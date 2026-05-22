
"use client";

import { useState, useMemo, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  getLandlordCollectionQuery 
} from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CalendarDays, Loader2, Wrench, ShieldCheck, 
  Users, ChevronRight, Clock, MapPin, 
  AlertTriangle, CheckCircle2, LayoutDashboard
} from "lucide-react";
import { format, isSameDay, isAfter, isBefore, addDays, startOfDay, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

type PortfolioEvent = {
  id: string;
  type: 'inspection' | 'lease' | 'repair';
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
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  // Fetch Data
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

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "tenantProfiles", user.uid);
  }, [db, user]);
  const { data: tenants, loading: isTenantsLoading } = useCollection(tenantsQuery);

  // Event Normalization Engine
  const allEvents = useMemo(() => {
    if (!isClient || !properties) return [];
    
    const events: PortfolioEvent[] = [];

    // 1. Inspections
    inspections?.forEach(i => {
      const date = i.scheduledDate ? new Date(i.scheduledDate) : null;
      if (date) {
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

    // 2. Repairs (Scheduled)
    maintenance?.forEach(m => {
      const date = m.scheduledDate ? new Date(m.scheduledDate) : null;
      if (date && m.status !== 'completed') {
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

    // 3. Lease Expiries (Renewals)
    tenants?.forEach(t => {
      const date = t.leaseEndDate ? new Date(t.leaseEndDate) : null;
      if (date) {
        events.push({
          id: t.id,
          type: 'lease',
          date,
          title: `Lease Renewal: ${t.firstName} ${t.lastName}`,
          subtitle: properties.find(p => p.id === t.propertyId)?.addressLine1 || 'Asset',
          propertyId: t.propertyId
        });
      }
    });

    return events.sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [inspections, maintenance, tenants, properties, isClient]);

  const selectedDayEvents = useMemo(() => {
    return allEvents.filter(e => isSameDay(e.date, selectedDate));
  }, [allEvents, selectedDate]);

  const upcomingEvents = useMemo(() => {
    const today = startOfDay(new Date());
    return allEvents.filter(e => isAfter(e.date, today)).slice(0, 10);
  }, [allEvents]);

  // Calendar Modifiers
  const modifiers = useMemo(() => {
    const dates: Record<string, Date[]> = {
      inspection: [],
      lease: [],
      repair: []
    };
    allEvents.forEach(e => {
      dates[e.type].push(e.date);
    });
    return dates;
  }, [allEvents]);

  const modifierStyles = {
    inspection: { borderBottom: '2px solid hsl(var(--primary))' },
    lease: { borderBottom: '2px solid #10b981' },
    repair: { borderBottom: '2px solid #f59e0b' }
  };

  if (!isClient || isInspLoading || isMaintLoading || isTenantsLoading) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Portfolio Calendar</h1>
          <p className="text-muted-foreground font-medium font-body">Integrated timeline for compliance, renewals, and operations.</p>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/10 bg-white" asChild>
              <Link href="/landlord/dashboard">
                <LayoutDashboard className="w-4 h-4 mr-2" /> Back to Stats
              </Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Calendar Selection Side */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
            <CardContent className="p-8">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                className="w-full"
                modifiers={modifiers}
                modifiersStyles={modifierStyles}
              />
              
              <div className="mt-8 pt-6 border-t border-primary/5 space-y-3">
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-primary" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Property Audits</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-emerald-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Lease Expiries</span>
                 </div>
                 <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-amber-500" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-primary/60">Scheduled Repairs</span>
                 </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2rem] bg-primary text-white overflow-hidden p-8">
            <h3 className="text-lg font-bold font-headline mb-4 flex items-center gap-2">
               <Clock className="w-5 h-5 text-accent" /> Operational View
            </h3>
            <p className="text-sm opacity-80 leading-relaxed font-body">This calendar reflects the current operational state of your relational ledger. All dates are synchronized in real-time.</p>
          </Card>
        </div>

        {/* Daily Ledger & Upcoming Events */}
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden min-h-[400px]">
            <CardHeader className="bg-primary/[0.02] border-b border-primary/5 p-8">
              <div className="flex justify-between items-center">
                 <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/40 mb-1">Portfolio Ledger</p>
                    <CardTitle className="text-2xl font-headline text-primary">{format(selectedDate, 'PPPP')}</CardTitle>
                 </div>
                 <Badge variant="outline" className="rounded-xl py-1 px-4 font-bold border-primary/10 text-primary uppercase text-[10px]">
                   {selectedDayEvents.length} Events Listed
                 </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {selectedDayEvents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 opacity-30">
                   <CalendarDays className="w-12 h-12 mb-4" />
                   <p className="text-sm font-bold uppercase tracking-widest">No Events Scheduled</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedDayEvents.map(event => (
                    <EventCard key={event.id} event={event} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <h3 className="text-xl font-bold font-headline flex items-center text-primary">
              <ChevronRight className="w-5 h-5 mr-1 text-accent" /> Upcoming Portfolio Roadmap
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {upcomingEvents.length === 0 ? (
                  <p className="col-span-full text-center py-10 text-muted-foreground italic text-sm">No upcoming events detected in the roadmap.</p>
               ) : (
                 upcomingEvents.map(event => (
                   <div key={event.id} className="flex gap-4 p-5 bg-white rounded-2xl border border-primary/5 shadow-sm items-center group hover:border-primary/20 transition-all">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        event.type === 'inspection' ? "bg-primary/10 text-primary" :
                        event.type === 'lease' ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                      )}>
                        {event.type === 'inspection' ? <ShieldCheck className="w-5 h-5" /> : 
                         event.type === 'lease' ? <Users className="w-5 h-5" /> : <Wrench className="w-5 h-5" />}
                      </div>
                      <div className="min-w-0">
                         <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{format(event.date, 'MMM dd, yyyy')}</p>
                         <p className="font-bold text-sm text-primary truncate">{event.title}</p>
                      </div>
                   </div>
                 ))
               )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EventCard({ event }: { event: PortfolioEvent }) {
  const Icon = event.type === 'inspection' ? ShieldCheck : event.type === 'lease' ? Users : Wrench;
  const colorClass = event.type === 'inspection' ? "bg-primary text-white" : 
                    event.type === 'lease' ? "bg-emerald-500 text-white" : "bg-amber-500 text-white";
  
  const linkHref = event.type === 'inspection' ? `/landlord/inspections` :
                   event.type === 'lease' ? `/landlord/tenants` : `/landlord/maintenance`;

  return (
    <div className="group flex items-center justify-between p-6 bg-primary/[0.02] border border-primary/5 rounded-[2rem] transition-all hover:bg-white hover:shadow-xl hover:scale-[1.01] hover:border-primary/10">
      <div className="flex items-center gap-6 text-left">
        <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg transform group-hover:rotate-6 transition-transform", colorClass)}>
           <Icon className="w-6 h-6" />
        </div>
        <div>
          <Badge variant="outline" className="mb-2 uppercase text-[9px] font-bold tracking-[0.2em] opacity-60 border-primary/10">
            {event.type}
          </Badge>
          <h4 className="text-xl font-bold font-headline text-primary leading-tight mb-1">{event.title}</h4>
          <div className="flex items-center gap-3">
             <p className="text-xs text-muted-foreground font-medium flex items-center">
                <MapPin className="w-3 h-3 mr-1 opacity-50" /> {event.subtitle}
             </p>
             {event.priority && (
               <Badge className="text-[9px] uppercase font-bold bg-red-100 text-red-700 border-none">{event.priority}</Badge>
             )}
          </div>
        </div>
      </div>
      <Button variant="ghost" size="icon" asChild className="rounded-2xl h-12 w-12 hover:bg-primary hover:text-white transition-all">
         <Link href={linkHref}>
            <ChevronRight className="w-6 h-6" />
         </Link>
      </Button>
    </div>
  );
}
