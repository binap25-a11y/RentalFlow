"use client";

import { useState, use, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase,
} from '@/firebase';
import { doc, query, collection, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Loader2, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  AlertTriangle,
  History,
  CheckCircle2,
  FileDown,
  Gavel,
  Activity,
  ChevronRight
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { generateTenancyAgreement, type GenerateTenancyAgreementOutput } from "@/ai/flows/generate-tenancy-agreement";
import { format } from 'date-fns';
import { jsPDF } from "jspdf";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * @fileOverview Post-2026 Tenancy Compliance Orchestrator.
 * Optimized for professional resilience and refined, solicitor-grade aesthetics.
 */

export default function TenancyAgreementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const propertyId = resolvedParams.propertyId;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  const [isGenerating, setIsGenerating] = useState(false);
  const [agreementData, setAgreementData] = useState<GenerateTenancyAgreementOutput | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => { setIsClient(true); }, []);

  // NARRATIVE LOADING STEPS
  useEffect(() => {
    if (!isGenerating) {
      setLoadingStep(0);
      return;
    }
    const interval = setInterval(() => {
      setLoadingStep(prev => (prev + 1) % 4);
    }, 4500);
    return () => clearInterval(interval);
  }, [isGenerating]);

  const loadingMessages = [
    "Establishing legal identities...",
    "Synthesizing 2026 statutory clauses...",
    "Validating periodic structure...",
    "Finalizing solicitor-grade draft..."
  ];

  const propertyRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'properties', propertyId);
  }, [db, propertyId]);

  const { data: property, isLoading: isPropLoading } = useDoc(propertyRef);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'tenantProfiles'), 
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: tenants } = useCollection(tenantsQuery);
  const activeTenant = tenants?.[0];

  const handleGenerate = async () => {
    if (!property || !activeTenant || !user) {
      toast({ variant: "destructive", title: "Missing Context", description: "Verify asset and resident assignment." });
      return;
    }

    setIsGenerating(true);
    setAgreementData(null);
    
    try {
      const result = await generateTenancyAgreement({
        propertyAddress: `${property.addressLine1}, ${property.city} ${property.zipCode}`,
        landlordName: user.displayName || 'Authorized Landlord',
        tenantName: `${activeTenant.firstName} ${activeTenant.lastName}`,
        rentAmount: property.rentAmount || 0,
        startDate: format(new Date(), 'yyyy-MM-dd'),
        petPolicy: "Tenant has statutory right to request pets as per the Renters' Rights Act 2024. Landlord may require pet insurance as a condition of consent."
      });

      setAgreementData(result);
      
      if (result.agreementText.includes('Synchronization Pending')) {
        toast({ 
          variant: "destructive",
          title: "Synchronization Delay", 
          description: "Intelligence relay is handing peak load. Please re-trigger the generation." 
        });
      } else {
        toast({ title: "Agreement Finalized", description: "Solicitor-grade draft synchronized." });
      }
    } catch (e) {
      toast({ variant: "destructive", title: "Sync Interrupted", description: "Orchestration delay encountered. Please retry." });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!agreementData || !property) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    pdf.setFillColor(15, 23, 42); 
    pdf.rect(0, 0, pageWidth, 50, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("TENANCY AGREEMENT", 20, 25);
    pdf.setFontSize(9);
    pdf.setFont("helvetica", "normal");
    pdf.text("OFFICIAL COMPLIANCE RECORD: RENTERS' RIGHTS ACT 2024", 20, 35);
    pdf.text(`GENERATED VIA RENTALFLOW INTELLIGENCE: ${format(new Date(), 'PPPP')}`, 20, 42);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(10);
    const splitText = pdf.splitTextToSize(agreementData.agreementText, 170);
    
    let y = 70;
    splitText.forEach((line: string) => {
      if (y > 280) {
        pdf.addPage();
        y = 20;
      }
      pdf.text(line, 20, y);
      y += 6;
    });

    if (y > 240) { pdf.addPage(); y = 20; }
    y += 20;
    pdf.setFont("helvetica", "bold");
    pdf.text("EXECUTION & SIGNATURES", 20, y);
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.text("__________________________", 20, y);
    pdf.text("__________________________", 120, y);
    y += 8;
    pdf.text(`Landlord: ${user?.displayName || 'Authorized Signatory'}`, 20, y);
    pdf.text(`Tenant: ${activeTenant?.firstName} ${activeTenant?.lastName}`, 120, y);

    pdf.save(`Agreement_${property.addressLine1.replace(/\s+/g, '_')}_2026.pdf`);
    toast({ title: "Binary Record Saved" });
  };

  if (!isClient || isPropLoading) return <div className="flex h-[70vh] items-center justify-center opacity-40"><Loader2 className="animate-spin text-primary w-12 h-12" /></div>;

  return (
    <div className="max-w-6xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32 text-left bg-background">
      <div className="flex flex-col gap-8 text-left border-b border-white/5 pb-12">
        <div className="flex items-center gap-6">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-2xl hover:bg-primary/5 transition-colors h-12 w-12 border border-white/5 shrink-0 shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1 space-y-1">
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1 rounded-full font-bold uppercase tracking-[0.2em] text-[10px] mb-2">
               <Gavel className="w-3.5 h-3.5 mr-2" /> Renters' Rights Act 2024
            </Badge>
            <h1 className="text-4xl md:text-5xl font-headline font-bold text-foreground tracking-tighter">Agreement Orchestrator</h1>
            <p className="text-muted-foreground font-medium font-body text-lg opacity-60">
              Generating statutory periodic agreements for {property?.addressLine1}.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 space-y-10">
           <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="bg-primary/5 p-10 border-b text-left">
               <CardTitle className="text-2xl font-headline text-foreground flex items-center gap-4 tracking-tight">
                 <ShieldCheck className="w-7 h-7 text-accent" />
                 Context Ledger
               </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-10 text-left">
                <div className="space-y-4">
                   <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Assigned Identity</p>
                   {activeTenant ? (
                     <div className="flex items-center gap-5 p-6 bg-muted/30 rounded-[2rem] border border-border shadow-inner">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg shadow-sm border border-primary/5">
                           {activeTenant.firstName[0]}{activeTenant.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                           <p className="font-bold text-lg text-foreground truncate tracking-tight">{activeTenant.firstName} {activeTenant.lastName}</p>
                           <p className="text-xs text-muted-foreground font-medium truncate opacity-70">{activeTenant.email}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="p-6 bg-red-500/5 rounded-[2rem] border border-red-500/10 flex items-center gap-4 text-red-600">
                        <AlertTriangle className="w-6 h-6" />
                        <span className="text-[11px] font-bold uppercase tracking-widest">Resident pending</span>
                     </div>
                   )}
                </div>

                <div className="space-y-4 pt-10 border-t border-border/50">
                   <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Asset DNA</p>
                   <div className="grid gap-4">
                      <div className="flex justify-between items-center text-sm font-bold text-foreground">
                         <span className="opacity-40">Monthly Rent</span>
                         <span className="text-xl tracking-tighter">£{property?.rentAmount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-sm font-bold text-foreground">
                         <span className="opacity-40">Agreement Tier</span>
                         <Badge className="bg-accent/10 text-accent border-none uppercase tracking-widest text-[9px] px-3 h-7">Solicitor Grade</Badge>
                      </div>
                   </div>
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !activeTenant}
                  className="w-full h-14 rounded-2xl font-bold bg-primary text-primary-foreground shadow-xl transition-all hover:scale-[1.01] border-none font-headline uppercase tracking-[0.2em] text-[11px] group"
                >
                  {isGenerating ? (
                    <div className="flex flex-col items-center gap-1">
                      <Loader2 className="w-5 h-5 animate-spin text-accent" />
                      <span className="text-[8px] opacity-60 animate-pulse">{loadingMessages[loadingStep]}</span>
                    </div>
                  ) : (
                    <><Sparkles className="w-5 h-5 mr-3 text-accent group-hover:rotate-12 transition-transform" /> Orchestrate AST Draft</>
                  )}
                </Button>
             </CardContent>
           </Card>

           <Card className="border-none shadow-sm rounded-[3rem] bg-accent text-white overflow-hidden text-left relative group">
             <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 blur-3xl rounded-full transition-transform duration-1000 group-hover:scale-150" />
             <CardContent className="p-12 space-y-8 relative z-10">
                <div className="p-8 bg-white/10 rounded-[2.5rem] border border-white/20 shadow-inner space-y-4 backdrop-blur-sm">
                   <p className="text-[11px] font-bold uppercase opacity-60 tracking-[0.4em] font-headline">Renters' Rights Act 2024</p>
                   <p className="text-base font-medium leading-relaxed opacity-90">Every draft is calibrated for the <strong className="text-white">May 2026 Enforcement</strong>, mandating rolling periodic structures and the abolition of Section 21.</p>
                </div>
                <div className="flex items-center gap-4 px-2">
                   <Gavel className="w-6 h-6 text-white/60" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Verified Legal Covenants</span>
                </div>
             </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-8 space-y-10">
           <Card className="border-none shadow-2xl rounded-[3.5rem] bg-card overflow-hidden ring-1 ring-border h-full flex flex-col min-h-[850px]">
             <CardHeader className="p-12 border-b border-border bg-white/[0.01] flex flex-row items-center justify-between gap-6">
                <div className="text-left space-y-1">
                  <CardTitle className="text-3xl font-bold font-headline text-foreground tracking-tight">Official Draft Preview</CardTitle>
                  <div className="flex items-center gap-2">
                    <Activity className="w-3.5 h-3.5 text-accent animate-pulse" />
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-60">Verified Statutory Residential Lease (Post-2026)</p>
                  </div>
                </div>
                {agreementData && !agreementData.agreementText.includes('Synchronization Pending') && (
                  <Button onClick={handleDownloadPDF} className="rounded-xl h-11 px-8 font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all font-headline text-[10px] uppercase tracking-widest shrink-0">
                     <FileDown className="w-4 h-4 mr-2" /> Save to Vault
                  </Button>
                )}
             </CardHeader>
             <CardContent className="flex-1 p-0 relative bg-white/[0.01]">
               <ScrollArea className="h-[750px] w-full">
                 <div className="p-16 text-left space-y-16">
                   {!agreementData ? (
                     <div className="h-[500px] flex flex-col items-center justify-center text-center opacity-30 gap-10">
                        <div className="p-10 bg-muted rounded-[3rem] shadow-inner">
                           <History className="w-20 h-20 text-foreground" />
                        </div>
                        <div className="space-y-3">
                          <p className="text-2xl font-bold font-headline text-foreground uppercase tracking-[0.2em]">Awaiting Intelligence Draft</p>
                          <p className="text-base font-medium text-foreground max-w-sm mx-auto leading-relaxed">Initialize the orchestration layer to generate a high-fidelity agreement.</p>
                        </div>
                     </div>
                   ) : agreementData.agreementText.includes('Synchronization Pending') ? (
                      <div className="h-[500px] flex flex-col items-center justify-center text-center gap-10 animate-in fade-in duration-700">
                        <div className="p-10 bg-amber-500/10 rounded-[3rem] shadow-inner ring-1 ring-amber-500/20">
                          <AlertTriangle className="w-20 h-20 text-amber-500 animate-pulse" />
                        </div>
                        <div className="space-y-4">
                          <p className="text-3xl font-bold font-headline text-foreground uppercase tracking-tight">Sync Delay Encountered</p>
                          <p className="text-lg text-muted-foreground font-medium max-w-md mx-auto leading-relaxed">The solicitor-grade engine is experiencing a peak volume cycle. Please re-trigger the generation now.</p>
                        </div>
                        <Button onClick={handleGenerate} variant="outline" className="rounded-xl h-12 px-10 font-bold font-headline uppercase tracking-[0.2em] text-[10px] border-border hover:bg-primary/5 transition-all shadow-xl">
                          Re-trigger Orchestration <ChevronRight className="w-4 h-4 ml-3" />
                        </Button>
                      </div>
                   ) : (
                     <div className="animate-in fade-in slide-in-from-bottom-8 duration-1000">
                        {agreementData.keyComplianceNotes.length > 0 && (
                          <div className="mb-16 p-10 bg-emerald-500/5 rounded-[3rem] border border-emerald-500/10 space-y-8 shadow-inner">
                             <div className="flex items-center gap-3">
                               <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                               <p className="text-[12px] font-bold uppercase tracking-[0.4em] text-emerald-600 font-headline">Compliance Verification Log</p>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {agreementData.keyComplianceNotes.map((note, i) => (
                                  <div key={i} className="flex items-start gap-4 text-[13px] font-bold text-foreground/80 leading-tight">
                                     <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" /> {note}
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}
                        <div className="prose prose-blue dark:prose-invert max-w-none">
                           <pre className="whitespace-pre-wrap font-body text-lg leading-loose text-foreground/80 bg-transparent p-0 border-none select-text">
                              {agreementData.agreementText}
                           </pre>
                        </div>
                     </div>
                   )}
                 </div>
               </ScrollArea>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}
