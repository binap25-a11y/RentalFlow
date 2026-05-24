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
  ChevronRight, Lightbulb, UserCheck, HardHat,
  Calendar as CalendarIcon, Building2,
  Activity, Save, Edit3
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
import { ScrollArea } from "@/components/ui/scroll-area";
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
  const [isEditingTask, setIsEditingTask] = useState<string | null>(null);
  const [costAmount, setCostAmount] = useState('');
  const [scheduledDate, setScheduledDate] = useState<Date>();

  const [newRequestTitle, setNewRequestTitle] = useState('');
  const [newRequestDesc, setNewRequestDesc] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

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

    const payload = {
      id: requestId,
      propertyId: selectedPropertyId,
      landlordId: user.uid,
      tenantId: property?.tenantIds?.[0] || 'landlord-direct',
      memberIds: property?.memberIds || [user.uid],
      title: newRequestTitle,
      description: newRequestDesc,
      status: 'pending',
      priority: 'routine',
      category: 'other',
      cost: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setDocumentNonBlocking(requestRef, payload, { merge: true });

    toast({ title: "Task Logged", description: "Maintenance event synchronized to roadmap." });
    setIsCreateDialogOpen(false);
    setIsSubmitting(false);
    setNewRequestTitle('');
    setNewRequestDesc('');
    setSelectedPropertyId('');
  };

  const handleOpenEdit = (request: any) => {
    setIsEditingTask(request.id);
    setEditTitle(request.title);
    setEditDesc(request.description);
  };

  const handleUpdateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !isEditingTask) return;
    const requestRef = doc(db, 'maintenanceRequests', isEditingTask);
    updateDocumentNonBlocking(requestRef, {
      title: editTitle,
      description: editDesc,
      updatedAt: serverTimestamp()
    });
    toast({ title: "Record Updated", description: "The task specifications have been refined." });
    setIsEditingTask(null);
  };

  const handleTriage = async (request: any) => {
    if (!user || !db) return;
    const desc = request.description || '';
    if (desc.trim().length < 5) {
      toast({ variant: "destructive", title: "Triage Denied", description: "Request context is too brief for AI analysis." });
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
      toast({ title: "Intelligence Complete", description: `Suggested priority: ${result.priority}` });
    } catch (error: any) {
      console.error("Triage Error:", error);
      toast({ variant: "destructive", title: "Intelligence Failed" });
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
    toast({ title: "Partner Assigned" });
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
          propertyAddress: prop?.addressLine1 || 'Property Asset',
          status: newStatus,
          title: request.title
        });
      }
    } catch (e) {
      console.warn('Notification skipped.');
    }

    toast({ title: "Status Updated", description: `Task transitioned to ${newStatus}.` });
  };

  const handleLogCost = (request: any) => {
    if (!user || !db || !costAmount) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, { cost: Number(costAmount), updatedAt: serverTimestamp() });
    toast({ title: "Expense Recorded", description: `£${costAmount} added to portfolio records.` });
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
    toast({ title: "Timeline Adjusted", description: `Set for ${format(scheduledDate, 'PPP')}` });
    setIsScheduling(null);
    setScheduledDate(undefined);
  };

  const getPriorityColor = (priority: string) => {
    switch(priority?.toLowerCase()) {
      case 'critical': return 'bg-red-600 text-white';
      case 'urgent': return 'bg-orange-600 text-white';
      case 'routine': return 'bg-primary text-white';
      case 'low': return 'bg-slate-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!isClient || loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
        <Loader2 className="animate-spin text-primary w-10 h-10 opacity-60" />
        <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground font-headline">Synchronizing Ledger</p>
      </div>
    );
  }

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto pb-12 text-left">
      <div className="space-y-6">
        <div className="text-left space-y-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-3 py-1 rounded-full font-bold uppercase tracking-[0.15em] text-[9px]">
             <Activity className="w-3 h-3 mr-2" /> Maintenance Roadmap
          </Badge>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Maintenance Hub</h1>
          <p className="text-sm text-muted-foreground font-medium font-body max-w-xl leading-relaxed">Orchestrating professional site upkeep and AI-driven repair triage.</p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)} 
          className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-12 px-8 shadow-lg shadow-primary/20 text-white text-sm transition-all hover:scale-[1.02] w-fit"
        >
          <Plus className="w-4 h-4 mr-2" /> Log New Request
        </Button>
      </div>

      <div className="grid gap-6">
        {!requests || requests.length === 0 ? (
          <Card className="border-none shadow-sm rounded-[2rem] py-24 flex flex-col items-center justify-center bg-white ring-1 ring-primary/5 border-2 border-dashed border-primary/5">
            <div className="p-8 bg-primary/5 rounded-[2rem] mb-6">
               <Wrench className="w-12 h-12 text-primary opacity-20" />
            </div>
            <h3 className="text-lg font-bold font-headline text-primary opacity-40 uppercase tracking-widest text-center">Empty Ledger</h3>
            <p className="text-muted-foreground font-medium mt-2 text-sm text-center">No active maintenance tasks registered.</p>
          </Card>
        ) : (
          requests.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((request) => {
            const assignedPro = contractors.find(c => c.id === request.assignedContractorId);
            
            return (
              <Card key={request.id} className="border-none shadow-sm overflow-hidden bg-white rounded-[2.5rem] group ring-1 ring-primary/5 transition-all hover:shadow-md">
                <CardContent className="p-8">
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex flex-wrap items-center gap-3">
                      <Badge className={cn("uppercase text-[8px] font-bold px-3 py-1 tracking-[0.1em] rounded-full", request.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-primary/10 text-primary')}>
                        {request.status}
                      </Badge>
                      <Badge className={cn("capitalize font-bold text-[8px] px-3 py-1 tracking-[0.1em] rounded-full", getPriorityColor(request.priority))}>
                        {request.priority}
                      </Badge>
                      <span className="text-[9px] text-muted-foreground font-bold uppercase flex items-center tracking-widest opacity-60 font-headline">
                        <Clock className="w-3.5 h-3.5 mr-1.5" /> {request.createdAt ? format(new Date(request.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-primary/40 hover:text-primary hover:bg-primary/5 transition-all" onClick={() => handleOpenEdit(request)}>
                      <Edit3 className="w-4 h-4" />
                    </Button>
                  </div>
                  
                  <div className="space-y-4 text-left">
                    <h3 className="text-xl font-bold font-headline group-hover:text-primary transition-colors tracking-tight leading-tight">{request.title}</h3>
                    <p className="text-sm text-muted-foreground font-body leading-relaxed font-medium max-w-4xl">{request.description}</p>
                    
                    <div className="flex flex-wrap items-center gap-8 pt-6 border-t border-primary/5">
                      <div className="flex items-center gap-3">
                         <div className="p-2 bg-primary/5 rounded-xl border border-primary/5 shadow-inner">
                            <Building2 className="w-4 h-4 text-accent" />
                         </div>
                         <div className="text-left">
                            <p className="text-[8px] font-bold text-primary/40 uppercase tracking-widest font-headline">Asset</p>
                            <p className="text-xs font-bold text-primary font-headline">{properties?.find(p => p.id === request.propertyId)?.addressLine1 || "Record Pending"}</p>
                         </div>
                      </div>
                      {request.scheduledDate && (
                        <div className="flex items-center gap-3">
                           <div className="p-2 bg-emerald-50 rounded-xl border border-emerald-100 shadow-inner">
                              <CalendarIcon className="w-4 h-4 text-emerald-600" />
                           </div>
                           <div className="text-left">
                              <p className="text-[8px] font-bold text-emerald-600/40 uppercase tracking-widest font-headline">Target</p>
                              <p className="text-xs font-bold text-emerald-700 font-headline">{format(new Date(request.scheduledDate), 'PPP')}</p>
                           </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {request.aiTriageNotes && (
                    <div className="space-y-8 mt-10 animate-in fade-in duration-700 border-t border-primary/5 pt-10">
                      <div className="bg-primary/[0.02] border border-primary/5 rounded-[1.75rem] p-8 flex gap-6 text-left shadow-inner">
                        <BrainCircuit className="w-10 h-10 text-primary shrink-0 opacity-40" />
                        <div className="flex-1">
                          <p className="text-[9px] font-bold text-primary/60 uppercase mb-3 tracking-[0.2em] font-headline">Fix Strategy</p>
                          <p className="text-sm text-primary font-bold font-body leading-relaxed">{request.aiTriageNotes}</p>
                        </div>
                      </div>

                      {request.aiSuggestions && request.aiSuggestions.length > 0 && (
                        <div className="flex flex-col gap-6 text-left pl-2">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 shadow-sm text-emerald-600">
                               <Lightbulb className="w-5 h-5" />
                            </div>
                            <p className="text-[9px] font-bold text-emerald-700/60 uppercase tracking-[0.2em] font-headline">Recommendations</p>
                          </div>
                          
                          <div className="flex flex-col gap-3">
                            {request.aiSuggestions.map((suggestion: string, idx: number) => (
                              <div key={idx} className="flex gap-3 p-4 bg-emerald-50/40 rounded-2xl border border-emerald-100/50 text-[11px] font-bold text-emerald-900 shadow-sm transition-all hover:bg-white text-left w-fit min-w-[300px]">
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> {suggestion}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
                <CardFooter className="bg-muted/5 p-6 flex flex-wrap gap-4 border-t border-primary/5">
                  <Button 
                    variant="outline" 
                    className="flex-1 min-w-[180px] bg-white text-primary rounded-xl font-bold h-12 border border-primary/10 shadow-sm transition-all text-xs font-headline hover:bg-primary/5 hover:text-primary" 
                    onClick={() => handleTriage(request)} 
                    disabled={isTriaging === request.id}
                  >
                    {isTriaging === request.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Triage Request
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="flex-1 min-w-[180px] rounded-xl font-bold h-12 border-primary/10 bg-white shadow-sm hover:bg-primary/5 hover:text-primary text-xs font-headline" 
                    onClick={() => setIsScheduling(request.id)}
                  >
                    <CalendarIcon className="w-4 h-4 mr-2" /> Target Roadmap
                  </Button>

                  <Button 
                    variant="outline" 
                    className="flex-1 min-w-[180px] rounded-xl font-bold h-12 border-primary/10 bg-white shadow-sm hover:bg-primary/5 hover:text-primary text-xs font-headline" 
                    onClick={() => setIsAssigningPro(request.id)}
                  >
                    <UserCheck className="w-4 h-4 mr-2" /> {assignedPro ? 'Change Partner' : 'Assign Partner'}
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" className="flex-1 min-w-[180px] rounded-xl font-bold h-12 border-primary/10 bg-white shadow-sm hover:bg-primary/5 hover:text-primary text-xs font-headline">Update Status</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="rounded-xl border-primary/10 shadow-xl min-w-[220px] p-2 bg-white" align="end">
                      <DropdownMenuItem className="py-3 px-4 font-bold text-xs font-headline cursor-pointer rounded-lg focus:bg-primary/5 focus:text-primary" onClick={() => updateStatus(request, 'in-progress')}>
                        <PlayCircle className="w-4 h-4 mr-3 text-sky-600" /> In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-3 px-4 font-bold text-xs font-headline cursor-pointer rounded-lg focus:bg-primary/5 focus:text-primary" onClick={() => updateStatus(request, 'completed')}>
                        <CheckCircle2 className="w-4 h-4 mr-3 text-emerald-600" /> Completed
                      </DropdownMenuItem>
                      <DropdownMenuItem className="py-3 px-4 font-bold text-xs font-headline cursor-pointer rounded-lg focus:bg-primary/5 focus:text-primary" onClick={() => setIsLoggingCost(request.id)}>
                        <PoundSterling className="w-4 h-4 mr-3 text-amber-600" /> Log Final Cost
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardFooter>

                {/* Assignment Dialog */}
                <Dialog open={isAssigningPro === request.id} onOpenChange={(open) => !open && setIsAssigningPro(null)}>
                  <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[500px] bg-white flex flex-col max-h-[85vh]">
                    <div className="p-8 bg-primary/5 border-b text-left shrink-0">
                      <DialogTitle className="text-xl font-bold font-headline text-primary tracking-tight">Partner Assignment</DialogTitle>
                      <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Select an authorized professional to resolve this issue.</DialogDescription>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-6 space-y-3">
                        {contractors.length === 0 ? (
                          <div className="p-12 text-center space-y-6">
                            <HardHat className="w-12 h-12 mx-auto text-primary/10" />
                            <p className="text-sm font-bold text-muted-foreground font-headline uppercase tracking-widest">Directory Empty</p>
                          </div>
                        ) : (
                          contractors.map(pro => (
                            <button 
                              key={pro.id} 
                              onClick={() => handleAssignContractor(request.id, pro.id)}
                              className="w-full flex items-center justify-between p-5 rounded-2xl hover:bg-primary/[0.03] transition-all text-left group border border-transparent hover:border-primary/5 shadow-sm bg-white"
                            >
                               <div className="flex items-center gap-5">
                                  <div className="p-3 bg-primary/5 rounded-xl text-primary font-bold shadow-inner">
                                     <HardHat className="w-5 h-5" />
                                  </div>
                                  <div>
                                     <p className="font-bold text-sm text-primary font-headline">{pro.name}</p>
                                     <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">{pro.role}</p>
                                  </div>
                               </div>
                               <ChevronRight className="w-4 h-4 text-primary/20 group-hover:text-primary transition-all" />
                            </button>
                          ))
                        )}
                      </div>
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                {/* Scheduling Dialog */}
                <Dialog open={isScheduling === request.id} onOpenChange={(open) => !open && setIsScheduling(null)}>
                  <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[450px] bg-white">
                    <div className="p-8 bg-primary/5 border-b text-left">
                      <DialogTitle className="text-xl font-bold font-headline text-primary tracking-tight">Target Roadmap</DialogTitle>
                      <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Register this repair in your property roadmap.</DialogDescription>
                    </div>
                    <div className="p-8 flex justify-center">
                      <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} className="rounded-2xl border-none shadow-inner bg-white p-0" />
                    </div>
                    <DialogFooter className="p-6 bg-muted/5 border-t">
                       <Button className="w-full rounded-xl h-12 font-bold bg-primary text-white shadow-lg font-headline text-sm hover:bg-primary/90" disabled={!scheduledDate} onClick={() => handleSetSchedule(request.id)}>
                          <Save className="w-4 h-4 mr-2" /> Synchronize Timeline
                       </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </Card>
            );
          })
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-w-[650px] flex flex-col max-h-[90vh]">
          <form onSubmit={handleCreateRequest} className="flex flex-col h-full overflow-hidden">
            <div className="p-10 bg-primary/5 border-b text-left shrink-0">
              <DialogTitle className="font-headline text-2xl font-bold text-primary tracking-tight">Log Maintenance Event</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground mt-1 text-sm">Initialize a maintenance event for your professional roadmap.</DialogDescription>
            </div>
            <ScrollArea className="flex-1">
              <div className="grid gap-6 p-10 text-left bg-white">
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-primary/40 font-headline tracking-widest">Target Inventory Asset</Label>
                  <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-primary" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required>
                    <option value="">Choose an inventory item...</option>
                    {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-primary/40 font-headline tracking-widest">Repair Identifier</Label>
                  <Input value={newRequestTitle} onChange={(e) => setNewRequestTitle(e.target.value)} required placeholder="e.g. Electrical Fault Discovery" className="rounded-xl h-11 bg-muted/20 border-none font-bold text-sm px-4" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-primary/40 font-headline tracking-widest">Operational Context</Label>
                  <Textarea value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} required placeholder="Provide full context for contractor access..." className="rounded-xl min-h-[140px] bg-muted/20 border-none font-medium px-4 py-4 text-sm leading-relaxed" />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
              <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg text-white font-headline text-sm hover:bg-primary/90" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Register in Roadmap
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!isEditingTask} onOpenChange={(open) => !open && setIsEditingTask(null)}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-white max-w-[650px] flex flex-col max-h-[90vh]">
          <form onSubmit={handleUpdateTask} className="flex flex-col h-full overflow-hidden">
            <div className="p-10 bg-primary/5 border-b text-left shrink-0">
              <DialogTitle className="font-headline text-2xl font-bold text-primary tracking-tight">Modify Record</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground mt-1 text-sm">Refine the specifications of this maintenance task.</DialogDescription>
            </div>
            <ScrollArea className="flex-1">
              <div className="grid gap-6 p-10 text-left bg-white">
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-primary/40 font-headline tracking-widest">Repair Identifier</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required className="rounded-xl h-11 bg-muted/20 border-none font-bold text-sm px-4" />
                </div>
                <div className="space-y-2">
                  <Label className="text-[9px] font-bold uppercase text-primary/40 font-headline tracking-widest">Operational Context</Label>
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} required className="rounded-xl min-h-[140px] bg-muted/20 border-none font-medium px-4 py-4 text-sm leading-relaxed" />
                </div>
              </div>
            </ScrollArea>
            <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
              <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg text-white font-headline text-sm hover:bg-primary/90">
                <Save className="w-4 h-4 mr-2" /> Update Portfolio Records
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
