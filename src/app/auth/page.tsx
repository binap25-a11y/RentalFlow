"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff, ArrowLeft, Sparkles } from "lucide-react";
import { useAuth, useFirestore, useUser } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp, initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { doc, getDoc, serverTimestamp, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { RENTALFLOW_LOGO_URL } from '@/lib/utils';

/**
 * @fileOverview Accelerated Authentication Pipeline.
 * Optimized for zero-latency redirection and atomic profile resolution.
 * Enhanced with premium visual feedback to reduce perceived wait time.
 */

export default function AuthPage() {
  const router = useRouter();
  const auth = useAuth();
  const db = useFirestore();
  const { user, isUserLoading } = useUser();
  const { toast } = useToast();

  const [isLoading, setIsLoading] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [role, setRole] = useState<'landlord' | 'tenant'>('landlord');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  
  const isRedirecting = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // HYPER-ACCELERATED REDIRECTION
  useEffect(() => {
    if (user && db && mounted && !isLoading && !isRedirecting.current) {
      const checkAndRedirect = async () => {
        try {
          isRedirecting.current = true;
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            const isProfileComplete = !!(userData.firstName && userData.lastName && userData.role && userData.phoneNumber);
            
            if (!isProfileComplete) {
              setNeedsProfile(true);
              isRedirecting.current = false;
              return;
            }
            
            // ATOMIC REDIRECT: Immediate jump to specific dashboard
            router.replace(userData.role === 'landlord' ? '/landlord/properties' : '/tenant/hub');
          } else {
            setNeedsProfile(true);
            isRedirecting.current = false;
          }
        } catch (e) {
          setNeedsProfile(true);
          isRedirecting.current = false;
        }
      };
      checkAndRedirect();
    }
  }, [user, db, router, mounted, isLoading]);

  const handleCreateProfile = async () => {
    if (!user || !db) return;
    if (!firstName.trim() || !lastName.trim() || !phoneNumber.trim()) {
      toast({ variant: "destructive", title: "Missing Info", description: "All fields required." });
      return;
    }

    setIsLoading(true);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      await updateProfile(user, { displayName });

      const userDocRef = doc(db, 'users', user.uid);
      await setDoc(userDocRef, {
        id: user.uid,
        email: user.email,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        role: role,
        plan: "free",
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (role === 'tenant' && user.email) {
        const emailLower = user.email.toLowerCase().trim();
        const tenantProfilesRef = collection(db, 'tenantProfiles');
        const q = query(tenantProfilesRef, where('email', '==', emailLower));
        const querySnapshot = await getDocs(q);
        
        for (const profileDoc of querySnapshot.docs) {
          await updateDoc(profileDoc.ref, { 
            userId: user.uid,
            tenantId: user.uid,
            memberIds: arrayUnion(user.uid)
          });
          const profileData = profileDoc.data();
          if (profileData.propertyId) {
            await updateDoc(doc(db, 'properties', profileData.propertyId), {
              tenantIds: arrayUnion(user.uid),
              memberIds: arrayUnion(user.uid)
            });
          }
        }
      }
      
      isRedirecting.current = true;
      router.replace(role === 'landlord' ? '/landlord/properties' : '/tenant/hub');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: e.message });
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (authMode === 'signup') await initiateEmailSignUp(auth, email, password);
      else await initiateEmailSignIn(auth, email, password);
    } catch (error: any) {
      setIsLoading(false);
      toast({ variant: "destructive", title: "Auth Failed", description: "Invalid credentials." });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await initiateGoogleSignIn(auth);
    } catch (error) {
      setIsLoading(false);
      toast({ variant: "destructive", title: "Session Interrupted" });
    }
  };

  if (!mounted || isUserLoading || (user && !needsProfile)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-[100]">
        <div className="flex flex-col items-center gap-6 animate-in fade-in duration-700">
          <div className="relative w-32 h-32 rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-primary/5 bg-card">
             <Image src={RENTALFLOW_LOGO_URL} alt="RentalFlow" fill className="object-cover" unoptimized priority />
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-5 h-5 animate-spin text-accent" />
              <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.4em] font-headline">Synchronizing Workspace</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (needsProfile && user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-left animate-in fade-in duration-700">
        <Card className="w-full max-w-xl border-none shadow-2xl bg-card overflow-hidden rounded-[3rem]">
          <CardHeader className="text-center bg-primary/5 pb-10 pt-12">
            <CardTitle className="text-3xl font-headline font-bold text-foreground tracking-tight">Identity Establishment</CardTitle>
            <CardDescription className="font-medium text-muted-foreground">Define your management or residency role.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-10 px-10 pb-12">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60 font-headline">First Name</Label>
                <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-bold text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60 font-headline">Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-bold text-foreground" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60 font-headline">Account Role</Label>
              <Tabs value={role} onValueChange={(v) => setRole(v as any)}>
                <TabsList className="grid w-full grid-cols-2 h-12 bg-muted/20 rounded-xl">
                  <TabsTrigger value="landlord" className="rounded-lg font-bold data-[state=active]:bg-accent data-[state=active]:text-white">Landlord</TabsTrigger>
                  <TabsTrigger value="tenant" className="rounded-lg font-bold data-[state=active]:bg-accent data-[state=active]:text-white">Resident</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground opacity-60 font-headline">Mobile Registry</Label>
              <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="h-12 rounded-xl bg-muted/20 border-none font-bold text-foreground" />
            </div>
            <Button className="w-full h-14 rounded-2xl font-bold bg-accent hover:bg-accent/90 text-white text-lg shadow-xl shadow-accent/20 border-none transition-all hover:scale-[1.01]" onClick={handleCreateProfile} disabled={isLoading}>
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : "Complete Registration"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 relative animate-in fade-in duration-1000">
      <div className="absolute top-8 left-8">
         <Button variant="ghost" asChild className="rounded-xl font-bold text-foreground hover:bg-primary/5"><Link href="/"><ArrowLeft className="w-4 h-4 mr-2" /> Return Home</Link></Button>
      </div>
      <div className="max-w-xl w-full text-center">
        <div className="mb-12 inline-flex flex-col items-center">
          <div className="relative h-24 w-24 rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-primary/5 mb-6 bg-card">
            <Image src={RENTALFLOW_LOGO_URL} alt="Logo" fill className="object-cover" unoptimized priority />
          </div>
          <h1 className="text-5xl font-headline font-bold text-foreground tracking-tighter">RentalFlow</h1>
        </div>
        <Card className="border-none shadow-2xl rounded-[3rem] p-2 bg-card">
          <CardHeader className="pt-10 pb-6 text-center">
            <CardTitle className="text-3xl font-headline font-bold text-foreground">Authentication</CardTitle>
            <CardDescription className="font-medium">Secure access to your property vault.</CardDescription>
          </CardHeader>
          <CardContent className="px-10 pb-12 space-y-6">
            <Button variant="outline" className="w-full h-14 rounded-2xl font-bold border-border bg-muted/10 hover:bg-muted/20 text-foreground" onClick={handleGoogleSignIn} disabled={isLoading}>
              Access with Google
            </Button>
            <div className="relative my-4"><div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/10"></span></div><div className="relative flex justify-center text-[10px] uppercase font-bold text-muted-foreground tracking-widest"><span className="bg-card px-4">or use internal mail</span></div></div>
            <form onSubmit={handleSubmit} className="space-y-6 text-left">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground opacity-60 font-headline">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="h-12 rounded-xl bg-muted/20 border-none font-bold text-foreground" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground opacity-60 font-headline">Password</Label>
                <div className="relative">
                  <Input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="h-12 rounded-xl bg-muted/20 border-none font-bold pr-12 text-foreground" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-3 text-muted-foreground/40 hover:text-accent">
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full h-14 rounded-2xl font-extrabold bg-accent hover:bg-accent/90 text-white text-xl shadow-xl shadow-accent/20 border-none transition-all hover:scale-[1.01]" disabled={isLoading}>
                {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : (authMode === 'login' ? 'Enter Vault' : 'Initialize Credentials')}
              </Button>
            </form>
            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full text-xs font-bold text-muted-foreground hover:text-accent transition-all font-headline uppercase tracking-widest mt-6">
              {authMode === 'login' ? "Register Professional Portfolio" : "Return to Access Hub"}
            </button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
