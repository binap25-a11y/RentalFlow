"use client";

import { useUser, useFirestore, useDoc, useMemoFirebase, useCollection, getLandlordCollectionQuery } from '@/firebase';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  Wallet, 
  MessageSquare, 
  ChevronRight,
  Loader2, 
  Activity, 
  Zap, 
  Building2,
  Shield, 
  Bot 
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { 
  cn, 
  RENTALFLOW_LOGO_URL, 
  RENTALFLOW_NEUTRAL_FALLBACK, 
  getResolvedImageUrl, 
  isRealUserUpload 
} from '@/lib/utils';
import { useEffect, useState, useMemo } from 'react';
import { doc } from 'firebase/firestore';

/**
 * 🏢 Cinematic Landing Experience
 * Re-engineered for high-fidelity brand identity and operational excellence.
 * Resolved Runtime Errors: Verified imports for 'Bot' and 'cn'.
 * Optimized for professional property management orchestration.
 */
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

  /**
   * 🖼️ Professional Identity Resolution
   * Uses standard getResolvedImageUrl to mirror the Inventory identity perfectly.
   */
  const heroImage = useMemo(() => {
    if (properties && properties.length > 0) {
      // Sort by most recently updated to feature the latest work
      const sorted = [...properties].sort((a, b) => 
        (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0)
      );
      // Resolve the identity of the most recently edited asset
      return getResolvedImageUrl(sorted[0].imageUrl, sorted[0].imageUrls);
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
          <div className="relative w-24 h-24 rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-primary/5">
            <Image src={RENTALFLOW_LOGO_URL} alt="RentalFlow" fill className="object-cover" unoptimized priority />
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-accent opacity-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background font-body selection:bg-accent/30 selection:text-white overflow-x-hidden text-left">
      <nav className="fixed top-0 w-full z-50 bg-background/60 backdrop-blur-xl border-b h-20 border-white/5">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
             <div className="relative h-11 w-11 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/10">
                <Image src={RENTALFLOW_LOGO_URL} alt="Logo" fill className="object-cover" unoptimized />
             </div>
             <span className="font-headline font-bold text-2xl tracking-tighter text-foreground">RentalFlow</span>
          </div>
          <div className="flex items-center gap-4">
             {user ? (
               <Button asChild className="rounded-2xl font-bold bg-accent hover:bg-accent/90 text-white px-8 h-12 shadow-2xl shadow-accent/20 transition-all active:scale-95 border-none">
                 <Link href={profile?.role === 'landlord' ? '/landlord/properties' : '/tenant/hub'}>
                    Portfolio Command <ChevronRight className="w-4 h-4 ml-1" />
                 </Link>
               </Button>
             ) : (
               <>
                 <Button variant="ghost" asChild className="rounded-xl font-bold hidden sm:inline-flex text-muted-foreground hover:text-foreground hover:bg-white/5"><Link href="/auth">Sign In</Link></Button>
                 <Button asChild className="rounded-2xl font-bold bg-accent hover:bg-accent/90 text-white px-8 h-12 shadow-2xl shadow-accent/20 transition-all active:scale-95 border-none"><Link href="/auth">Initialize Access</Link></Button>
               </>
             )}
          </div>
        </div>
      </nav>

      <section className="relative pt-48 pb-40 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-accent/10 blur-[120px] rounded-full -z-10 opacity-30" />
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-24 items-center">
          <div className="text-left space-y-10 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            <div className="space-y-4">
              <Badge variant="outline" className="py-2 px-5 rounded-full border-accent/20 bg-accent/5 text-accent font-bold uppercase tracking-[0.25em] text-[10px] animate-pulse">
                <Sparkles className="w-3.5 h-3.5 mr-2" /> High-Fidelity Operations
              </Badge>
              <h1 className="text-7xl md:text-[5.5rem] font-headline font-bold tracking-tighter leading-[0.85] text-foreground">
                Command Your <br/><span className="text-accent">Portfolio.</span>
              </h1>
            </div>
            
            <p className="text-xl text-muted-foreground font-medium max-w-xl leading-relaxed opacity-80">
              The professional orchestration layer for modern property managers. Automated maintenance triage, verified visual ledgers, and cinematic resident experiences.
            </p>

            <div className="flex flex-col sm:flex-row gap-6 pt-4">
              {user && profile ? (
                <Button size="lg" asChild className="h-16 px-12 rounded-[1.75rem] bg-accent hover:bg-accent/90 text-white text-lg font-bold shadow-2xl transition-all hover:scale-[1.02] active:scale-95 border-none">
                  <Link href={profile.role === 'landlord' ? '/landlord/properties' : '/tenant/hub'}>
                      Return to Command <ArrowRight className="w-6 h-6 ml-3" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" asChild className="h-16 px-12 rounded-[1.75rem] bg-accent hover:bg-accent/90 text-white text-lg font-bold shadow-2xl transition-all hover:scale-[1.02] active:scale-95 border-none">
                  <Link href="/auth">Start Tenancy <ArrowRight className="w-6 h-6 ml-3" /></Link>
                </Button>
              )}
              <Button size="lg" variant="outline" className="h-16 px-12 rounded-[1.75rem] border-white/10 bg-white/5 hover:bg-white/10 text-foreground font-bold text-lg backdrop-blur-md">
                 Explore Intelligence
              </Button>
            </div>

            <div className="flex items-center gap-10 opacity-40">
               <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold font-headline">99.9%</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Uptime Sync</span>
               </div>
               <div className="w-px h-10 bg-white/10" />
               <div className="flex flex-col gap-1">
                  <span className="text-2xl font-bold font-headline">5k+</span>
                  <span className="text-[10px] font-bold uppercase tracking-widest">Assets Managed</span>
               </div>
            </div>
          </div>
          
          <div className="relative group">
            <div className="absolute -inset-1 bg-accent/20 rounded-[4rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
            <div className="relative h-[650px] rounded-[3.5rem] overflow-hidden shadow-2xl ring-1 ring-white/10 animate-in fade-in zoom-in duration-1000 bg-muted">
              <img 
                src={heroImage} 
                alt="Portfolio Identity" 
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = RENTALFLOW_NEUTRAL_FALLBACK;
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-12 left-10 right-10 glass p-10 rounded-[2.5rem] animate-in slide-in-from-bottom-10 duration-1000 delay-500">
                 <div className="flex justify-between items-center">
                    <div className="text-left space-y-1">
                      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-accent font-headline">Verified Asset Identity</p>
                      <p className="text-3xl font-bold font-headline text-foreground tracking-tight">Portfolio Command</p>
                    </div>
                    <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 text-emerald-500 shadow-inner">
                       <ShieldCheck className="w-8 h-8" />
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="py-40 bg-muted/20 relative">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-32">
          <div className="max-w-4xl mx-auto space-y-6">
             <h2 className="text-5xl md:text-7xl font-headline font-bold tracking-tight text-foreground leading-[0.9]">Engineered for <br/>Tenancy Excellence</h2>
             <p className="text-xl text-muted-foreground font-medium font-body max-w-2xl mx-auto opacity-70">Remove the friction from professional property management with a high-fidelity operational layer.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            {[
              { 
                title: "AI Maintenance Triage", 
                desc: "Prioritize critical repairs and receive automated fix strategies the microsecond an issue is reported.", 
                icon: Zap, 
                color: "text-amber-500", 
                bg: "bg-amber-500/10" 
              },
              { 
                title: "Financial Command", 
                desc: "Unified rental ledgers with real-time collection status and automated professional visual records.", 
                icon: Activity, 
                color: "text-accent", 
                bg: "bg-accent/10" 
              },
              { 
                title: "Resident Concierge", 
                desc: "A dedicated AI assistant for residents, providing instant guidance on property protocols and guides.", 
                icon: Bot, 
                color: "text-emerald-500", 
                bg: "bg-emerald-500/10" 
              }
            ].map((f, i) => (
              <Card key={i} className="border-none shadow-sm rounded-[3rem] p-12 bg-card hover:shadow-2xl transition-all duration-500 group text-left ring-1 ring-white/5 hover:ring-white/10 hover:scale-[1.02]">
                <div className={cn("p-6 rounded-[2rem] w-fit mb-10 group-hover:scale-110 transition-transform duration-500", f.bg, f.color)}>
                   <f.icon className="w-10 h-10" />
                </div>
                <h3 className="text-3xl font-bold font-headline mb-5 text-foreground leading-tight">{f.title}</h3>
                <p className="text-lg text-muted-foreground font-medium font-body leading-relaxed opacity-70">{f.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="py-40 relative">
        <div className="max-w-7xl mx-auto px-6">
           <Card className="rounded-[4rem] bg-accent p-20 text-center relative overflow-hidden border-none shadow-2xl">
              <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
              <div className="relative z-10 space-y-10">
                 <h2 className="text-5xl md:text-7xl font-headline font-bold text-white tracking-tighter">Ready to orchestrate?</h2>
                 <p className="text-xl text-white/80 font-medium max-w-2xl mx-auto">Initialize your professional portfolio identity today and join the leading property managers.</p>
                 <Button size="lg" asChild className="h-16 px-16 rounded-2xl bg-white text-accent hover:bg-white/90 text-xl font-bold shadow-2xl transition-all hover:scale-105 active:scale-95 border-none">
                    <Link href="/auth">Access Portfolio Vault</Link>
                 </Button>
              </div>
           </Card>
        </div>
      </section>

      <footer className="py-20 border-t border-white/5 text-center bg-card">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-10">
           <div className="flex items-center gap-3">
              <div className="relative h-8 w-8 rounded-lg overflow-hidden ring-1 ring-white/10">
                 <Image src={RENTALFLOW_LOGO_URL} alt="Logo" fill className="object-cover" unoptimized />
              </div>
              <span className="font-headline font-bold text-lg tracking-tighter text-foreground">RentalFlow</span>
           </div>
           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.5em] font-headline opacity-40">
             © 2026 RENTALFLOW OPERATIONS. ENCRYPTED & PROTECTED.
           </p>
           <div className="flex items-center gap-6">
              <Link href="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors">Protocol</Link>
              <Link href="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors">Security</Link>
              <Link href="#" className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent transition-colors">Support</Link>
           </div>
        </div>
      </footer>
    </div>
  );
}