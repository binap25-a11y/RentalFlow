
"use client";

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (user && db && mounted) {
      const checkProfile = async () => {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userDocRef);

          if (!userDoc.exists()) {
            setDocumentNonBlocking(userDocRef, {
              id: user.uid,
              email: user.email,
              role: role,
              externalAuthId: user.uid,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            }, { merge: true });
            
            router.push(role === 'landlord' ? '/landlord/dashboard' : '/tenant/hub');
          } else {
            const userData = userDoc.data();
            if (userData?.role === 'landlord') {
              router.push('/landlord/dashboard');
            } else if (userData?.role === 'tenant') {
              router.push('/tenant/hub');
            }
          }
        } catch (e) {
          // Errors are handled gracefully or by global listener if configured
        }
      };
      checkProfile();
    }
  }, [user, db, router, role, mounted]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (authMode === 'signup') {
        await initiateEmailSignUp(auth, email, password);
        toast({ title: "Account created", description: "Your RentalFlow profile is ready." });
      } else {
        await initiateEmailSignIn(auth, email, password);
        toast({ title: "Welcome back", description: "Successfully signed in." });
      }
    } catch (error: any) {
      // Do not use console.error() as it triggers the Next.js Error Overlay in development
      let message = "An unexpected error occurred. Please try again.";
      
      if (error.code === 'auth/invalid-credential') {
        message = "Invalid email or password. Please check your credentials.";
      } else if (error.code === 'auth/email-already-in-use') {
        message = "An account with this email already exists.";
      } else if (error.code === 'auth/weak-password') {
        message = "Password should be at least 6 characters.";
      } else if (error.code === 'auth/user-not-found') {
        message = "No account found with this email.";
      } else if (error.code === 'auth/wrong-password') {
        message = "Incorrect password.";
      }

      toast({
        variant: "destructive",
        title: "Authentication Failed",
        description: message,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    try {
      await initiateGoogleSignIn(auth);
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Google Sign-In Failed",
        description: "Could not connect to Google. Please try again.",
      });
    } finally {
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

  if (!mounted || isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse flex flex-col items-center">
          <KeyRound className="w-12 h-12 text-primary mb-4" />
          <p className="text-muted-foreground font-medium">Loading RentalFlow...</p>
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
        <h1 className="text-4xl font-headline font-bold text-primary mb-2">RentalFlow</h1>
        <p className="text-muted-foreground font-medium">Rental Management Reimagined</p>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-2xl text-center">
            {authMode === 'login' ? 'Welcome Back' : 'Join RentalFlow'}
          </CardTitle>
          <CardDescription className="text-center">
            {authMode === 'login' ? 'Sign in to your rental portal' : 'Create your rental management account'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={role} onValueChange={(v) => setRole(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6 bg-muted/50 p-1">
              <TabsTrigger value="landlord" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Landlord
              </TabsTrigger>
              <TabsTrigger value="tenant" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                <Home className="w-4 h-4 mr-2" />
                Resident
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input 
                    id="email" 
                    type="email" 
                    placeholder="name@example.com" 
                    className="pl-10"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required 
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  {authMode === 'login' && (
                    <Dialog>
                      <DialogTrigger asChild>
                        <button type="button" className="text-xs text-primary hover:underline font-medium">
                          Forgot password?
                        </button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Reset Password</DialogTitle>
                          <DialogDescription>
                            Enter your email address to receive a reset link.
                          </DialogDescription>
                        </DialogHeader>
                        <div className="py-4">
                          <Label htmlFor="reset-email">Email Address</Label>
                          <Input 
                            id="reset-email" 
                            type="email" 
                            placeholder="name@example.com"
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                          />
                        </div>
                        <DialogFooter>
                          <Button onClick={handleResetPassword}>Send Reset Link</Button>
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
                    className="pl-10 pr-10"
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
                className={`w-full h-12 text-base transition-all duration-300 transform active:scale-[0.98] ${role === 'landlord' ? 'bg-primary hover:bg-primary/90' : 'bg-accent hover:bg-accent/90'}`} 
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
                <span className="bg-background px-2 text-muted-foreground font-medium">Or continue with</span>
              </div>
            </div>

            <Button 
              variant="outline" 
              className="w-full h-11 border-muted-foreground/20 hover:bg-muted/50 rounded-xl mb-4"
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
                className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors"
              >
                {authMode === 'login' ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
              </button>
            </div>
          </Tabs>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-xs text-muted-foreground opacity-60">
        &copy; 2024 RentalFlow Systems. Secure property management.
      </p>
    </div>
  );
}
