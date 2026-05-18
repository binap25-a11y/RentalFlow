"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, Loader2, Eye, EyeOff, ShieldCheck, Chrome, User as UserIcon, Phone, CheckCircle2 } from "lucide-react";
import { useAuth, useFirestore, useUser } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp, initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { doc, getDoc, serverTimestamp, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';

export default function LoginPage() {
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

  // High-resolution blue key brand seed - synchronized across app
  const LOGO_URL = 'https://picsum.photos/seed/rentflow-blue-key-v12/512/512';

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user && db && mounted && !isLoading && !isRedirecting.current) {
      const checkAndRedirect = async () => {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (!userData.firstName || !userData.lastName || !userData.role || !userData.phoneNumber) {
              setNeedsProfile(true);
              return;
            }

            if (isRedirecting.current) return;
            isRedirecting.current = true;
            
            router.replace(userData?.role === 'landlord' ? '/landlord/dashboard' : '/tenant/hub');
          } else {
            setNeedsProfile(true);
          }
        } catch (e) {
          setNeedsProfile(true);
        }
      };
      checkAndRedirect();
    }
  }, [user, db, router, mounted, isLoading]);

  const handleCreateProfile = async () => {
    if (!user || !db) return;
    if (!firstName.trim() || !lastName.trim() || !phoneNumber.trim()) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please fill in all details." });
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
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (role === 'tenant' && user.email) {
        const tenantProfilesRef = collection(db, 'tenantProfiles');
        const q = query(tenantProfilesRef, where('email', '==', user.email.toLowerCase().trim()));
        const querySnapshot = await getDocs(q);
        
        for (const profileDoc of querySnapshot.docs) {
          const profileData = profileDoc.data();
          await updateDoc(profileDoc.ref, { 
            userId: user.uid,
            tenantId: user.uid,
            memberIds: arrayUnion(user.uid)
          });
          const propertyRef = doc(db, 'properties', profileData.propertyId);
          await updateDoc(propertyRef, {
            tenantIds: arrayUnion(user.uid),
            memberIds: arrayUnion(user.uid)
          });
        }
      }
      
      await user.getIdToken(true);
      toast({ title: "Profile Ready", description: `Welcome to RentalFlow.` });
      
      isRedirecting.current = true;
      router.replace(role === 'landlord' ? '/landlord/dashboard' : '/tenant/hub');
    } catch (e: any) {
      toast({ variant: "destructive", title: "Setup Failed", description: e.message });
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        await initiateEmailSignUp(auth, email, password);
        toast({ title: "Account Created", description: "Please complete your profile details." });
      } else {
        await initiateEmailSignIn(auth, email, password);
      }
    } catch (error: any) {
      setIsLoading(false);
      let message = "An error occurred.";
      if (error.code === 'auth/invalid-credential') message = "Invalid email or password.";
      else if (error.code === 'auth/email-already-in-use') message = "Email already in use.";
      
      toast({ variant: "destructive", title: "Auth Error", description: message });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await initiateGoogleSignIn(auth);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Google Login Failed" });
      setIsLoading(false);
    }
  };

  if (!mounted || isUserLoading || (user && !needsProfile && !isRedirecting.current)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24 mb-4">
            <Image 
              src={LOGO_URL} 
              alt="Logo" 
              fill 
              className="object-contain rounded-[2rem] shadow-xl" 
              unoptimized 
            />
          </div>
          <Loader2 className="w-10 h-10 animate-spin text-primary" />
          <p className="text-sm font-medium text-muted-foreground animate-pulse">Authenticating Portfolio Access...</p>
        </div>
      </div>
    );
  }

  if (needsProfile && user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg border-none shadow-2xl bg-white overflow-hidden animate-in zoom-in duration-300 rounded-[2.5rem]">
          <CardHeader className="text-center bg-primary/5 pb-8 pt-10">
            <div className="mx-auto p-1 bg-white rounded-2xl w-fit mb-4 shadow-sm">
               <Image 
                src={LOGO_URL} 
                alt="RentalFlow" 
                width={72} 
                height={72} 
                className="rounded-2xl" 
                unoptimized 
              />
            </div>
            <CardTitle className="text-2xl font-headline font-bold text-primary">Identity Establishment</CardTitle>
            <CardDescription>Establish your professional profile on RentalFlow.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-8 px-10 pb-12">
            <div className="grid grid-cols-2 gap-4 text-left">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className="pl-10 h-11 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2 text-left">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+44 7700 900000" className="pl-10 h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-4 text-left">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Role</Label>
              <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl h-12">
                  <TabsTrigger value="landlord" className="rounded-lg font-bold">Landlord</TabsTrigger>
                  <TabsTrigger value="tenant" className="rounded-lg font-bold">Resident</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Button className="w-full h-14 rounded-xl font-bold bg-primary text-lg shadow-lg shadow-primary/20" onClick={handleCreateProfile} disabled={isLoading || !firstName || !lastName || !phoneNumber}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5 mr-2" /> Complete Registration</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-10 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="inline-flex items-center justify-center p-1 bg-white rounded-[2.5rem] mb-6 shadow-2xl">
           <Image 
            src={LOGO_URL} 
            alt="RentalFlow" 
            width={100} 
            height={100} 
            className="rounded-[2.25rem]" 
            unoptimized 
          />
        </div>
        <h1 className="text-5xl font-headline font-bold text-primary mb-2 tracking-tighter">RentalFlow</h1>
        <p className="text-muted-foreground font-medium text-lg">Professional Portfolio Management</p>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white overflow-hidden rounded-[2.5rem]">
        <CardHeader className="space-y-1 pb-4 text-center bg-primary/5 pt-8">
          <CardTitle className="text-2xl font-headline font-bold text-primary">
            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {authMode === 'login' ? 'Sign in to access your ledger' : 'Establish your management presence'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8 px-8 pb-10">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-12" />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-12" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-muted-foreground">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-14 rounded-xl font-bold bg-primary text-lg shadow-lg shadow-primary/20" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (authMode === 'login' ? 'Login' : 'Sign Up')}
            </Button>
          </form>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-4 text-muted-foreground font-bold tracking-widest">secure gateway</span>
            </div>
          </div>

          <Button variant="outline" className="w-full h-12 rounded-xl mb-6 font-bold border-primary/10 hover:bg-primary/5" onClick={handleGoogleSignIn} disabled={isLoading}>
            <Chrome className="w-5 h-5 mr-3 text-red-500" />
            Continue with Google
          </Button>

          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full text-sm font-bold text-primary/60 hover:text-primary transition-colors">
            {authMode === 'login' ? "New to RentalFlow? Register here" : "Return to login screen"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}