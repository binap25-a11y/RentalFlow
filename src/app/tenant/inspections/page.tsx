"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  getTenantCollectionQuery,
  updateDocumentNonBlocking
} from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  ShieldCheck, Loader2, ClipboardList, CheckCircle2, 
  FileDown, Clock, MapPin, Activity, PenTool, Sparkles, AlertTriangle,
  Gavel
} from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

/**
 * @fileOverview High-Fidelity Resident Audit Portal.
 * Tenants can review professional property audits and provide digital verification signatures.
 */

export default function TenantInspectionsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "properties", userId: user.uid });
  }, [db, user]);
  const { data: properties } = useCollection(propertiesQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "inspections", userId: user.uid });
  }, [db, user]);
  const { data: inspections, loading: isLoading } = useCollection(inspectionsQuery);

  const [activeInspection, setActiveInspection] = useState<any>(null);
  const [signatureName, setSignatureName] = useState('');
  const [isCertified, setIsCertified] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleOpenReport = (inspection: any) => {
    setActiveInspection(inspection);
    setSignatureName(inspection.tenantSignature || user?.displayName || inspection.targetResidentName || '');
    setIsCertified(!!inspection.tenantSignature);
  };

  const handleSignReport = async () => {
    if (!db || !activeInspection || !signatureName || !isCertified) return;
    
    setIsSaving(true);
    const inspectionRef = doc(db, 'inspections', activeInspection.id);
    updateDocumentNonBlocking(inspectionRef, {
      tenantSignature: signatureName,
      tenantSignedAt: new Date().toISOString(),
      updatedAt: serverTimestamp(),
    });

    toast({ title: "Residency Handshake Complete", description: "Audit record verified and synchronized." });
    setIsSaving(false);
    setActiveInspection(null);
  };

  const handleDownloadPDF = async (inspection: any) => {
    const property = properties.find(p => p.id === inspection.propertyId);
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(15, 23, 42); 
    pdf.rect(0, 0, pageWidth, 50, "F");
    pdf.setTextColor(255, 255, 255); 
    pdf.setFont("helvetica", "bold"); 
    pdf.setFontSize(22);
    pdf.text("RESIDENT AUDIT REVIEW", 20, 25);
    pdf.setFontSize(9);
    pdf.text(`OFFICIAL PORTFOLIO COMPLIANCE RECORD | ASSET: ${property?.addressLine1 || 'Property'}`, 20, 35);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.text("EXECUTIVE SUMMARY", 20, 70);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const summaryLines = pdf.splitTextToSize(inspection.summary || "No summary provided.", 170);
    pdf.text(summaryLines, 20, 80);

    let y = 100 + (summaryLines.length * 6);
    if (y > 220) { pdf.addPage(); y = 25; }
    
    pdf.setFont("helvetica", "bold");
    pdf.text("EXECUTION & SIGNATURES", 20, y);
    y += 15;

    // Landlord Sig Row
    pdf.line(20, y + 15, 90, y + 15);
    pdf.text("Landlord Verified", 20, y + 22);
    pdf.setFont("helvetica", "bold");
    if (inspection.landlordSignature) {
      pdf.setFont("courier", "bolditalic");
      pdf.text(inspection.landlordSignature, 20, y + 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      const ts = inspection.landlordSignedAt ? format(new Date(inspection.landlordSignedAt), 'PPp') : 'Recently';
      pdf.text(`Verified: ${ts}`, 20, y + 27);
      pdf.setFontSize(10);
    }

    // Tenant Sig Row
    pdf.line(120, y + 15, 190, y + 15);
    pdf.text("Resident Verified", 120, y + 22);
    if (inspection.tenantSignature) {
      pdf.setFont("courier", "bolditalic");
      pdf.text(inspection.tenantSignature, 120, y + 14);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7);
      const ts = format(new Date(inspection.tenantSignedAt), 'PPp');
      pdf.text(`Verified: ${ts}`, 120, y + 27);
      pdf.setFontSize(10);
    }

    pdf.save(`Audit_Review_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast({ title: "Compliance Review Saved" });
  };

  if (!isClient) return null;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto text-left pb-24 bg-background">
      <div className="space-y-4">
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-5 py-2 rounded-full font-bold uppercase tracking-[0.25em] text-[10px] mb-2">
           <ShieldCheck className="w-4 h-4 mr-2" /> Verified Compliance History
        </Badge>
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-foreground tracking-tighter">Audits & Safety</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70 leading-relaxed max-w-3xl">
          Review professional site audits, safety certifications, and provide digital verification for your residency records.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-10">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-bold font-headline flex items-center text-foreground tracking-tight">
              <ClipboardList className="w-7 h-7 mr-4 text-accent" />
              Property Audit Trail
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40 font-headline">Compliance Ledger</p>
          </div>

          <div className="grid gap-6">
            {isLoading ? (
              <div className="py-32 flex flex-col items-center justify-center gap-6 opacity-40">
                <Loader2 className="w-12 h-12 animate-spin text-primary" />
                <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground font-headline">Synchronizing Records...</p>
              </div>
            ) : !inspections || inspections.length === 0 ? (
              <Card className="py-32 text-center bg-muted/5 rounded-[4rem] border-2 border-dashed border-border group hover:border-primary/20 transition-all shadow-inner flex flex-col items-center justify-center">
                <div className="p-10 bg-muted rounded-[3rem] mb-10 transition-transform group-hover:scale-110">
                   <ClipboardList className="w-20 h-20 text-foreground/10" />
                </div>
                <h3 className="text-2xl font-bold font-headline text-foreground opacity-30 uppercase tracking-[0.3em]">No Audit Records Initialized</h3>
              </Card>
            ) : (
              inspections.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map((inspection) => (
                <Card key={inspection.id} className="border-none shadow-sm hover:shadow-2xl transition-all duration-700 rounded-[3.5rem] group overflow-hidden bg-card ring-1 ring-border">
                  <CardContent className="p-10">
                    <div className="flex flex-col md:flex-row justify-between items-center gap-10">
                      <div className="flex items-center gap-10 flex-1 min-w-0">
                        <div className="bg-primary/5 p-6 rounded-[2rem] flex flex-col items-center justify-center text-foreground font-headline min-w-[100px] shadow-inner ring-1 ring-border group-hover:bg-accent/5 transition-colors">
                           <span className="text-[11px] font-bold uppercase tracking-[0.3em] opacity-40">{format(new Date(inspection.scheduledDate), 'MMM')}</span>
                           <span className="text-4xl font-bold tracking-tighter">{format(new Date(inspection.scheduledDate), 'dd')}</span>
                        </div>
                        <div className="text-left flex-1 min-w-0">
                           <div className="flex flex-wrap items-center gap-3 mb-3">
                              <Badge className={cn("uppercase text-[9px] font-bold px-5 py-1.5 tracking-[0.2em] rounded-full border-none shadow-sm font-headline", inspection.status === 'completed' ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white')}>
                                {inspection.status === 'completed' ? 'Verified' : 'Pending Review'}
                              </Badge>
                              {inspection.tenantSignature && (
                                <Badge className="bg-blue-500/10 text-blue-600 border-none uppercase text-[9px] font-bold px-4 py-1.5 rounded-full font-headline">Resident Signed</Badge>
                              )}
                           </div>
                           <h4 className="text-2xl font-bold font-headline text-foreground group-hover:text-accent transition-colors leading-tight tracking-tight">Professional Property Audit</h4>
                           <p className="text-xs text-muted-foreground font-bold flex items-center mt-3 opacity-60 uppercase tracking-widest"><MapPin className="w-4 h-4 mr-2 text-accent" />{properties.find(p => p.id === inspection.propertyId)?.addressLine1 || 'Portfolio Asset'}</p>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
                        <Button className="flex-1 rounded-xl h-11 px-8 font-bold bg-primary text-primary-foreground uppercase tracking-widest text-[10px] transition-all hover:scale-[1.02]" onClick={() => handleOpenReport(inspection)}>
                           {inspection.tenantSignature ? <><ClipboardList className="w-4 h-4 mr-2" /> Review Report</> : <><PenTool className="w-4 h-4 mr-2" /> Review & Sign</>}
                        </Button>
                        {inspection.status === 'completed' && (
                          <Button variant="outline" className="flex-1 rounded-xl h-11 px-6 font-bold border-border bg-card shadow-sm hover:bg-muted text-[10px] uppercase tracking-widest" onClick={() => handleDownloadPDF(inspection)}>
                            <FileDown className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-12">
           <Card className="border-none shadow-2xl rounded-[3rem] bg-accent text-white overflow-hidden text-left relative group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full transition-transform duration-1000 group-hover:scale-150" />
             <CardHeader className="pb-6 p-10">
                <CardTitle className="text-2xl font-bold font-headline flex items-center gap-4">
                   <Activity className="w-8 h-8 text-white/90" /> Compliance Pulse
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 px-10 pb-12">
                <div className="p-8 bg-white/10 rounded-[2.5rem] border border-white/10 shadow-inner space-y-4 backdrop-blur-md">
                   <p className="text-[10px] font-bold uppercase opacity-60 tracking-[0.4em] font-headline">Safety Commitment</p>
                   <p className="text-base font-medium leading-relaxed opacity-90">Every audit is conducted by a qualified professional to ensure your residency meets the highest safety and quality standards.</p>
                </div>
                <div className="flex items-center gap-4 px-2">
                   <ShieldCheck className="w-6 h-6 text-white/60" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Certified Assets & Records</span>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>

      <Dialog open={activeInspection !== null} onOpenChange={(o) => !o && setActiveInspection(null)}>
        <DialogContent className="sm:max-w-[800px] p-0 rounded-[3rem] border-none shadow-2xl flex flex-col h-[85vh] overflow-hidden bg-card ring-1 ring-white/10">
           <div className="p-10 bg-primary/5 border-b shrink-0 text-left relative">
              <div className="absolute top-0 right-0 p-8 opacity-5"><ClipboardList className="w-24 h-24" /></div>
              <DialogTitle className="text-3xl font-headline font-bold text-foreground tracking-tighter">Audit Review Hub</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-sm mt-2">Official findings ledger for {properties.find(p => p.id === activeInspection?.propertyId)?.addressLine1}.</DialogDescription>
           </div>
           
           <ScrollArea className="flex-1">
             <div className="p-10 space-y-12 pb-32 text-left">
                {activeInspection?.summary && (
                  <div className="space-y-6">
                     <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Executive Summary</p>
                     <div className="p-8 bg-muted/20 rounded-[2.5rem] border border-border shadow-inner relative">
                        <p className="text-xl font-medium text-foreground leading-relaxed italic">"{activeInspection.summary}"</p>
                        <Badge className="absolute top-0 right-8 -translate-y-1/2 bg-emerald-500 text-white font-bold h-8 px-6 rounded-full uppercase text-[10px] tracking-widest shadow-xl">
                          Health Score: {activeInspection.healthScore}/100
                        </Badge>
                     </div>
                  </div>
                )}

                {activeInspection?.priorityItems?.length > 0 && (
                  <div className="space-y-6">
                     <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-red-500 opacity-50 font-headline">Maintenance Roadmap</p>
                     <div className="grid gap-4">
                        {activeInspection.priorityItems.map((item: string, i: number) => (
                          <div key={i} className="flex gap-5 items-center p-5 bg-red-500/5 rounded-2xl border border-red-500/10">
                             <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
                             <span className="text-sm font-bold text-foreground">{item}</span>
                          </div>
                        ))}
                     </div>
                  </div>
                )}

                <div className="p-10 bg-amber-500/5 rounded-[3rem] border border-amber-500/10 space-y-10">
                    <div className="flex items-center justify-between">
                        <div>
                            <h4 className="text-2xl font-bold font-headline text-amber-900 dark:text-amber-100">Residency Verification</h4>
                            <p className="text-sm text-amber-800/60 font-medium mt-1">Review the findings above and affix your digital acknowledgment.</p>
                        </div>
                        <PenTool className="w-10 h-10 text-amber-600 opacity-40" />
                    </div>

                    <div className="space-y-8">
                        <div className="space-y-3">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-amber-800/40 font-headline">Full Legal Name (Digital Handshake)</Label>
                            <Input 
                              value={signatureName} 
                              onChange={(e) => setSignatureName(e.target.value)} 
                              placeholder="Type your name to sign..."
                              className="h-14 rounded-2xl border-amber-500/20 bg-white/40 font-bold text-lg px-8 text-amber-950 font-headline italic shadow-inner"
                              disabled={!!activeInspection?.tenantSignature}
                            />
                        </div>

                        {!activeInspection?.tenantSignature && (
                          <div className="flex items-start gap-5 p-8 bg-white/60 rounded-3xl border border-amber-500/10 shadow-sm transition-all hover:bg-white/80">
                              <Checkbox 
                                id="res-certify" 
                                checked={isCertified} 
                                onCheckedChange={(checked) => setIsCertified(!!checked)}
                                className="w-7 h-7 rounded-xl border-amber-500/40 data-[state=checked]:bg-amber-600 mt-1"
                              />
                              <div className="grid gap-2 leading-tight">
                                  <label htmlFor="res-certify" className="text-base font-bold text-amber-900 cursor-pointer leading-relaxed">
                                      I acknowledge receipt of this property audit and certify that the findings accurately represent the condition of the asset as I observe it today, {format(new Date(), 'PPp')}.
                                  </label>
                              </div>
                          </div>
                        )}

                        {activeInspection?.tenantSignature && (
                          <div className="p-8 bg-emerald-500/10 rounded-3xl border border-emerald-500/20 flex items-center justify-between">
                             <div className="flex items-center gap-4">
                                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                                <div>
                                   <p className="text-lg font-bold text-emerald-900">Digitally Verified</p>
                                   <p className="text-[10px] font-bold text-emerald-800/60">{format(new Date(activeInspection.tenantSignedAt), 'PPp')}</p>
                                </div>
                             </div>
                             <ShieldCheck className="w-10 h-10 text-emerald-600 opacity-20" />
                          </div>
                        )}
                    </div>
                </div>

                <div className="p-10 bg-primary/5 rounded-[3rem] border border-border flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <div className="p-5 bg-white dark:bg-muted rounded-[1.5rem] shadow-xl text-accent border border-border">
                           <Gavel className="w-8 h-8" />
                        </div>
                        <div className="text-left">
                           <p className="text-xl font-bold text-foreground font-headline tracking-tight">Legal Audit Compliance</p>
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-60">
                             {activeInspection.landlordSignature ? `Verified by Landlord: ${activeInspection.landlordSignature}` : 'Awaiting Landlord Finalization'}
                           </p>
                        </div>
                    </div>
                    {activeInspection.landlordSignedAt && (
                      <div className="text-right">
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Digital Stamp</p>
                         <p className="text-xs font-bold text-foreground">{format(new Date(activeInspection.landlordSignedAt), 'PPp')}</p>
                      </div>
                    )}
                </div>
             </div>
           </ScrollArea>
           
           <DialogFooter className="p-8 bg-muted/5 border-t shrink-0 flex flex-col md:flex-row gap-4">
              <Button variant="outline" className="rounded-xl h-12 px-10 font-bold uppercase tracking-widest text-[10px] border-border" onClick={() => setActiveInspection(null)}>
                 Close Review
              </Button>
              {!activeInspection?.tenantSignature && (
                <Button className="rounded-xl h-12 px-12 font-bold bg-primary text-primary-foreground uppercase tracking-widest text-[10px] border-none shadow-2xl transition-all hover:scale-[1.01] active:scale-95" onClick={handleSignReport} disabled={isSaving || !signatureName || !isCertified}>
                   {isSaving ? <><Loader2 className="w-4 h-4 mr-3 animate-spin" /> Processing...</> : <><PenTool className="w-4 h-4 mr-3" /> Finalize Digital Handshake</>}
                </Button>
              )}
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
