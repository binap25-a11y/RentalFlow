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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { 
  Calendar as CalendarIcon, Loader2, 
  CheckCircle2, ClipboardList, ShieldAlert, Home, Wrench, 
  Check, X, AlertTriangle, Info, Trash2, Edit3, PlayCircle, Camera, Clock,
  Save, Download, FileDown
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
  {
    id: "exterior",
    title: "Exterior",
    icon: Home,
    items: ["Roof condition", "Walls, brickwork", "Windows and external doors", "Garden maintained", "Pathways safe and clear", "Bins accessible"]
  },
  {
    id: "safety",
    title: "Safety & Compliance",
    icon: ShieldAlert,
    items: ["Smoke alarms tested", "CO alarm tested", "Electrical sockets safe", "Gas safety certificate valid", "EICR valid", "PAT Certificate valid", "No tampering with safety equipment"]
  },
  {
    id: "interior",
    title: "Interior General",
    icon: Info,
    items: ["Walls, ceilings, floors", "No signs of damp or mould", "Windows open and close", "Internal doors and locks", "Adequate ventilation", "General cleanliness acceptable"]
  },
  {
    id: "kitchen",
    title: "Kitchen",
    icon: CheckCircle2,
    items: ["Worktops, cupboards, flooring", "Sink and taps", "Oven and hob", "Fridge freezer", "Washing machine (if supplied)", "Adequate ventilation"]
  },
  {
    id: "bathrooms",
    title: "Bathrooms",
    icon: Wrench,
    items: ["Toilet flushing", "Shower/bath working", "No leaks from taps/pipes", "Extractor fan working", "Sealant and grout intact", "No mould or damp"]
  },
  {
    id: "heating",
    title: "Heating",
    icon: AlertTriangle,
    items: ["Boiler functioning", "Radiators heating", "Thermostat working", "Hot water supply"]
  },
  {
    id: "bedrooms",
    title: "Bedrooms",
    icon: Home,
    items: ["Windows and locks", "Heating operational", "No damp or mould", "Flooring and carpet condition and walls", "Furniture condition (if provided)"]
  }
];

