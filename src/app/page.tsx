"use client";

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Home, KeyRound, LayoutDashboard, Mail, Lock, UserPlus, LogIn, Chrome, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth, useFirestore, useUser, setDocumentNonBlocking } from '@/firebase';
import { initiateEmailSignIn, initiateEmailSignUp, initiateGoogleSignIn, initiatePasswordReset } from '@/firebase/non-blocking-login';
import { doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

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
  const [resetEmail, setResetEmail] = useState('');
  const [role, setRole] = useState<'landlord' | 'tenant'>('landlord');
  
  const isRedirecting = useRef(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user && db && mounted && !isLoading && !isRedirecting.current) {
      const checkAndRedirect = async () => {
        isRedirecting.current = true;
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (userDoc.exists()) {
            const userData = userDoc.data();
            if (userData?.role === 'landlord') {
              router.replace('/landlord/dashboard');
            } else if (userData?.role === 'tenant') {
              router.replace('/tenant/hub');
            } else {
              // No role found, allow them to choose (unlikely if they signed up correctly)
              isRedirecting.current = false;
            }
          } else {
            // New user, wait for sign-up completion to create doc
            isRedirecting.current = false;
          }
        } catch (e) {
          console.error("Redirect check failed:", e);
          isRedirecting.current = false;
        }
      };
      checkAndRedirect();
    }
  }, [user, db, router, mounted, isLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        await initiateEmailSignUp(auth, email, password);
        const newUser = auth.currentUser;
        if (newUser) {
          const userDocRef = doc(db, 'users', newUser.uid);
          await setDocumentNonBlocking(userDocRef, {
            id: newUser.uid,
            email: newUser.email,
            role: role,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }, { merge: true });
          
          toast({ title: "Account created", description: "Welcome to RentalFlow." });
          // Redirection will be handled by the useEffect
        }
      } else {
        await initiateEmailSignIn(auth, email, password);
        toast({ title: "Welcome back", description: "Successfully signed in." });
      }
    } catch (error: any) {
      setIsLoading(false);
      let message = "An unexpected error occurred. Please try again.";
      if (error.code === 'auth/invalid-credential') message = "Invalid email or password.";
      else if (error.code === 'auth/email-already-in-use') message = "Email already in use.";
      
      toast({ variant: "destructive", title: "Authentication Failed", description: message });
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

  const handleResetPassword = async () => {
    if (!resetEmail) {
      toast({ variant: "destructive", title: "Email required", description: "Please enter your email." });
      return;
    }
    try {
      await initiatePasswordReset(auth, resetEmail);
      toast({ title: "Reset link sent", description: "Check your email inbox." });
    } catch (error) {
      toast({ variant: "destructive", title: "Reset Failed", description: "Could not send reset link." });
    }
  };

  if (!mounted || (isUserLoading && !user)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center">
          <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
          <p className="text-muted-foreground font-medium animate-pulse">Initializing RentalFlow...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center animate-in fade-in slide-in-from-top-4 duration-1000">
        <div className="inline-flex items-center justify-center p-3 bg-primary text-primary-foreground rounded-2xl mb-4 shadow-xl shadow-primary/20">
          <KeyRound className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-headline font-bold text-primary mb-2 tracking-tight">RentalFlow</h1>
        <p className="text-muted-foreground font-medium">Rental Management Reimagined</p>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-2 text-center">
          <CardTitle className="text-2xl font-headline font-bold text-primary">
            {authMode === 'login' ? 'Welcome Back' : 'Join RentalFlow'}
          </CardTitle>
          <CardDescription className="font-medium">
            {authMode === 'login' ? 'Sign in to your portal' : 'Create your management account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1 rounded-xl">
              <TabsTrigger value="landlord" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg font-bold">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Landlord
              </TabsTrigger>
              <TabsTrigger value="tenant" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground rounded-lg font-bold">
                <Home className="w-4 h-4 mr-2" />
                Resident
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2 text-left">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-10 h-11 rounded-xl"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2 text-left">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {authMode === 'login' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="text-xs text-primary font-bold hover:underline focus:outline-none">
                          Forgot password?
                        </button>
                      </DialogTrigger>
                      <DialogContent className="rounded-2xl">
                        <DialogHeader>
                          <DialogTitle className="font-headline font-bold">Reset Password</DialogTitle>
                          <DialogDescription>
                            Enter your email to receive a reset link.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label htmlFor="reset-email">Email Address</Label>
                          <Input 
                            id="reset-email" 
                            type="email" 
                            placeholder="name@example.com"
                            className="h-11 rounded-xl mt-2"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                          />
                        </div>
                        <DialogFooter>
                          <Button onClick={handleResetPassword} className="rounded-xl w-full h-11 font-bold shadow-lg shadow-primary/10">Send Reset Link</Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="password" 
                    type={showPassword ? "text" : "password"} 
                    className="pl-10 pr-10 h-11 rounded-xl"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required 
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-3 text-muted-foreground hover:text-primary transition-colors focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit"
                className={`w-full h-12 text-base rounded-xl transition-all duration-300 transform active:scale-[0.98] font-bold shadow-lg ${role === 'landlord' ? 'bg-primary hover:bg-primary/90 shadow-primary/20' : 'bg-accent hover:bg-accent/90 shadow-accent/20'}`} 
                disabled={isLoading}
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  authMode === 'login' ? (
                    <span className="flex items-center"><LogIn className="w-4 h-4 mr-2" /> Login</span>
                  ) : (
                    <span className="flex items-center"><UserPlus className="w-4 h-4 mr-2" /> Create Account</span>
                  )
                )}
              </Button>
            </form>

            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-muted-foreground/20"></span>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-white px-2 text-muted-foreground font-bold">Or continue with</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-11 border-muted-foreground/20 hover:bg-muted/50 rounded-xl mb-4 font-bold"
              onClick={handleGoogleSignIn}
              disabled={isLoading}
            >
              <Chrome className="w-4 h-4 mr-2 text-red-500" />
              Sign in with Google
            </Button>

            <div className="text-center">
              <button 
                type="button"
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors focus:outline-none"
              >
                {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </Tabs>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-xs text-muted-foreground opacity-60 font-medium">
        &copy; 2024 RentalFlow Systems. Secure property management.
      </p>
    </div>
  );
}