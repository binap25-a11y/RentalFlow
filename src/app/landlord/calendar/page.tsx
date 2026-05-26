"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
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
  Building2, Save, Activity, ShieldAlert,
  ArrowRight
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
import { ScrollArea } from "@/components/ui/scroll-area";

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
  
  const ledgerRef = useRef<HTMLDivElement>(null);

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
  const { data: allProperties } = useCollection(propertiesQuery);

  const properties = useMemo(() => 
    allProperties?.filter(p => !p.isDeleted) || [], 
  [allProperties]);

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

    inspections?.forEach(i => {
      const date = i.scheduledDate ? new Date(i.scheduledDate) : null;
      if (date && isValid(date) && properties.some(p => p.id === i.propertyId)) {
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

    maintenance?.forEach(m => {
      const date = m.scheduledDate ? new Date(m.scheduledDate) : null;
      if (date && isValid(date) && m.status !== 'completed' && properties.some(p => p.id === m.propertyId)) {
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

  const handleDateSelect = (d: Date | undefined) => {
    if (d) {
      setSelectedDate(d);
      // Premium Interaction: Auto-scroll to ledger when date is picked
      setTimeout(() => {
        ledgerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    }
  };

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
    inspection: { borderBottom: '3px solid hsl(var(--accent))' },
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
        <Loader2 className="animate-spin text-primary w-12 h-12 opacity-60" />
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground font-headline">Synchronizing Roadmap</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto pb-12 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1.5 rounded-full font-bold mb-3 uppercase tracking-[0.2em] text-[9px]">
             <Activity className="w-3 h-3 mr-2" /> Timeline Orchestration
          </Badge>
          <h1 className="text-3xl font-headline font-bold text-foreground tracking-tight">Portfolio Calendar</h1>
          <p className="text-muted-foreground font-medium font-body max-w-lg mt-1 text-sm">Managing site audits and high-fidelity repair timelines.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm rounded-[2rem] overflow-hidden bg-card ring-1 ring-border">
            <CardContent className="p-6">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={handleDateSelect}
                className="w-full border-none shadow-none ring-0 p-0 bg-transparent"
                modifiers={modifiers}
                modifiersStyles={modifierStyles}
              />
              
              <div className="mt-8 pt-6 border-t border-border space-y-4">
                 <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-60 font-headline">Operational Legend</p>
                 <div className="grid grid-cols-1 gap-2">
                    <div className="flex items-center gap-3 p-3 bg-accent/5 rounded-xl border border-accent/10">
                        <div className="w-2.5 h-2.5 rounded-full bg-accent shadow-sm" />
                        <span className="text-[10px] font-bold uppercase text-accent tracking-widest font-headline">Site Audit Scheduled</span>
                    </div>
                    <div className="flex items-center gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/10">
                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-sm" />
                        <span className="text-[10px] font-bold uppercase text-amber-500 tracking-widest font-headline">Maintenance Event</span>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2rem] bg-primary text-primary-foreground overflow-hidden p-8 relative group">
            <div className="absolute -top-10 -right-10 opacity-10 group-hover:rotate-12 transition-transform duration-700 text-foreground">
               <Clock className="w-32 h-32" />
            </div>
            <div className="relative z-10 space-y-4">
              <h3 className="text-lg font-bold font-headline flex items-center gap-3 text-accent uppercase tracking-widest">
                 <Clock className="w-5 h-5" /> Quick Actions
              </h3>
              <p className="text-xs opacity-80 leading-relaxed font-body font-medium">Select a date to view current site visits or log a new repair directly to the roadmap.</p>
              <Button className="w-full rounded-xl bg-primary-foreground text-primary font-bold h-12 shadow-lg hover:opacity-90 transition-all text-xs uppercase tracking-widest font-headline" onClick={() => setIsAddRepairOpen(true)}>
                 <Plus className="w-4 h-4 mr-2" /> Schedule Task
              </Button>
            </div>
          </Card>
        </div>

        <div className="lg:col-span-8 space-y-8" ref={ledgerRef}>
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-card overflow-hidden min-h-[500px] ring-1 ring-border">
            <CardHeader className="bg-muted/10 border-b border-border p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="text-left">
                 <p className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-60 mb-1 font-headline">Daily Ledger</p>
                 <CardTitle className="text-2xl font-headline text-foreground tracking-tight">{format(selectedDate, 'PPPP')}</CardTitle>
              </div>
              <Badge className="rounded-full py-1.5 px-4 font-bold bg-primary text-primary-foreground uppercase text-[9px] tracking-widest shadow-sm">
                {selectedDayEvents.length} Active Records
              </Badge>
            </CardHeader>
            <CardContent className="p-8">
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 opacity-20 text-center space-y-4">
                   <div className="p-8 bg-muted/20 rounded-[2rem]">
                      <CalendarDays className="w-16 h-16 text-foreground" />
                   </div>
                   <h3 className="text-lg font-bold font-headline text-foreground uppercase tracking-widest">Empty Ledger</h3>
                   <p className="text-xs font-medium text-foreground">No audits or maintenance recorded for this date.</p>
                </div>
              ) : (
                <div className="grid gap-4">
                  {selectedDayEvents.map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-xl font-bold font-headline flex items-center text-foreground tracking-tight">
                <ChevronRight className="w-5 h-5 mr-1 text-accent" /> Portfolio Future State
              </h3>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 font-headline">Upcoming Roadmap</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {allEvents.filter(e => isAfter(e.date, startOfDay(new Date()))).slice(0, 6).length === 0 ? (
                  <p className="col-span-full text-center py-16 text-muted-foreground italic text-xs font-medium bg-muted/5 rounded-[2rem] border-2 border-dashed border-border">No future operations synchronized.</p>
               ) : (
                 allEvents.filter(e => isAfter(e.date, startOfDay(new Date()))).slice(0, 6).map(event => (
                    <EventCard key={event.id} event={event} compact />
                 ))
               )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isAddRepairOpen} onOpenChange={setIsAddRepairOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[550px] bg-card flex flex-col max-h-[90vh]">
          <form onSubmit={handleAddRepair} className="flex flex-col h-full overflow-hidden">
            <div className="p-8 bg-primary/5 border-b text-left shrink-0">
              <DialogTitle className="text-xl font-bold font-headline text-foreground tracking-tight">Schedule Maintenance</DialogTitle>
              <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Registering an operational event for {format(selectedDate, 'PPP')}</DialogDescription>
            </div>
            <ScrollArea className="flex-1">
              <div className="p-8 space-y-6 text-left">
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground opacity-60 font-headline tracking-widest">Target Inventory Asset</Label>
                  <select className="flex h-12 w-full rounded-xl border-none bg-muted/20 px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-foreground font-headline" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required>
                    <option value="">Choose an asset...</option>
                    {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground opacity-60 font-headline tracking-widest">Repair Subject</Label>
                  <Input value={repairTitle} onChange={(e) => setRepairTitle(e.target.value)} required placeholder="e.g. Electrical Fault Discovery" className="rounded-xl h-12 bg-muted/20 border-none font-bold text-sm px-4" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-muted-foreground opacity-60 font-headline tracking-widest">Operational Context</Label>
                  <Textarea value={repairDesc} onChange={(e) => setRepairDesc(e.target.value)} placeholder="Provide full context for contractor access..." className="rounded-xl min-h-[120px] bg-muted/20 border-none font-medium px-4 py-4 text-sm leading-relaxed" />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
              <Button type="submit" disabled={isSaving || !selectedPropertyId || !repairTitle} className="w-full rounded-xl h-14 font-bold bg-primary text-primary-foreground shadow-lg hover:opacity-90 transition-all font-headline uppercase tracking-widest text-xs">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
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
  const colorClass = event.type === 'inspection' ? "bg-accent text-white" : "bg-amber-500 text-white";
  const linkHref = event.type === 'inspection' ? `/landlord/inspections` : `/landlord/maintenance`;

  return (
    <div className={cn(
      "flex items-center justify-between transition-all bg-card ring-1 ring-border group",
      compact ? "p-4 rounded-2xl" : "p-6 rounded-[1.75rem]"
    )}>
      <div className="flex items-center gap-5 text-left">
        <div className={cn(
          "rounded-xl flex items-center justify-center transform group-hover:scale-105 transition-transform shrink-0 shadow-sm",
          compact ? "w-10 h-10" : "w-14 h-14",
          colorClass
        )}>
           <Icon className={compact ? "w-5 h-5" : "w-7 h-7"} />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
             <Badge variant="outline" className="uppercase text-[7px] font-bold tracking-[0.2em] text-muted-foreground border-border font-headline px-2 py-0.5">
              {event.type === 'inspection' ? 'AUDIT' : 'REPAIR'}
             </Badge>
             {compact && (
               <span className="text-[9px] font-bold text-muted-foreground uppercase opacity-40 font-headline">{format(event.date, 'MMM dd')}</span>
             )}
          </div>
          <h4 className={cn(
            "font-bold font-headline leading-tight mb-1 tracking-tight text-foreground truncate",
            compact ? "text-sm" : "text-xl"
          )}>{event.title}</h4>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[9px] text-muted-foreground font-bold flex items-center font-body opacity-60 uppercase tracking-widest font-headline">
              <MapPin className="w-3 h-3 mr-1 text-accent" /> {event.subtitle}
            </p>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 shrink-0">
         <Button variant="outline" size="sm" asChild className="rounded-xl h-10 font-bold border-border bg-card shadow-sm hover:bg-primary hover:text-primary-foreground text-[10px] uppercase tracking-widest px-4 transition-all">
            <Link href={linkHref}>
               {event.type === 'inspection' ? 'Jump to Audit' : 'Jump to Repair'}
               <ArrowRight className="w-3 h-3 ml-2" />
            </Link>
         </Button>
      </div>
    </div>
  );
}
