
"use client";

import { useState, useEffect } from 'react';
import { useUser, useAuth, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { 
  User, Mail, Phone, Loader2, Save, Camera, Crown, ShieldCheck, Zap
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Header } from "@/components/dashboard/header";
import { uploadToSupabase } from '@/lib/actions/supabase-storage';
import { compressImage } from '@/lib/utils';
import { Badge } from "@/components/ui/badge";

/**
 * @fileOverview Account Specs Hub.
 * Integrated with Subscription Plan management.
 */

export default function ProfilePage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [isAdminEscalated, setIsAdminEscalated] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (user) {
      user.getIdTokenResult(true).then(result => {
        setIsAdminEscalated(!!result.claims.admin || !!result.claims.premium);
      });
    }
  }, [user]);

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    if (profile) {
      setFirstName(profile.firstName || '');
      setLastName(profile.lastName || '');
      setPhoneNumber(profile.phoneNumber || '');
    }
  }, [profile]);

  const isPro = profile?.plan === 'pro' || isAdminEscalated;

  const handleUpgrade = async () => {
    if (!user || !user.email) return;
    setIsUpgrading(true);
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.uid,
          email: user.email,
        }),
      });

      const data = await response.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || 'Billing offline');
      }
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Sync Delayed", 
        description: "Billing orchestration is handing peak load. Please try again." 
      });
      setIsUpgrading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setIsUploading(true);
    try {
      const compressedBlob = await compressImage(file, 400, 0.8);
      const path = `${user.uid}/${Date.now()}-avatar.jpg`;
      
      const formData = new FormData();
      formData.append('file', compressedBlob, 'avatar.jpg');
      
      const result = await uploadToSupabase(formData, 'Property-Images-', path);
      if (!result.success) throw new Error(result.error);

      await updateProfile(user, { photoURL: result.url });
      toast({ title: "Identity Updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: error.message });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !userDocRef) return;

    setIsSaving(true);
    try {
      const displayName = `${firstName.trim()} ${lastName.trim()}`;
      await updateProfile(user, { displayName });

      await setDoc(userDocRef, {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phoneNumber: phoneNumber.trim(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: "Account Specs Updated" });
    } catch (error) {
      toast({ variant: "destructive", title: "Sync Failed" });
    } finally {
      setIsSaving(false);
    }
  };

  if (isUserLoading || isProfileLoading) return <div className="flex h-screen items-center justify-center bg-background"><Loader2 className="animate-spin text-primary" /></div>;
  if (!profile) return null;

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background font-body">
        <SidebarNav 
          role={profile.role} 
          userName={user?.displayName || 'User'} 
          userAvatar={user?.photoURL || undefined} 
        />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header role={profile.role} />
          <main className="flex-1 overflow-y-auto p-8">
            <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
                <div>
                  <h1 className="text-4xl font-headline font-bold text-foreground mb-2 tracking-tight">Account Specs</h1>
                  <p className="text-muted-foreground font-medium font-body">Manage your identity and authentication credentials.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-4 space-y-8">
                  <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-card text-center">
                    <div className="p-10 space-y-6">
                      <div className="relative inline-block group">
                        <Avatar className="h-32 w-32 border-4 border-background shadow-2xl ring-1 ring-primary/5">
                          <AvatarImage src={user?.photoURL || undefined} />
                          <AvatarFallback className="bg-primary text-white text-4xl font-bold font-headline">
                            {firstName?.[0]}{lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <button 
                          onClick={() => document.getElementById('avatar-input')?.click()}
                          className="absolute bottom-0 right-0 p-3 bg-accent text-white rounded-2xl shadow-xl hover:scale-110 transition-transform active:scale-95"
                          disabled={isUploading}
                        >
                          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                        </button>
                        <input id="avatar-input" type="file" className="hidden" accept="image/*" onChange={handleAvatarUpload} />
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold font-headline text-foreground leading-tight">{firstName} {lastName}</h3>
                        <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mt-1">{profile.role} account</p>
                      </div>
                    </div>
                  </Card>

                  <Card className="border-none shadow-sm rounded-[2rem] bg-card overflow-hidden text-left relative group">
                    <div className="p-8 space-y-6">
                       <div className="flex items-center justify-between">
                         <h3 className="font-bold font-headline text-lg text-foreground flex items-center gap-3">
                           <Zap className="w-5 h-5 text-amber-500" /> Subscription Plan
                         </h3>
                         {isPro && <Badge className="bg-amber-500/10 text-amber-600 border-none text-[9px] font-bold uppercase">Pro Tier</Badge>}
                       </div>
                       
                       <div className="p-6 bg-muted/30 rounded-2xl border border-border shadow-inner">
                          <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-widest mb-1 opacity-60">Current Status</p>
                          <p className="text-xl font-bold font-headline text-foreground">
                            {isPro ? 'Pro Portfolio Enabled' : 'Free Registry Access'}
                          </p>
                       </div>

                       {!isPro && profile.role === 'landlord' && (
                         <Button 
                            onClick={handleUpgrade}
                            disabled={isUpgrading}
                            className="w-full h-12 rounded-xl font-bold bg-accent hover:bg-accent/90 text-white shadow-lg transition-all text-[10px] uppercase tracking-widest border-none"
                         >
                            {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Crown className="w-4 h-4 mr-2" />}
                            Upgrade to Pro
                         </Button>
                       )}
                    </div>
                  </Card>
                </div>

                <div className="lg:col-span-8">
                  <Card className="border-none shadow-sm rounded-[2.5rem] bg-card overflow-hidden">
                    <form onSubmit={handleSave}>
                      <CardHeader className="p-8 pb-4 border-b border-primary/5 bg-primary/[0.02] text-left">
                        <CardTitle className="text-xl font-headline flex items-center text-foreground">
                          <User className="w-5 h-5 mr-3 text-accent" />
                          Identity Profile
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-10 space-y-8 text-left">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          <div className="space-y-2">
                            <Label className="font-bold text-xs uppercase text-muted-foreground opacity-40 tracking-widest font-headline">First Name</Label>
                            <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="h-12 rounded-xl bg-muted/20 border-none font-bold text-foreground shadow-inner" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-bold text-xs uppercase text-muted-foreground opacity-40 tracking-widest font-headline">Last Name</Label>
                            <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="h-12 rounded-xl bg-muted/20 border-none font-bold text-foreground shadow-inner" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold text-xs uppercase text-muted-foreground opacity-40 tracking-widest font-headline">Contact Electronic Mail</Label>
                          <div className="relative">
                            <Mail className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground opacity-20" />
                            <Input value={user?.email || ''} readOnly className="pl-12 h-12 rounded-xl bg-muted/10 border-none font-bold opacity-60 cursor-not-allowed text-foreground" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold text-xs uppercase text-muted-foreground opacity-40 tracking-widest font-headline">Official Mobile Number</Label>
                          <div className="relative">
                            <Phone className="absolute left-4 top-3.5 h-5 w-5 text-muted-foreground opacity-20" />
                            <Input value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} required className="pl-12 h-12 rounded-xl bg-muted/20 border-none font-bold text-foreground shadow-inner" />
                          </div>
                        </div>
                      </CardContent>
                      <CardFooter className="p-8 bg-muted/10 border-t flex justify-end">
                        <Button type="submit" disabled={isSaving} className="rounded-xl h-11 px-10 font-bold bg-primary text-primary-foreground shadow-lg shadow-primary/20 font-headline uppercase tracking-widest text-[10px] border-none hover:scale-[1.01] transition-transform">
                          {isSaving ? <Loader2 className="w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                          Save Account Specs
                        </Button>
                      </CardFooter>
                    </form>
                  </Card>
                </div>
              </div>
            </div>
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
