"use client";

import { useState, useMemo, useEffect } from 'react';
import { triageMaintenanceRequest } from "@/ai/flows/maintenance-request-triage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  setDocumentNonBlocking, 
  getLandlordCollectionQuery 
} from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { 
  Wrench, Sparkles, Clock, BrainCircuit, Loader2, 
  CheckCircle2, PlayCircle, Plus, PoundSterling,
  ChevronRight, Lightbulb, UserCheck, HardHat, Phone, Mail,
  Calendar as CalendarIcon, Building2, ShieldAlert,
  ArrowRight, Activity, Save
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
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
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { notifyTenantOfUpdate } from "@/lib/actions/email-actions";

export default function MaintenancePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const [isTriaging, setIsTriaging] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingCost, setIsLoggingCost] = useState<string | null>(null);
  const [isAssigningPro, setIsAssigningPro] = useState<string | null>(null);
  const [isScheduling, setIsScheduling] = useState<string | null>(null);
  const [costAmount, setCostAmount] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>();

  const [newRequestTitle, setNewRequestTitle] = useState('');
  const [newRequestDesc, setNewRequestDesc] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: properties } = useCollection(propertiesQuery);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "maintenanceRequests", user.uid);
  }, [db, user]);

  const { data: requests, loading } = useCollection(maintenanceQuery);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "tenantProfiles", user.uid);
  }, [db, user]);
  const { data: tenants } = useCollection(tenantsQuery);

  const contractorsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "emergencyContacts", user.uid);
  }, [db, user]);

  const { data: allContacts } = useCollection(contractorsQuery);
  const contractors = useMemo(() => allContacts?.filter(c => c.category === 'professional') || [], [allContacts]);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedPropertyId) return;
    setIsSubmitting(true);
    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    const property = properties?.find(p => p.id === selectedPropertyId);

    setDocumentNonBlocking(requestRef, {
      id: requestId,
      propertyId: selectedPropertyId,
      landlordId: user.uid,
      tenantId: property?.tenantIds?.[0] || 'landlord-discovered',
      memberIds: property?.memberIds || [user.uid],
      title: newRequestTitle,
      description: newRequestDesc,
      status: 'pending',
      priority: 'routine',
      category: 'other',
      cost: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    toast({ title: "Request Logged", description: "Maintenance task added to ledger." });
    setIsCreateDialogOpen(false);
    setIsSubmitting(false);
    setNewRequestTitle('');
    setNewRequestDesc('');
    setSelectedPropertyId('');
  };

  const handleTriage = async (request: any) => {
    if (!user || !db) return;
    
    const desc = request.description || '';
    if (desc.trim().length < 5) {
      toast({ variant: "destructive", title: "Triage Denied", description: "Request description is too brief for AI analysis." });
      return;
    }

    setIsTriaging(request.id);
    try {
      const result = await triageMaintenanceRequest({ maintenanceRequest: desc });
      const requestRef = doc(db, 'maintenanceRequests', request.id);
      updateDocumentNonBlocking(requestRef, {
        priority: result.priority,
        category: result.category,
        aiTriageNotes: result.reasoning,
        aiSuggestions: result.suggestions || [],
        updatedAt: serverTimestamp(),
      });
      toast({ title: "AI Triage Complete", description: `Suggested priority: ${result.priority}` });
    } catch (error: any) {
      console.error("Triage Error:", error);
      toast({ variant: "destructive", title: "AI Triage failed", description: "The intelligence engine encountered an error." });
    } finally {
      setIsTriaging(null);
    }
  };

  const handleAssignContractor = (requestId: string, contractorId: string) => {
    if (!db) return;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    updateDocumentNonBlocking(requestRef, { 
      assignedContractorId: contractorId,
      updatedAt: serverTimestamp() 
    });
    toast({ title: "Contractor Assigned" });
    setIsAssigningPro(null);
  };

  const updateStatus = async (request: any, newStatus: string) => {
    if (!user || !db) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, { status: newStatus, updatedAt: serverTimestamp() });
    
    try {
      const tenant = tenants?.find(t => t.userId === request.tenantId);
      if (tenant?.email) {
        const prop = properties?.find(p => p.id === request.propertyId);
        await notifyTenantOfUpdate({
          tenantEmail: tenant.email,
          propertyAddress: prop?.addressLine1 || 'Your Home',
          status: newStatus,
          title: request.title
        });
      }
    } catch (e) {
      console.warn('Email notification skipped.');
    }

    toast({ title: "Status Updated", description: `Task marked as ${newStatus}.` });
  };

  const handleLogCost = (request: any) => {
    if (!user || !db || !costAmount) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, { cost: Number(costAmount), updatedAt: serverTimestamp() });
    toast({ title: "Expense Recorded", description: `£${costAmount} added to records.` });
    setIsLoggingCost(null);
    setCostAmount('');
  };

  const handleSetSchedule = (requestId: string) => {
    if (!db || !scheduledDate) return;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    updateDocumentNonBlocking(requestRef, { 
      scheduledDate: scheduledDate.toISOString(),
      updatedAt: serverTimestamp() 
    });
    toast({ title: "Repair Scheduled", description: `Set for ${format(scheduledDate, 'PPP')}` });
    setIsScheduling(null);
    setScheduledDate(undefined);
  };

  const getPriorityColor = (priority: string) => {
    switch(priority?.toLowerCase()) {
      case 'critical': return 'bg-red-600 text-white shadow-red-200';
      case 'urgent': return 'bg-orange-600 text-white shadow-orange-200';
      case 'routine': return 'bg-blue-600 text-white shadow-blue-200';
      case 'low': return 'bg-slate-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/10 rounded-full blur-2xl animate-pulse" />
          <Loader2 className="animate-spin text-primary w-12 h-12 opacity-60 relative z-10" />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground font-headline">Synchronizing Repairs</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto pb-12 text-left">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1.5 rounded-full font-bold mb-4 uppercase tracking-[0.2em] text-[10px]">
             <Wrench className="w-3 h-3 mr-2" /> Asset Maintenance
          </Badge>
          <h1 className="text-5xl font-headline font-bold text-primary tracking-tighter">Maintenance Hub</h1>
          <p className="text-muted-foreground font-medium font-body max-w-lg mt-2">Orchestrating high-fidelity repairs and professional site upkeep.</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-2xl bg-primary hover:bg-primary/90 font-bold h-14 px-10 shadow-2xl shadow-primary/20 text-white text-lg">
          <Plus className="w-5 h-5 mr-2" /> Log New Request
        </Button>
      </div>

      <div className="grid gap-8">
        {!requests || requests.length === 0 ? (
          <Card className="border-none shadow-sm rounded-[3rem] py-32 flex flex-col items-center justify-center bg-white ring-1 ring-primary/5 border-2 border-dashed border-primary/5">
            <div className="p-10 bg-primary/5 rounded-[3rem] mb-8">
               <Wrench className="w-20 h-20 text-primary opacity-20" />
            </div>
            <h3 className="text-2xl font-bold font-headline text-primary opacity-40 uppercase tracking-widest">Clear Ledger</h3>
            <p className="text-muted-foreground font-medium mt-3">No active maintenance tasks recorded in the roadmap.</p>
            <Button variant="ghost" className="mt-8 font-bold text-primary" onClick={() => setIsCreateDialogOpen(true)}>Initialize First Task</Button>
          </Card>
        ) : (
          requests.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((request) => {
            const assignedPro = contractors.find(c => c.id === request.assignedContractorId);
            
            return (
              <Card key={request.id} className="border-none shadow-xl overflow-hidden bg-white rounded-[2.5rem] group ring-1 ring-primary/5 transition-all hover:shadow-2xl">
                <CardContent className="p-10">
                  <div className="flex flex-wrap items-center gap-4 mb-8">
                    <Badge className={cn("uppercase text-[9px] font-bold px-5 py-1.5 tracking-[0.2em] rounded-full", request.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary')}>
                      {request.status}
                    </Badge>
                    <Badge className={cn("capitalize font-bold text-[9px] px-5 py-1.5 tracking-[0.2em] rounded-full shadow-lg", getPriorityColor(request.priority))}>
                      {request.priority}
                    </Badge>
                    {request.cost > 0 && (
                      <Badge className="bg-amber-50 text-amber-700 font-bold border border-amber-100 text-[9px] px-5 py-1.5 uppercase tracking-[0.2em] rounded-full">
                        £{request.cost} Invoiced
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground font-bold uppercase ml-auto flex items-center tracking-widest opacity-60">
                      <Clock className="w-4 h-4 mr-2" /> Reported: {request.createdAt ? format(new Date(request.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                    </span>
                  </div>
                  
                  <div className="space-y-6 text-left">
                    <h3 className="text-4xl font-bold font-headline group-hover:text-primary transition-colors leading-tight tracking-tighter">{request.title}</h3>
                    <p className="text-lg text-muted-foreground font-body leading-relaxed font-medium max-w-5xl">{request.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-10 pt-4 border-t border-primary/5">
                      <div className="flex items-center gap-3">
                         <div className="p-3 bg-primary/5 rounded-xl">
                            <Building2 className="w-5 h-5 text-accent" />
                         </div>
                         <div className="text-left">
                            <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest font-headline">Asset Assignment</p>
                            <p className="text-sm font-bold text-primary">{properties?.find(p => p.id === request.propertyId)?.addressLine1 || "Asset ID Pending"}</p>
                         </div>
                      </div>
                      {request.scheduledDate && (
                        <div className="flex items-center gap-3">
                           <div className="p-3 bg-emerald-50 rounded-xl">
                              <CalendarIcon className="w-5 h-5 text-emerald-600" />
                           </div>
                           <div className="text-left">
                              <p className="text-[10px] font-bold text-emerald-600/40 uppercase tracking-widest font-headline">Repair Target</p>
                              <p className="text-sm font-bold text-emerald-700">{format(new Date(request.scheduledDate), 'PPP')}</p>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {assignedPro && (
                    <div className="mt-10 p-8 bg-primary/[0.02] border border-primary/10 rounded-[2rem] flex flex-col md:flex-row md:items-center justify-between gap-8 animate-in slide-in-from-left-4">
                       <div className="flex items-center gap-8 text-left">
                          <div className="p-6 bg-white dark:bg-primary/20 rounded-[1.5rem] text-primary shadow-xl ring-1 ring-primary/5 transform -rotate-3">
                             <HardHat className="w-10 h-10" />
                          </div>
                          <div>
                             <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-2 font-headline">Operational Partner</p>
                             <p className="font-bold text-2xl text-primary leading-none tracking-tight">{assignedPro.name}</p>
                             <div className="flex gap-6 mt-4">
                                <span className="text-xs font-bold text-muted-foreground flex items-center uppercase tracking-widest"><Phone className="w-4 h-4 mr-2 text-accent" /> {assignedPro.phone}</span>
                                {assignedPro.email && <span className="text-xs font-bold text-muted-foreground flex items-center uppercase tracking-widest"><Mail className="w-4 h-4 mr-2 text-accent" /> {assignedPro.email}</span>}
                             </div>
                          </div>
                       </div>
                       <Button variant="ghost" size="sm" className="text-[10px] font-bold text-primary hover:bg-primary/10 rounded-xl uppercase tracking-[0.2em] h-10 px-6 border border-primary/10" onClick={() => setIsAssigningPro(request.id)}>Modify Assignment</Button>
                    </div>
                  )}

                  {request.aiTriageNotes && (
                    <div className="space-y-6 mt-10 animate-in fade-in duration-700">
                      <div className="bg-primary/5 border border-primary/5 rounded-[2rem] p-8 flex gap-8 text-left shadow-inner ring-1 ring-primary/5">
                        <BrainCircuit className="w-12 h-12 text-primary shrink-0" />
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-primary uppercase mb-4 tracking-[0.3em] font-headline opacity-40">Intelligence Engine Triage</p>
                          <p className="text-lg text-primary font-bold font-body leading-relaxed">{request.aiTriageNotes}</p>
                        </div>
                      </div>

                      {request.aiSuggestions && request.aiSuggestions.length > 0 && (
                        <div className="bg-emerald-50/50 dark:bg-emerald-900/10 border border-emerald-100/50 rounded-[2rem] p-8 flex gap-8 text-left">
                          <div className="p-4 bg-white rounded-2xl shadow-sm text-emerald-600 h-fit">
                             <Lightbulb className="w-8 h-8" />
                          </div>
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-emerald-700/60 uppercase mb-4 tracking-[0.3em] font-headline">Recommended Next Steps</p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {request.aiSuggestions.map((suggestion: string, idx: number) => (
                                <div key={idx} className="flex gap-4 p-4 bg-white/60 rounded-2xl border border-emerald-100 text-sm font-bold text-emerald-900">
                                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" /> {suggestion}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-muted/5 p-8 flex flex-wrap gap-4 border-t border-primary/5">
                  <Button className="flex-1 min-w-[200px] bg-white hover:bg-primary text-primary hover:text-white rounded-2xl font-bold h-14 border border-primary/10 shadow-lg transition-all" onClick={() => handleTriage(request)} disabled={isTriaging === request.id}>
                    {isTriaging === request.id ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Sparkles className="w-5 h-5 mr-2" />}
                    Analyze Issue with AI
                  </Button>
                  
                  <Button variant="outline" className="flex-1 min-w-[200px] rounded-2xl font-bold h-14 border-primary/10 bg-white shadow-sm hover:bg-muted/50" onClick={() => setIsScheduling(request.id)}>
                    <CalendarIcon className="w-5 h-5 mr-2" /> Adjust Roadmap
                  </Button>

                  <Button variant="outline" className="flex-1 min-w-[200px] rounded-2xl font-bold h-14 border-primary/10 bg-white shadow-sm hover:bg-muted/50" onClick={() => setIsAssigningPro(request.id)}>
                    <UserCheck className="w-5 h-5 mr-2" /> {assignedPro ? 'Change Partner' : 'Assign Partner'}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex-1 min-w-[200px] rounded-2xl font-bold h-14 border-primary/10 bg-white shadow-sm hover:bg-muted/50">Update Records</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-[1.5rem] border-primary/10 shadow-2xl min-w-[240px] p-2" align="end">
                      <DropdownMenuItem className="py-4 px-5 font-bold font-headline cursor-pointer rounded-xl focus:bg-primary/5 text-primary" onClick={() => updateStatus(request, 'in-progress')}>
                        <PlayCircle className="w-5 h-5 mr-4 text-sky-600" /> Mark In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-4 px-5 font-bold font-headline cursor-pointer rounded-xl focus:bg-primary/5 text-primary" onClick={() => updateStatus(request, 'completed')}>
                        <CheckCircle2 className="w-5 h-5 mr-4 text-emerald-600" /> Mark Completed
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-4 px-5 font-bold font-headline cursor-pointer rounded-xl focus:bg-primary/5 text-primary" onClick={() => setIsLoggingCost(request.id)}>
                        <PoundSterling className="w-5 h-5 mr-4 text-amber-600" /> Log Maintenance Cost
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardFooter>

                {/* Assignment Dialog */}
                <Dialog open={isAssigningPro === request.id} onOpenChange={(open) => !open && setIsAssigningPro(null)}>
                  <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[550px] bg-white">
                    <div className="p-10 bg-primary/5 border-b text-left">
                      <DialogTitle className="text-3xl font-bold font-headline text-primary tracking-tighter uppercase tracking-[0.05em]">Partner Assignment</DialogTitle>
                      <DialogDescription className="font-medium text-muted-foreground mt-2">Select an authorized professional to lead this resolution.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-4 max-h-[500px] overflow-y-auto no-scrollbar">
                      {contractors.length === 0 ? (
                        <div className="p-16 text-center space-y-8">
                          <HardHat className="w-20 h-20 mx-auto text-primary/10" />
                          <p className="text-lg font-bold text-muted-foreground font-headline uppercase tracking-[0.2em]">Partner Directory Empty</p>
                          <Button asChild className="rounded-2xl font-bold bg-primary text-white h-14 px-8 shadow-xl"><a href="/landlord/emergency-contacts">Configure Partners First</a></Button>
                        </div>
                      ) : (
                        contractors.map(pro => (
                          <button 
                            key={pro.id} 
                            onClick={() => handleAssignContractor(request.id, pro.id)}
                            className="w-full flex items-center justify-between p-6 rounded-[1.75rem] hover:bg-primary/[0.03] transition-all text-left group border border-transparent hover:border-primary/10 shadow-sm bg-white"
                          >
                             <div className="flex items-center gap-6">
                                <div className="p-4 bg-primary/5 rounded-2xl text-primary font-bold shadow-inner group-hover:scale-110 transition-transform ring-1 ring-primary/5">
                                   <HardHat className="w-6 h-6" />
                                </div>
                                <div>
                                   <p className="font-bold text-xl text-primary leading-tight tracking-tight">{pro.name}</p>
                                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1.5">{pro.role}</p>
                                </div>
                             </div>
                             <div className="w-10 h-10 rounded-full bg-primary/5 flex items-center justify-center text-primary/20 group-hover:bg-primary group-hover:text-white transition-all">
                                <ChevronRight className="w-5 h-5" />
                             </div>
                          </button>
                        ))
                      )}
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Scheduling Dialog */}
                <Dialog open={isScheduling === request.id} onOpenChange={(open) => !open && setIsScheduling(null)}>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden max-w-[480px] bg-white">
                    <div className="p-10 bg-primary/5 border-b text-left">
                      <DialogTitle className="text-3xl font-bold font-headline text-primary tracking-tighter uppercase tracking-[0.05em]">Target Timeline</DialogTitle>
                      <DialogDescription className="font-medium text-muted-foreground mt-2">Register this repair in your portfolio roadmap.</DialogDescription>
                    </div>
                    <div className="p-10 flex justify-center">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        className="rounded-[2rem] border-none shadow-inner bg-white p-0"
                      />
                    </div>
                    <DialogFooter className="p-10 bg-muted/5 border-t">
                       <Button className="w-full rounded-2xl h-16 font-bold bg-primary text-white shadow-2xl shadow-primary/20 font-headline text-xl" disabled={!scheduledDate} onClick={() => handleSetSchedule(request.id)}>
                          <Save className="w-6 h-6 mr-3" /> Synchronize Timeline
                       </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                {/* Cost Logging Dialog */}
                <Dialog open={isLoggingCost === request.id} onOpenChange={(open) => !open && setIsLoggingCost(null)}>
                  <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-w-[450px]">
                    <div className="p-10 bg-primary/5 border-b text-left">
                      <DialogTitle className="text-3xl font-bold font-headline text-primary tracking-tighter">Log Expense</DialogTitle>
                      <DialogDescription className="font-medium text-muted-foreground">Update your portfolio yield records with repair costs.</DialogDescription>
                    </div>
                    <div className="p-10 text-left">
                      <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-[0.2em] mb-4 block">Final Invoiced Amount (£)</Label>
                      <Input type="number" placeholder="0.00" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} className="rounded-2xl h-16 bg-muted/20 border-none font-bold text-2xl px-8" />
                    </div>
                    <DialogFooter className="p-10 bg-muted/5 border-t">
                      <Button className="w-full rounded-2xl h-16 font-bold bg-primary shadow-2xl text-white font-headline text-xl" onClick={() => handleLogCost(request)}>Update Ledger</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-w-[650px]">
          <form onSubmit={handleCreateRequest}>
            <div className="p-12 bg-primary/5 border-b text-left">
              <DialogTitle className="font-headline text-4xl font-bold text-primary tracking-tighter">Log Maintenance Task</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground mt-2">Initialize a maintenance event for your asset roadmap.</DialogDescription>
            </div>
            <div className="grid gap-8 p-12 text-left bg-white">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-[0.3em]">Target Inventory Item</Label>
                <select className="flex h-14 w-full rounded-2xl border-none bg-muted/20 px-6 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-primary" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required>
                  <option value="">Select a property from inventory...</option>
                  {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-[0.3em]">Issue Label</Label>
                <Input value={newRequestTitle} onChange={(e) => setNewRequestTitle(e.target.value)} required placeholder="e.g. Boiler Leak Detected" className="rounded-2xl h-14 bg-muted/20 border-none font-bold text-lg px-6" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-[0.3em]">Operational Context</Label>
                <Textarea value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} required placeholder="Provide full context for contractor access..." className="rounded-2xl min-h-[150px] bg-muted/20 border-none font-medium px-6 py-4 leading-relaxed" />
              </div>
            </div>
            <DialogFooter className="p-12 bg-muted/5 border-t">
              <Button type="submit" className="w-full rounded-2xl h-16 font-bold bg-primary shadow-2xl shadow-primary/20 text-white font-headline text-xl" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-6 h-6 animate-spin mr-3" /> : <Save className="w-6 h-6 mr-3" />}
                Register Task in Roadmap
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
