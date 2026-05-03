"use client";

import { useState } from 'react';
import { triageMaintenanceRequest } from "@/ai/flows/maintenance-request-triage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, getLandlordCollectionQuery } from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { Wrench, Sparkles, Clock, BrainCircuit, Loader2, CheckCircle2, PlayCircle, Plus, PoundSterling } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export default function MaintenancePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isTriaging, setIsTriaging] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoggingCost, setIsLoggingCost] = useState<string | null>(null);
  const [costAmount, setCostAmount] = useState('');

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

    toast({ title: "Request Logged", description: "Maintenance task has been added to the ledger." });
    setIsCreateDialogOpen(false);
    setIsSubmitting(false);
    setNewRequestTitle('');
    setNewRequestDesc('');
    setSelectedPropertyId('');
  };

  const handleTriage = async (request: any) => {
    if (!user || !db) return;
    setIsTriaging(request.id);
    try {
      const result = await triageMaintenanceRequest({ maintenanceRequest: request.description });
      const requestRef = doc(db, 'maintenanceRequests', request.id);
      updateDocumentNonBlocking(requestRef, {
        priority: result.priority,
        category: result.category,
        aiTriageNotes: result.reasoning,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "AI Triage Complete", description: `Suggested priority: ${result.priority}` });
    } catch (error) {
      toast({ variant: "destructive", title: "Triage failed" });
    } finally {
      setIsTriaging(null);
    }
  };

  const updateStatus = (request: any, newStatus: string) => {
    if (!user || !db) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, { status: newStatus, updatedAt: serverTimestamp() });
    toast({ title: "Status Updated", description: `Task marked as ${newStatus}.` });
  };

  const handleLogCost = (request: any) => {
    if (!user || !db || !costAmount) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, { cost: Number(costAmount), updatedAt: serverTimestamp() });
    toast({ title: "Cost Logged", description: `Financial ledger updated with £${costAmount}.` });
    setIsLoggingCost(null);
    setCostAmount('');
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

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto">
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
          <Card className="border-dashed border-2 py-24 flex flex-col items-center justify-center bg-muted/10 rounded-[2rem]">
            <Wrench className="w-12 h-12 text-primary/20 mb-4" />
            <h3 className="text-xl font-bold font-headline text-primary/40">No active requests</h3>
          </Card>
        ) : (
          requests.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map((request) => (
            <Card key={request.id} className="border-none shadow-sm overflow-hidden bg-white rounded-2xl group border border-transparent hover:border-primary/5 transition-all">
              <CardContent className="p-6">
                <div className="flex flex-wrap items-center gap-3 mb-6">
                  <Badge className={cn("uppercase text-[10px] font-bold px-3 py-1", request.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700')}>
                    {request.status}
                  </Badge>
                  <Badge className={cn("capitalize font-bold text-[10px] px-3 py-1", getPriorityColor(request.priority))}>
                    {request.priority}
                  </Badge>
                  {request.cost > 0 && <Badge variant="secondary" className="bg-amber-100 text-amber-800 font-bold border-amber-200 text-[10px] px-3 py-1">£{request.cost} Spent</Badge>}
                  <span className="text-[10px] text-muted-foreground font-bold uppercase ml-auto flex items-center">
                    <Clock className="w-3 h-3 mr-1" /> {request.createdAt ? format(new Date(request.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                  </span>
                </div>
                
                <div className="space-y-4 text-left">
                  <h3 className="text-xl font-bold font-headline group-hover:text-primary transition-colors leading-tight">{request.title}</h3>
                  <p className="text-muted-foreground font-body leading-relaxed break-words">{request.description}</p>
                </div>

                {request.aiTriageNotes && (
                  <div className="bg-primary/5 border border-primary/10 rounded-2xl p-5 mt-6 flex gap-4 text-left">
                    <BrainCircuit className="w-6 h-6 text-primary shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[10px] font-bold text-primary uppercase mb-2 tracking-widest font-headline">AI Triage Analysis</p>
                      <p className="text-sm text-black font-bold font-body leading-relaxed">{request.aiTriageNotes}</p>
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="bg-muted/5 p-4 flex flex-wrap gap-3 border-t">
                <Button className="flex-1 min-w-[140px] bg-white hover:bg-primary/5 text-primary rounded-xl font-bold h-12 border border-primary/20 shadow-sm" onClick={() => handleTriage(request)} disabled={isTriaging === request.id}>
                  {isTriaging === request.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                  AI Triage Analysis
                </Button>
                <Dialog open={isLoggingCost === request.id} onOpenChange={(open) => !open && setIsLoggingCost(null)}>
                  <Button variant="outline" className="flex-1 min-w-[140px] rounded-xl font-bold h-12 border-primary/20 bg-white shadow-sm" onClick={() => setIsLoggingCost(request.id)}>
                    <PoundSterling className="w-4 h-4 mr-2" /> Log Expense
                  </Button>
                  <DialogContent className="rounded-2xl border-none shadow-2xl">
                    <DialogHeader className="text-left">
                      <DialogTitle className="font-headline text-xl font-bold text-primary">Log Maintenance Expense</DialogTitle>
                      <DialogDescription className="font-body">Enter the professional cost for this repair task to update your portfolio analytics.</DialogDescription>
                    </DialogHeader>
                    <div className="py-6 space-y-2 text-left">
                      <Label className="text-xs font-bold uppercase text-muted-foreground font-headline">Total Cost (£)</Label>
                      <Input type="number" placeholder="e.g. 150.00" value={costAmount} onChange={(e) => setCostAmount(e.target.value)} className="rounded-xl h-12 bg-muted/20 border-none font-body" />
                    </div>
                    <DialogFooter>
                      <Button className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg shadow-primary/20 text-white font-headline" onClick={() => handleLogCost(request)}>Update Financial Ledger</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1 min-w-[140px] rounded-xl font-bold h-12 border-primary/20 bg-white shadow-sm">Update Status</Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="rounded-xl border-none shadow-xl min-w-[200px]" align="end">
                    <DropdownMenuItem className="py-3 px-4 font-bold font-body" onClick={() => updateStatus(request, 'in-progress')}>
                      <PlayCircle className="w-4 h-4 mr-3 text-sky-600" /> Mark In Progress
                    </DropdownMenuItem>
                    <DropdownMenuItem className="py-3 px-4 font-bold font-body" onClick={() => updateStatus(request, 'completed')}>
                      <CheckCircle2 className="w-4 h-4 mr-3 text-emerald-600" /> Mark Completed
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardFooter>
            </Card>
          ))
        )}
      </div>

      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="rounded-2xl border-none shadow-2xl">
          <form onSubmit={handleCreateRequest}>
            <DialogHeader className="text-left">
              <DialogTitle className="font-headline text-xl font-bold text-primary">Log Maintenance Task</DialogTitle>
              <DialogDescription className="font-body">Record a new maintenance event for your asset history.</DialogDescription>
            </DialogHeader>
            <div className="grid gap-6 py-6 text-left">
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground font-headline tracking-widest">Select Asset</Label>
                <select className="flex h-12 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-body" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required>
                  <option value="">Choose a property...</option>
                  {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground font-headline tracking-widest">Task Title</Label>
                <Input value={newRequestTitle} onChange={(e) => setNewRequestTitle(e.target.value)} required placeholder="e.g. Kitchen tap leak" className="rounded-xl h-12 bg-muted/20 border-none font-body" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs font-bold uppercase text-muted-foreground font-headline tracking-widest">Detailed Description</Label>
                <Textarea value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} required placeholder="Describe the issue in detail..." className="rounded-xl min-h-[120px] bg-muted/20 border-none font-body" />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg shadow-primary/20 text-white font-headline" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Log Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}