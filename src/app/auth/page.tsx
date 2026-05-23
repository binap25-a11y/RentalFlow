"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Eye, EyeOff, User as UserIcon, Phone, CheckCircle2, Lock, Sparkles, ShieldCheck, ArrowLeft } from "lucide-react";
import { useAuth, useFirestore, useUser } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp, initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { doc, getDoc, serverTimestamp, setDoc, collection, query, where, getDocs, updateDoc, arrayUnion } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import Link from 'next/link';
import { RENTALFLOW_NEUTRAL_FALLBACK } from '@/lib/utils';

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

  const BRAND_LOGO_URL = RENTALFLOW_NEUTRAL_FALLBACK;

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
          console.error("Profile check failed:", e);
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
        plan: "free", // Initialize with basic access
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      if (role === 'tenant' && user.email) {
        const emailLower = user.email.toLowerCase().trim();
        const tenantProfilesRef = collection(db, 'tenantProfiles');
        const q = query(tenantProfilesRef, where('email', '==', emailLower));
        const querySnapshot = await getDocs(q);
        
        for (const profileDoc of querySnapshot.docs) {
          const profileData = profileDoc.data();
          
          await updateDoc(profileDoc.ref, { 
            userId: user.uid,
            tenantId: user.uid,
            memberIds: arrayUnion(user.uid)
          });
          
          if (profileData.propertyId) {
            const propertyRef = doc(db, 'properties', profileData.propertyId);
            await updateDoc(propertyRef, {
              tenantIds: arrayUnion(user.uid),
              memberIds: arrayUnion(user.uid)
            });
          }
        }
      }
      
      await user.getIdToken(true);
      toast({ title: "Profile Ready", description: `Welcome to RentalFlow.` });
      
      isRedirecting.current = true;
      router.replace(role === 'landlord' ? '/landlord/dashboard' : '/tenant/hub');
    } catch (e: any) {
      console.error("Profile synchronization failed:", e);
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
      let message = "An error occurred during authentication.";
      if (error.code === 'auth/invalid-credential') message = "The credentials provided are invalid.";
      else if (error.code === 'auth/email-already-in-use') message = "This email is already registered.";
      
      toast({ variant: "destructive", title: "Authentication Failed", description: message });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await initiateGoogleSignIn(auth);
    } catch (error: any) {
      console.error("Google Auth Session Failed:", error);
      toast({ 
        variant: "destructive", 
        title: "Google Session Failed", 
        description: error.message || "Ensure popups are enabled and try again."
      });
      setIsLoading(false);
    }
  };

  if (!mounted || isUserLoading || (user && !needsProfile && !isRedirecting.current)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background overflow-hidden px-4">
        <div className="relative flex flex-col items-center">
          <div className="relative w-32 h-32 mb-10 animate-in fade-in zoom-in-95 duration-1000 slide-in-from-bottom-12">
            <div className="absolute inset-0 bg-primary/10 rounded-[2.5rem] blur-3xl animate-pulse" />
            <div className="relative z-10 w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl ring-4 ring-background">
               <Image 
                src={BRAND_LOGO_URL} 
                alt="RentalFlow" 
                fill 
                className="object-cover" 
                unoptimized 
                priority
              />
            </div>
          </div>
          
          <div className="flex flex-col items-center gap-5 animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-300">
            <h1 className="text-5xl font-headline font-bold text-primary tracking-tighter">RentalFlow</h1>
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-primary opacity-60" />
                <p className="text-sm font-bold text-muted-foreground uppercase tracking-[0.4em] font-headline">Secure Ledger Sync</p>
              </div>
              <div className="flex items-center gap-2 px-6 py-2.5 bg-card rounded-full border border-primary/5 shadow-xl transition-all">
                <Lock className="w-3.5 h-3.5 text-emerald-500" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-headline">Enterprise Grade Security Active</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (needsProfile && user) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 sm:p-12">
        <Card className="w-full max-w-xl border-none shadow-2xl bg-card overflow-hidden animate-in zoom-in-95 duration-500 rounded-[3rem]">
          <CardHeader className="text-center bg-primary/5 pb-10 pt-12">
            <div className="mx-auto p-1 bg-background rounded-2xl w-fit mb-6 shadow-xl overflow-hidden ring-4 ring-background">
               <Image 
                src={BRAND_LOGO_URL} 
                alt="RentalFlow" 
                width={80} 
                height={80} 
                className="rounded-2xl object-cover" 
                unoptimized 
                priority
              />
            </div>
            <CardTitle className="text-3xl font-headline font-bold text-primary">Identity Establishment</CardTitle>
            <CardDescription className="font-medium text-lg text-muted-foreground">Define your management or residency profile.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-8 pt-10 px-12 pb-14 text-left">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-headline">First Name</Label>
                <div className="relative">
                  <UserIcon className="absolute left-4 top-3.5 h-4.5 w-4.5 text-primary/20" />
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className="pl-12 h-13 rounded-2xl border-none bg-muted/20 font-body font-bold" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-headline">Last Name</Label>
                <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="h-13 rounded-2xl border-none bg-muted/20 font-body font-bold" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-headline">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-4 top-3.5 h-4.5 w-4.5 text-primary/20" />
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+44 7700 900000" className="pl-12 h-13 rounded-2xl border-none bg-muted/20 font-body font-bold" />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-bold uppercase tracking-widest text-muted-foreground font-headline">Define Role</Label>
              <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/20 p-1.5 rounded-2xl h-14">
                  <TabsTrigger value="landlord" className="rounded-xl font-bold font-headline text-sm data-[state=active]:bg-primary data-[state=active]:text-white">Portfolio Manager</TabsTrigger>
                  <TabsTrigger value="tenant" className="rounded-xl font-bold font-headline text-sm data-[state=active]:bg-primary data-[state=active]:text-white">Property Resident</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Button className="w-full h-15 rounded-2xl font-bold bg-primary text-white text-lg shadow-2xl shadow-primary/20 font-headline hover:scale-[1.02] active:scale-95 transition-all" onClick={handleCreateProfile} disabled={isLoading || !firstName || !lastName || !phoneNumber}>
              {isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : <><CheckCircle2 className="w-6 h-6 mr-3" /> Complete Registration</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 sm:p-12 overflow-hidden relative">
      <div className="absolute top-8 left-8 z-20">
         <Button variant="ghost" asChild className="rounded-xl font-bold text-foreground">
            <Link href="/"><ArrowLeft className="w-4 h-4 mr-2" /> Back to Home</Link>
         </Button>
      </div>

      <div className="absolute top-0 left-0 w-full h-full opacity-10 dark:opacity-20 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent rounded-full blur-[120px]" />
      </div>

      <div className="mb-12 text-center animate-in fade-in slide-in-from-top-12 duration-1000 relative z-10">
        <div className="inline-flex items-center justify-center p-1.5 bg-card rounded-[2.75rem] mb-8 shadow-2xl ring-1 ring-primary/5 overflow-hidden">
           <Image 
            src={BRAND_LOGO_URL} 
            alt="RentalFlow" 
            width={110} 
            height={110} 
            className="rounded-[2.5rem] object-cover" 
            unoptimized 
            priority
          />
        </div>
        <h1 className="text-6xl font-headline font-bold text-foreground mb-3 tracking-tighter">RentalFlow</h1>
        <p className="text-muted-foreground font-medium font-body opacity-80 uppercase tracking-[0.2em] text-sm">Premium Portfolio Ledger</p>
      </div>

      <div className="max-w-xl w-full relative z-10">
        <Card className="w-full border-none shadow-[0_32px_64px_-12px_rgba(0,0,0,0.14)] bg-card overflow-hidden rounded-[3.5rem] p-2">
          <CardHeader className="space-y-2 pb-6 text-center bg-primary/[0.02] pt-12 rounded-[3rem]">
            <CardTitle className="text-3xl font-headline font-bold text-foreground">
              {authMode === 'login' ? 'Authentication' : 'Registration'}
            </CardTitle>
            <CardDescription className="font-medium text-muted-foreground">
              {authMode === 'login' ? 'Secure access to your management vault' : 'Establish your professional presence'}
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-10 px-10 pb-12">
            <div className="space-y-6">
              <Button 
                variant="outline" 
                className="w-full h-16 rounded-[1.75rem] font-bold border-primary/10 hover:bg-muted/50 font-headline text-foreground shadow-sm text-lg" 
                onClick={handleGoogleSignIn} 
                disabled={isLoading}
              >
                <svg className="w-6 h-6 mr-4" viewBox="0 0 24 24">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-3.3 3.28-8.19 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.16H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.84l3.66-2.75z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.16l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    fill="#EA4335"
                  />
                </svg>
                Continue with Google
              </Button>

              <div className="relative my-8">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-muted/50"></span>
                </div>
                <div className="relative flex justify-center text-[10px] uppercase">
                  <span className="bg-card px-6 text-muted-foreground font-bold tracking-[0.4em] font-headline">or use electronic mail</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-2 text-left">
                  <Label htmlFor="email" className="font-bold text-xs uppercase text-muted-foreground tracking-widest font-headline">Email Address</Label>
                  <Input id="email" type="email" placeholder="name@domain.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-2xl h-14 border-none bg-muted/20 font-body font-bold text-lg px-6" />
                </div>
                <div className="space-y-2 text-left">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="password" title="Password" className="font-bold text-xs uppercase text-muted-foreground tracking-widest font-headline">Password</Label>
                    <button type="button" className="text-[10px] font-bold text-accent uppercase tracking-widest hover:underline">Reset</button>
                  </div>
                  <div className="relative">
                    <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-2xl h-14 border-none bg-muted/20 font-body font-bold text-lg px-6 pr-12" />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-4 text-primary/30 hover:text-primary transition-colors">
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>
                <Button type="submit" className="w-full h-16 rounded-[1.75rem] font-bold bg-primary text-white text-xl shadow-2xl shadow-primary/20 font-headline hover:scale-[1.01] active:scale-95 transition-all" disabled={isLoading}>
                  {isLoading ? <Loader2 className="w-6 h-6 animate-spin text-white" /> : (authMode === 'login' ? 'Access Vault' : 'Create Credentials')}
                </Button>
              </form>
            </div>

            <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full mt-10 text-xs font-bold text-muted-foreground hover:text-primary transition-all font-headline uppercase tracking-widest">
              {authMode === 'login' ? "New to the platform? Create account" : "Return to authentication screen"}
            </button>
          </CardContent>
        </Card>
      </div>

      <div className="mt-16 flex flex-wrap justify-center items-center gap-10 opacity-30 grayscale hover:grayscale-0 transition-all duration-700">
         <div className="flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-foreground" />
            <span className="text-[10px] font-bold text-foreground uppercase tracking-[0.3em] font-headline">UK Compliant Architecture</span>
         </div>
         <div className="flex items-center gap-3">
            <Sparkles className="w-5 h-5 text-foreground" />
            <span className="text-[10px] font-bold text-foreground uppercase tracking-[0.3em] font-headline">AI-Driven Management</span>
         </div>
      </div>
    </div>
  );
}
