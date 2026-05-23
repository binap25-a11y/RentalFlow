
"use client";

import { useUser } from '@/firebase';
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowRight, Building2, ShieldCheck, Sparkles, 
  Wrench, Wallet, MessageSquare, ChevronRight,
  Globe, Zap, LayoutDashboard, Star, CheckCircle2
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { RENTALFLOW_NEUTRAL_FALLBACK } from '@/lib/utils';

export default function LandingPage() {
  const { user } = useUser();

  return (
    <div className="min-h-screen bg-white font-body selection:bg-primary selection:text-white">
      {/* Navigation Header */}
      <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-xl border-b border-primary/5 h-20">
        <div className="max-w-7xl mx-auto h-full px-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
             <div className="relative h-10 w-10 rounded-xl overflow-hidden shadow-lg">
                <Image src={RENTALFLOW_NEUTRAL_FALLBACK} alt="Logo" fill className="object-cover" unoptimized />
             </div>
             <span className="font-headline font-bold text-2xl tracking-tight text-primary">RentalFlow</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
             <Link href="#features" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Features</Link>
             <Link href="#compliance" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Compliance</Link>
          </div>
          <div className="flex items-center gap-4">
             {user ? (
               <Button asChild className="rounded-xl font-bold bg-primary shadow-xl shadow-primary/20 text-white">
                 <Link href={user.email?.includes('landlord') ? '/landlord/dashboard' : '/tenant/hub'}>
                    Return to Dashboard <ArrowRight className="w-4 h-4 ml-2" />
                 </Link>
               </Button>
             ) : (
               <>
                 <Button variant="ghost" asChild className="rounded-xl font-bold text-primary hidden sm:inline-flex">
                   <Link href="/auth">Sign In</Link>
                 </Button>
                 <Button asChild className="rounded-xl font-bold bg-primary shadow-xl shadow-primary/20 text-white px-6">
                   <Link href="/auth">Get Started</Link>
                 </Button>
               </>
             )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative pt-40 pb-32 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[800px] bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
          <div className="text-left space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
            <Badge variant="outline" className="py-2 px-4 rounded-full border-primary/10 bg-primary/5 text-primary font-bold uppercase tracking-[0.2em] text-[10px]">
              <Sparkles className="w-3 h-3 mr-2 text-accent" /> AI-Powered Portfolio Orchestration
            </Badge>
            <h1 className="text-6xl md:text-8xl font-headline font-bold text-primary tracking-tighter leading-[0.9]">
              Premium Property <br/>
              <span className="text-accent">Management.</span>
            </h1>
            <p className="text-xl text-muted-foreground font-medium max-w-xl leading-relaxed">
              Accelerate your rental operations with automated maintenance triage, professional ledger tracking, and an AI-driven resident concierge.
            </p>
            <div className="flex flex-col sm:flex-row items-center gap-4 pt-4">
               <Button size="lg" asChild className="w-full sm:w-auto h-16 px-10 rounded-2xl bg-primary text-lg font-bold shadow-2xl shadow-primary/20 text-white hover:scale-[1.02] transition-transform">
                 <Link href="/auth">Launch Your Portfolio</Link>
               </Button>
               <div className="flex items-center gap-3 px-6 h-16 rounded-2xl border border-primary/5 bg-white shadow-sm">
                  <div className="flex -space-x-2">
                    {[1,2,3].map(i => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-muted overflow-hidden">
                        <Image src={`https://picsum.photos/seed/user-${i}/100/100`} alt="User" width={32} height={32} />
                      </div>
                    ))}
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Trusted by UK Landlords</span>
               </div>
            </div>
          </div>
          <div className="relative h-[600px] rounded-[3rem] overflow-hidden shadow-2xl ring-1 ring-primary/5 animate-in fade-in zoom-in duration-1000">
            <Image 
              src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=1200&auto=format&fit=crop" 
              alt="Luxury Property" 
              fill 
              className="object-cover" 
              unoptimized 
              priority
              data-ai-hint="modern architecture"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-primary/60 to-transparent" />
            <div className="absolute bottom-10 left-10 right-10 bg-white/10 backdrop-blur-xl border border-white/20 p-8 rounded-3xl">
               <div className="flex justify-between items-center text-white">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60 mb-1">Active Tenancy Hub</p>
                    <p className="text-2xl font-bold font-headline">88 Berkeley Square, London</p>
                  </div>
                  <Badge className="bg-emerald-500 text-white border-none font-bold">VERIFIED</Badge>
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-32 bg-slate-50">
        <div className="max-w-7xl mx-auto px-6 text-center space-y-20">
          <div className="max-w-3xl mx-auto space-y-4">
             <h2 className="text-4xl md:text-5xl font-headline font-bold text-primary tracking-tight">Engineered for Operational Excellence</h2>
             <p className="text-lg text-muted-foreground font-medium">Three core systems designed to remove the friction from property management.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-none shadow-sm rounded-[2.5rem] p-10 bg-white hover:shadow-2xl transition-all group text-left">
              <div className="p-5 bg-accent/10 text-accent rounded-3xl w-fit mb-8 group-hover:scale-110 transition-transform">
                <Sparkles className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold font-headline mb-4 text-primary">AI Maintenance Triage</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">Let Gemini triage resident reports instantly. Prioritize critical repairs and receive automated suggestions before contacting a contractor.</p>
            </Card>
            <Card className="border-none shadow-sm rounded-[2.5rem] p-10 bg-white hover:shadow-2xl transition-all group text-left">
              <div className="p-5 bg-primary/5 text-primary rounded-3xl w-fit mb-8 group-hover:scale-110 transition-transform">
                <Wallet className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold font-headline mb-4 text-primary">Financial Command</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">Unified rental ledgers with real-time status tracking. Generate digital receipts, dispatch reminders, and export tax-ready statements.</p>
            </Card>
            <Card className="border-none shadow-sm rounded-[2.5rem] p-10 bg-white hover:shadow-2xl transition-all group text-left">
              <div className="p-5 bg-emerald-50 text-emerald-600 rounded-3xl w-fit mb-8 group-hover:scale-110 transition-transform">
                <MessageSquare className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold font-headline mb-4 text-primary">Resident Concierge</h3>
              <p className="text-muted-foreground font-medium leading-relaxed">A dedicated AI assistant for your residents. Answer property-specific questions about appliances, utilities, and protocols 24/7.</p>
            </Card>
          </div>
        </div>
      </section>

      {/* Compliance Section */}
      <section id="compliance" className="py-32 bg-primary text-white overflow-hidden relative">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-accent/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="max-w-7xl mx-auto px-6 flex flex-col lg:flex-row items-center gap-20">
          <div className="flex-1 text-left space-y-10">
             <div className="space-y-4">
                <h2 className="text-4xl md:text-6xl font-headline font-bold tracking-tight">Secure. Compliant. <br/>Redundant.</h2>
                <p className="text-xl text-white/70 font-medium leading-relaxed">RentalFlow combines Firebase's secure real-time architecture with PostgreSQL redundancy to protect your portfolio data.</p>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                  { icon: ShieldCheck, title: "UK SOS Protocols", desc: "Built-in emergency service directory for residents." },
                  { icon: Globe, title: "Vaulted Storage", desc: "Private encrypted storage for all property certificates." },
                  { icon: Zap, title: "Instant Verifications", desc: "Digital verification for every rental transaction." },
                  { icon: CheckCircle2, title: "Audit Trail", desc: "Comprehensive history for every maintenance event." }
                ].map((item, i) => (
                  <div key={i} className="flex gap-4 p-6 bg-white/5 rounded-2xl border border-white/10 backdrop-blur-sm">
                    <item.icon className="w-6 h-6 text-accent shrink-0" />
                    <div>
                      <p className="font-bold font-headline">{item.title}</p>
                      <p className="text-xs text-white/60 font-medium mt-1">{item.desc}</p>
                    </div>
                  </div>
                ))}
             </div>
          </div>
          <div className="flex-1 w-full max-w-md">
             <div className="bg-white rounded-[3rem] p-8 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-2 bg-accent" />
                <div className="flex items-center justify-between mb-8">
                   <p className="text-[10px] font-bold uppercase tracking-widest text-primary/40">Portfolio Pulse</p>
                   <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                </div>
                <div className="space-y-6">
                   <div className="h-4 w-3/4 bg-slate-100 rounded-full" />
                   <div className="h-4 w-1/2 bg-slate-100 rounded-full" />
                   <div className="pt-4 border-t border-slate-100 space-y-4">
                      <div className="flex justify-between items-center">
                         <span className="text-xs font-bold text-primary">Yield Potential</span>
                         <span className="text-xs font-bold text-emerald-600">£12,450 /mo</span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                         <div className="w-[85%] h-full bg-primary" />
                      </div>
                   </div>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-32">
        <div className="max-w-4xl mx-auto px-6 text-center bg-slate-50 rounded-[4rem] p-20 space-y-10 border border-primary/5">
           <h2 className="text-4xl md:text-5xl font-headline font-bold text-primary tracking-tight">Ready to modernize your portfolio?</h2>
           <p className="text-lg text-muted-foreground font-medium">Join professional landlords across the UK using AI to scale their operations.</p>
           <Button size="lg" asChild className="h-16 px-12 rounded-2xl bg-primary text-xl font-bold shadow-2xl shadow-primary/20 text-white">
             <Link href="/auth">Start Your Free Trial</Link>
           </Button>
           <div className="flex justify-center gap-8 pt-6 opacity-40 grayscale">
              <span className="text-sm font-bold uppercase tracking-widest">Enterprise Encrypted</span>
              <span className="text-sm font-bold uppercase tracking-widest">UK GDPR Compliant</span>
           </div>
        </div>
      </section>

      <footer className="py-12 border-t border-primary/5">
        <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
             <div className="relative h-8 w-8 rounded-lg overflow-hidden grayscale">
                <Image src={RENTALFLOW_NEUTRAL_FALLBACK} alt="Logo" fill className="object-cover" unoptimized />
             </div>
             <span className="font-headline font-bold text-lg tracking-tight text-primary/40">RentalFlow</span>
          </div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">© 2026 RENTALFLOW OPERATIONS. ALL RIGHTS RESERVED.</p>
        </div>
      </footer>
    </div>
  );
}
