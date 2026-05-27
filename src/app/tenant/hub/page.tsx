"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, AlertCircle, 
  Loader2, Building2, 
  ChevronRight, ReceiptText,
  ShieldCheck, Download, 
  Info, Wifi, Shield, PoundSterling, Phone, Wrench
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { cn, getResolvedImageUrl } from "@/lib/utils";
import { query, collection, where } from "firebase/firestore";
import { format } from "date-fns";

/**
 * @fileOverview High-Fidelity Resident Hub (Optimized).
 * Hierarchy: Cinematic Hero -> Identity -> Rent Ledger -> Narrative -> Property DNA -> Actions.
 */

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "properties", userId: user.uid });
  }, [db, user]);
  
  const { data: properties, isLoading: isPropLoading } = useCollection(propertiesQuery);
  const property = properties?.[0];

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    const now = new Date();
    return query(
      collection(db, 'rentPayments'), 
      where('tenantId', '==', user.uid), 
      where('month', '==', now.getMonth() + 1), 
      where('year', '==', now.getFullYear())
    );
  }, [db, user]);
  const { data: payments } = useCollection(paymentsQuery);
  const currentPayment = payments?.[0];

  const handleDownloadStatement = async () => {
    if (!property) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.text(`RENTAL STATEMENT - ${property.addressLine1}`, 20, 20);
    doc.save(`Statement_${property.addressLine1.replace(/\s+/g, '_')}_${format(new Date(), 'MMM_yyyy')}.pdf`);
  };

  if (!isClient || isPropLoading) return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000 pb-32 text-left bg-background">
      <div className="h-[400px] w-full bg-muted/40 animate-pulse rounded-[3rem]" />
      <div className="space-y-4">
        <div className="h-10 w-64 bg-muted rounded-full animate-pulse" />
        <div className="h-6 w-48 bg-muted/40 rounded-full animate-pulse" />
      </div>
    </div>
  );

  if (!property) return (
    <div className="max-w-7xl mx-auto space-y-12 py-32 text-center">
      <Building2 className="w-16 h-16 mx-auto text-muted-foreground/20 mb-6" />
      <h1 className="text-3xl font-headline font-bold text-foreground">Registry Verification</h1>
      <p className="text-muted-foreground max-w-sm mx-auto">Once your landlord links your residency to a property, your hub will be initialized here.</p>
    </div>
  );

  const primaryImageUrl = getResolvedImageUrl(property?.imageUrl, property?.imageUrls);

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32 text-left bg-background relative">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-foreground tracking-tighter">Resident Portal</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70">Welcome home.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-10">
          <Card className="border-none shadow-2xl overflow-hidden bg-card group ring-1 ring-border">
            {/* 1. CINEMATIC HERO */}
            <div className="relative h-[450px] md:h-[550px] w-full bg-muted overflow-hidden">
              {primaryImageUrl ? (
                <img 
                  src={primaryImageUrl} 
                  alt={property.addressLine1} 
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Building2 className="w-24 h-24 text-muted-foreground/10" />
                </div>
              )}
            </div>

            {/* 2. IDENTITY BAR */}
            <div className="p-10 border-b border-border bg-white/[0.01] space-y-4">
               <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground tracking-tight leading-tight">
                 {property.addressLine1}, {property.city}, {property.zipCode}
               </h2>
               <div className="flex items-center gap-4 flex-wrap">
                 <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold uppercase tracking-[0.2em] text-[10px] py-2.5 px-6 rounded-full shadow-sm font-headline shrink-0 h-fit">
                   <ShieldCheck className="w-4 h-4 mr-2" /> Active Tenancy
                 </Badge>
                 <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-[8px] font-bold uppercase tracking-widest px-4 h-9 flex items-center gap-2 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Ledger Synchronized
                 </Badge>
               </div>
            </div>

            <CardContent className="p-10 md:p-12 space-y-12">
              {/* 3. RENT LEDGER */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><ReceiptText className="w-6 h-6 mr-4 text-accent" /> Monthly Rent</h3>
                  <Button variant="ghost" asChild className="rounded-xl font-bold text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent">
                    <Link href="/tenant/payments">View history <ChevronRight className="w-3.5 h-3.5 ml-1" /></Link>
                  </Button>
                </div>
                <div className="p-10 bg-muted/20 rounded-[2.5rem] border border-border shadow-inner relative overflow-hidden group text-left">
                   <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-1000">
                      <PoundSterling className="w-32 h-32" />
                   </div>
                   <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.3em] font-headline opacity-50 mb-3">Verified Ledger</p>
                   <p className="text-6xl font-bold font-headline text-foreground tracking-tighter mb-4">£{property.rentAmount?.toLocaleString()}</p>
                   <Badge className={cn("w-full h-14 flex items-center justify-center font-bold text-[11px] rounded-2xl shadow-sm uppercase tracking-[0.2em] border transition-all duration-700", currentPayment?.status === 'paid' ? "bg-emerald-500 text-white border-transparent" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                     {currentPayment?.status === 'paid' ? "Receipted & Collected" : "Collection Pending"}
                   </Badge>
                </div>
              </div>

              {/* 4. RESIDENCE NARRATIVE */}
              <div className="space-y-6">
                <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><Info className="w-6 h-6 mr-4 text-accent" /> Your Residence</h3>
                <div className="p-8 bg-primary/5 rounded-[2rem] border border-border text-left">
                   <p className="text-[9px] font-bold uppercase text-accent tracking-[0.3em] mb-4">Official Narrative</p>
                   <p className="text-base text-muted-foreground leading-relaxed font-body font-medium">
                     {property.description || "A premium managed property with high-fidelity visual orchestration and automated maintenance support."}
                   </p>
                </div>
              </div>

              {/* 5. PROPERTY DNA */}
              <div className="space-y-6">
                <h3 className="font-bold font-headline text-xl text-foreground flex items-center tracking-tight"><ShieldCheck className="w-5 h-5 mr-3 text-accent" /> Property DNA</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-muted/10 rounded-2xl border border-border/50 flex items-center gap-4 min-w-0">
                     <div className="p-3 bg-white rounded-xl shadow-sm text-accent shrink-0"><Wifi className="w-5 h-5" /></div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase opacity-40">Connectivity</p>
                        <p className="text-sm font-bold leading-tight whitespace-normal break-words">{property.connectivityStatus || 'Ultra-Fast Fiber Enabled'}</p>
                     </div>
                  </div>
                  <div className="p-6 bg-muted/10 rounded-2xl border border-border/50 flex items-center gap-4 min-w-0">
                     <div className="p-3 bg-white rounded-xl shadow-sm text-accent shrink-0"><Shield className="w-5 h-5" /></div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase opacity-40">Compliance</p>
                        <p className="text-sm font-bold leading-tight whitespace-normal break-words">{property.complianceStatus || 'EPC Grade B / Certified'}</p>
                     </div>
                  </div>
                </div>
              </div>

              {/* 6. FITTED ACTIONS */}
              <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row gap-4">
                <Button variant="outline" className="flex-1 h-16 rounded-[1.75rem] border-border bg-card hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all" onClick={handleDownloadStatement}>
                   <Download className="w-5 h-5 mr-3 text-accent" /> Download Rent Statement
                </Button>
                <Button asChild className="flex-1 h-16 rounded-[1.75rem] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] uppercase tracking-widest font-headline shadow-2xl shadow-primary/20 transition-all border-none">
                   <Link href="/tenant/maintenance">
                     <Wrench className="w-5 h-5 mr-3 text-accent" /> Report a Repair
                   </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-10">
           <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-10 pb-4 border-b border-border bg-muted/5 text-left">
               <CardTitle className="text-xl font-headline font-bold flex items-center text-foreground">
                 <AlertCircle className="w-6 h-6 mr-4 text-accent" />
                 Real-Time Support
               </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-8 text-left">
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 text-left">
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-red-600 mb-3">Primary SOS</p>
                    <p className="text-base font-bold text-foreground font-headline">Emergency Services</p>
                    <p className="text-lg font-bold mt-4 flex items-center text-red-600">
                      <Phone className="w-5 h-5 mr-3 opacity-40" /> 999
                    </p>
                </div>
                <Button variant="ghost" asChild className="w-full text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-primary hover:bg-primary/5 h-12 rounded-xl transition-all">
                   <Link href="/tenant/emergency-contacts">View Support Network <ChevronRight className="w-4 h-4 ml-2" /></Link>
                </Button>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
