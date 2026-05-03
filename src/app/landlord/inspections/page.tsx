"use client";

import { useState, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  getMemberCollectionQuery,
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
  Check, X, AlertTriangle, Info, Trash2, Edit3, PlayCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { generateInspectionReport } from "@/ai/flows/generate-inspection-report";
import { jsPDF } from "jspdf";

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
    return getMemberCollectionQuery(db, "inspections", user.uid);
  }, [db, user]);

  const { data: inspections, loading: isInspLoading } = useCollection(inspectionsQuery);

  const [date, setDate] = useState<Date>();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');
  const [activeInspection, setActiveInspection] = useState<any>(null);
  const [structuredFindings, setStructuredFindings] = useState<Record<string, { status: 'pass' | 'fail', notes: string }>>({});
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

  const handleSchedule = () => {
    if (!user || !db || !selectedPropertyId || !date) return;

    const property = properties?.find(p => p.id === selectedPropertyId);
    const inspectionId = doc(collection(db, 'inspections')).id;
    const inspectionRef = doc(db, 'inspections', inspectionId);

    updateDocumentNonBlocking(inspectionRef, {
      id: inspectionId,
      propertyId: selectedPropertyId,
      landlordId: user.uid,
      memberIds: property?.memberIds || [user.uid],
      scheduledDate: date.toISOString(),
      status: 'scheduled',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

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

  const downloadPDF = (inspection: any) => {
    const property = properties?.find(p => p.id === inspection.propertyId);
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

    Object.entries(findings).forEach(([item, data]: [string, any]) => {
      if (y > 270) {
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
      if (data.notes) {
        const splitNotes = pdf.splitTextToSize(`Note: ${data.notes}`, pageWidth - 80);
        pdf.text(splitNotes, 25, y + 5);
        y += (splitNotes.length * 4);
      }
      
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(10);
      y += 8;
    });

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

    const flatFindings = Object.entries(structuredFindings).map(([item, data]) => {
      return `${item}: ${data.status?.toUpperCase() || 'UNCHECKED'} ${data.notes ? `(Notes: ${data.notes})` : ''}`;
    }).join('\n');

    try {
      const aiReport = await generateInspectionReport({
        propertyAddress: property?.addressLine1 || 'Property',
        findings: flatFindings
      });

      const inspectionRef = doc(db, 'inspections', activeInspection.id);
      const completedData = {
        ...activeInspection,
        status: 'completed',
        structuredFindings: structuredFindings,
        summary: aiReport.summary,
        priorityItems: aiReport.priorityItems,
        healthScore: aiReport.healthScore,
        conductedDate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      };

      updateDocumentNonBlocking(inspectionRef, completedData);
      downloadPDF(completedData);
      toast({ title: "Audit Finalized", description: "Official record updated and report downloaded." });
      setActiveInspection(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reporting Failed", description: "AI could not generate summary at this time." });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isClient || isPropLoading || isInspLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Inspections & Audits</h1>
          <p className="text-muted-foreground font-medium font-body">Official portfolio compliance tracking and safety records.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Schedule Audit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-left">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Select Asset</Label>
              <select className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
                <option value="">Choose a property...</option>
                {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
              </select>
            </div>
            <div className="space-y-2 text-left">
              <Label className="text-xs uppercase font-bold text-muted-foreground">Audit Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal h-11 rounded-xl border-input hover:bg-muted/50 transition-colors", !date && "text-muted-foreground")}>
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0 rounded-2xl shadow-2xl border-none overflow-hidden" align="start">
                  <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                </PopoverContent>
              </Popover>
            </div>
            <Button className="w-full rounded-xl h-11 font-bold shadow-lg shadow-primary/10" onClick={handleSchedule} disabled={!date || !selectedPropertyId}>Confirm Schedule</Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold font-headline flex items-center">
            <ClipboardList className="w-5 h-5 mr-2 text-primary" />
            Portfolio Compliance Ledger
          </h3>
          <div className="grid gap-4">
            {!inspections || inspections.length === 0 ? (
              <div className="py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed border-primary/10">
                <p className="text-muted-foreground font-medium">No audit records found.</p>
              </div>
            ) : (
              inspections.slice().sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map((inspection) => (
                <Card key={inspection.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="bg-primary/5 p-4 rounded-2xl flex flex-col items-center justify-center text-primary min-w-[100px] h-fit">
                        <span className="text-xs font-bold uppercase">{format(new Date(inspection.scheduledDate), 'MMM')}</span>
                        <span className="text-3xl font-bold">{format(new Date(inspection.scheduledDate), 'dd')}</span>
                      </div>
                      <div className="flex-1 space-y-3">
                        <div className="flex items-center justify-between">
                          <Badge variant={inspection.status === 'completed' ? 'secondary' : 'default'} className="uppercase font-bold text-[10px]">{inspection.status}</Badge>
                          <div className="flex gap-2">
                            {inspection.status === 'completed' && <Button variant="outline" size="sm" onClick={() => downloadPDF(inspection)} className="rounded-lg h-8 text-primary border-primary/20"><Download className="w-3 h-3 mr-2" /> Export PDF</Button>}
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg" onClick={() => handleDeleteInspection(inspection.id)}><Trash2 className="w-4 h-4" /></Button>
                          </div>
                        </div>
                        <div className="text-left">
                          <h4 className="text-lg font-bold font-headline">{properties?.find(p => p.id === inspection.propertyId)?.addressLine1 || 'Property Asset'}</h4>
                          <p className="text-xs text-muted-foreground font-bold flex items-center mt-1">
                            {inspection.conductedDate ? `Recorded: ${format(new Date(inspection.conductedDate), 'PPp')}` : `Scheduled: ${format(new Date(inspection.scheduledDate), 'PPP')}`}
                          </p>
                        </div>
                        <Dialog open={activeInspection?.id === inspection.id} onOpenChange={(open) => !open && setActiveInspection(null)}>
                          <DialogTrigger asChild>
                            <Button className={cn("w-full md:w-auto rounded-xl font-bold h-10 px-6", inspection.status === 'completed' ? "bg-muted hover:bg-muted/80 text-foreground" : "bg-accent hover:bg-accent/90 text-white")} onClick={() => handleOpenAudit(inspection)}>
                              {inspection.status === 'completed' ? <><Edit3 className="w-4 h-4 mr-2" /> Edit Audit</> : <><PlayCircle className="w-4 h-4 mr-2" /> Start Audit</>}
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-[700px] p-0 rounded-2xl border-none shadow-2xl flex flex-col h-[85vh] overflow-hidden">
                            <div className="p-6 bg-primary/5 border-b text-left">
                              <DialogTitle className="text-2xl font-headline font-bold">Comprehensive Audit</DialogTitle>
                              <DialogDescription className="font-medium">{inspection.status === 'completed' ? "Updating previous findings." : "Conducting full safety audit."}</DialogDescription>
                            </div>
                            <ScrollArea className="flex-1">
                              <div className="p-6 space-y-8">
                                <Tabs defaultValue="exterior">
                                  <TabsList className="w-full grid grid-cols-4 lg:grid-cols-7 h-auto bg-muted/50 p-1 rounded-xl">
                                    {INSPECTION_SECTIONS.map(s => <TabsTrigger key={s.id} value={s.id} className="rounded-lg py-2"><s.icon className="w-4 h-4" /></TabsTrigger>)}
                                  </TabsList>
                                  {INSPECTION_SECTIONS.map(section => (
                                    <TabsContent key={section.id} value={section.id} className="mt-6 space-y-6">
                                      <div className="flex items-center gap-2 mb-4"><section.icon className="w-5 h-5 text-primary" /><h3 className="text-lg font-bold font-headline">{section.title}</h3></div>
                                      {section.items.map(item => (
                                        <div key={item} className="p-4 bg-muted/20 rounded-2xl space-y-4 border border-primary/5">
                                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                                            <Label className="font-bold text-sm text-left">{item}</Label>
                                            <div className="flex gap-2">
                                              <Button size="sm" variant={structuredFindings[item]?.status === 'pass' ? 'default' : 'outline'} className="rounded-lg font-bold h-8 px-4" onClick={() => handleStatusChange(item, 'pass')}><Check className="w-3 h-3 mr-2" /> PASS</Button>
                                              <Button size="sm" variant={structuredFindings[item]?.status === 'fail' ? 'destructive' : 'outline'} className="rounded-lg font-bold h-8 px-4" onClick={() => handleStatusChange(item, 'fail')}><X className="w-3 h-3 mr-2" /> FAIL</Button>
                                            </div>
                                          </div>
                                          <Textarea placeholder="Auditor notes..." className="rounded-xl min-h-[60px] bg-white text-sm" value={structuredFindings[item]?.notes || ''} onChange={(e) => handleNotesChange(item, e.target.value)} />
                                        </div>
                                      ))}
                                    </TabsContent>
                                  ))}
                                </Tabs>
                              </div>
                            </ScrollArea>
                            <DialogFooter className="p-6 bg-muted/10 border-t">
                              <Button className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg shadow-primary/20" onClick={handleConduct} disabled={isGenerating}>
                                {isGenerating ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Finalizing...</> : <><CheckCircle2 className="w-4 h-4 mr-2" /> Sign & Update Record</>}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        {inspection.summary && <div className="p-4 bg-muted/40 rounded-xl border border-primary/5 mt-4 text-left"><p className="text-[10px] font-bold text-primary uppercase mb-2">Audit Executive Summary</p><p className="text-sm text-muted-foreground italic leading-relaxed">{inspection.summary}</p></div>}
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