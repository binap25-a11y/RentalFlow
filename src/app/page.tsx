"use client";

import { useUser, useFirestore, useDoc, useMemoFirebase } from '@/firebase';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { 
  ArrowRight, 
  ShieldCheck, 
  Sparkles, 
  ChevronRight,
  Loader2, 
  Activity, 
  Zap, 
  Building2,
  Bot 
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { 
  cn, 
  RENTALFLOW_LOGO_URL 
} from '@/lib/utils';
import { useEffect, useState } from 'react';
import { doc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';

/**
 * @fileOverview High-Fidelity Portfolio Entry Point.
 * Optimized for cinematic landing and intentional exposure before redirection.
 * CALIBRATED: Centered hero layout with stacked branding and command logic.
 */

export default function LandingPage() {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    setMounted(true);
  }, []);

  // CINEMATIC REDIRECTION: Optimized for professional speed (1.5s)
  useEffect(() => {
    if (mounted && user && !isProfileLoading && profile) {
      const timer = setTimeout(() => {
        setIsRedirecting(true);
        router.replace(profile.role === 'landlord' ? '/landlord/properties' : '/tenant/hub');
      }, 1500);
      
      return () => clearTimeout(timer);
    }
  }, [mounted, user, isProfileLoading, profile, router]);

  const scrollToFeatures = () => {
    const section = document.getElementById('features');
    if (section) {
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  if (!mounted) {
    return (
      <div className="fixed inset-0 bg-background z-[100] transition-opacity duration-300" />
    );
  }

  return (
    <div className={cn(
      "min-h-screen bg-background font-body selection:bg-accent/30 selection:text-white overflow-x-hidden text-left transition-all duration-1000",
      isRedirecting ? "opacity-0 scale-[0.99] grayscale-[0.5]" : "opacity-100"
    )}>
      {/* AUTH STATUS OVERLAY - THEMED & ACCELERATED */}
      {user && !isProfileLoading && !isRedirecting && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] animate-in slide-in-from-bottom-5 duration-700">
           <div className="bg-background/80 backdrop-blur-xl border border-border px-6 py-3 rounded-full flex items-center gap-3 shadow-2xl ring-1 ring-black/5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-accent" />
              <span className="text-[10px] font-bold text-foreground uppercase tracking-[0.2em] font-headline">Synchronizing Vault</span>
           </div>
        </div>
      )}

      <section className="relative pt-48 pb-40 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-accent/10 blur-[120px] rounded-full -z-10 opacity-30" />
        
        <div className="max-w-5xl mx-auto px-6 flex flex-col items-center text-center space-y-12 animate-in fade-in slide-in-from-bottom-8 duration-700">
          
          {/* Logo and Identity Stack in the middle */}
          <div className="flex flex-col items-center gap-10">
            <div className="flex flex-col items-center">
              <div className="relative h-28 w-28 rounded-[2.5rem] overflow-hidden shadow-2xl ring-1 ring-white/10 bg-card transition-transform hover:scale-105 duration-700">
                 <Image src={RENTALFLOW_LOGO_URL} alt="Logo" fill className="object-cover" unoptimized priority />
              </div>
              <h1 className="text-4xl font-headline font-bold text-foreground tracking-tighter mt-6">RentalFlow</h1>
            </div>
            
            <div className="space-y-6">
              <Badge variant="outline" className="py-2 px-6 rounded-full border-accent/20 bg-accent/5 text-accent font-bold uppercase tracking-[0.25em] text-[10px]">
                <Sparkles className="w-3.5 h-3.5 mr-2" /> High-Fidelity Operations
              </Badge>
              <h1 className="text-6xl md:text-[5.5rem] font-headline font-bold tracking-tighter leading-[0.85] text-foreground">
                Command Your <br/><span className="text-accent">Portfolio.</span>
              </h1>
              <p className="text-xl text-muted-foreground font-medium max-w-2xl mx-auto leading-relaxed opacity-80">
                The professional orchestration layer for modern property managers. Automated maintenance triage, verified visual ledgers, and cinematic resident experiences.
              </p>
            </div>
          </div>

          {/* Command Trigger Stack */}
          <div className="flex flex-col sm:flex-row gap-6 pt-4">
            <Button size="lg" asChild className="h-20 px-12 md:px-20 rounded-[2.25rem] bg-accent hover:bg-accent/90 text-white text-lg md:text-xl font-bold shadow-2xl transition-all hover:scale-[1.02] active:scale-95 border-none">
              <Link href="/auth">Sign In <ArrowRight className="w-6 h-6 ml-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="h-20 px-12 md:px-16 rounded-[2.25rem] border-white/10 bg-white/5 hover:bg-white/10 text-foreground font-bold text-lg backdrop-blur-md cursor-pointer transition-all" onClick={scrollToFeatures}>
               Explore Intelligence
            </Button>
          </div>
          
          {/* Hardware-Accelerated Preview */}
          <div className="relative group w-full mt-16">
            <div className="absolute -inset-1 bg-accent/20 rounded-[4rem] blur-2xl opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
            <div className="relative h-[550px] md:h-[650px] rounded-[3.5rem] overflow-hidden shadow-2xl ring-1 ring-white/10 bg-muted">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex flex-col items-center justify-center gap-4">
                <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 shadow-inner">
                   <Building2 className="w-24 h-24 text-primary/10" />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/30 font-headline">Awaiting visual identity</p>
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent opacity-60" />
              <div className="absolute bottom-12 left-10 right-10 glass p-10 rounded-[2.5rem] animate-in slide-in-from-bottom-10 duration-1000 delay-300">
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
              <Card key={i} className="border-none shadow-sm rounded-[3rem] p-12 bg-card hover:shadow-2xl transition-all duration-500 group text-left ring-1 ring-white/5 hover:ring-white/10 hover:scale-[1.01]">
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