export default function InspectionsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: allProperties, loading: isPropLoading } = useCollection(propertiesQuery);

  const properties = useMemo(() => 
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
    const property = properties?.find(p => p.id === editPropertyId);
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
      const updated = {
        ...prev,
        [itemId]: { ...prev[itemId], status }
      };
      syncFindingsToFirestore(updated);
      return updated;
    });
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setStructuredFindings(prev => {
      const updated = {
        ...prev,
        [itemId]: { ...prev[itemId], notes }
      };
      return updated;
    });
  };

  const handleNotesBlur = (itemId: string) => {
    syncFindingsToFirestore(structuredFindings);
  };

  const handleImageUpload = async (itemId: string, file: File | null) => {
    if (!file || !user || !activeInspection) return;
    setStructuredFindings(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], isSyncing: true }
    }));
    try {
      const optimizedBlob = await compressImage(file);
      const path = `${user.uid}/${activeInspection.propertyId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const formData = new FormData();
      formData.append('file', optimizedBlob, file.name);
      const result = await uploadToSupabase(formData, 'Property-Images-', path);
      if (!result.success) throw new Error(result.error);
      
      setStructuredFindings(prev => {
        const updated = {
          ...prev,
          [itemId]: { ...prev[itemId], imageUrl: result.url, isSyncing: false }
        };
        syncFindingsToFirestore(updated);
        return updated;
      });
      toast({ title: "Evidence Synchronized" });
    } catch (err: any) {
      setStructuredFindings(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], isSyncing: false }
      }));
      toast({ variant: "destructive", title: "Sync Failed", description: err.message });
    }
  };

  const handleSchedule = () => {
    if (!user || !db || !selectedPropertyId || !date) return;
    const property = properties?.find(p => p.id === selectedPropertyId);
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
    toast({ title: "Inspection Scheduled", description: `Set for ${format(date, 'PPP')}` });
    setSelectedPropertyId('');
    setDate(undefined);
  };

  const handleFinalizeAudit = async () => {
    if (!db || !activeInspection || !user) return;
    
    const entries = Object.entries(structuredFindings);
    if (entries.length === 0) {
      toast({ variant: "destructive", title: "Context Required", description: "Please mark at least one checklist item (Pass/Fail) before finalizing." });
      return;
    }

    setIsGenerating(true);
    const property = properties?.find(p => p.id === activeInspection.propertyId);
    
    try {
      const flatFindingsString = entries.map(([item, data]: [string, any]) => {
        return `${item}: ${data.status?.toUpperCase() || 'UNCHECKED'} ${data.notes ? `(Notes: ${data.notes})` : ''}`;
      }).join('\n');

      const aiReport = await generateInspectionReport({
        propertyAddress: property?.addressLine1 || 'Property Asset',
        findings: flatFindingsString
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

      toast({ title: "Audit Finalized", description: "Compliance records synchronized." });
      setActiveInspection(null);
    } catch (error: any) {
      console.error("Audit Finalization Error:", error);
      toast({ 
        variant: "destructive", 
        title: "Reporting Engine Error", 
        description: "An unexpected error occurred. Your manual findings have been saved." 
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = async (inspection: any) => {
    const property = properties?.find(p => p.id === inspection.propertyId);
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();

    pdf.setFillColor(30, 58, 138); 
    pdf.rect(0, 0, pageWidth, 40, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(22);
    pdf.text("PROPERTY AUDIT REPORT", 20, 25);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text("CONFIDENTIAL COMPLIANCE RECORD", 20, 32);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("PORTFOLIO ASSET IDENTITY", 20, 55);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "normal");
    pdf.text(`${property?.addressLine1 || 'Property Asset'}`, 20, 63);
    pdf.text(`${property?.city || ''}, ${property?.zipCode || ''}`, 20, 69);
    
    pdf.setFont("helvetica", "bold");
    pdf.text("AUDIT TIMESTAMP:", 130, 63);
    pdf.setFont("helvetica", "normal");
    pdf.text(format(new Date(inspection.conductedDate || inspection.scheduledDate), 'PPP'), 130, 69);

    pdf.setFillColor(248, 250, 252);
    pdf.rect(20, 80, 170, 20, "F");
    pdf.setDrawColor(226, 232, 240);
    pdf.rect(20, 80, 170, 20, "D");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(12);
    pdf.text("PROPERTY HEALTH SCORE:", 30, 92);
    pdf.setTextColor(inspection.healthScore > 80 ? 22 : 185, inspection.healthScore > 80 ? 101 : 28, inspection.healthScore > 80 ? 52 : 28);
    pdf.setFontSize(16);
    pdf.text(`${inspection.healthScore}/100`, 160, 92, { align: 'right' });

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("EXECUTIVE SUMMARY", 20, 115);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    const summaryLines = pdf.splitTextToSize(inspection.summary || "No automated summary available.", 170);
    pdf.text(summaryLines, 20, 125);

    let y = 125 + (summaryLines.length * 5) + 15;
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("AUDIT FINDINGS CHECKLIST", 20, y);
    y += 10;
    
    pdf.setFontSize(9);
    pdf.setDrawColor(226, 232, 240);
    
    const findings = Object.entries(inspection.structuredFindings || {});
    findings.forEach(([item, data]: [string, any]) => {
      if (y > 270) { pdf.addPage(); y = 20; }
      pdf.line(20, y, 190, y);
      y += 6;
      pdf.setFont("helvetica", "bold");
      pdf.text(item, 20, y);
      pdf.setTextColor(data.status === 'pass' ? 22 : 185, data.status === 'pass' ? 101 : 28, data.status === 'pass' ? 52 : 28);
      pdf.text(data.status?.toUpperCase() || 'UNCHECKED', 180, y, { align: 'right' });
      pdf.setTextColor(0, 0, 0);
      pdf.setFont("helvetica", "normal");
      if (data.notes) {
        y += 5;
        const noteLines = pdf.splitTextToSize(`Notes: ${data.notes}`, 160);
        pdf.text(noteLines, 25, y);
        y += (noteLines.length * 4);
      }
      y += 4;
    });

    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text("Generated via RentalFlow Intelligence Engine. Strictly for internal compliance records.", 20, 285);

    pdf.save(`Audit_Report_${property?.addressLine1.replace(/\s+/g, '_')}_${format(new Date(), 'yyyyMMdd')}.pdf`);
    toast({ title: "Report Exported" });
  };

  if (!isClient || isPropLoading || isInspLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 text-left bg-background">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground mb-2 tracking-tight">Inspections & Audits</h1>
          <p className="text-muted-foreground font-medium font-body">Official portfolio compliance tracking and safety records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-none shadow-sm h-fit rounded-[2rem] overflow-hidden bg-card ring-1 ring-border">
          <CardHeader className="bg-primary/5 p-8 border-b">
            <CardTitle className="text-xl font-headline text-foreground tracking-tight">Schedule Audit</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground font-headline tracking-widest opacity-60">Select Asset</Label>
              <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none transition-shadow font-bold text-foreground" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
                <option value="">Choose a property...</option>
                {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase font-bold text-muted-foreground font-headline tracking-widest opacity-60">Audit Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full justify-start text-left font-bold h-11 rounded-xl border-border bg-muted/20 hover:bg-muted/30 transition-colors font-body", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <Button className="w-full rounded-xl h-11 font-bold shadow-lg shadow-accent/10 font-headline bg-accent text-white hover:bg-accent/90 transition-all uppercase tracking-widest text-[10px] border-none" onClick={handleSchedule} disabled={!date || !selectedPropertyId}>Confirm Schedule</Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold font-headline flex items-center text-foreground tracking-tight">
            <ClipboardList className="w-5 h-5 mr-2 text-accent" />
            Compliance Ledger
          </h3>
          <div className="grid gap-4">
            {!inspections || inspections.length === 0 ? (
              <div className="py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-border">
                <p className="text-muted-foreground font-medium font-body uppercase tracking-widest text-xs opacity-40">No audit records found.</p>
              </div>
            ) : (
              inspections.slice().sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map((inspection) => (
                <Card key={inspection.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow rounded-[2rem] bg-card ring-1 ring-border">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="bg-primary/5 p-4 rounded-2xl flex flex-col items-center justify-center text-foreground min-w-[100px] h-fit font-headline shadow-inner ring-1 ring-border">
                        <span className="text-xs font-bold uppercase tracking-widest opacity-60">{format(new Date(inspection.scheduledDate), 'MMM')}</span>
                        <span className="text-3xl font-bold">{format(new Date(inspection.scheduledDate), 'dd')}</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant={inspection.status === 'completed' ? 'secondary' : 'default'} className="uppercase font-bold text-[10px] font-headline tracking-widest rounded-full">{inspection.status}</Badge>
                          <div className="flex gap-2">
                            {inspection.status === 'completed' && (
                              <Button variant="ghost" size="icon" className="h-8 w-8 text-accent hover:bg-accent/10" onClick={() => handleDownloadReport(inspection)}>
                                <FileDown className="w-4 h-4" />
                              </Button>
                            )}
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-muted-foreground hover:text-accent hover:bg-accent/5 rounded-lg" onClick={() => handleOpenEditMetadata(inspection)}><Edit3 className="w-4 h-4" /></Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg"><Trash2 className="w-4 h-4" /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent className="rounded-3xl border-none shadow-2xl bg-card">
                                <AlertDialogHeader className="text-left">
                                  <AlertDialogTitle className="font-headline font-bold text-xl text-foreground">Delete Record?</AlertDialogTitle>
                                  <AlertDialogDescription className="text-muted-foreground font-medium mt-2">Permanently remove the audit findings for this property. Irreversible.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter className="mt-6 gap-3">
                                  <AlertDialogCancel className="rounded-xl h-12 font-bold uppercase tracking-widest text-[10px] border-border">Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => { if(db) deleteDocumentNonBlocking(doc(db, 'inspections', inspection.id)); toast({ title: "Record Removed" }); }} className="rounded-xl h-12 font-bold bg-red-600 text-white uppercase tracking-widest text-[10px] hover:bg-red-700 border-none">Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                        <div className="text-left">
                          <h4 className="text-lg font-bold font-headline text-foreground tracking-tight">{properties?.find(p => p.id === inspection.propertyId)?.addressLine1 || 'Property Asset'}</h4>
                          <p className="text-[10px] text-muted-foreground font-bold flex items-center mt-1 font-body uppercase tracking-widest opacity-60">
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            {inspection.conductedDate ? `Recorded: ${format(new Date(inspection.conductedDate), 'PPp')}` : `Scheduled: ${format(new Date(inspection.scheduledDate), 'PPP')}`}
                          </p>
                        </div>
                        <Dialog open={activeInspection?.id === inspection.id} onOpenChange={(open) => !open && setActiveInspection(null)}>
                          <DialogTrigger asChild>
                            <Button className={cn("w-full md:w-auto rounded-xl font-bold h-10 px-8 font-headline uppercase tracking-widest text-[10px] transition-all", inspection.status === 'completed' ? "bg-muted hover:bg-muted/80 text-foreground" : "bg-accent hover:bg-accent/90 text-white shadow-lg")} onClick={() => handleOpenAudit(inspection)}>
                              {inspection.status === 'completed' ? <><Edit3 className="w-4 h-4 mr-2" /> Edit Audit</> : <><PlayCircle className="w-4 h-4 mr-2" /> Start Audit</>}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[850px] p-0 rounded-2xl border-none shadow-2xl flex flex-col h-[90vh] overflow-hidden bg-card">
                            <div className="p-8 bg-primary/5 border-b text-left shrink-0">
                              <DialogTitle className="text-2xl font-headline font-bold text-foreground tracking-tight">Professional Property Audit</DialogTitle>
                              <DialogDescription className="font-medium text-muted-foreground font-body mt-1 text-sm">Synchronizing high-fidelity binary evidence and checklist data.</DialogDescription>
                            </div>
                            
                            <Tabs defaultValue="exterior" className="flex-1 flex flex-col min-h-0">
                                <div className="bg-muted/30 border-b border-border py-4 px-6 shrink-0">
                                    <TabsList className="flex flex-wrap h-auto items-center bg-transparent p-0 gap-2">
                                      {INSPECTION_SECTIONS.map(s => (
                                        <TabsTrigger 
                                          key={s.id} 
                                          value={s.id} 
                                          className="rounded-xl h-10 px-5 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-accent data-[state=active]:shadow-sm transition-all border border-transparent data-[state=active]:border-border"
                                        >
                                          <s.icon className="w-4 h-4 shrink-0" />
                                          <span className="text-[10px] font-extrabold uppercase tracking-widest">{s.title}</span>
                                        </TabsTrigger>
                                      ))}
                                    </TabsList>
                                </div>

                                <ScrollArea className="flex-1 text-left">
                                  <div className="p-6 md:p-10 space-y-8 pb-32">
                                      {INSPECTION_SECTIONS.map(section => (
                                        <TabsContent key={section.id} value={section.id} className="mt-0 space-y-8 animate-in fade-in duration-300">
                                          <div className="grid gap-6">
                                            {section.items.map(item => (
                                              <div key={item} className="p-6 bg-primary/[0.02] rounded-[2.5rem] space-y-6 border border-border shadow-sm">
                                                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                                  <Label className="font-bold text-base text-left font-headline text-foreground leading-tight">{item}</Label>
                                                  <div className="flex gap-2 shrink-0">
                                                    <Button size="sm" variant={structuredFindings[item]?.status === 'pass' ? 'default' : 'outline'} className="flex-1 md:flex-none rounded-xl font-bold h-11 px-8 text-[10px] uppercase tracking-widest transition-all" onClick={() => handleStatusChange(item, 'pass')}><Check className="w-4 h-4 mr-2" /> PASS</Button>
                                                    <Button size="sm" variant={structuredFindings[item]?.status === 'fail' ? 'destructive' : 'outline'} className="flex-1 md:flex-none rounded-xl font-bold h-11 px-8 text-[10px] uppercase tracking-widest transition-all" onClick={() => handleStatusChange(item, 'fail')}><X className="w-4 h-4 mr-2" /> FAIL</Button>
                                                  </div>
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-6 border-t border-border">
                                                  <div className="space-y-3">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em] opacity-40">Findings Ledger</Label>
                                                    <Textarea 
                                                      placeholder="Notes..." 
                                                      className="rounded-2xl min-h-[120px] bg-muted/20 border-none font-medium text-sm leading-relaxed" 
                                                      value={structuredFindings[item]?.notes || ''} 
                                                      onChange={(e) => handleNotesChange(item, e.target.value)}
                                                      onBlur={() => handleNotesBlur(item)}
                                                    />
                                                  </div>
                                                  <div className="space-y-3">
                                                    <Label className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.2em] opacity-40">Visual Evidence</Label>
                                                    <div className="relative aspect-video rounded-2xl overflow-hidden border-2 border-dashed border-border bg-muted/10 flex items-center justify-center cursor-pointer group hover:bg-muted/20 transition-all">
                                                      {structuredFindings[item]?.isSyncing ? (
                                                        <div className="flex flex-col items-center gap-4 animate-in fade-in">
                                                           <Loader2 className="w-10 h-10 animate-spin text-accent" />
                                                           <span className="text-[10px] font-bold text-accent uppercase tracking-[0.3em]">Syncing Binary...</span>
                                                        </div>
                                                      ) : structuredFindings[item]?.imageUrl ? (
                                                        <div className="relative w-full h-full">
                                                          <Image src={structuredFindings[item].imageUrl} alt="Evidence" fill className="object-cover transition-transform group-hover:scale-105 duration-500" unoptimized />
                                                          <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                             <Camera className="w-8 h-8 text-white" />
                                                          </div>
                                                        </div>
                                                      ) : (
                                                        <label htmlFor={`upload-${item}`} className="flex flex-col items-center gap-3 text-muted-foreground opacity-30 group-hover:opacity-60 transition-opacity cursor-pointer">
                                                          <Camera className="w-10 h-10" />
                                                          <span className="text-[10px] font-bold uppercase tracking-widest">Capture Asset</span>
                                                          <input id={`upload-${item}`} type="file" accept="image/*" className="hidden" onChange={(e) => handleImageUpload(item, e.target.files?.[0] || null)} />
                                                        </label>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        </TabsContent>
                                      ))}
                                  </div>
                                </ScrollArea>
                            </Tabs>

                            <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
                              <Button className="w-full rounded-2xl h-16 font-bold bg-accent text-white hover:bg-accent/90 transition-all border-none shadow-2xl shadow-accent/20 uppercase tracking-[0.3em] text-[12px]" onClick={handleFinalizeAudit} disabled={isGenerating}>
                                {isGenerating ? <><Loader2 className="w-5 h-5 mr-4 animate-spin" /> Orchestrating Records...</> : <><CheckCircle2 className="w-5 h-5 mr-4" /> Finalize Audit Report</>}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        {inspection.summary && (
                          <div className="p-5 bg-primary/[0.03] rounded-2xl border border-border mt-4 text-left shadow-inner group-hover:bg-primary/[0.05] transition-colors relative">
                             <div className="flex justify-between items-center mb-2">
                               <p className="text-[9px] font-bold text-muted-foreground/60 uppercase font-headline tracking-widest">Audit Executive Summary</p>
                               <Badge className="bg-emerald-500/10 text-emerald-600 border-none font-bold text-[9px]">{inspection.healthScore}/100 Health</Badge>
                             </div>
                             <p className="text-sm text-foreground/80 italic leading-relaxed font-body font-medium">"{inspection.summary}"</p>
                             <div className="mt-4 flex gap-2">
                                <Button variant="outline" size="sm" className="h-9 rounded-lg font-bold text-[9px] uppercase tracking-widest px-4 transition-all" onClick={() => handleDownloadReport(inspection)}>
                                  <Download className="w-3.5 h-3.5 mr-2" /> Download Official PDF
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

      <Dialog open={!!editingMetadata} onOpenChange={(open) => !open && setEditingMetadata(null)}>
        <DialogContent className="sm:max-w-[500px] p-0 rounded-[2.5rem] border-none shadow-2xl flex flex-col h-[700px] max-h-[90vh] bg-card overflow-hidden">
          <div className="p-8 bg-primary/5 border-b text-left shrink-0">
            <DialogTitle className="text-2xl font-headline font-bold text-foreground tracking-tight">Modify Audit Record</DialogTitle>
            <DialogDescription className="text-sm font-medium text-muted-foreground mt-1">Refining operational metadata for this compliance asset.</DialogDescription>
          </div>
          
          <ScrollArea className="flex-1">
            <div className="p-10 space-y-10 text-left pb-20">
              <div className="space-y-4">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Target Asset</Label>
                <select 
                  className="flex h-14 w-full rounded-2xl border-none bg-muted/30 px-6 py-2 text-base font-bold text-foreground shadow-inner ring-1 ring-white/5 focus:ring-2 focus:ring-accent outline-none" 
                  value={editPropertyId} 
                  onChange={(e) => setEditPropertyId(e.target.value)}
                >
                  <option value="">Choose property...</option>
                  {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                </select>
              </div>
              <div className="space-y-4">
                <Label className="text-[10px] font-bold uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Audit Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant={"outline"} className="w-full justify-start text-left font-bold h-14 rounded-2xl border-none bg-muted/30 px-6 text-base shadow-inner ring-1 ring-white/5">
                      <CalendarIcon className="mr-3 h-5 w-5 text-accent" />
                      {editDate ? format(editDate, "PPP") : <span>Pick a date</span>}
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
            <Button 
              className="w-full rounded-[1.75rem] h-16 font-bold bg-primary text-primary-foreground transition-all active:scale-[0.98] shadow-2xl shadow-primary/10 font-headline uppercase tracking-[0.2em] text-[11px] border-none" 
              onClick={handleUpdateMetadata} 
              disabled={!editDate || !editPropertyId}
            >
              Synchronize Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
