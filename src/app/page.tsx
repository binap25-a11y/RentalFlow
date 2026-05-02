"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KeyRound, Loader2, Eye, EyeOff, ShieldCheck, Chrome, User, Phone, CheckCircle2 } from "lucide-react";
import { useAuth, useFirestore, useUser, setDocumentNonBlocking } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp, initiateGoogleSignIn } from '@/firebase/non-blocking-login';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { sendEmailVerification } from 'firebase/auth';
import { useToast } from '@/hooks/use-toast';

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
  
  // Profile Setup State
  const [role, setRole] = useState<'landlord' | 'tenant'>('landlord');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [needsProfile, setNeedsProfile] = useState(false);
  
  const isRedirecting = useRef(false);

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
            isRedirecting.current = true;
            const userData = userDoc.data();
            if (userData?.role === 'landlord') {
              router.replace('/landlord/dashboard');
            } else if (userData?.role === 'tenant') {
              router.replace('/tenant/hub');
            }
          } else {
            setNeedsProfile(true);
          }
        } catch (e) {
          // Standard permission errors handled by FirebaseErrorListener
        }
      };
      checkAndRedirect();
    }
  }, [user, db, router, mounted, isLoading]);

  const handleCreateProfile = async () => {
    if (!user || !db) return;
    if (!firstName || !lastName || !phoneNumber) {
      toast({ variant: "destructive", title: "Missing Information", description: "Please provide your name and contact number." });
      return;
    }

    setIsLoading(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      
      setDocumentNonBlocking(userDocRef, {
        id: user.uid,
        email: user.email,
        firstName,
        lastName,
        phoneNumber,
        role: role,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
      
      try {
        await sendEmailVerification(user);
        toast({ title: "Profile Ready", description: "Verification email sent. Welcome to RentalFlow!" });
      } catch (err) {
        toast({ title: "Profile established", description: `Welcome as a ${role}.` });
      }
      
      isRedirecting.current = true;
      if (role === 'landlord') {
        router.replace('/landlord/dashboard');
      } else {
        router.replace('/tenant/hub');
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Setup Failed", description: "Could not establish your profile." });
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        await initiateEmailSignUp(auth, email, password);
        toast({ title: "Account created", description: "Please complete your identity details." });
      } else {
        await initiateEmailSignIn(auth, email, password);
        toast({ title: "Welcome back", description: "Signed in successfully." });
      }
    } catch (error: any) {
      setIsLoading(false);
      let message = "An error occurred. Please try again.";
      if (error.code === 'auth/invalid-credential') message = "Invalid email or password.";
      else if (error.code === 'auth/email-already-in-use') message = "Email already in use.";
      
      toast({ variant: "destructive", title: "Auth Failed", description: message });
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await initiateGoogleSignIn(auth);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Google Sign-In Failed", description: "Please try again." });
      setIsLoading(false);
    }
  };

  if (!mounted || (isUserLoading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
      </div>
    );
  }

  if (needsProfile) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
        <Card className="w-full max-w-lg border-none shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden">
          <CardHeader className="text-center bg-primary/5 pb-8">
            <div className="mx-auto p-3 bg-primary text-primary-foreground rounded-2xl w-fit mb-4">
              <ShieldCheck className="w-8 h-8" />
            </div>
            <CardTitle className="text-2xl font-headline font-bold text-primary">Identity Establishment</CardTitle>
            <CardDescription>
              Authenticated as <span className="text-primary font-bold">{user?.email}</span>. Complete your details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6 pt-8">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">First Name</Label>
                <div className="relative">
                  <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Jane" className="pl-10 h-11 rounded-xl" />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Last Name</Label>
                <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Doe" className="h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+44 7700 900000" className="pl-10 h-11 rounded-xl" />
              </div>
            </div>

            <div className="space-y-4">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Select Your Portal Role</Label>
              <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="w-full">
                <TabsList className="grid w-full grid-cols-2 bg-muted/50 p-1 rounded-xl h-12">
                  <TabsTrigger value="landlord" className="rounded-lg font-bold">Landlord</TabsTrigger>
                  <TabsTrigger value="tenant" className="rounded-lg font-bold">Resident</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>

            <Button className="w-full h-12 rounded-xl font-bold bg-primary text-lg shadow-lg shadow-primary/20" onClick={handleCreateProfile} disabled={isLoading || !firstName || !lastName || !phoneNumber}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><CheckCircle2 className="w-5 h-5 mr-2" /> Enter My Portal</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="inline-flex items-center justify-center p-3 bg-primary text-primary-foreground rounded-2xl mb-4 shadow-xl">
          <KeyRound className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-headline font-bold text-primary mb-2 tracking-tight">RentalFlow</h1>
        <p className="text-muted-foreground font-medium">Professional Property Management</p>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-sm overflow-hidden">
        <CardHeader className="space-y-1 pb-4 text-center bg-primary/5">
          <CardTitle className="text-2xl font-headline font-bold text-primary">
            {authMode === 'login' ? 'Welcome Back' : 'Create Account'}
          </CardTitle>
          <CardDescription>
            {authMode === 'login' ? 'Sign in to access your properties' : 'Join the RentalFlow ecosystem'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2 text-left">
              <Label htmlFor="email">Work Email</Label>
              <Input id="email" type="email" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11" />
            </div>
            <div className="space-y-2 text-left">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} required className="rounded-xl h-11" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3 text-muted-foreground hover:text-primary transition-colors">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full h-12 rounded-xl font-bold bg-primary text-lg" disabled={isLoading}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (authMode === 'login' ? 'Login' : 'Sign Up')}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t"></span>
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-4 text-muted-foreground font-bold tracking-widest">Secure Connect</span>
            </div>
          </div>

          <Button variant="outline" className="w-full h-12 rounded-xl mb-6 font-bold border-primary/10 hover:bg-primary/5 hover:border-primary/20 transition-all" onClick={handleGoogleSignIn} disabled={isLoading}>
            <Chrome className="w-5 h-5 mr-3 text-red-500" />
            Continue with Google
          </Button>

          <button onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')} className="w-full text-sm font-bold text-primary/60 hover:text-primary transition-colors">
            {authMode === 'login' ? "New to RentalFlow? Create an account" : "Already registered? Log in here"}
          </button>
        </CardContent>
      </Card>
    </div>
  );
}