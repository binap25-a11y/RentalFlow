"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  getLandlordCollectionQuery,
  setDocumentNonBlocking
} from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, Loader2, Wrench, ShieldCheck, 
  ChevronRight, Clock, MapPin, 
  LayoutDashboard, Plus,
  Building2, Save, Activity, ShieldAlert
} from "lucide-react";
import { format, isSameDay, isAfter, startOfDay, isValid } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

type PortfolioEvent = {
  id: string;
  type: 'inspection' | 'repair';
  date: Date;
  title: string;
  subtitle: string;
  propertyId: string;
  status?: string;
  priority?: string;
};

export default function LandlordCalendarPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isClient, setIsClient] = useState(false);
  const [isAddRepairOpen, setIsAddRepairOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // New Repair Form State
  const [repairTitle, setRepairTitle] = useState('');
  const [repairDesc, setRepairDesc] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  useEffect(() => {
    setIsClient(true);
  }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);
  const { data: properties } = useCollection(propertiesQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "inspections", user.uid);
  }, [db, user]);
  const { data: inspections, loading: isInspLoading } = useCollection(inspectionsQuery);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "maintenanceRequests", user.uid);
  }, [db, user]);
  const { data: maintenance, loading: isMaintLoading } = useCollection(maintenanceQuery);

  const allEvents = useMemo(() => {
    if (!isClient || !properties) return [];
    
    const events: PortfolioEvent[] = [];

    // 1. Map Inspections
    inspections?.forEach(i => {
      const date = i.scheduledDate ? new Date(i.scheduledDate) : null;
      if (date && isValid(date)) {
        events.push({
          id: i.id,
          type: 'inspection',
          date,
          title: `Site Audit: ${properties.find(p => p.id === i.propertyId)?.addressLine1 || 'Property Asset'}`,
          subtitle: i.status || 'Scheduled',
          propertyId: i.propertyId,
          status: i.status
        });
      }
    });

    // 2. Map Maintenance Repairs (Scheduled Only)
    maintenance?.forEach(m => {
      const date = m.scheduledDate ? new Date(m.scheduledDate) : null;
      if (date && isValid(date) && m.status !== 'completed') {
        events.push({
          id: m.id,
          type: 'repair',
          date,
          title: `Repair: ${m.title}`,
          subtitle: properties.find(p => p.id === m.propertyId)?.addressLine1 || 'Property Asset',
          propertyId: m.propertyId,
          priority: m.priority,
          status: m.status
        });
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [inspections, maintenance, properties, isClient]);

  const selectedDayEvents = useMemo(() => {
    return allEvents.filter(e => isSameDay(e.date, selectedDate));
  }, [allEvents, selectedDate]);

  const modifiers = useMemo(() => {
    const dates: Record<string, Date[]> = {
      inspection: [],
      repair: []
    };
    allEvents.forEach(e => {
      if (dates[e.type]) {
        dates[e.type].push(e.date);
      }
    });
    return dates;
  }, [allEvents]);

  const modifierStyles = {
    inspection: { borderBottom: '3px solid hsl(var(--primary))' },
    repair: { borderBottom: '3px solid #f59e0b' }
  };

  const handleAddRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedPropertyId || !repairTitle) return;

    setIsSaving(true);
    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    const property = properties?.find(p => p.id === selectedPropertyId);

    const payload = {
      id: requestId,
      propertyId: selectedPropertyId,
      landlordId: user.uid,
      tenantId: property?.tenantIds?.[0] || 'landlord-direct',
      memberIds: property?.memberIds || [user.uid],
      title: repairTitle,
      description: repairDesc,
      status: 'pending',
      priority: 'routine',
      category: 'other',
      scheduledDate: selectedDate.toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setDocumentNonBlocking(requestRef, payload, { merge: true });
    
    toast({ title: "Repair Scheduled", description: `Task logged for ${format(selectedDate, 'PPP')}` });
    setIsAddRepairOpen(false);
    setIsSaving(false);
    setRepairTitle('');
    setRepairDesc('');
    setSelectedPropertyId('');
  };

  if (!isClient || isInspLoading || isMaintLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse" />
          <Loader2 className="animate-spin text-primary w-12 h-12 opacity-60 relative z-10" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground font-headline">Synchronizing Roadmap</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto pb-12 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1.5 rounded-full font-bold mb-4 uppercase tracking-[0.2em] text-[10px]">
             <Activity className="w-3 h-3 mr-2" /> Timeline Orchestration
          </Badge>
          <h1 className="text-5xl font-headline font-bold text-primary tracking-tighter">Portfolio Calendar</h1>
          <p className="text-muted-foreground font-medium font-body max-w-lg mt-2">Managing site audits and high-fidelity repair timelines.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Left Column: Calendar Control */}
        <div className="lg:col-span-4 space-y-8">
          <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-white ring-1 ring-primary/5">
            <CardContent className="p-8">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="w-full border-none shadow-none ring-0 p-0"
                modifiers={modifiers}
                modifiersStyles={modifierStyles}
              />
              
              <div className="mt-10 pt-8 border-t border-primary/5 space-y-6">
                 <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/40 font-headline">Operational Legend</p>
                 <div className="grid grid-cols-1 gap-4">
                    <div className="flex items-center gap-3 p-3 bg-primary/[0.03] rounded-2xl border border-primary/5">
                        <div className="w-3 h-3 rounded-full bg-primary shadow-lg shadow-primary/20" />
                        <span className="text-[10px] font-bold uppercase text-primary/70 tracking-widest font-headline">Site Audit Scheduled</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-2xl border border-amber-100">
                        <div className="w-3 h-3 rounded-full bg-amber-500 shadow-lg shadow-amber-200" />
                        <span className="text-[10px] font-bold uppercase text-amber-700 tracking-widest font-headline">Maintenance Event</span>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-xl rounded-[2.5rem] bg-primary text-white overflow-hidden p-10 relative group">
            <div className="absolute -top-10 -right-10 opacity-10 group-hover:rotate-12 transition-transform duration-700">
               <Clock className="w-48 h-48" />
            </div>
            <div className="relative z-10">
              <h3 className="text-xl font-bold font-headline mb-4 flex items-center gap-3 text-accent uppercase tracking-widest">
                 <Clock className="w-6 h-6" /> Quick Actions
              </h3>
              <p className="text-sm opacity-80 leading-relaxed font-body font-medium">Select a date to view current site visits or log a new repair directly to the roadmap.</p>
              <Button className="mt-8 w-full rounded-2xl bg-white text-primary font-bold h-12 shadow-2xl shadow-black/20 hover:scale-[1.02] transition-transform" onClick={() => setIsAddRepairOpen(true)}>
                 <Plus className="w-4 h-4 mr-2" /> Schedule Repair for {format(selectedDate, 'PP')}
              </Button>
            </div>
          </Card>
        </div>

        {/* Right Column: Daily Ledger */}
        <div className="lg:col-span-8 space-y-10">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-white overflow-hidden min-h-[600px] ring-1 ring-primary/5 border border-primary/5">
            <CardHeader className="bg-primary/[0.02] border-b border-primary/5 p-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="text-left">
                 <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/40 mb-2 font-headline">Daily Operational Ledger</p>
                 <CardTitle className="text-4xl font-headline text-primary tracking-tighter">{format(selectedDate, 'PPPP')}</CardTitle>
              </div>
              <div className="flex items-center gap-4">
                <Badge className="rounded-full py-2.5 px-6 font-bold bg-primary text-white uppercase text-[10px] tracking-widest shadow-xl shadow-primary/10">
                  {selectedDayEvents.length} Active Records
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-10">
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-32 opacity-20 text-center">
                   <div className="p-10 bg-muted/20 rounded-[3rem] mb-8">
                      <CalendarDays className="w-20 h-20 text-primary" />
                   </div>
                   <h3 className="text-2xl font-bold font-headline text-primary uppercase tracking-widest">No Events Found</h3>
                   <p className="text-sm font-medium mt-3">No audits or maintenance recorded for this date.</p>
                   <Button variant="ghost" className="mt-6 font-bold text-primary" onClick={() => setIsAddRepairOpen(true)}>Log Task Now</Button>
                </div>
              ) : (
                <div className="grid gap-6">
                  {selectedDayEvents.map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-8">
            <div className="flex items-center justify-between">
              <h3 className="text-2xl font-bold font-headline flex items-center text-primary tracking-tight">
                <ChevronRight className="w-6 h-6 mr-2 text-accent" /> Portfolio Future State
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Upcoming Operations</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {allEvents.filter(e => isAfter(e.date, startOfDay(new Date()))).slice(0, 8).length === 0 ? (
                  <p className="col-span-full text-center py-20 text-muted-foreground italic text-sm font-medium bg-muted/5 rounded-[3rem] border-2 border-dashed border-primary/5">No future operations synchronized.</p>
               ) : (
                 allEvents.filter(e => isAfter(e.date, startOfDay(new Date()))).slice(0, 8).map(event => (
                    <EventCard key={event.id} event={event} compact />
                 ))
               )}
            </div>
          </div>
        </div>
      </div>

      {/* Add Repair Dialog */}
      <Dialog open={isAddRepairOpen} onOpenChange={setIsAddRepairOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden max-w-[600px] animate-in zoom-in-95 duration-300 bg-white">
          <form onSubmit={handleAddRepair}>
            <div className="p-10 bg-primary/5 border-b text-left">
              <DialogTitle className="text-3xl font-bold font-headline text-primary tracking-tighter">Schedule Maintenance</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground mt-2">Registering an operational event for {format(selectedDate, 'PPP')}</DialogDescription>
            </div>
            <div className="p-10 space-y-8 text-left">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-[0.2em]">Target Asset</Label>
                <select className="flex h-14 w-full rounded-2xl border-none bg-muted/20 px-6 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-bold tracking-tight" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required>
                  <option value="">Choose an inventory item...</option>
                  {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-[0.2em]">Repair Subject</Label>
                <Input value={repairTitle} onChange={(e) => setRepairTitle(e.target.value)} required placeholder="e.g. Electrical Fault Discovery" className="rounded-2xl h-14 bg-muted/20 border-none font-bold text-lg" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-[0.2em]">Operational Context</Label>
                <Textarea value={repairDesc} onChange={(e) => setRepairDesc(e.target.value)} placeholder="Provide full context for contractor access..." className="rounded-2xl min-h-[150px] bg-muted/20 border-none font-medium leading-relaxed" />
              </div>
            </div>
            <DialogFooter className="p-10 bg-muted/10 border-t">
              <Button type="submit" disabled={isSaving || !selectedPropertyId || !repairTitle} className="w-full rounded-2xl h-16 font-bold bg-primary text-white shadow-2xl shadow-primary/20 font-headline text-xl hover:scale-[1.01] transition-transform">
                {isSaving ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Save className="w-6 h-6 mr-3" />}
                Synchronize to Ledger
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EventCard({ event, compact = false }: { event: PortfolioEvent, compact?: boolean }) {
  const Icon = event.type === 'inspection' ? ShieldCheck : Wrench;
  const colorClass = event.type === 'inspection' ? "bg-primary text-white shadow-primary/20" : "bg-amber-500 text-white shadow-amber-200";
  const linkHref = event.type === 'inspection' ? `/landlord/inspections` : `/landlord/maintenance`;

  return (
    <Link href={linkHref} className="group block">
      <div className={cn(
        "flex items-center justify-between transition-all hover:bg-white hover:shadow-2xl hover:scale-[1.01] hover:border-primary/10 bg-primary/[0.03] border border-primary/5",
        compact ? "p-6 rounded-[2rem]" : "p-8 rounded-[2.5rem]"
      )}>
        <div className="flex items-center gap-6 text-left">
          <div className={cn(
            "rounded-[1.5rem] flex items-center justify-center shadow-xl transform group-hover:rotate-6 transition-transform shrink-0",
            compact ? "w-14 h-14" : "w-20 h-20",
            colorClass
          )}>
             <Icon className={compact ? "w-7 h-7" : "w-10 h-10"} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-3 mb-2">
               <Badge variant="outline" className="uppercase text-[8px] font-bold tracking-[0.2em] opacity-40 border-primary/10 font-headline bg-white/50">
                {event.type === 'inspection' ? 'PROPERTY AUDIT' : 'REPAIR TICKET'}
               </Badge>
               {compact && (
                 <span className="text-[10px] font-bold text-muted-foreground uppercase opacity-40">{format(event.date, 'MMM dd')}</span>
               )}
            </div>
            <h4 className={cn(
              "font-bold font-headline text-primary leading-tight mb-1 tracking-tighter group-hover:text-accent transition-colors truncate",
              compact ? "text-lg" : "text-3xl"
            )}>{event.title}</h4>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-[10px] text-muted-foreground font-bold flex items-center font-body opacity-60 uppercase tracking-widest">
                <MapPin className="w-3 h-3 mr-1 text-accent" /> {event.subtitle}
              </p>
              {!compact && (
                <Badge variant="secondary" className="bg-primary/5 text-primary/60 border-none text-[8px] font-bold uppercase tracking-[0.1em]">Status: {event.status || 'Active'}</Badge>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-primary/10 group-hover:text-primary transition-all shrink-0">
           {!compact && <span className="text-[10px] font-bold uppercase tracking-[0.3em] hidden md:inline">Open Ledger</span>}
           <ChevronRight className={compact ? "w-6 h-6" : "w-8 h-8"} />
        </div>
      </div>
    </Link>
  );
}
