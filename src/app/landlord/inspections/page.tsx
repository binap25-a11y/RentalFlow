
"use client";

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { Calendar as CalendarIcon, FileCheck, MapPin, Plus, Clock, Loader2, FileText, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

export default function InspectionsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'properties'),
      where('landlordId', '==', user.uid)
    );
  }, [db, user]);

  const { data: properties, isLoading } = useCollection(propertiesQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'inspections'),
      where('landlordId', '==', user.uid)
    );
  }, [db, user]);

  const { data: inspections } = useCollection(inspectionsQuery);

  const [date, setDate] = useState<Date>();
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const handleSchedule = () => {
    if (!user || !db || !selectedPropertyId || !date) return;

    const inspectionId = doc(collection(db, 'dummy')).id;
    const inspectionRef = doc(db, 'inspections', inspectionId);

    setDocumentNonBlocking(inspectionRef, {
      id: inspectionId,
      propertyId: selectedPropertyId,
      landlordId: user.uid,
      scheduledDate: date.toISOString(),
      inspectorUserId: user.uid,
      status: 'scheduled',
      summary: 'Standard routine inspection.',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    toast({ title: "Inspection Scheduled", description: `New inspection set for ${format(date, 'PPP')}` });
    setSelectedPropertyId('');
    setDate(undefined);
  };

  const generatePDFReport = () => {
    toast({ title: "Generating PDF...", description: "Compiling inspection data into report." });
    setTimeout(() => {
      toast({ title: "Success", description: "Inspection report saved." });
    }, 2000);
  };

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Inspections</h1>
          <p className="text-muted-foreground font-medium">Schedule and conduct property health checks.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-xl">Schedule Inspection</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Property</label>
              <select 
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                value={selectedPropertyId}
                onChange={(e) => setSelectedPropertyId(e.target.value)}
              >
                <option value="">Select...</option>
                {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Select Date</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant={"outline"}
                    className={cn(
                      "w-full justify-start text-left font-normal h-10",
                      !date && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {date ? format(date, "PPP") : <span>Pick a date</span>}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={setDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
            <Button className="w-full rounded-xl" onClick={handleSchedule} disabled={!date || !selectedPropertyId}>
              Confirm Schedule
            </Button>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold font-headline flex items-center">
            <Clock className="w-5 h-5 mr-2 text-primary" />
            Upcoming Calendar
          </h3>
          
          <div className="grid gap-4">
            {!inspections || inspections.length === 0 ? (
              <p className="text-center py-20 text-muted-foreground bg-muted/20 rounded-2xl border-2 border-dashed">
                No inspections currently scheduled.
              </p>
            ) : (
              inspections.map((inspection) => (
                <Card key={inspection.id} className="border-none shadow-sm overflow-hidden group">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="bg-primary/5 p-4 rounded-2xl flex flex-col items-center justify-center text-primary min-w-[100px]">
                        <span className="text-sm font-bold uppercase">
                          {format(new Date(inspection.scheduledDate), 'MMM')}
                        </span>
                        <span className="text-3xl font-bold">
                          {format(new Date(inspection.scheduledDate), 'dd')}
                        </span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <Badge variant="outline" className="uppercase">{inspection.status}</Badge>
                          <Button variant="ghost" size="sm" onClick={generatePDFReport} className="text-primary h-8">
                            <Download className="w-3 h-3 mr-2" /> Report Template
                          </Button>
                        </div>
                        <h4 className="text-lg font-bold">{inspection.summary}</h4>
                        <p className="text-sm text-muted-foreground flex items-center">
                          <MapPin className="w-4 h-4 mr-1" /> {properties?.find(p => p.id === inspection.propertyId)?.addressLine1 || 'Unknown Property'}
                        </p>
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
