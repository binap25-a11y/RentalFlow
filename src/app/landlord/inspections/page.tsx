"use client";

import { useState, useEffect } from 'react';
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
  Calendar as CalendarIcon, Loader2, Download, 
  CheckCircle2, ClipboardList, ShieldAlert, Home, Wrench, 
  Check, X, AlertTriangle, Info, Trash2, Edit3, PlayCircle, Camera
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateInspectionReport } from "@/ai/flows/generate-inspection-report";
import { uploadToSupabase } from '@/lib/actions/supabase-storage';
import Image from 'next/image';

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

  const { data: properties, loading: isPropLoading } = useCollection(propertiesQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "inspections", user.uid);
  }, [db, user]);

  const { data: inspections, loading: isInspLoading } = useCollection(inspectionsQuery);

  const [date, setDate] = useState<Date>();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [activeInspection, setActiveInspection] = useState<any>(null);
  const [structuredFindings, setStructuredFindings] = useState<Record<string, { status: 'pass' | 'fail', notes: string, imageUrl?: string, localFile?: File }>>({});
  const [isGenerating, setIsGenerating] = useState(false);

  const handleOpenAudit = (inspection: any) => {
    setActiveInspection(inspection);
    setStructuredFindings(inspection.structuredFindings || {});
  };

  const handleStatusChange = (itemId: string, status: 'pass' | 'fail') => {
    setStructuredFindings(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], status }
    }));
  };

  const handleNotesChange = (itemId: string, notes: string) => {
    setStructuredFindings(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], notes }
    }));
  };

  const handleImageUpload = (itemId: string, file: File | null) => {
    if (!file) return;
    setStructuredFindings(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], localFile: file, imageUrl: URL.createObjectURL(file) }
    }));
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

    toast({ title: "Inspection Scheduled", description: `New inspection set for ${format(date, 'PPP')}` });
    setSelectedPropertyId('');
    setDate(undefined);
  };

  const handleDeleteInspection = (id: string) => {
    if (!db) return;
    const inspectionRef = doc(db, 'inspections', id);
    deleteDocumentNonBlocking(inspectionRef);
    toast({ title: "Audit Record Removed", description: "The compliance entry has been decommissioned." });
  };

  const getBase64FromUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url);
      const blob = await response.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      return "";
    }
  };

  const downloadPDF = async (inspection: any) => {
    const property = properties?.find(p => p.id === inspection.propertyId);
    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const today = format(new Date(), 'PPp');
    
    pdf.setFillColor(31, 41, 55);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.text("OFFICIAL AUDIT RECORD", 20, 25);
    pdf.setFontSize(10);
    pdf.text(`Portfolio Registry: RentSafeUK`, 20, 32);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Property Subject", 20, 55);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(11);
    pdf.text(`${property?.addressLine1 || 'Property Asset'}`, 20, 62);
    pdf.text(`${property?.city || 'Unknown'}, ${property?.zipCode || 'No Postcode'}`, 20, 68);

    pdf.setFont("helvetica", "bold");
    pdf.text("Audit Information", pageWidth - 80, 55);
    pdf.setFont("helvetica", "normal");
    pdf.text(`Conducted: ${inspection.conductedDate ? format(new Date(inspection.conductedDate), 'PPp') : 'N/A'}`, pageWidth - 80, 62);
    pdf.text(`Safety Score: ${inspection.healthScore || 0}/100`, pageWidth - 80, 68);

    pdf.setDrawColor(229, 231, 235);
    pdf.line(20, 75, pageWidth - 20, 75);

    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Executive Summary", 20, 90);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "italic");
    const summaryText = inspection.summary || "No summary provided";
    const splitSummary = pdf.splitTextToSize(summaryText, pageWidth - 40);
    pdf.text(splitSummary, 20, 98);

    let y = 98 + (splitSummary.length * 5) + 15;

    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(14);
    pdf.text("Condition Audit Breakdown", 20, y);
    y += 8;

    const findings = inspection.structuredFindings || {};
    
    pdf.setFontSize(10);
    pdf.setFillColor(243, 244, 246);
    pdf.rect(20, y, pageWidth - 40, 8, 'F');
    pdf.text("Checklist Item", 25, y + 6);
    pdf.text("Status", pageWidth - 60, y + 6);
    y += 12;

    for (const [item, data] of Object.entries(findings) as [string, any][]) {
      if (y > 250) {
        pdf.addPage();
        y = 20;
      }
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(0, 0, 0);
      pdf.text(item, 25, y);
      
      const isPass = data.status === 'pass';
      if (isPass) {
        pdf.setTextColor(16, 185, 129);
      } else {
        pdf.setTextColor(239, 68, 68);
      }
      
      pdf.setFont("helvetica", "bold");
      pdf.text(isPass ? "PASS" : "FAIL", pageWidth - 60, y);
      
      pdf.setTextColor(107, 114, 128);
      pdf.setFontSize(8);
      let contentY = y + 5;
      if (data.notes) {
        const splitNotes = pdf.splitTextToSize(`Note: ${data.notes}`, pageWidth - 80);
        pdf.text(splitNotes, 25, contentY);
        contentY += (splitNotes.length * 4);
      }
      
      if (data.imageUrl) {
        try {
          const b64 = await getBase64FromUrl(data.imageUrl);
          if (b64) {
            pdf.addImage(b64, 'JPEG', 25, contentY, 40, 30);
            contentY += 35;
          }
        } catch (e) {
          console.error("Failed to add image to PDF", e);
        }
      }
      
      y = contentY + 5;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
    }

    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`Generated: ${today} | Official Audit Record - Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: "center" });
    }
    
    pdf.save(`Audit_${property?.addressLine1 || 'Report'}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  const handleConduct = async () => {
    if (!db || !activeInspection || !user) return;
    setIsGenerating(true);
    const property = properties?.find(p => p.id === activeInspection.propertyId);

    try {
      const finalStructuredFindings: any = {};
      const findingsList = Object.entries(structuredFindings);

      for (const [item, data] of findingsList) {
        let uploadedUrl = data.imageUrl || "";
        
        if (data.localFile) {
          const formData = new FormData();
          formData.append('file', data.localFile);
          const path = `audits/${user.uid}/${activeInspection.id}/${item.replace(/\s+/g, '_')}_${Date.now()}`;
          const uploadRes = await uploadToSupabase(formData, 'property-images', path);
          if (uploadRes.success) {
            uploadedUrl = uploadRes.url || "";
          }
        }

        finalStructuredFindings[item] = {
          status: data.status,
          notes: data.notes,
          imageUrl: uploadedUrl
        };
      }

      const flatFindingsString = Object.entries(finalStructuredFindings).map(([item, data]: [string, any]) => {
        return `${item}: ${data.status?.toUpperCase() || 'UNCHECKED'} ${data.notes ? `(Notes: ${data.notes})` : ''}`;
      }).join('\n');

      const aiReport = await generateInspectionReport({
        propertyAddress: property?.addressLine1 || 'Property',
        findings: flatFindingsString
      });

      const inspectionRef = doc(db, 'inspections', activeInspection.id);
      const completedData = {
        ...activeInspection,
        status: 'completed',
        structuredFindings: finalStructuredFindings,
        summary: aiReport.summary,
        priorityItems: aiReport.priorityItems,
        healthScore: aiReport.healthScore,
        conductedDate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      };

      updateDocumentNonBlocking(inspectionRef, completedData);
      await downloadPDF(completedData);

      toast({ title: "Audit Finalized", description: "Official record updated and report downloaded." });
      setActiveInspection(null);
    } catch (error: any) {
      console.error(error);
      toast({ variant: "destructive", title: "Reporting Failed", description: "The audit engine encountered a synchronization error." });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isClient || isPropLoading || isInspLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Inspections & Audits</h1>
          <p className="text-muted-foreground font-medium font-body">Official portfolio compliance tracking and safety records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-none shadow-sm h-fit rounded-[2rem] overflow-hidden bg-card">
          <CardHeader className="bg-primary/5 p-8 border-b">
            <CardTitle className="text-xl font-headline text-primary tracking-tight">Schedule Audit</CardTitle>
          </CardHeader>
          <CardContent className="p-8 space-y-6">
            <div className="space-y-2 text-left">
              <Label className="text-xs uppercase font-bold text-muted-foreground font-headline tracking-widest opacity-60">Select Asset</Label>
              <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow font-bold text-primary" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
                <option value="">Choose a property...</option>
                {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-left">
              <Label className="text-xs uppercase font-bold text-muted-foreground font-headline tracking-widest opacity-60">Audit Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full justify-start text-left font-bold h-11 rounded-xl border-input hover:bg-muted/50 transition-colors font-body", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <Button className="w-full rounded-xl h-11 font-bold shadow-lg shadow-primary/10 font-headline bg-primary text-white hover:bg-primary/90 transition-all uppercase tracking-widest text-[10px]" onClick={handleSchedule} disabled={!date || !selectedPropertyId}>Confirm Schedule</Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold font-headline flex items-center text-primary tracking-tight">
            <ClipboardList className="w-5 h-5 mr-2" />
            Compliance Ledger
          </h3>
          <div className="grid gap-4">
            {!inspections || inspections.length === 0 ? (
              <div className="py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-primary/10">
                <p className="text-muted-foreground font-medium font-body uppercase tracking-widest text-xs opacity-40">No audit records found.</p>
              </div>
            ) : (
              inspections.slice().sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map((inspection) => (
                <Card key={inspection.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow rounded-[2rem] bg-white border border-primary/5">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="bg-primary/5 p-4 rounded-2xl flex flex-col items-center justify-center text-primary min-w-[100px] h-fit font-headline shadow-inner">
                        <span className="text-xs font-bold uppercase tracking-widest opacity-60">{format(new Date(inspection.scheduledDate), 'MMM')}</span>
                        <span className="text-3xl font-bold">{format(new Date(inspection.scheduledDate), 'dd')}</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant={inspection.status === 'completed' ? 'secondary' : 'default'} className="uppercase font-bold text-[10px] font-headline tracking-widest rounded-full">{inspection.status}</Badge>
                          <div className="flex gap-2">
                            {inspection.status === 'completed' && <Button variant="outline" size="sm" onClick={() => downloadPDF(inspection)} className="rounded-lg h-8 text-primary border-primary/20 hover:bg-primary/5 font-headline"><Download className="w-3 h-3 mr-2" /> Export PDF</Button>}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg" onClick={() => handleDeleteInspection(inspection.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        <div className="text-left">
                          <h4 className="text-lg font-bold font-headline text-primary tracking-tight">{properties?.find(p => p.id === inspection.propertyId)?.addressLine1 || 'Property Asset'}</h4>
                          <p className="text-[10px] text-muted-foreground font-bold flex items-center mt-1 font-body uppercase tracking-widest opacity-60">
                            <Clock className="w-3.5 h-3.5 mr-1.5" />
                            {inspection.conductedDate ? `Recorded: ${format(new Date(inspection.conductedDate), 'PPp')}` : `Scheduled: ${format(new Date(inspection.scheduledDate), 'PPP')}`}
                          </p>
                        </div>
                        <Dialog open={activeInspection?.id === inspection.id} onOpenChange={(open) => !open && setActiveInspection(null)}>
                          <DialogTrigger asChild>
                            <Button className={cn("w-full md:w-auto rounded-xl font-bold h-10 px-8 font-headline uppercase tracking-widest text-[10px] transition-all", inspection.status === 'completed' ? "bg-muted hover:bg-muted/80 text-foreground" : "bg-primary hover:bg-primary/90 text-white")} onClick={() => handleOpenAudit(inspection)}>
                              {inspection.status === 'completed' ? <><Edit3 className="w-4 h-4 mr-2" /> Edit Audit</> : <><PlayCircle className="w-4 h-4 mr-2" /> Start Audit</>}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[850px] p-0 rounded-[3rem] border-none shadow-2xl flex flex-col h-[90vh] overflow-hidden bg-white">
                            <div className="p-8 bg-primary/5 border-b text-left shrink-0">
                              <DialogTitle className="text-2xl font-headline font-bold text-primary tracking-tight">Professional Property Audit</DialogTitle>
                              <DialogDescription className="font-medium text-muted-foreground font-body mt-1">Conducting full safety audit with high-fidelity evidence capture.</DialogDescription>
                            </div>
                            <ScrollArea className="flex-1 text-left">
                              <div className="p-8 space-y-8">
                                <Tabs defaultValue="exterior" className="w-full">
                                  <div className="overflow-x-auto pb-4 no-scrollbar">
                                    <TabsList className="inline-flex w-max min-w-full bg-muted/50 p-1.5 rounded-2xl h-auto gap-1">
                                      {INSPECTION_SECTIONS.map(s => (
                                        <TabsTrigger key={s.id} value={s.id} className="rounded-xl py-3 px-6 flex items-center gap-2 data-[state=active]:bg-white data-[state=active]:text-primary data-[state=active]:shadow-sm">
                                          <s.icon className="w-4 h-4" />
                                          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">{s.title}</span>
                                        </TabsTrigger>
                                      ))}
                                    </TabsList>
                                  </div>
                                  {INSPECTION_SECTIONS.map(section => (
                                    <TabsContent key={section.id} value={section.id} className="mt-8 space-y-8 animate-in fade-in duration-500">
                                      <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-primary/5 rounded-xl text-primary"><section.icon className="w-6 h-6" /></div>
                                        <h3 className="text-xl font-bold font-headline text-primary">{section.title}</h3>
                                      </div>
                                      <div className="grid gap-6">
                                        {section.items.map(item => (
                                          <div key={item} className="p-6 bg-primary/[0.02] rounded-[2rem] space-y-6 border border-primary/5 shadow-inner">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                              <Label className="font-bold text-base text-left font-headline text-primary tracking-tight">{item}</Label>
                                              <div className="flex gap-2">
                                                <Button size="sm" variant={structuredFindings[item]?.status === 'pass' ? 'default' : 'outline'} className="rounded-xl font-bold h-10 px-6 font-headline tracking-widest text-[10px]" onClick={() => handleStatusChange(item, 'pass')}><Check className="w-4 h-4 mr-2" /> PASS</Button>
                                                <Button size="sm" variant={structuredFindings[item]?.status === 'fail' ? 'destructive' : 'outline'} className="rounded-xl font-bold h-10 px-6 font-headline tracking-widest text-[10px]" onClick={() => handleStatusChange(item, 'fail')}><X className="w-4 h-4 mr-2" /> FAIL</Button>
                                              </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-primary/5">
                                              <div className="space-y-2 text-left">
                                                <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/40 font-headline">Audit Findings</Label>
                                                <Textarea placeholder="Auditor notes..." className="rounded-2xl min-h-[120px] bg-white text-sm font-body border-primary/5 shadow-sm focus:ring-2 focus:ring-primary" value={structuredFindings[item]?.notes || ''} onChange={(e) => handleNotesChange(item, e.target.value)} />
                                              </div>
                                              <div className="space-y-2 text-left">
                                                <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/40 font-headline">Evidence Capture</Label>
                                                <div className="relative group">
                                                  {structuredFindings[item]?.imageUrl ? (
                                                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-white border border-primary/10 shadow-lg">
                                                      <Image src={structuredFindings[item]?.imageUrl || ''} alt="Evidence" fill className="object-cover" unoptimized />
                                                      <Button variant="destructive" size="icon" className="absolute top-3 right-3 h-10 w-10 rounded-xl shadow-2xl transition-all hover:scale-110 active:scale-95" onClick={() => setStructuredFindings(prev => ({...prev, [item]: {...prev[item], imageUrl: undefined, localFile: undefined}}))}>
                                                        <Trash2 className="w-5 h-5" />
                                                      </Button>
                                                    </div>
                                                  ) : (
                                                    <label 
                                                      htmlFor={`upload-${item}`}
                                                      className="w-full aspect-video rounded-[2rem] border-2 border-dashed border-primary/10 hover:border-primary/30 transition-all bg-white flex flex-col items-center justify-center gap-3 group cursor-pointer shadow-inner"
                                                    >
                                                      <div className="p-4 bg-primary/5 rounded-full group-hover:scale-110 transition-transform"><Camera className="w-8 h-8 text-primary/20 group-hover:text-primary/40" /></div>
                                                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40 group-hover:text-primary/60">Capture High-Res Evidence</span>
                                                    </label>
                                                  )}
                                                  <input 
                                                    id={`upload-${item}`} 
                                                    type="file" 
                                                    accept="image/*" 
                                                    capture="environment"
                                                    className="hidden" 
                                                    onChange={(e) => handleImageUpload(item, e.target.files?.[0] || null)} 
                                                  />
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </TabsContent>
                                  ))}
                                </Tabs>
                              </div>
                            </ScrollArea>
                            <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
                              <Button className="w-full rounded-2xl h-14 font-bold bg-primary shadow-xl shadow-primary/20 font-headline text-white hover:bg-primary/90 uppercase tracking-widest text-xs transition-all hover:scale-[1.01]" onClick={handleConduct} disabled={isGenerating}>
                                {isGenerating ? <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Orchestrating Audit Records...</> : <><CheckCircle2 className="w-5 h-5 mr-3" /> Sign & Finalize Official Record</>}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        {inspection.summary && <div className="p-5 bg-primary/[0.03] rounded-2xl border border-primary/5 mt-4 text-left shadow-inner"><p className="text-[9px] font-bold text-primary/60 uppercase mb-2 font-headline tracking-widest">Audit Executive Summary</p><p className="text-sm text-primary/80 italic leading-relaxed font-body font-medium">"{inspection.summary}"</p></div>}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
