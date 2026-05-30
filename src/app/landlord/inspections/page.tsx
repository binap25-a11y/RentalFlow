"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  setDocumentNonBlocking,
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  getLandlordCollectionQuery 
} from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, isValid } from "date-fns";
import { 
  Calendar as CalendarIcon, Loader2, 
  CheckCircle2, ClipboardList, ShieldAlert, Home, Wrench, 
  Check, X, AlertTriangle, Info, Trash2, Edit3, PlayCircle, Camera, Clock,
  Save, FileDown, Activity, ChevronRight
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, compressImage } from "@/lib/utils";
import { generateInspectionReport } from "@/ai/flows/generate-inspection-report";
import { uploadToSupabase } from '@/lib/actions/supabase-storage';
import Image from 'next/image';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const INSPECTION_SECTIONS = [
  { id: "exterior", title: "Exterior", icon: Home, items: ["Roof condition", "Walls, brickwork", "Windows and external doors", "Garden maintained", "Pathways safe and clear", "Bins accessible"] },
  { id: "safety", title: "Safety", icon: ShieldAlert, items: ["Smoke alarms tested", "CO alarm tested", "Electrical sockets safe", "Gas safety certificate", "EICR valid", "PAT Certificate", "No tampering"] },
  { id: "interior", title: "Interior", icon: Info, items: ["Walls, ceilings, floors", "No signs of damp", "Windows functional", "Internal doors/locks", "Adequate ventilation", "Cleanliness"] },
  { id: "kitchen", title: "Kitchen", icon: CheckCircle2, items: ["Cupboards & floors", "Sink and taps", "Oven and hob", "Fridge freezer", "Washing machine", "Ventilation"] },
  { id: "bathrooms", title: "Bath", icon: Wrench, items: ["Toilet flushing", "Shower/bath working", "No leaks detected", "Extractor fan", "Sealant and grout", "No damp detected"] },
  { id: "heating", title: "Utility", icon: AlertTriangle, items: ["Boiler functioning", "Radiators heating", "Thermostat working", "Hot water supply"] },
  { id: "bedrooms", title: "Sleep", icon: Home, items: ["Windows and locks", "Heating functional", "No damp/mould", "Flooring condition", "Furniture condition"] }
];

