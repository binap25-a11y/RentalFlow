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
  LayoutDashboard, ArrowUpRight, Plus,
  Building2, Save, X
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
  DialogTitle, 
  DialogTrigger 
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
          title: `Property Audit: ${properties.find(p => p.id === i.propertyId)?.addressLine1 || 'Asset'}`,
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
          subtitle: properties.find(p => p.id === m.propertyId)?.addressLine1 || 'Asset',
          propertyId: m.propertyId,
          priority: m.priority
        });
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [inspections, maintenance, properties, isClient]);

  const selectedDayEvents = useMemo(() => {
    return allEvents.filter(e => isSameDay(e.date, selectedDate));
  }, [allEvents, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return allEvents
      .filter(e => isAfter(e.date, today))
      .slice(0, 10);
  }, [allEvents]);

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
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-4">
        <Loader2 className="animate-spin text-primary w-10 h-10 opacity-40" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-headline">Syncing Portfolio Timeline</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary mb-2 tracking-tight">Portfolio Calendar</h1>
          <p className="text-muted-foreground font-medium font-body max-w-lg">High-fidelity timeline for site audits and coordinated repairs.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/10 bg-white" asChild>
              <Link href="/landlord/dashboard">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Portfolio Command
              </Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Calendar Control */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white ring-1 ring-primary/5">
            <CardContent className="p-8">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="w-full"
                modifiers={modifiers}
                modifiersStyles={modifierStyles}
              />
              
              <div className="mt-8 pt-6 border-t border-primary/5 space-y-4">
                 <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/40 font-headline">Timeline Legend</p>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-md bg-primary" />
                        <span className="text-[10px] font-bold uppercase text-primary/60 font-headline">Asset Audit</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-md bg-amber-500" />
                        <span className="text-[10px] font-bold uppercase text-primary/60 font-headline">Repair Target</span>
                    </div>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2rem] bg-primary text-white overflow-hidden p-8 relative">
            <div className="absolute top-0 right-0 p-4 opacity-10">
               <Clock className="w-20 h-20" />
            </div>
            <h3 className="text-lg font-bold font-headline mb-4 flex items-center gap-2 text-accent">
               <Clock className="w-5 h-5" /> Operational Readiness
            </h3>
            <p className="text-sm opacity-80 leading-relaxed font-body font-medium relative z-10">Use this view to coordinate site visits. Select a date on the calendar to view scheduled operations or log a new repair directly to the timeline.</p>
          </Card>
        </div>

        {/* Right Column: Daily Ledger & Add Repair */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden min-h-[450px] ring-1 ring-primary/5">
            <CardHeader className="bg-primary/[0.02] border-b border-primary/5 p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="text-left">
                 <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/40 mb-1 font-headline">Daily Operational Ledger</p>
                 <CardTitle className="text-3xl font-headline text-primary tracking-tight">{format(selectedDate, 'PPPP')}</CardTitle>
              </div>
              <div className="flex items-center gap-3">
                <Dialog open={isAddRepairOpen} onOpenChange={setIsAddRepairOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/20 h-11 px-6">
                      <Plus className="w-4 h-4 mr-2" /> Schedule Repair
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[550px]">
                    <form onSubmit={handleAddRepair}>
                      <div className="p-8 bg-primary/5 border-b text-left">
                        <DialogTitle className="text-2xl font-bold font-headline text-primary">Schedule Timeline Task</DialogTitle>
                        <DialogDescription className="font-medium">Logging an operation for {format(selectedDate, 'PPP')}</DialogDescription>
                      </div>
                      <div className="p-8 space-y-6 text-left bg-card">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-widest">Select Portfolio Asset</Label>
                          <select className="flex h-12 w-full rounded-xl border-none bg-muted/20 px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-bold" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required>
                            <option value="">Choose a property...</option>
                            {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                          </select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-widest">Task Subject</Label>
                          <Input value={repairTitle} onChange={(e) => setRepairTitle(e.target.value)} required placeholder="e.g. Boiler service or Electrical fix" className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-widest">Detailed Context</Label>
                          <Textarea value={repairDesc} onChange={(e) => setRepairDesc(e.target.value)} placeholder="Notes for the visit..." className="rounded-xl min-h-[120px] bg-muted/20 border-none font-medium" />
                        </div>
                      </div>
                      <DialogFooter className="p-8 bg-muted/10 border-t">
                        <Button type="submit" disabled={isSaving || !selectedPropertyId || !repairTitle} className="w-full rounded-xl h-14 font-bold bg-primary text-white shadow-xl shadow-primary/20 font-headline text-lg">
                          {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                          Commit to Portfolio Timeline
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                <Badge className="rounded-xl py-1.5 px-4 font-bold bg-primary text-white uppercase text-[10px]">
                  {selectedDayEvents.length} Tasks
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 opacity-30 text-center">
                   <div className="p-8 bg-muted/30 rounded-full mb-6">
                      <CalendarDays className="w-16 h-16 text-primary" />
                   </div>
                   <h3 className="text-xl font-bold font-headline text-primary uppercase tracking-widest">Clear Timeline</h3>
                   <p className="text-sm font-medium mt-2">No site visits recorded for this period.</p>
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
            <h3 className="text-2xl font-bold font-headline flex items-center text-primary tracking-tight">
              <ChevronRight className="w-6 h-6 mr-1 text-accent" /> Upcoming Portfolio Roadmap
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {upcomingEvents.length === 0 ? (
                  <p className="col-span-full text-center py-12 text-muted-foreground italic text-sm font-medium bg-muted/10 rounded-[2rem] border-2 border-dashed border-primary/5">No upcoming operations detected.</p>
               ) : (
                 upcomingEvents.map(event => {
                   const linkHref = event.type === 'inspection' ? `/landlord/inspections` : `/landlord/maintenance`;
                   
                   return (
                     <Link key={event.id} href={linkHref} className="flex gap-5 p-6 bg-white rounded-[1.75rem] border border-primary/5 shadow-sm items-center group hover:border-primary/20 hover:shadow-xl hover:scale-[1.02] transition-all">
                        <div className={cn(
                          "w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 transition-transform group-hover:rotate-6 shadow-sm",
                          event.type === 'inspection' ? "bg-primary text-white" : "bg-amber-100 text-amber-600"
                        )}>
                          {event.type === 'inspection' ? <ShieldCheck className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
                        </div>
                        <div className="min-w-0 flex-1 text-left">
                           <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1 font-headline">{format(event.date, 'MMM dd, yyyy')}</p>
                           <p className="font-bold text-base text-primary truncate leading-tight">{event.title}</p>
                        </div>
                        <ArrowUpRight className="w-5 h-5 text-primary/20 group-hover:text-primary transition-colors shrink-0" />
                     </Link>
                   );
                 })
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: PortfolioEvent }) {
  const Icon = event.type === 'inspection' ? ShieldCheck : Wrench;
  const colorClass = event.type === 'inspection' ? "bg-primary text-white" : "bg-amber-500 text-white";
  const linkHref = event.type === 'inspection' ? `/landlord/inspections` : `/landlord/maintenance`;

  return (
    <Link href={linkHref} className="group block">
      <div className="flex items-center justify-between p-6 bg-primary/[0.02] border border-primary/5 rounded-[2rem] transition-all hover:bg-white hover:shadow-2xl hover:scale-[1.01] hover:border-primary/10">
        <div className="flex items-center gap-6 text-left">
          <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-6 transition-transform", colorClass)}>
             <Icon className="w-7 h-7" />
          </div>
          <div>
            <div className="flex items-center gap-3 mb-2">
               <Badge variant="outline" className="uppercase text-[9px] font-bold tracking-[0.2em] opacity-60 border-primary/10 font-headline">
                {event.type === 'inspection' ? 'AUDIT' : 'REPAIR'}
               </Badge>
               {event.priority && (
                 <Badge className="text-[9px] uppercase font-bold bg-red-100 text-red-700 border-none px-3 font-headline">{event.priority}</Badge>
               )}
            </div>
            <h4 className="text-2xl font-bold font-headline text-primary leading-none mb-2 tracking-tight group-hover:text-accent transition-colors">{event.title}</h4>
            <p className="text-sm text-muted-foreground font-bold flex items-center font-body opacity-60">
              <MapPin className="w-3.5 h-3.5 mr-1.5" /> {event.subtitle}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-primary/20 group-hover:text-primary transition-all">
           <span className="text-[10px] font-bold uppercase tracking-widest hidden md:inline">Inspect Task</span>
           <ChevronRight className="w-6 h-6" />
        </div>
      </div>
    </Link>
  );
}
