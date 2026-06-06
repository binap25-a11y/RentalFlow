"use client";

import { useState, use, useEffect, useMemo } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase,
} from '@/firebase';
import { doc, query, collection, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  FileText, 
  Loader2, 
  Download, 
  ArrowLeft, 
  Sparkles, 
  ShieldCheck, 
  Users, 
  Calendar,
  AlertTriangle,
  History,
  CheckCircle2,
  FileDown
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { generateTenancyAgreement, type GenerateTenancyAgreementOutput } from "@/ai/flows/generate-tenancy-agreement";
import { format } from 'date-fns';
import { jsPDF } from "jspdf";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * @fileOverview Post-2026 Tenancy Compliance Orchestrator.
 * High-Fidelity agreement generation aligned with the Renters' Rights Act.
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

  useEffect(() => { setIsClient(true); }, []);

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
      toast({ variant: "destructive", title: "Missing Context", description: "Verify asset and resident assignment before proceeding." });
      return;
    }

    setIsGenerating(true);
    try {
      const result = await generateTenancyAgreement({
        propertyAddress: `${property.addressLine1}, ${property.city} ${property.zipCode}`,
        landlordName: user.displayName || 'The Landlord',
        tenantName: `${activeTenant.firstName} ${activeTenant.lastName}`,
        rentAmount: property.rentAmount || 0,
        startDate: new Date().toISOString(),
        petPolicy: "Tenant has statutory right to request pets as per the Renters' Rights Act 2024. Landlord may require pet insurance."
      });

      setAgreementData(result);
      toast({ title: "Agreement Synchronized", description: "2026 Compliance Protocol Applied." });
    } catch (e) {
      toast({ variant: "destructive", title: "Generation Failure" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadPDF = () => {
    if (!agreementData || !property) return;

    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    
    // --- HEADER ---
    pdf.setFillColor(15, 23, 42); 
    pdf.rect(0, 0, pageWidth, 50, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("TENANCY AGREEMENT", 20, 28);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("STATUTORY COMPLIANCE: RENTERS' RIGHTS ACT 2024", 20, 36);
    pdf.text(`Generated: ${format(new Date(), 'PPPP')}`, 20, 42);

    // --- CONTENT ---
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

    // --- SIGNATURES ---
    if (y > 240) { pdf.addPage(); y = 20; }
    y += 20;
    pdf.setFont("helvetica", "bold");
    pdf.text("SIGNATURES", 20, y);
    y += 15;
    pdf.setFont("helvetica", "normal");
    pdf.text("__________________________", 20, y);
    pdf.text("__________________________", 120, y);
    y += 8;
    pdf.text("Landlord Signature", 20, y);
    pdf.text("Tenant Signature", 120, y);

    pdf.save(`Agreement_${property.addressLine1.replace(/\s+/g, '_')}_2026.pdf`);
    toast({ title: "Binary Record Saved" });
  };

  if (!isClient || isPropLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-24 text-left">
      <div className="flex flex-col gap-6 text-left border-b border-white/5 pb-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-2xl hover:bg-primary/5 transition-colors h-10 w-10 border border-white/5 shrink-0 shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground tracking-tight">Compliance Orchestrator</h1>
            <p className="text-muted-foreground flex items-center font-medium font-body text-sm mt-1 opacity-60">
              Generating statutory agreements for {property?.addressLine1 || 'Asset'}.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-1 space-y-8">
           <Card className="border-none shadow-sm rounded-[2.5rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="bg-primary/5 p-8 border-b text-left">
               <CardTitle className="text-xl font-headline text-foreground flex items-center gap-3">
                 <ShieldCheck className="w-6 h-6 text-accent" />
                 Context Sync
               </CardTitle>
             </CardHeader>
             <CardContent className="p-8 space-y-8 text-left">
                <div className="space-y-4">
                   <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-50 font-headline">Assigned Resident</p>
                   {activeTenant ? (
                     <div className="flex items-center gap-4 p-4 bg-muted/30 rounded-2xl border border-border shadow-inner">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                           {activeTenant.firstName[0]}{activeTenant.lastName[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                           <p className="font-bold text-sm text-foreground truncate">{activeTenant.firstName} {activeTenant.lastName}</p>
                           <p className="text-[10px] text-muted-foreground font-medium truncate">{activeTenant.email}</p>
                        </div>
                     </div>
                   ) : (
                     <div className="p-4 bg-red-500/5 rounded-2xl border border-red-500/10 flex items-center gap-3 text-red-600">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">No Resident Assigned</span>
                     </div>
                   )}
                </div>

                <div className="space-y-4 pt-6 border-t border-border">
                   <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-50 font-headline">Asset Specs</p>
                   <div className="grid gap-3">
                      <div className="flex justify-between items-center text-xs font-bold text-foreground">
                         <span className="opacity-40">Monthly Rent</span>
                         <span>£{property?.rentAmount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs font-bold text-foreground">
                         <span className="opacity-40">Tenancy Type</span>
                         <span className="text-accent uppercase tracking-widest text-[9px]">Periodic (Statutory)</span>
                      </div>
                   </div>
                </div>

                <Button 
                  onClick={handleGenerate} 
                  disabled={isGenerating || !activeTenant}
                  className="w-full h-14 rounded-2xl font-bold bg-primary text-primary-foreground shadow-2xl transition-all hover:scale-[1.02] border-none font-headline uppercase tracking-[0.2em] text-[10px]"
                >
                  {isGenerating ? <Loader2 className="w-4 h-4 mr-3 animate-spin" /> : <Sparkles className="w-4 h-4 mr-3" />}
                  Orchestrate AI Draft
                </Button>
             </CardContent>
           </Card>

           <Card className="border-none shadow-sm rounded-[2.5rem] bg-accent text-white overflow-hidden text-left relative">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full" />
             <CardContent className="p-10 space-y-6">
                <div className="p-6 bg-white/10 rounded-[2rem] border border-white/10 shadow-inner space-y-3">
                   <p className="text-[10px] font-bold uppercase opacity-60 tracking-[0.3em] font-headline">Act Compliance (2026)</p>
                   <p className="text-sm font-medium leading-relaxed opacity-90">Drafts generated here exclude all Section 21 clauses and enforce rolling periodic structures as per the statutory updates.</p>
                </div>
             </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-2 space-y-8">
           <Card className="border-none shadow-2xl rounded-[3.5rem] bg-card overflow-hidden ring-1 ring-border h-full flex flex-col min-h-[700px]">
             <CardHeader className="p-10 border-b border-border bg-white/[0.01] flex flex-row items-center justify-between">
                <div className="text-left">
                  <CardTitle className="text-2xl font-bold font-headline text-foreground tracking-tight">Agreement Preview</CardTitle>
                  <p className="text-xs font-medium text-muted-foreground opacity-60">Statutory Residential Lease Draft</p>
                </div>
                {agreementData && (
                  <Button onClick={handleDownloadPDF} className="rounded-xl h-11 px-8 font-bold bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-700 transition-all font-headline text-[10px] uppercase tracking-widest">
                     <FileDown className="w-4 h-4 mr-2" /> Download PDF Record
                  </Button>
                )}
             </CardHeader>
             <CardContent className="flex-1 p-0 relative">
               <ScrollArea className="h-[600px] w-full">
                 <div className="p-12 text-left space-y-12">
                   {!agreementData ? (
                     <div className="h-[400px] flex flex-col items-center justify-center text-center opacity-30 gap-6">
                        <History className="w-16 h-16 text-foreground" />
                        <div>
                          <p className="text-lg font-bold font-headline text-foreground uppercase tracking-[0.3em]">Awaiting Intelligence Draft</p>
                          <p className="text-sm font-medium text-foreground max-w-xs mt-2">Use the side panel to initialize a post-2026 compliant agreement draft.</p>
                        </div>
                     </div>
                   ) : (
                     <div className="animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        {agreementData.keyComplianceNotes.length > 0 && (
                          <div className="mb-12 p-8 bg-emerald-500/5 rounded-[2.5rem] border border-emerald-500/10 space-y-6 shadow-inner">
                             <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-emerald-600 font-headline">Compliance Verification Log</p>
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {agreementData.keyComplianceNotes.map((note, i) => (
                                  <div key={i} className="flex items-center gap-3 text-xs font-bold text-foreground/80">
                                     <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {note}
                                  </div>
                                ))}
                             </div>
                          </div>
                        )}
                        <div className="prose prose-blue dark:prose-invert max-w-none">
                           <pre className="whitespace-pre-wrap font-body text-base leading-relaxed text-foreground/80 bg-transparent p-0 border-none">
                              {agreementData.agreementText}
                           </pre>
                        </div>
                        <div className="mt-24 pt-12 border-t border-border grid grid-cols-2 gap-20 opacity-40">
                           <div className="space-y-4">
                              <p className="text-[10px] font-bold uppercase tracking-widest font-headline">Landlord Identity</p>
                              <div className="h-px bg-foreground/20 w-full" />
                           </div>
                           <div className="space-y-4">
                              <p className="text-[10px] font-bold uppercase tracking-widest font-headline">Resident Identity</p>
                              <div className="h-px bg-foreground/20 w-full" />
                           </div>
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