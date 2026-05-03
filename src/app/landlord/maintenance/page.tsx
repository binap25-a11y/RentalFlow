"use client";

import { useState } from 'react';
import { triageMaintenanceRequest } from "@/ai/flows/maintenance-request-triage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, getMemberCollectionQuery } from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { Wrench, Sparkles, Clock, BrainCircuit, Loader2, CheckCircle2, PlayCircle, Plus, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function MaintenancePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  
  const [isTriaging, setIsTriaging] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [newRequestTitle, setNewRequestTitle] = useState('');
  const [newRequestDesc, setNewRequestDesc] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getMemberCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: properties } = useCollection(propertiesQuery);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getMemberCollectionQuery(db, "maintenanceRequests", user.uid);
  }, [db, user]);

  const { data: requests, loading } = useCollection(maintenanceQuery);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedPropertyId) return;

    setIsSubmitting(true);
    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    const property = properties?.find(p => p.id === selectedPropertyId);

    const data = {
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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setDocumentNonBlocking(requestRef, data, { merge: true });
    toast({ title: "Request Logged", description: "Maintenance task has been added to the ledger." });
    
    setIsCreateDialogOpen(false);
    setIsSubmitting(false);
    setNewRequestTitle('');
    setNewRequestDesc('');
    setSelectedPropertyId('');
  };

  const handleTriage = async (request: any) => {
    if (!user) return;
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
      toast({ variant: "destructive", title: "Triage failed", description: "Could not analyze request at this time." });
    } finally {
      setIsTriaging(null);
    }
  };

  const updateStatus = (request: any, newStatus: string) => {
    if (!user) return;
    const requestRef = doc(db, 'maintenanceRequests', request.id);
    updateDocumentNonBlocking(requestRef, {
      status: newStatus,
      updatedAt: serverTimestamp(),
    });
    toast({ title: "Status Updated", description: `Task marked as ${newStatus}.` });
  };

  const getPriorityColor = (priority: string) => {
    switch(priority?.toLowerCase()) {
      case 'critical': return 'bg-red-500 text-white border-red-200';
      case 'urgent': return 'bg-orange-500 text-white border-orange-200';
      case 'routine': return 'bg-blue-500 text-white border-blue-200';
      case 'low': return 'bg-slate-400 text-white border-slate-200';
      default: return 'bg-muted text-muted-foreground border-muted';
    }
  };

  const getStatusStyles = (status: string) => {
    switch(status?.toLowerCase()) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
      case 'in-progress': return 'bg-sky-100 text-sky-700 border-sky-200';
      case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
      default: return 'bg-slate-100 text-slate-700 border-slate-200';
    }
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Maintenance Management</h1>
          <p className="text-muted-foreground font-medium font-body">Review, prioritize and assign maintenance tasks.</p>
        </div>
        <div className="flex gap-3">
          <Button onClick={() => setIsCreateDialogOpen(true)} className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg shadow-primary/20">
            <Plus className="w-4 h-4 mr-2" />
            Log New Request
          </Button>
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl">
              <form onSubmit={handleCreateRequest}>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl font-bold font-headline">Log Maintenance Task</DialogTitle>
                  <DialogDescription className="font-medium">Manually add a maintenance issue discovered or reported.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6 text-left">
                  <div className="space-y-2">
                    <Label htmlFor="property" className="font-bold text-xs uppercase text-primary/60 tracking-wider">Property Asset</Label>
                    <select 
                      id="property" 
                      className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow"
                      value={selectedPropertyId}
                      onChange={(e) => setSelectedPropertyId(e.target.value)}
                      required
                    >
                      <option value="">Select a property...</option>
                      {properties?.map(prop => (
                        <option key={prop.id} value={prop.id}>{prop.addressLine1}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title" className="font-bold text-xs uppercase text-primary/60 tracking-wider">Issue Title</Label>
                    <Input id="title" value={newRequestTitle} onChange={(e) => setNewRequestTitle(e.target.value)} required placeholder="e.g., HVAC failure in Unit 4" className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc" className="font-bold text-xs uppercase text-primary/60 tracking-wider">Detailed Description</Label>
                    <Textarea id="desc" value={newRequestDesc} onChange={(e) => setNewRequestDesc(e.target.value)} required placeholder="Provide context for AI triage..." className="rounded-xl min-h-[100px]" />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg shadow-primary/20" disabled={isSubmitting}>
                    {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Log Request"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid gap-6">
        {!requests || requests.length === 0 ? (
          <Card className="border-dashed border-2 py-24 flex flex-col items-center justify-center text-center bg-muted/10 rounded-[2rem]">
            <div className="p-6 bg-white rounded-full mb-6 shadow-sm">
              <Wrench className="w-10 h-10 text-primary/20" />
            </div>
            <h3 className="text-xl font-bold font-headline text-primary/40">No active requests</h3>
            <p className="text-sm text-muted-foreground max-w-xs mt-2 font-medium">Maintenance tasks will appear here once logged.</p>
          </Card>
        ) : (
          requests
            .slice()
            .sort((a, b) => {
              const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
              const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
              return dateB - dateA;
            })
            .map((request) => {
              const createdAt = request.createdAt ? new Date(request.createdAt.seconds * 1000) : null;
              const property = properties?.find(p => p.id === request.propertyId);
              const status = request.status || 'pending';
              
              return (
                <Card key={request.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow bg-white rounded-2xl">
                  <CardContent className="p-6 pb-4">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge className={`uppercase text-[10px] font-bold border ${getStatusStyles(status)}`}>
                          {status}
                        </Badge>
                        <Badge className={`capitalize font-bold border ${getPriorityColor(request.priority)}`}>
                          {request.priority || 'Pending Triage'}
                        </Badge>
                        <Badge variant="secondary" className="capitalize text-[10px] font-bold">
                          {request.category || 'Uncategorized'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight ml-auto flex items-center">
                          <Clock className="w-3 h-3 mr-1" /> {createdAt && isValid(createdAt) ? format(createdAt, 'PPp') : 'Recently'}
                        </span>
                      </div>
                      
                      <div className="space-y-2 text-left">
                        <div className="flex items-center gap-2 text-primary/60 font-bold text-xs uppercase tracking-wider">
                          <Building2 className="w-3 h-3" />
                          {property?.addressLine1 || 'Unknown Property'}
                        </div>
                        <h3 className="text-xl font-bold font-headline group-hover:text-primary transition-colors">{request.title || 'Maintenance Issue'}</h3>
                        <p className="text-muted-foreground leading-relaxed font-body">{request.description}</p>
                      </div>

                      {request.aiTriageNotes && (
                        <div className="bg-primary/5 border border-primary/10 rounded-xl p-4 flex gap-3 text-left">
                          <BrainCircuit className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                          <div className="flex-1">
                            <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-1">AI Recommendation Insight</p>
                            <p className="text-sm text-black font-body font-bold leading-relaxed">{request.aiTriageNotes}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="bg-muted/10 p-4 flex flex-col md:flex-row gap-3 border-t border-muted/20">
                    <Button 
                      className="w-full md:flex-1 bg-white hover:bg-primary/5 text-primary rounded-xl shadow-sm font-bold h-11 px-6 transition-all border border-primary/20"
                      onClick={() => handleTriage(request)}
                      disabled={isTriaging === request.id}
                    >
                      {isTriaging === request.id ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4 mr-2" />
                      )}
                      {isTriaging === request.id ? 'Analyzing Request...' : 'AI Triage Analysis'}
                    </Button>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" className="w-full md:flex-1 rounded-xl font-bold h-11 px-6 border-primary/20 bg-white hover:bg-primary/5 hover:text-primary transition-all">
                          Update Status
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48 rounded-xl border-none shadow-xl">
                        <DropdownMenuItem onClick={() => updateStatus(request, 'in-progress')} className="rounded-lg cursor-pointer font-medium">
                          <PlayCircle className="w-4 h-4 mr-2 text-blue-500" />
                          In Progress
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => updateStatus(request, 'completed')} className="rounded-lg cursor-pointer font-medium">
                          <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                          Completed
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </CardFooter>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
}