export default function InspectionsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: allProperties, loading: isPropLoading } = useCollection(propertiesQuery);

  const activeProperties = useMemo(() => 
    allProperties?.filter(p => !p.isDeleted && p.addressLine1) || [], 
  [allProperties]);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "inspections", user.uid);
  }, [db, user]);

  const { data: inspections, loading: isInspLoading } = useCollection(inspectionsQuery);

  const [date, setDate] = useState<Date>();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [activeInspection, setActiveInspection] = useState<any>(null);
  const [structuredFindings, setStructuredFindings] = useState<Record<string, { status: 'pass' | 'fail', notes: string, imageUrl?: string, isSyncing?: boolean }>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const [editingMetadata, setEditingMetadata] = useState<any>(null);
  const [editDate, setEditDate] = useState<Date>();
  const [editPropertyId, setEditPropertyId] = useState('');

  const handleOpenAudit = (inspection: any) => {
    setActiveInspection(inspection);
    setStructuredFindings(inspection.structuredFindings || {});
  };

  const handleOpenEditMetadata = (inspection: any) => {
    setEditingMetadata(inspection);
    setEditDate(new Date(inspection.scheduledDate));
    setEditPropertyId(inspection.propertyId);
  };

  const handleUpdateMetadata = async () => {
    if (!db || !editingMetadata || !editDate || !editPropertyId) return;
    const inspectionRef = doc(db, 'inspections', editingMetadata.id);
    const property = activeProperties.find(p => p.id === editPropertyId);
    updateDocumentNonBlocking(inspectionRef, {
      propertyId: editPropertyId,
      scheduledDate: editDate.toISOString(),
      memberIds: property?.memberIds || [user?.uid],
      updatedAt: serverTimestamp(),
    });
    toast({ title: "Audit Metadata Updated" });
    setEditingMetadata(null);
  };

  const syncFindingsToFirestore = (updatedFindings: any) => {
    if (!db || !activeInspection) return;
    const inspectionRef = doc(db, 'inspections', activeInspection.id);
    updateDocumentNonBlocking(inspectionRef, {
      structuredFindings: updatedFindings,
      updatedAt: serverTimestamp(),
    });
  };

  const handleStatusChange = (itemId: string, status: 'pass' | 'fail') => {
    setStructuredFindings(prev => {
      const updated = { ...prev, [itemId]: { ...prev[itemId], status } };
      syncFindingsToFirestore(updated);
      return updated;
    });
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setStructuredFindings(prev => ({ ...prev, [itemId]: { ...prev[itemId], notes } }));
  };

  const handleNotesBlur = (itemId: string) => {
    syncFindingsToFirestore(structuredFindings);
  };

  const handleImageUpload = async (itemId: string, file: File | null) => {
    if (!file || !user || !activeInspection) return;
    setStructuredFindings(prev => ({ ...prev, [itemId]: { ...prev[itemId], isSyncing: true } }));
    try {
      const optimizedBlob = await compressImage(file);
      const path = `${user.uid}/${activeInspection.propertyId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const formData = new FormData();
      formData.append('file', optimizedBlob, file.name);
      const result = await uploadToSupabase(formData, 'Property-Images-', path);
      if (!result.success) throw new Error(result.error);
      
      setStructuredFindings(prev => {
        const updated = { ...prev, [itemId]: { ...prev[itemId], imageUrl: result.url, isSyncing: false } };
        syncFindingsToFirestore(updated);
        return updated;
      });
      toast({ title: "Evidence Synchronized" });
    } catch (err: any) {
      setStructuredFindings(prev => ({ ...prev, [itemId]: { ...prev[itemId], isSyncing: false } }));
      toast({ variant: "destructive", title: "Sync Failed", description: err.message });
    }
  };

  const handleSchedule = () => {
    if (!user || !db || !selectedPropertyId || !date) return;
    const property = activeProperties.find(p => p.id === selectedPropertyId);
    const inspectionId = doc(collection(db, 'inspections')).id;
    const inspectionRef = doc(db, 'inspections', inspectionId);
    setDocumentNonBlocking(inspectionRef, {
      id: inspectionId,
      propertyId: selectedPropertyId,
      landlordId: user.uid,
      memberIds: property?.memberIds || [user.uid],
      scheduledDate: date.toISOString(),
      status: 'scheduled',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });
    toast({ title: "Inspection Scheduled" });
    setSelectedPropertyId('');
    setDate(undefined);
  };

  const handleFinalizeAudit = async () => {
    if (!db || !activeInspection || !user) return;
    
    const entries = Object.entries(structuredFindings);
    if (entries.length === 0) {
      toast({ variant: "destructive", title: "Context Required", description: "Record findings before finalizing." });
      return;
    }

    setIsGenerating(true);
    const property = activeProperties.find(p => p.id === activeInspection.propertyId);
    
    try {
      const findingsString = entries.map(([item, data]: [string, any]) => {
        return `${item}: ${data.status?.toUpperCase() || 'UNCHECKED'} ${data.notes ? `(Notes: ${data.notes})` : ''}`;
      }).join('\n');

      const aiReport = await generateInspectionReport({
        propertyAddress: property?.addressLine1 || 'Property Asset',
        findings: findingsString
      });

      const inspectionRef = doc(db, 'inspections', activeInspection.id);
      updateDocumentNonBlocking(inspectionRef, {
        status: 'completed',
        structuredFindings: structuredFindings,
        summary: aiReport.summary,
        priorityItems: aiReport.priorityItems,
        healthScore: aiReport.healthScore,
        conductedDate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Audit Finalized" });
      setActiveInspection(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Synchronization Timeout" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = async (inspection: any) => {
    const property = activeProperties.find(p => p.id === inspection.propertyId);
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();

    // --- HEADER ---
    pdf.setFillColor(30, 58, 138); 
    pdf.rect(0, 0, pageWidth, 45, "F");
    pdf.setTextColor(255, 255, 255); 
    pdf.setFont("helvetica", "bold"); 
    pdf.setFontSize(24);
    pdf.text("PROPERTY AUDIT REPORT", 20, 28);
    pdf.setFontSize(10); 
    pdf.setFont("helvetica", "normal");
    pdf.text("OFFICIAL COMPLIANCE RECORD", 20, 36);

    // --- ASSET IDENTITY ---
    pdf.setTextColor(0, 0, 0); 
    pdf.setFontSize(14); 
    pdf.setFont("helvetica", "bold");
    pdf.text("ASSET IDENTITY", 20, 60);
    pdf.setFontSize(11); 
    pdf.setFont("helvetica", "normal");
    pdf.text(`${property?.addressLine1 || 'Property Asset'}`, 20, 68);
    pdf.text(`${property?.city || ''}, ${property?.zipCode || ''}`, 20, 74);
    
    pdf.setFont("helvetica", "bold"); 
    pdf.text("DATE CONDUCTED:", 130, 68);
    pdf.setFont("helvetica", "normal"); 
    pdf.text(format(new Date(inspection.conductedDate || inspection.scheduledDate), 'PPP'), 130, 74);

    // --- HEALTH SCORE BANNER ---
    pdf.setFillColor(248, 250, 252); 
    pdf.rect(20, 85, 170, 25, "F");
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(20, 85, 170, 25, "D");
    pdf.setFont("helvetica", "bold"); 
    pdf.setFontSize(12); 
    pdf.text("PROPERTY HEALTH SCORE:", 30, 100);
    
    const score = inspection.healthScore || 0;
    if (score >= 80) pdf.setTextColor(22, 101, 52); // Green
    else if (score >= 60) pdf.setTextColor(180, 83, 9); // Amber
    else pdf.setTextColor(185, 28, 28); // Red
    
    pdf.setFontSize(18); 
    pdf.text(`${score}/100`, 160, 100, { align: 'right' });
    pdf.setTextColor(0, 0, 0);

    // --- EXECUTIVE SUMMARY ---
    pdf.setFontSize(14); 
    pdf.setFont("helvetica", "bold");
    pdf.text("EXECUTIVE SUMMARY", 20, 125);
    pdf.setFont("helvetica", "normal"); 
    pdf.setFontSize(10);
    const summaryLines = pdf.splitTextToSize(inspection.summary || "Manual compliance summary recorded within the ledger.", 170);
    pdf.text(summaryLines, 20, 135);

    let y = 135 + (summaryLines.length * 6);

    // --- PRIORITY ACTIONS ---
    if (inspection.priorityItems && inspection.priorityItems.length > 0) {
      if (y > 250) { pdf.addPage(); y = 25; }
      pdf.setFontSize(14); 
      pdf.setFont("helvetica", "bold");
      pdf.text("CRITICAL FIX STRATEGY", 20, y + 10);
      y += 20;
      pdf.setFontSize(10); 
      pdf.setFont("helvetica", "normal");
      inspection.priorityItems.forEach((item: string) => {
        if (y > 270) { pdf.addPage(); y = 25; }
        pdf.text(`• ${item}`, 25, y);
        y += 7;
      });
      y += 10;
    }

    // --- DETAILED AUDIT LEDGER ---
    if (inspection.structuredFindings) {
      if (y > 240) { pdf.addPage(); y = 25; }
      pdf.setFontSize(14); 
      pdf.setFont("helvetica", "bold");
      pdf.text("DETAILED AUDIT LEDGER", 20, y + 10);
      y += 22;
      
      pdf.setFontSize(8);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(100, 100, 100);
      pdf.text("INVENTORY ITEM", 20, y);
      pdf.text("STATUS", 170, y, { align: 'right' });
      pdf.setDrawColor(226, 232, 240);
      pdf.line(20, y + 2, 190, y + 2);
      y += 10;

      Object.entries(inspection.structuredFindings).forEach(([item, data]: [string, any]) => {
        if (y > 270) { pdf.addPage(); y = 25; }
        pdf.setTextColor(0, 0, 0);
        pdf.setFont("helvetica", "bold");
        pdf.setFontSize(10);
        pdf.text(item, 20, y);
        
        const isPass = data.status === 'pass';
        if (isPass) pdf.setTextColor(22, 101, 52);
        else pdf.setTextColor(185, 28, 28);
        
        pdf.text(data.status?.toUpperCase() || 'UNCHECKED', 170, y, { align: 'right' });
        
        pdf.setTextColor(100, 100, 100);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);
        if (data.notes) {
          y += 6;
          const noteLines = pdf.splitTextToSize(`Notes: ${data.notes}`, 160);
          pdf.text(noteLines, 25, y);
          y += (noteLines.length * 5);
        }
        y += 10;
      });
    }

    // --- FOOTER ---
    const pageCount = (pdf as any).internal.getNumberOfPages();
    for(let i = 1; i <= pageCount; i++) {
        pdf.setPage(i);
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(`RentalFlow Property Operations | Compliance Record | Page ${i} of ${pageCount}`, pageWidth / 2, 285, { align: 'center' });
    }

    pdf.save(`Audit_${property?.addressLine1.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast({ title: "Full Report Generated" });
  };

  if (!isClient || isPropLoading || isInspLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 text-left bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-3 py-1 rounded-full font-bold uppercase tracking-[0.15em] text-[9px] mb-2">
             <Activity className="w-3 h-3 mr-2" /> Compliance Monitoring
          </Badge>
          <h1 className="text-3xl font-headline font-bold text-foreground tracking-tight">Inspections & Audits</h1>
          <p className="text-muted-foreground font-medium font-body text-sm opacity-70">Official portfolio compliance tracking and safety records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-none shadow-sm h-fit rounded-[2.5rem] overflow-hidden bg-card ring-1 ring-border">
          <CardHeader className="bg-primary/5 p-8 border-b text-left">
            <CardTitle className="text-xl font-headline text-foreground tracking-tight">Schedule Audit</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground font-headline tracking-widest opacity-60">Select Asset</Label>
              <select className="flex h-12 w-full rounded-xl border-none bg-muted/20 px-4 py-2 text-sm focus:ring-2 focus:ring-accent outline-none font-bold text-foreground" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
                <option value="">Choose property...</option>
                {activeProperties.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground font-headline tracking-widest opacity-60">Audit Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-bold h-12 rounded-xl border-border bg-muted/20 font-body", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" /> {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <Button className="w-full rounded-xl h-12 font-bold bg-primary text-primary-foreground shadow-lg uppercase tracking-widest text-[10px] transition-all hover:scale-[1.01]" onClick={handleSchedule} disabled={!date || !selectedPropertyId}>Confirm Schedule</Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold font-headline flex items-center text-foreground px-2">
            <ClipboardList className="w-5 h-5 mr-3 text-accent" /> Compliance Ledger
          </h3>
          <div className="grid gap-4">
            {!inspections || inspections.length === 0 ? (
              <div className="py-20 text-center bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-border opacity-40">
                <p className="text-xs font-bold uppercase tracking-widest font-headline">No audit records found.</p>
              </div>
            ) : (
              inspections.slice().sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map((inspection) => (
                <Card key={inspection.id} className="border-none shadow-sm overflow-hidden bg-card rounded-[2.5rem] ring-1 ring-border group hover:shadow-md transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="bg-primary/5 p-4 rounded-2xl flex flex-col items-center justify-center text-foreground min-w-[90px] h-fit font-headline shadow-inner ring-1 ring-border">
                        <span className="text-[10px] font-bold uppercase tracking-widest opacity-40">{format(new Date(inspection.scheduledDate), 'MMM')}</span>
                        <span className="text-3xl font-bold">{format(new Date(inspection.scheduledDate), 'dd')}</span>
                      </div>
                      <div className="flex-1 space-y-4 text-left">
                        <div className="flex items-center justify-between">
                          <Badge variant={inspection.status === 'completed' ? 'secondary' : 'default'} className="uppercase font-bold text-[10px] tracking-widest px-4 py-1 rounded-full">{inspection.status}</Badge>
                          <div className="flex gap-2">
                            {inspection.status === 'completed' && (
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-accent hover:bg-accent/5 rounded-lg" onClick={() => handleDownloadReport(inspection)}><FileDown className="w-4 h-4" /></Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:bg-primary/5 rounded-lg" onClick={() => handleOpenEditMetadata(inspection)}><Edit3 className="w-4 h-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild><Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/40 hover:bg-destructive/5 rounded-lg"><Trash2 className="w-4 h-4" /></Button></AlertDialogTrigger>
                              <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl bg-card">
                                <AlertDialogHeader className="text-left"><AlertDialogTitle className="font-headline font-bold text-xl">Delete Record?</AlertDialogTitle><AlertDialogDescription className="text-muted-foreground font-medium mt-2">Permanently remove this audit. Irreversible.</AlertDialogDescription></AlertDialogHeader>
                                <AlertDialogFooter className="mt-6 gap-3"><AlertDialogCancel className="rounded-xl h-12 font-bold text-[10px] uppercase">Cancel</AlertDialogCancel><AlertDialogAction onClick={() => { if(db) deleteDocumentNonBlocking(doc(db, 'inspections', inspection.id)); toast({ title: "Record Removed" }); }} className="rounded-xl h-12 font-bold bg-red-600 text-white uppercase text-[10px] border-none">Delete</AlertDialogAction></AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <div>
                          <h4 className="text-lg font-bold font-headline text-foreground leading-none">{activeProperties.find(p => p.id === inspection.propertyId)?.addressLine1 || 'Property Asset'}</h4>
                          <p className="text-[10px] text-muted-foreground font-bold flex items-center mt-2 opacity-60 uppercase tracking-widest"><Clock className="w-3.5 h-3.5 mr-2" />{inspection.conductedDate ? `Recorded: ${format(new Date(inspection.conductedDate), 'PPp')}` : `Scheduled: ${format(new Date(inspection.scheduledDate), 'PPP')}`}</p>
                        </div>
                        <Button className={cn("rounded-xl font-bold h-10 px-8 text-[10px] uppercase tracking-widest", inspection.status === 'completed' ? "bg-muted text-foreground hover:bg-muted/80" : "bg-accent text-white")} onClick={() => handleOpenAudit(inspection)}>
                          {inspection.status === 'completed' ? <><Edit3 className="w-4 h-4 mr-2" /> Edit Audit</> : <><PlayCircle className="w-4 h-4 mr-2" /> Start Audit</>}
                        </Button>
                        {inspection.summary && (
                          <div className="p-8 bg-primary/[0.03] rounded-3xl border border-border mt-6 text-left shadow-inner relative overflow-hidden group/summary">
                             <div className="absolute top-0 right-0 p-8 opacity-5 group-hover/summary:rotate-12 transition-transform duration-700"><ShieldAlert className="w-20 h-20" /></div>
                             
                             <div className="space-y-1 mb-6">
                               <p className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-widest">Executive Summary</p>
                               <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-[11px] h-8 px-4 rounded-full">{inspection.healthScore}/100 Health Score</Badge>
                             </div>
                             
                             <p className="text-base text-foreground/80 italic leading-relaxed font-medium">"{inspection.summary}"</p>
                             
                             {inspection.priorityItems && inspection.priorityItems.length > 0 && (
                               <div className="mt-8 pt-6 border-t border-border/50">
                                  <p className="text-[9px] font-bold text-red-500 uppercase tracking-widest mb-4">Critical Fix Strategy</p>
                                  <div className="grid gap-2">
                                    {inspection.priorityItems.map((item: string, i: number) => (
                                      <div key={i} className="flex gap-3 items-center text-xs font-bold text-foreground">
                                        <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" /> {item}
                                      </div>
                                    ))}
                                  </div>
                               </div>
                             )}

                             <div className="mt-8 pt-6 border-t border-border/50 flex justify-end">
                               <Button 
                                onClick={() => handleDownloadReport(inspection)}
                                className="rounded-xl h-10 bg-primary text-primary-foreground font-bold uppercase tracking-widest text-[9px] px-8 shadow-xl transition-all hover:scale-[1.02]"
                               >
                                 <FileDown className="w-4 h-4 mr-2" /> Download Professional Report
                               </Button>
                             </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>

      <Dialog open={activeInspection !== null} onOpenChange={(o) => !o && setActiveInspection(null)}>
        <DialogContent className="sm:max-w-[1000px] p-0 rounded-[2.5rem] border-none shadow-2xl flex flex-col h-[90vh] overflow-hidden bg-card ring-1 ring-white/10">
           <div className="p-6 bg-primary/5 border-b shrink-0 text-left">
              <DialogTitle className="text-xl font-headline font-bold text-foreground tracking-tight">Professional Property Audit</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground text-xs mt-1">Synchronizing compliance data and high-fidelity evidence.</DialogDescription>
           </div>
           <Tabs defaultValue="exterior" className="flex-1 flex flex-col min-h-0">
              <div className="bg-muted/30 border-b p-2 shrink-0">
                 <TabsList className="flex flex-wrap h-auto items-center bg-transparent p-0 gap-1 justify-center md:justify-start">
                    {INSPECTION_SECTIONS.map(s => (
                      <TabsTrigger key={s.id} value={s.id} className="rounded-lg h-9 px-4 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-accent border border-transparent data-[state=active]:border-border transition-all">
                        <s.icon className="w-4 h-4 shrink-0" />
                        <span className="text-[9px] font-extrabold uppercase tracking-widest">{s.title}</span>
                      </TabsTrigger>
                    ))}
                 </TabsList>
              </div>
              <ScrollArea className="flex-1">
                 <div className="p-4 md:p-8 space-y-6 pb-32">
                    {INSPECTION_SECTIONS.map(section => (
                      <TabsContent key={section.id} value={section.id} className="mt-0 space-y-6">
                         {section.items.map(item => (
                           <div key={item} className="p-6 bg-primary/[0.02] rounded-[2rem] border border-border shadow-sm text-left">
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                                 <Label className="font-bold text-base flex-1">{item}</Label>
                                 <div className="flex gap-2">
                                    <Button size="sm" variant={structuredFindings[item]?.status === 'pass' ? 'default' : 'outline'} className="rounded-lg font-bold px-6 text-[9px] uppercase tracking-widest" onClick={() => handleStatusChange(item, 'pass')}><Check className="w-3.5 h-3.5 mr-2" /> PASS</Button>
                                    <Button size="sm" variant={structuredFindings[item]?.status === 'fail' ? 'destructive' : 'outline'} className="rounded-lg font-bold px-6 text-[9px] uppercase tracking-widest" onClick={() => handleStatusChange(item, 'fail')}><X className="w-3.5 h-3.5 mr-2" /> FAIL</Button>
                                 </div>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border/50">
                                 <div className="space-y-2">
                                    <Label className="text-[9px] font-bold uppercase text-muted-foreground opacity-40 tracking-widest">Findings Ledger</Label>
                                    <Textarea placeholder="Notes..." className="rounded-xl min-h-[90px] bg-muted/20 border-none font-medium text-xs" value={structuredFindings[item]?.notes || ''} onChange={(e) => handleNotesChange(item, e.target.value)} onBlur={() => handleNotesBlur(item)} />
                                 </div>
                                 <div className="space-y-2">
                                    <Label className="text-[9px] font-bold uppercase text-muted-foreground opacity-40 tracking-widest">Evidence Capture</Label>
                                    <div className="relative aspect-video rounded-xl overflow-hidden border border-dashed border-border bg-muted/10 flex items-center justify-center cursor-pointer group hover:bg-muted/20 transition-all">
                                       {structuredFindings[item]?.isSyncing ? (
                                         <div className="flex flex-col items-center gap-2"><Loader2 className="w-6 h-6 animate-spin text-accent" /><span className="text-[8px] font-bold text-accent uppercase tracking-widest">Syncing...</span></div>
                                       ) : structuredFindings[item]?.imageUrl ? (
                                         <Image src={structuredFindings[item].imageUrl} alt="Evidence" fill className="object-cover" unoptimized />
                                       ) : (
                                         <label htmlFor={`up-${item}`} className="flex flex-col items-center gap-2 text-muted-foreground opacity-30 cursor-pointer">
                                           <Camera className="w-8 h-8" /><span className="text-[8px] font-bold uppercase tracking-widest">Capture Visual</span>
                                           <input id={`up-${item}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(item, e.target.files?.[0] || null)} />
                                         </label>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           </div>
                         ))}
                      </TabsContent>
                    ))}
                 </div>
              </ScrollArea>
           </Tabs>
           <DialogFooter className="p-4 bg-muted/5 border-t shrink-0">
              <Button className="w-full md:w-auto rounded-xl h-10 px-10 font-bold bg-primary text-primary-foreground uppercase tracking-widest text-[9px] border-none shadow-xl transition-all hover:scale-[1.01]" onClick={handleFinalizeAudit} disabled={isGenerating}>
                 {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Orchestrating Records...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Finalize Audit Report</>}
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editingMetadata !== null} onOpenChange={(o) => !o && setEditingMetadata(null)}>
        <DialogContent className="sm:max-w-[550px] p-0 rounded-[2.5rem] border-none shadow-2xl flex flex-col h-[800px] max-h-[90vh] bg-card overflow-hidden">
          <div className="p-8 bg-primary/5 border-b text-left shrink-0">
            <DialogTitle className="text-2xl font-headline font-bold">Modify Audit Record</DialogTitle>
            <DialogDescription className="text-sm font-medium mt-1">Refining operational metadata for this compliance asset.</DialogDescription>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-10 space-y-10 text-left pb-20">
              <div className="space-y-4">
                <Label className="text-[10px] font-bold uppercase opacity-60 tracking-widest font-headline">Target Asset</Label>
                <select className="flex h-14 w-full rounded-2xl border-none bg-muted/30 px-6 font-bold text-foreground shadow-inner focus:ring-2 focus:ring-accent outline-none" value={editPropertyId} onChange={(e) => setEditPropertyId(e.target.value)}>
                  <option value="">Choose property...</option>
                  {activeProperties.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                </select>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-bold uppercase opacity-60 tracking-widest font-headline">Audit Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start text-left font-bold h-14 rounded-2xl border-none bg-muted/30 px-6 text-base shadow-inner">
                      <CalendarIcon className="mr-3 h-5 w-5 text-accent" /> {editDate ? format(editDate, "PPP") : <span>Pick date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 rounded-[2rem] border-none shadow-2xl overflow-hidden" align="start">
                    <Calendar mode="single" selected={editDate} onSelect={setEditDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
            <Button className="w-full rounded-2xl h-16 font-bold bg-primary text-primary-foreground font-headline uppercase tracking-[0.2em] text-[11px] border-none transition-all active:scale-[0.98]" onClick={handleUpdateMetadata} disabled={!editDate || !editPropertyId}>Synchronize Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
