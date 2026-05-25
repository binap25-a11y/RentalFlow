"use client";

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, getLandlordCollectionQuery } from '@/firebase';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowRight, ShieldCheck, Sparkles, 
  Wallet, MessageSquare, ChevronRight,
  Loader2
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RENTALFLOW_NEUTRAL_FALLBACK, getResolvedImageUrl } from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';
import { doc } from 'firebase/firestore';

export default function LandingPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const [mounted, setMounted] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user || profile?.role !== 'landlord') return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user, profile]);

  const { data: properties } = useCollection(propertiesQuery);

  const heroImage = useMemo(() => {
    if (properties && properties.length > 0) {
      return getResolvedImageUrl(properties[0].imageUrl, properties[0].imageUrls);
    }
    return RENTALFLOW_NEUTRAL_FALLBACK;
  }, [properties]);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || isUserLoading || (user && isProfileLoading)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-[100] animate-in fade-in duration-500">
        <div className="flex flex-col items-center gap-4">
          <div className="relative w-24 h-24 rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-primary/5">
            <Image src={RENTALFLOW_NEUTRAL_FALLBACK} alt="RentalFlow" fill className="object-cover" unoptimized priority />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-accent opacity-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body selection:bg-accent selection:text-white overflow-x-hidden text-left">
      <nav className="fixed top-0 w-full z-50 bg-background/80 backdrop-blur-xl border-b h-20 border-border">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="relative h-10 w-10 rounded-xl overflow-hidden shadow-lg transition-transform hover:scale-105">
                <Image src={RENTALFLOW_NEUTRAL_FALLBACK} alt="Logo" fill className="object-cover" unoptimized />
             </div>
             <span className="font-headline font-bold text-2xl tracking-tighter text-foreground">RentalFlow</span>
          </div>
          <div className="flex items-center gap-4">
             {user ? (
               <Button asChild className="rounded-xl font-bold bg-accent hover:bg-accent/90 text-white px-6 h-11 shadow-lg shadow-accent/20 transition-all active:scale-95 border-none">
                 <Link href={profile?.role === 'landlord' ? '/landlord/properties' : '/tenant/hub'}>
                    Portfolio Access <ChevronRight className="w-4 h-4 ml-1" />
                 </Link>
               </Button>
             ) : (
               <>
                 <Button variant="ghost" asChild className="rounded-xl font-bold hidden sm:inline-flex text-foreground hover:bg-primary/5"><Link href="/auth">Sign In</Link></Button>
                 <Button asChild className="rounded-xl font-bold bg-accent hover:bg-accent/90 text-white px-6 h-11 shadow-lg shadow-accent/20 transition-all active:scale-95 border-none"><Link href="/auth">Get Started</Link></Button>
               </>
             )}
          </div>
        </div>
      </nav>

      <section className="relative pt-40 pb-32">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="text-left space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <Badge variant="outline" className="py-2 px-4 rounded-full border-accent/20 bg-accent/5 text-accent font-bold uppercase tracking-[0.2em] text-[10px]">
              <Sparkles className="w-3 h-3 mr-2" /> AI-Powered Portfolio Orchestration
            </Badge>
            <h1 className="text-6xl md:text-8xl font-headline font-bold tracking-tighter leading-[0.9] text-foreground">
              Premium Property <br/><span className="text-accent">Management.</span>
            </h1>
            
            <div className="pt-4">
              {user && profile ? (
                <Button size="lg" asChild className="h-16 px-10 rounded-2xl bg-accent hover:bg-accent/90 text-white text-lg font-bold shadow-2xl transition-all hover:scale-[1.02] active:scale-95 border-none">
                  <Link href={profile.role === 'landlord' ? '/landlord/properties' : '/tenant/hub'}>
                      Return to Portfolio <ArrowRight className="w-5 h-5 ml-3" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild className="h-16 px-10 rounded-2xl bg-accent hover:bg-accent/90 text-white text-lg font-bold shadow-2xl transition-all hover:scale-[1.02] active:scale-95 border-none">
                  <Link href="/auth">Launch Your Portfolio <ArrowRight className="w-5 h-5 ml-3" /></Link>
                </Button>
              )}
            </div>
            
            <p className="text-xl text-muted-foreground font-medium max-w-xl leading-relaxed">
              Accelerate your rental operations with automated maintenance triage and professional visual ledgers.
            </p>
          </div>
          <div className="relative h-[550px] rounded-[3rem] overflow-hidden shadow-2xl ring-1 ring-border animate-in fade-in zoom-in duration-1000">
            <Image src={heroImage} alt="Portfolio Hero" fill className="object-cover" unoptimized priority />
            <div className="absolute inset-0 bg-gradient-to-t from-background/90 via-transparent to-transparent" />
            <div className="absolute bottom-10 left-10 right-10 bg-background/60 backdrop-blur-md border border-border p-8 rounded-3xl">
               <div className="flex justify-between items-center">
                  <div className="text-left">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60 mb-1 font-headline">Active Ledger Hub</p>
                    <p className="text-2xl font-bold font-headline text-foreground">Portfolio Command</p>
                  </div>
                  <Badge className="bg-emerald-50 text-white border-none font-bold uppercase text-[9px] tracking-widest px-4 py-1.5 rounded-full shadow-lg font-headline">Verified</Badge>
               </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-32 bg-muted/30">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-20">
          <div className="max-w-3xl mx-auto space-y-4">
             <h2 className="text-4xl md:text-5xl font-headline font-bold tracking-tight text-foreground">Engineered for Excellence</h2>
             <p className="text-lg text-muted-foreground font-medium font-body">Remove the friction from professional property management.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-none shadow-sm rounded-[2.5rem] p-10 bg-card hover:shadow-2xl transition-all group text-left ring-1 ring-border">
              <div className="p-5 bg-accent/10 text-accent rounded-3xl w-fit mb-8 group-hover:scale-110 transition-transform"><Sparkles className="w-8 h-8" /></div>
              <h3 className="text-2xl font-bold font-headline mb-4 text-foreground">AI Maintenance Triage</h3>
              <p className="text-muted-foreground font-medium font-body leading-relaxed">Prioritize critical repairs and receive automated suggestions before contacting a contractor.</p>
            </Card>
            <Card className="border-none shadow-sm rounded-[2.5rem] p-10 bg-card hover:shadow-2xl transition-all group text-left ring-1 ring-border">
              <div className="p-5 bg-accent/5 text-accent rounded-3xl w-fit mb-8 group-hover:scale-110 transition-transform"><Wallet className="w-8 h-8" /></div>
              <h3 className="text-2xl font-bold font-headline mb-4 text-foreground">Financial Command</h3>
              <p className="text-muted-foreground font-medium font-body leading-relaxed">Unified rental ledgers with real-time status tracking and professional visual asset records.</p>
            </Card>
            <Card className="border-none shadow-sm rounded-[2.5rem] p-10 bg-card hover:shadow-2xl transition-all group text-left ring-1 ring-border">
              <div className="p-5 bg-emerald-500/10 text-emerald-500 rounded-3xl w-fit mb-8 group-hover:scale-110 transition-transform"><MessageSquare className="w-8 h-8" /></div>
              <h3 className="text-2xl font-bold font-headline mb-4 text-foreground">Resident Concierge</h3>
              <p className="text-muted-foreground font-medium font-body leading-relaxed">A dedicated AI assistant for residents, providing instant guidance on property protocols.</p>
            </Card>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-border text-center bg-card">
        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] font-headline opacity-40">© 2026 RENTALFLOW OPERATIONS. ALL RIGHTS RESERVED.</p>
      </footer>
    </div>
  );
}
