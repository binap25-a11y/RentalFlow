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
  Calendar as CalendarIcon, Loader2, 
  CheckCircle2, ClipboardList, ShieldAlert, Home, Wrench, 
  Check, X, AlertTriangle, Info, Trash2, Edit3, PlayCircle, Camera, Clock
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn, compressImage, withRetry } from "@/lib/utils";
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
  const [structuredFindings, setStructuredFindings] = useState<Record<string, { status: 'pass' | 'fail', notes: string, imageUrl?: string, isSyncing?: boolean }>>({});
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

  const handleImageUpload = async (itemId: string, file: File | null) => {
    if (!file || !user || !activeInspection) return;

    setStructuredFindings(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], isSyncing: true }
    }));

    try {
      const optimizedBlob = await compressImage(file);
      // ATOMIC PATH PROTOCOL: uid/propertyId/timestamp-filename
      const path = `${user.uid}/${activeInspection.propertyId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      
      const publicUrl = await withRetry(async () => {
        const formData = new FormData();
        formData.append('file', optimizedBlob, file.name);
        
        const result = await uploadToSupabase(formData, 'Property-Images-', path);
        if (!result.success) throw new Error(result.error);
        return result.url!;
      });
      
      setStructuredFindings(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], imageUrl: publicUrl, isSyncing: false }
      }));
      toast({ title: "Evidence Synchronized" });
    } catch (err: any) {
      console.error("Audit Sync Failure:", err);
      setStructuredFindings(prev => ({
        ...prev,
        [itemId]: { ...prev[itemId], isSyncing: false }
      }));
      toast({ 
        variant: "destructive", 
        title: "Synchronization Interrupted", 
        description: err.message || "Visual delivery failed."
      });
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

    toast({ title: "Inspection Scheduled", description: `New inspection set for ${format(date, 'PPP')}` });
    setSelectedPropertyId('');
    setDate(undefined);
  };

  const handleDeleteInspection = (id: string) => {
    if (!db) return;
    const inspectionRef = doc(db, 'inspections', id);
    deleteDocumentNonBlocking(inspectionRef);
    toast({ title: "Audit Record Removed" });
  };

  const handleFinalizeAudit = async () => {
    if (!db || !activeInspection || !user) return;
    setIsGenerating(true);
    const property = properties?.find(p => p.id === activeInspection.propertyId);

    try {
      const flatFindingsString = Object.entries(structuredFindings).map(([item, data]: [string, any]) => {
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
        structuredFindings: structuredFindings,
        summary: aiReport.summary,
        priorityItems: aiReport.priorityItems,
        healthScore: aiReport.healthScore,
        conductedDate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      };

      updateDocumentNonBlocking(inspectionRef, completedData);
      toast({ title: "Audit Finalized", description: "Official record updated." });
      setActiveInspection(null);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Reporting Failed" });
    } finally {
      setIsGenerating(false);
    }
  };

  if (!isClient || isPropLoading || isInspLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>;

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
                            <Button variant="ghost" size="icon" className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg" onClick={() => handleDeleteInspection(inspection.id)}><Trash2 className="w-4 h-4" /></Button>
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
                          <DialogContent className="sm:max-w-[850px] p-0 rounded-[3rem] border-none shadow-2xl flex flex-col h-[90vh] overflow-hidden bg-card">
                            <div className="p-8 bg-primary/5 border-b text-left shrink-0">
                              <DialogTitle className="text-2xl font-headline font-bold text-foreground tracking-tight">Professional Property Audit</DialogTitle>
                              <DialogDescription className="font-medium text-muted-foreground font-body mt-1">Conducting full safety audit with high-fidelity evidence capture.</DialogDescription>
                            </div>
                            <ScrollArea className="flex-1 text-left">
                              <div className="p-8 space-y-8">
                                <Tabs defaultValue="exterior" className="w-full">
                                  <div className="overflow-x-auto pb-4 no-scrollbar">
                                    <TabsList className="inline-flex w-max min-w-full bg-muted/50 p-1.5 rounded-2xl h-auto gap-1">
                                      {INSPECTION_SECTIONS.map(s => (
                                        <TabsTrigger key={s.id} value={s.id} className="rounded-xl py-3 px-6 flex items-center gap-2 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm">
                                          <s.icon className="w-4 h-4" />
                                          <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline">{s.title}</span>
                                        </TabsTrigger>
                                      ))}
                                    </TabsList>
                                  </div>
                                  {INSPECTION_SECTIONS.map(section => (
                                    <TabsContent key={section.id} value={section.id} className="mt-8 space-y-8 animate-in fade-in duration-500">
                                      <div className="flex items-center gap-3 mb-6">
                                        <div className="p-3 bg-primary/5 rounded-xl text-foreground ring-1 ring-border"><section.icon className="w-6 h-6" /></div>
                                        <h3 className="text-xl font-bold font-headline text-foreground">{section.title}</h3>
                                      </div>
                                      <div className="grid gap-6">
                                        {section.items.map(item => (
                                          <div key={item} className="p-6 bg-primary/[0.02] rounded-[2rem] space-y-6 border border-border shadow-inner">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                              <Label className="font-bold text-base text-left font-headline text-foreground tracking-tight">{item}</Label>
                                              <div className="flex gap-2">
                                                <Button size="sm" variant={structuredFindings[item]?.status === 'pass' ? 'default' : 'outline'} className="rounded-xl font-bold h-10 px-6 font-headline tracking-widest text-[10px]" onClick={() => handleStatusChange(item, 'pass')}><Check className="w-4 h-4 mr-2" /> PASS</Button>
                                                <Button size="sm" variant={structuredFindings[item]?.status === 'fail' ? 'destructive' : 'outline'} className="rounded-xl font-bold h-10 px-6 font-headline tracking-widest text-[10px]" onClick={() => handleStatusChange(item, 'fail')}><X className="w-4 h-4 mr-2" /> FAIL</Button>
                                              </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-border">
                                              <div className="space-y-2 text-left">
                                                <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60 font-headline">Audit Findings</Label>
                                                <Textarea placeholder="Auditor notes..." className="rounded-2xl min-h-[120px] bg-muted/20 text-sm font-body border-none shadow-inner focus:ring-2 focus:ring-accent text-foreground" value={structuredFindings[item]?.notes || ''} onChange={(e) => handleNotesChange(item, e.target.value)} />
                                              </div>
                                              <div className="space-y-2 text-left">
                                                <Label className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60 font-headline">Evidence Capture</Label>
                                                <div className="relative group">
                                                  {structuredFindings[item]?.imageUrl ? (
                                                    <div className="relative aspect-video rounded-2xl overflow-hidden bg-background border border-border shadow-lg">
                                                      <Image src={structuredFindings[item]?.imageUrl || ''} alt="Evidence" fill className="object-cover" unoptimized />
                                                      <div className="absolute top-3 right-3 flex gap-1 z-20">
                                                        <Button variant="destructive" size="icon" className="h-10 w-10 rounded-xl shadow-2xl transition-all hover:scale-110 active:scale-95 bg-red-500 text-white" onClick={() => setStructuredFindings(prev => ({...prev, [item]: {...prev[item], imageUrl: undefined}}))}>
                                                          <Trash2 className="w-5 h-5" />
                                                        </Button>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <label 
                                                      htmlFor={`upload-${item}`}
                                                      className="w-full aspect-video rounded-[2rem] border-2 border-dashed border-border hover:border-accent/30 transition-all bg-muted/10 flex flex-col items-center justify-center gap-3 group cursor-pointer shadow-inner"
                                                    >
                                                      {structuredFindings[item]?.isSyncing ? (
                                                        <div className="flex flex-col items-center gap-2">
                                                          <Loader2 className="w-8 h-8 animate-spin text-accent opacity-40" />
                                                          <span className="text-[8px] font-bold uppercase text-accent tracking-[0.3em]">Syncing Binary...</span>
                                                        </div>
                                                      ) : (
                                                        <>
                                                          <div className="p-4 bg-primary/5 rounded-full group-hover:scale-110 transition-transform"><Camera className="w-8 h-8 text-muted-foreground opacity-40 group-hover:opacity-60" /></div>
                                                          <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-40 group-hover:opacity-60">Gallery Select</span>
                                                        </>
                                                      )}
                                                    </label>
                                                  )}
                                                  <input 
                                                    id={`upload-${item}`} 
                                                    type="file" 
                                                    accept="image/*" 
                                                    className="hidden" 
                                                    onChange={(e) => handleImageUpload(item, e.target.files?.[0] || null)} 
                                                    disabled={structuredFindings[item]?.isSyncing}
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
                              <Button className="w-full rounded-2xl h-14 font-bold bg-accent shadow-xl shadow-accent/20 font-headline text-white hover:bg-accent/90 uppercase tracking-widest text-xs transition-all hover:scale-[1.01] border-none" onClick={handleFinalizeAudit} disabled={isGenerating || Object.values(structuredFindings).some(f => f.isSyncing)}>
                                {isGenerating ? <><Loader2 className="w-5 h-5 mr-3 animate-spin" /> Orchestrating Audit Records...</> : <><CheckCircle2 className="w-5 h-5 mr-3" /> Sign & Finalize Official Record</>}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                        {inspection.summary && <div className="p-5 bg-primary/[0.03] rounded-2xl border border-border mt-4 text-left shadow-inner"><p className="text-[9px] font-bold text-muted-foreground/60 uppercase mb-2 font-headline tracking-widest">Audit Executive Summary</p><p className="text-sm text-foreground/80 italic leading-relaxed font-body font-medium">"{inspection.summary}"</p></div>}
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
