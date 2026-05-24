"use client";

import { useState, useMemo, useEffect } from 'react';
import { triageMaintenanceRequest } from "@/ai/flows/maintenance-request-triage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
  Calendar as CalendarIcon, Building2
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
      toast({ variant: "destructive", title: "AI Triage failed", description: "The intelligence engine encountered an error. Please try again." });
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
    toast({ title: "Contractor Assigned", description: "The professional has been linked to this task." });
    setIsAssigningPro(null);
  };

  const updateStatus = async (request: any, newStatus: string) => {
    if (!user || !db) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, { status: newStatus, updatedAt: serverTimestamp() });
    
    // Notify Tenant via Email
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
      console.warn('Email notification for status update skipped.');
    }

    toast({ title: "Status Updated", description: `Task marked as ${newStatus}.` });
  };

  const handleLogCost = (request: any) => {
    if (!user || !db || !costAmount) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, { cost: Number(costAmount), updatedAt: serverTimestamp() });
    toast({ title: "Cost Logged", description: `£${costAmount} added to financial records.` });
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
    toast({ title: "Repair Scheduled", description: `Task set for ${format(scheduledDate, 'PPP')}` });
    setIsScheduling(null);
    setScheduledDate(undefined);
  };

  const getPriorityColor = (priority: string) => {
    switch(priority?.toLowerCase()) {
      case 'critical': return 'bg-red-600 text-white';
      case 'urgent': return 'bg-orange-600 text-white';
      case 'routine': return 'bg-blue-600 text-white';
      case 'low': return 'bg-slate-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!isClient || loading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Maintenance Hub</h1>
          <p className="text-muted-foreground font-medium font-body">Manage repairs and track professional maintenance costs.</p>
        </div>
        <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg shadow-primary/20 text-white">
          <Plus className="w-4 h-4 mr-2" /> Log New Request
        </Button>
      </div>

      <div className="grid gap-6">
        {!requests || requests.length === 0 ? (
          <Card className="border-dashed border-2 py-24 flex flex-col items-center justify-center bg-card rounded-[2.5rem] border-primary/5">
            <Wrench className="w-12 h-12 text-primary/10 mb-4" />
            <h3 className="text-xl font-bold font-headline text-primary/40">No Active Requests</h3>
            <p className="text-sm text-muted-foreground mt-2">New tenant reports or manual logs will appear here.</p>
          </Card>
        ) : (
          requests.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((request) => {
            const assignedPro = contractors.find(c => c.id === request.assignedContractorId);
            
            return (
              <Card key={request.id} className="border-none shadow-sm overflow-hidden bg-card rounded-2xl group border border-transparent hover:border-primary/5 transition-all">
                <CardContent className="p-8">
                  <div className="flex flex-wrap items-center gap-4 mb-6">
                    <Badge className={cn("uppercase text-[9px] font-bold px-4 py-1 tracking-widest", request.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700')}>
                      {request.status}
                    </Badge>
                    <Badge className={cn("capitalize font-bold text-[9px] px-4 py-1 tracking-widest", getPriorityColor(request.priority))}>
                      {request.priority}
                    </Badge>
                    {request.cost > 0 && <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold border-none text-[9px] px-4 py-1 uppercase tracking-widest">£{request.cost} Invoiced</Badge>}
                    <span className="text-[10px] text-muted-foreground font-bold uppercase ml-auto flex items-center tracking-widest">
                      <Clock className="w-3.5 h-3.5 mr-1.5 opacity-40" /> Reported: {request.createdAt ? format(new Date(request.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                    </span>
                  </div>
                  
                  <div className="space-y-4 text-left">
                    <h3 className="text-2xl font-bold font-headline group-hover:text-primary transition-colors leading-tight tracking-tight">{request.title}</h3>
                    <p className="text-muted-foreground font-body leading-relaxed font-medium max-w-4xl">{request.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-8 pt-2">
                      <div className="flex items-center gap-2 text-[10px] font-bold text-primary/40 uppercase tracking-widest font-headline">
                         <Building2 className="w-4 h-4 text-accent" />
                         {properties?.find(p => p.id === request.propertyId)?.addressLine1 || "Asset ID Pending"}
                      </div>
                      {request.scheduledDate && (
                        <div className="flex items-center gap-2 text-[10px] font-bold text-emerald-600 uppercase tracking-widest font-headline">
                           <CalendarIcon className="w-4 h-4" />
                           Repair Target: {format(new Date(request.scheduledDate), 'PPP')}
                        </div>
                      )}
                    </div>
                  </div>

                  {assignedPro && (
                    <div className="mt-8 p-6 bg-primary/5 border border-primary/10 rounded-2xl flex items-center justify-between animate-in slide-in-from-left-4">
                       <div className="flex items-center gap-6 text-left">
                          <div className="p-4 bg-white dark:bg-primary/20 rounded-2xl text-primary shadow-sm ring-1 ring-primary/10">
                             <HardHat className="w-6 h-6" />
                          </div>
                          <div>
                             <p className="text-[10px] font-bold text-primary/40 uppercase tracking-widest mb-1 font-headline">Operational Partner</p>
                             <p className="font-bold text-lg text-primary leading-none">{assignedPro.name}</p>
                             <div className="flex gap-4 mt-2">
                                <span className="text-[10px] font-bold text-muted-foreground flex items-center uppercase"><Phone className="w-3 h-3 mr-1.5 text-accent" /> {assignedPro.phone}</span>
                                {assignedPro.email && <span className="text-[10px] font-bold text-muted-foreground flex items-center uppercase"><Mail className="w-3 h-3 mr-1.5 text-accent" /> {assignedPro.email}</span>}
                             </div>
                          </div>
                       </div>
                       <Button variant="ghost" size="sm" className="text-[10px] font-bold text-primary hover:bg-primary/10 rounded-xl uppercase tracking-widest h-9 px-4" onClick={() => setIsAssigningPro(request.id)}>Reassign</Button>
                    </div>
                  )}

                  {request.aiTriageNotes && (
                    <div className="space-y-6 mt-8 animate-in fade-in duration-700">
                      <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 flex gap-6 text-left shadow-inner">
                        <BrainCircuit className="w-8 h-8 text-primary shrink-0" />
                        <div className="flex-1">
                          <p className="text-[10px] font-bold text-primary uppercase mb-3 tracking-widest font-headline opacity-60">Intelligence Engine Triage</p>
                          <p className="text-sm text-foreground font-bold font-body leading-relaxed">{request.aiTriageNotes}</p>
                        </div>
                      </div>

                      {request.aiSuggestions && request.aiSuggestions.length > 0 && (
                        <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 rounded-2xl p-6 flex gap-6 text-left">
                          <Lightbulb className="w-8 h-8 text-emerald-600 shrink-0" />
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 uppercase mb-3 tracking-widest font-headline">Recommended Next Steps</p>
                            <ul className="space-y-3">
                              {request.aiSuggestions.map((suggestion: string, idx: number) => (
                                <li key={idx} className="flex gap-3 text-sm font-bold text-emerald-950 dark:text-emerald-50">
                                  <ChevronRight className="w-4 h-4 shrink-0 text-emerald-500" /> {suggestion}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-muted/5 p-6 flex flex-wrap gap-4 border-t border-border">
                  <Button className="flex-1 min-w-[150px] bg-white dark:bg-background hover:bg-primary/5 text-primary rounded-xl font-bold h-12 border border-primary/20 shadow-sm transition-all" onClick={() => handleTriage(request)} disabled={isTriaging === request.id}>
                    {isTriaging === request.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    AI Triage
                  </Button>
                  
                  <Button variant="outline" className="flex-1 min-w-[150px] rounded-xl font-bold h-12 border-border bg-white dark:bg-background shadow-sm" onClick={() => setIsScheduling(request.id)}>
                    <CalendarIcon className="w-4 h-4 mr-2" /> Schedule
                  </Button>

                  <Button variant="outline" className="flex-1 min-w-[150px] rounded-xl font-bold h-12 border-border bg-white dark:bg-background shadow-sm" onClick={() => setIsAssigningPro(request.id)}>
                    <UserCheck className="w-4 h-4 mr-2" /> {assignedPro ? 'Reassign' : 'Assign Pro'}
                  </Button>

                  <Dialog open={isLoggingCost === request.id} onOpenChange={(open) => !open && setIsLoggingCost(null)}>
                    <Button variant="outline" className="flex-1 min-w-[150px] rounded-xl font-bold h-12 border-border bg-white dark:bg-background shadow-sm" onClick={() => setIsLoggingCost(request.id)}>
                      <PoundSterling className="w-4 h-4 mr-2" /> Log Expense
                    </Button>
                    <DialogContent className="rounded-[2rem] border-none shadow-2xl p-0 overflow-hidden">
                      <div className="p-8 bg-primary/5 border-b text-left">
                        <DialogTitle className="font-headline text-2xl font-bold text-primary tracking-tight">Log Maintenance Expense</DialogTitle>
                        <DialogDescription className="font-medium">Update your portfolio analytics with repair costs.</DialogDescription>
                      </div>
                      <div className="p-8 space-y-6 text-left bg-card">
                        <div className="space-y-2">
                          <Label className="text-xs font-bold uppercase text-primary/40 font-headline tracking-widest">Total Invoiced Amount (£)</Label>
                          <Input type="number" placeholder="0.00" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} className="rounded-xl h-14 bg-muted/20 border-none font-bold text-lg" />
                        </div>
                      </div>
                      <DialogFooter className="p-8 bg-muted/10 border-t">
                        <Button className="w-full rounded-xl h-14 font-bold bg-primary shadow-xl shadow-primary/20 text-white font-headline text-lg" onClick={() => handleLogCost(request)}>Update Financial Ledger</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex-1 min-w-[150px] rounded-xl font-bold h-12 border-border bg-white dark:bg-background shadow-sm">Update Status</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-2xl border-border shadow-2xl min-w-[220px] p-2" align="end">
                      <DropdownMenuItem className="py-3 px-4 font-bold font-body cursor-pointer rounded-xl focus:bg-primary/5" onClick={() => updateStatus(request, 'in-progress')}>
                        <PlayCircle className="w-4 h-4 mr-3 text-sky-600" /> Mark In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-3 px-4 font-bold font-body cursor-pointer rounded-xl focus:bg-primary/5" onClick={() => updateStatus(request, 'completed')}>
                        <CheckCircle2 className="w-4 h-4 mr-3 text-emerald-600" /> Mark Completed
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardFooter>

                {/* Assignment Dialog */}
                <Dialog open={isAssigningPro === request.id} onOpenChange={(open) => !open && setIsAssigningPro(null)}>
                  <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[500px]">
                    <div className="p-10 bg-primary/5 border-b text-left">
                      <DialogTitle className="text-2xl font-bold font-headline text-primary tracking-tight">Assign Trade Partner</DialogTitle>
                      <DialogDescription className="font-medium">Link an authorized professional to this maintenance event.</DialogDescription>
                    </div>
                    <div className="p-6 space-y-2 bg-card max-h-[450px] overflow-y-auto no-scrollbar">
                      {contractors.length === 0 ? (
                        <div className="p-12 text-center space-y-6">
                          <HardHat className="w-16 h-16 mx-auto text-primary/10" />
                          <p className="text-sm font-bold text-muted-foreground font-headline uppercase tracking-widest">No contractors on file</p>
                          <Button variant="outline" asChild className="rounded-xl font-bold border-primary/20 h-11"><a href="/landlord/emergency-contacts">Add Contractor First</a></Button>
                        </div>
                      ) : (
                        contractors.map(pro => (
                          <button 
                            key={pro.id} 
                            onClick={() => handleAssignContractor(request.id, pro.id)}
                            className="w-full flex items-center justify-between p-5 rounded-2xl hover:bg-primary/[0.03] transition-all text-left group border border-transparent hover:border-primary/5"
                          >
                             <div className="flex items-center gap-5">
                                <div className="p-4 bg-primary/10 rounded-2xl text-primary font-bold shadow-inner group-hover:scale-110 transition-transform">
                                   <HardHat className="w-5 h-5" />
                                </div>
                                <div>
                                   <p className="font-bold text-base text-primary leading-tight">{pro.name}</p>
                                   <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mt-1">{pro.role}</p>
                                </div>
                             </div>
                             <ChevronRight className="w-5 h-5 text-primary/20 group-hover:text-primary transition-colors" />
                          </button>
                        ))
                      )}
                    </div>
                    <div className="p-8 bg-muted/5 border-t">
                       <Button variant="ghost" className="w-full font-bold text-muted-foreground uppercase tracking-widest text-xs" onClick={() => setIsAssigningPro(null)}>Close Overlay</Button>
                    </div>
                  </DialogContent>
                </Dialog>

                {/* Scheduling Dialog */}
                <Dialog open={isScheduling === request.id} onOpenChange={(open) => !open && setIsScheduling(null)}>
                  <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[450px]">
                    <div className="p-10 bg-primary/5 border-b text-left">
                      <DialogTitle className="text-2xl font-bold font-headline text-primary tracking-tight">Schedule Repair</DialogTitle>
                      <DialogDescription className="font-medium">Set a target completion or site visit date.</DialogDescription>
                    </div>
                    <div className="p-8 bg-card flex justify-center">
                      <Calendar
                        mode="single"
                        selected={scheduledDate}
                        onSelect={setScheduledDate}
                        className="rounded-2xl border-none shadow-inner"
                      />
                    </div>
                    <DialogFooter className="p-8 bg-muted/10 border-t">
                       <Button className="w-full rounded-xl h-14 font-bold bg-primary text-white shadow-xl shadow-primary/20 font-headline text-lg" disabled={!scheduledDate} onClick={() => handleSetSchedule(request.id)}>Confirm Repair Date</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden">
          <form onSubmit={handleCreateRequest}>
            <div className="p-10 bg-primary/5 border-b text-left">
              <DialogTitle className="font-headline text-2xl font-bold text-primary tracking-tight">Log Maintenance Task</DialogTitle>
              <DialogDescription className="font-medium">Record a maintenance event for your asset history.</DialogDescription>
            </div>
            <div className="grid gap-8 p-10 text-left bg-card">
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-widest">Select Asset</Label>
                <select className="flex h-14 w-full rounded-xl border-none bg-muted/20 px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-foreground" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required>
                  <option value="">Choose a property...</option>
                  {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-widest">Task Subject</Label>
                <Input value={newRequestTitle} onChange={(e) => setNewRequestTitle(e.target.value)} required placeholder="e.g. Boiler low pressure" className="rounded-xl h-14 bg-muted/20 border-none font-bold text-lg" />
              </div>
              <div className="space-y-2">
                <Label className="text-[10px] font-bold uppercase text-primary/40 font-headline tracking-widest">Detailed Context</Label>
                <Textarea value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} required placeholder="Describe the issue or required upkeep..." className="rounded-xl min-h-[150px] bg-muted/20 border-none font-medium" />
              </div>
            </div>
            <DialogFooter className="p-10 bg-muted/10 border-t">
              <Button type="submit" className="w-full rounded-xl h-14 font-bold bg-primary shadow-xl shadow-primary/20 text-white font-headline text-lg" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Plus className="w-5 h-5 mr-3" />}
                Log Maintenance Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
