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
  deleteDocumentNonBlocking,
  getLandlordCollectionQuery 
} from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { 
  Wrench, Sparkles, Clock, BrainCircuit, Loader2, 
  CheckCircle2, PlayCircle, Plus,
  Calendar as CalendarIcon, Building2,
  Activity, Save, Lightbulb, Edit3, Trash2
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import { ScrollArea } from "@/components/ui/scroll-area";
import Link from 'next/link';

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
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isScheduling, setIsScheduling] = useState<string | null>(null);
  const [scheduledDate, setScheduledDate] = useState<Date>();

  const [newRequestTitle, setNewRequestTitle] = useState('');
  const [newRequestDesc, setNewRequestDesc] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const [editRequestId, setEditRequestId] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPropertyId, setEditPropertyId] = useState('');

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

    toast({ title: "Task Logged", description: "Maintenance event synchronized." });
    setIsCreateDialogOpen(false);
    setIsSubmitting(false);
    setNewRequestTitle('');
    setNewRequestDesc('');
    setSelectedPropertyId('');
  };

  const openEditDialog = (request: any) => {
    setEditRequestId(request.id);
    setEditTitle(request.title);
    setEditDesc(request.description);
    setEditPropertyId(request.propertyId);
    setIsEditDialogOpen(true);
  };

  const handleUpdateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !editRequestId || !editPropertyId) return;
    setIsSubmitting(true);

    const requestRef = doc(db, 'maintenanceRequests', editRequestId);
    updateDocumentNonBlocking(requestRef, {
      title: editTitle,
      description: editDesc,
      propertyId: editPropertyId,
      updatedAt: serverTimestamp(),
    });

    toast({ title: "Task Updated", description: "Ledger details modified." });
    setIsEditDialogOpen(false);
    setIsSubmitting(false);
  };

  const handleDeleteRequest = (id: string) => {
    if (!db) return;
    const requestRef = doc(db, 'maintenanceRequests', id);
    deleteDocumentNonBlocking(requestRef);
    toast({ title: "Task Deleted", description: "Record removed from portfolio ledger." });
  };

  const handleTriage = async (request: any) => {
    if (!user || !db) return;
    const desc = request.description || '';
    if (desc.trim().length < 5) {
      toast({ variant: "destructive", title: "Context Required", description: "Details too brief for AI analysis." });
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
      toast({ title: "Intelligence Complete", description: "Actionable strategy synchronized." });
    } catch (error) {
      toast({ variant: "destructive", title: "Intelligence Error" });
    } finally {
      setIsTriaging(null);
    }
  };

  const updateStatus = async (request: any, newStatus: string) => {
    if (!user || !db) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, { status: newStatus, updatedAt: serverTimestamp() });
    toast({ title: "Status Updated", description: `Task transitioned to ${newStatus}.` });
  };

  const handleSetSchedule = (requestId: string) => {
    if (!db || !scheduledDate) return;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    updateDocumentNonBlocking(requestRef, { 
      scheduledDate: scheduledDate.toISOString(),
      updatedAt: serverTimestamp() 
    });
    toast({ title: "Timeline Adjusted" });
    setIsScheduling(null);
    setScheduledDate(undefined);
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
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-6xl mx-auto pb-12 text-left">
      <div className="space-y-6">
        <div className="space-y-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-3 py-1 rounded-full font-bold uppercase tracking-[0.15em] text-[9px]">
             <Activity className="w-3 h-3 mr-2" /> Maintenance Roadmap
          </Badge>
          <h1 className="text-3xl font-headline font-bold text-foreground tracking-tight">Maintenance Hub</h1>
          <p className="text-sm text-muted-foreground font-medium font-body max-w-xl leading-relaxed">Orchestrating professional site upkeep and AI-driven repair triage.</p>
        </div>
        <Button 
          onClick={() => setIsCreateDialogOpen(true)} 
          className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-12 px-8 shadow-lg shadow-primary/20 text-primary-foreground text-sm transition-all hover:scale-[1.02] w-fit shrink-0"
        >
          <Plus className="w-4 h-4 mr-2" /> Log New Request
        </Button>
      </div>

      <div className="grid gap-6">
        {!requests || requests.length === 0 ? (
          <Card className="border-none shadow-sm rounded-[2rem] py-24 flex flex-col items-center justify-center bg-card ring-1 ring-border border-2 border-dashed">
            <Wrench className="w-12 h-12 text-primary opacity-20 mb-6" />
            <h3 className="text-lg font-bold font-headline text-muted-foreground opacity-40 uppercase tracking-widest text-center">Empty Ledger</h3>
          </Card>
        ) : (
          requests.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((request) => (
            <Card key={request.id} className="border-none shadow-sm overflow-hidden bg-card rounded-[2.5rem] group ring-1 ring-border transition-all hover:shadow-md relative min-w-0">
              <CardContent className="p-8">
                <div className="flex justify-between items-start mb-6 pr-10 min-w-0">
                  <div className="flex flex-wrap items-center gap-3 min-w-0">
                    <Badge className={cn("uppercase text-[8px] font-bold px-3 py-1 tracking-[0.1em] rounded-full shrink-0", request.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-primary/10 text-primary')}>
                      {request.status}
                    </Badge>
                    <Badge className={cn("capitalize font-bold text-[8px] px-3 py-1 tracking-[0.1em] rounded-full shrink-0", request.priority === 'critical' ? 'bg-red-600 text-white' : 'bg-primary text-primary-foreground')}>
                      {request.priority}
                    </Badge>
                    <span className="text-[9px] text-muted-foreground font-bold uppercase flex items-center tracking-widest opacity-60 font-headline truncate">
                      <Clock className="w-3.5 h-3.5 mr-1.5 shrink-0" /> {request.createdAt ? format(new Date(request.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                    </span>
                  </div>
                </div>
                
                <div className="space-y-4 min-w-0">
                  <h3 className="text-xl font-bold font-headline group-hover:text-primary transition-colors tracking-tight leading-tight text-foreground truncate block w-full">{request.title}</h3>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed font-medium max-w-4xl block truncate md:line-clamp-2 md:whitespace-normal">{request.description}</p>
                  
                  <div className="flex flex-wrap items-center gap-8 pt-6 border-t border-border min-w-0">
                    <div className="flex items-center gap-3 min-w-0">
                       <div className="p-2 bg-primary/5 rounded-xl text-accent shrink-0"><Building2 className="w-4 h-4" /></div>
                       <div className="text-left min-w-0 flex-1">
                          <p className="text-[8px] font-bold text-muted-foreground uppercase tracking-widest font-headline">Asset</p>
                          <p className="text-xs font-bold text-foreground truncate block">{properties?.find(p => p.id === request.propertyId)?.addressLine1 || "Portfolio Item"}</p>
                       </div>
                    </div>
                    {request.scheduledDate && (
                      <div className="flex items-center gap-3 min-w-0">
                         <div className="p-2 bg-emerald-500/10 rounded-xl text-emerald-500 shrink-0"><CalendarIcon className="w-4 h-4" /></div>
                         <div className="text-left min-w-0 flex-1">
                            <p className="text-[8px] font-bold text-emerald-500/60 uppercase tracking-widest font-headline">Target</p>
                            <p className="text-xs font-bold text-emerald-500 truncate block">{format(new Date(request.scheduledDate), 'PPP')}</p>
                         </div>
                      </div>
                    )}
                  </div>
                </div>

                {request.aiTriageNotes && (
                  <div className="space-y-8 mt-10 animate-in fade-in duration-700 border-t border-border pt-10">
                    <div className="bg-primary/5 border border-border rounded-[1.75rem] p-8 flex gap-6 shadow-inner min-w-0">
                      <BrainCircuit className="w-10 h-10 text-primary shrink-0 opacity-40" />
                      <div className="flex-1 text-left min-w-0">
                        <p className="text-[9px] font-bold text-muted-foreground uppercase mb-3 tracking-[0.2em] font-headline">Fix Strategy</p>
                        <p className="text-sm text-foreground font-bold font-body leading-relaxed">{request.aiTriageNotes}</p>
                      </div>
                    </div>

                    {request.aiSuggestions && request.aiSuggestions.length > 0 && (
                      <div className="flex flex-col gap-6 text-left pl-2 min-w-0">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 bg-emerald-500/10 rounded-xl text-emerald-500 shrink-0"><Lightbulb className="w-5 h-5" /></div>
                          <p className="text-[9px] font-bold text-emerald-500/60 uppercase tracking-[0.2em] font-headline">Recommendations</p>
                        </div>
                        <div className="flex flex-col gap-3 min-w-0">
                          {request.aiSuggestions.map((s: string, idx: number) => (
                            <div key={idx} className="flex gap-3 p-4 bg-emerald-500/5 rounded-2xl border border-emerald-500/10 text-[11px] font-bold text-foreground shadow-sm w-full md:w-fit min-w-0">
                              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-500" /> <span className="truncate block">{s}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/5 p-6 flex flex-wrap gap-4 border-t border-border">
                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[160px] bg-card text-foreground rounded-xl font-bold h-12 border border-border transition-all text-xs font-headline hover:bg-primary/5" 
                  onClick={() => handleTriage(request)} 
                  disabled={isTriaging === request.id}
                >
                  {isTriaging === request.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  Triage Request
                </Button>
                
                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[160px] rounded-xl font-bold h-12 border-border bg-card shadow-sm hover:bg-primary/5 text-foreground text-xs font-headline" 
                  onClick={() => openEditDialog(request)}
                >
                  <Edit3 className="w-4 h-4 mr-2" /> Edit Task
                </Button>

                <Button 
                  variant="outline" 
                  className="flex-1 min-w-[160px] rounded-xl font-bold h-12 border-border bg-card shadow-sm hover:bg-primary/5 text-foreground text-xs font-headline" 
                  onClick={() => setIsScheduling(request.id)}
                >
                  <CalendarIcon className="w-4 h-4 mr-2" /> Target Roadmap
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 min-w-[160px] rounded-xl font-bold h-12 border-border bg-card shadow-sm hover:bg-primary/5 text-foreground text-xs font-headline">Update Status</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="rounded-xl border-border shadow-xl min-w-[220px] p-2 bg-card" align="end">
                    <DropdownMenuItem className="py-3 px-4 font-bold text-xs cursor-pointer rounded-lg focus:bg-accent focus:text-accent-foreground group" onClick={() => updateStatus(request, 'in-progress')}>
                      <PlayCircle className="w-4 h-4 mr-3 text-sky-600 group-focus:text-white" /> In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem className="py-3 px-4 font-bold text-xs cursor-pointer rounded-lg focus:bg-accent focus:text-accent-foreground group" onClick={() => updateStatus(request, 'completed')}>
                      <CheckCircle2 className="w-4 h-4 mr-3 text-emerald-600 group-focus:text-white" /> Completed
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-12 w-12 rounded-xl text-destructive/40 hover:text-white hover:bg-red-500 transition-all shrink-0 border border-border">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl bg-card p-10">
                    <AlertDialogHeader className="text-left">
                      <AlertDialogTitle className="text-2xl font-headline font-bold text-foreground">Delete Maintenance Record?</AlertDialogTitle>
                      <AlertDialogDescription className="text-muted-foreground font-medium text-base mt-2">
                        This will permanently remove the repair log for <strong>{request.title}</strong>. This action cannot be reversed.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="mt-8 gap-3">
                      <AlertDialogCancel className="rounded-xl h-12 font-bold font-headline uppercase tracking-widest text-[10px] border-border">Cancel</AlertDialogCancel>
                      <AlertDialogAction 
                        onClick={() => handleDeleteRequest(request.id)}
                        className="rounded-xl h-12 font-bold bg-red-600 hover:bg-red-700 text-white font-headline uppercase tracking-widest text-[10px] border-none"
                      >
                        Delete Record
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardFooter>

              <Dialog open={isScheduling === request.id} onOpenChange={(open) => !open && setIsScheduling(null)}>
                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden max-w-[450px] bg-card">
                  <div className="p-8 bg-primary/5 border-b text-left">
                    <DialogTitle className="text-xl font-bold font-headline text-foreground tracking-tight">Target Roadmap</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1">Register this repair in your property roadmap.</DialogDescription>
                  </div>
                  <div className="p-8 flex justify-center">
                    <Calendar mode="single" selected={scheduledDate} onSelect={setScheduledDate} className="rounded-2xl border-none shadow-inner bg-background p-0" />
                  </div>
                  <DialogFooter className="p-6 bg-muted/5 border-t">
                     <Button className="w-full rounded-xl h-12 font-bold bg-background text-foreground border border-border shadow-lg font-headline text-sm hover:bg-primary hover:text-primary-foreground" disabled={!scheduledDate} onClick={() => handleSetSchedule(request.id)}>
                        <Save className="w-4 h-4 mr-2" /> Synchronize Timeline
                     </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card max-w-[650px] flex flex-col h-[850px] max-h-[90vh] ring-1 ring-white/10">
          <form onSubmit={handleCreateRequest} className="flex flex-col h-full overflow-hidden">
            <div className="p-10 bg-primary/5 border-b text-left shrink-0">
              <DialogTitle className="font-headline text-2xl font-bold text-foreground tracking-tight">Log Maintenance Event</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground mt-1 text-sm">Initialize a maintenance event for your professional roadmap.</DialogDescription>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="grid gap-8 p-10 text-left">
                <div className="space-y-3">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 font-headline tracking-widest">Target Inventory Asset</Label>
                  <select 
                    className="flex h-14 w-full rounded-2xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-primary outline-none font-bold text-foreground shadow-inner ring-1 ring-white/10" 
                    value={selectedPropertyId} 
                    onChange={(e) => setSelectedPropertyId(e.target.value)} 
                    required
                  >
                    <option value="">Choose an inventory item...</option>
                    {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Repair Identifier</Label>
                  <Input value={newRequestTitle} onChange={(e) => setNewRequestTitle(e.target.value)} required placeholder="e.g. Electrical Fault discovery" className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-base px-6 shadow-inner ring-1 ring-white/10 text-foreground" />
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Context</Label>
                  <Textarea value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} required placeholder="Details for triage and fix strategy..." className="rounded-2xl min-h-[160px] bg-muted/40 border-none font-medium px-6 py-5 text-base leading-relaxed shadow-inner ring-1 ring-white/10 text-foreground" />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-10 bg-muted/5 border-t shrink-0">
              <Button type="submit" className="w-full rounded-2xl h-16 font-bold bg-background text-foreground border border-border shadow-2xl font-headline text-sm hover:bg-primary hover:text-primary-foreground transition-all hover:scale-[1.01]" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                Register Roadmap Task
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card max-w-[650px] flex flex-col h-[850px] max-h-[90vh] ring-1 ring-white/10">
          <form onSubmit={handleUpdateTask} className="flex flex-col h-full overflow-hidden">
            <div className="p-10 bg-primary/5 border-b text-left shrink-0">
              <DialogTitle className="font-headline text-2xl font-bold text-foreground tracking-tight">Modify Task Records</DialogTitle>
              <DialogDescription className="font-medium text-muted-foreground mt-1 text-sm">Refine the identifier, asset location, and context for this maintenance roadmap event.</DialogDescription>
            </div>
            
            <ScrollArea className="flex-1">
              <div className="grid gap-8 p-10 text-left">
                <div className="space-y-3">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 font-headline tracking-widest">Target Inventory Asset</Label>
                  <select 
                    className="flex h-14 w-full rounded-2xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-primary outline-none font-bold text-foreground shadow-inner ring-1 ring-white/10" 
                    value={editPropertyId} 
                    onChange={(e) => setEditPropertyId(e.target.value)} 
                    required
                  >
                    <option value="">Choose an inventory item...</option>
                    {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                  </select>
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Repair Identifier</Label>
                  <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} required placeholder="e.g. Electrical Fault discovery" className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-base px-6 shadow-inner ring-1 ring-white/10 text-foreground" />
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Operational Context</Label>
                  <Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} required placeholder="Updated details for this repair log..." className="rounded-2xl min-h-[220px] bg-muted/40 border-none font-medium px-6 py-5 text-base leading-relaxed shadow-inner ring-1 ring-white/10 text-foreground" />
                </div>
              </div>
            </ScrollArea>

            <DialogFooter className="p-10 bg-muted/5 border-t shrink-0">
              <Button type="submit" className="w-full rounded-2xl h-16 font-bold bg-background text-foreground border border-border shadow-2xl font-headline text-sm hover:bg-primary hover:text-primary-foreground transition-all hover:scale-[1.01]" disabled={isSubmitting || !editTitle}>
                {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                Synchronize Changes
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
