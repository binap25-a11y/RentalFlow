
"use client";

import { useState } from 'react';
import { triageMaintenanceRequest } from "@/ai/flows/maintenance-request-triage";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking, getLandlordCollectionQuery } from "@/firebase";
import { doc, serverTimestamp } from "firebase/firestore";
import { Wrench, Sparkles, Clock, Filter, BrainCircuit, Loader2, CheckCircle2, PlayCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function MaintenancePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isTriaging, setIsTriaging] = useState<string | null>(null);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "maintenanceRequests", user.uid);
  }, [db, user]);

  const { data: requests, isLoading } = useCollection(maintenanceQuery);

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
      
      toast({
        title: "AI Triage Complete",
        description: `Suggested priority: ${result.priority}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Triage failed",
        description: "Could not analyze request at this time.",
      });
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

  if (isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Maintenance Management</h1>
          <p className="text-muted-foreground font-medium">Review, prioritize and assign maintenance tasks.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {!requests || requests.length === 0 ? (
          <Card className="border-dashed border-2 py-20 flex flex-col items-center justify-center text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Wrench className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">No active requests</h3>
            <p className="text-sm text-muted-foreground max-w-xs">Maintenance requests submitted by your residents will appear here.</p>
          </Card>
        ) : (
          requests
            .slice()
            .sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            })
            .map((request) => {
              const createdAt = request.createdAt ? new Date(request.createdAt) : null;
              return (
                <Card key={request.id} className="border-none shadow-sm overflow-hidden group">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
                    <div className="p-6 md:col-span-3 space-y-4">
                      <div className="flex flex-wrap items-center gap-3">
                        <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary/60 border-primary/20">
                          {request.status || 'Pending'}
                        </Badge>
                        <Badge className={`capitalize font-bold border ${getPriorityColor(request.priority)}`}>
                          {request.priority || 'Pending Triage'}
                        </Badge>
                        <Badge variant="secondary" className="capitalize text-[10px] font-bold">
                          {request.category || 'Uncategorized'}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-tight ml-auto">
                          <Clock className="w-3 h-3 mr-1" /> {createdAt && isValid(createdAt) ? format(createdAt, 'PPp') : 'Just now'}
                        </span>
                      </div>
                      
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold font-headline group-hover:text-primary transition-colors">{request.title || 'Maintenance Issue'}</h3>
                        <p className="text-muted-foreground leading-relaxed">{request.description}</p>
                      </div>

                      {request.aiTriageNotes && (
                        <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex gap-3">
                          <BrainCircuit className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                          <div>
                            <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-1">AI Recommendation Insight</p>
                            <p className="text-sm text-accent-foreground/80 italic">{request.aiTriageNotes}</p>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="bg-muted/30 p-6 flex flex-col justify-center gap-3 border-l border-muted/50">
                      <Button 
                        className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/10 font-bold h-11"
                        onClick={() => handleTriage(request)}
                        disabled={isTriaging === request.id}
                      >
                        {isTriaging === request.id ? (
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                          <Sparkles className="w-4 h-4 mr-2" />
                        )}
                        {isTriaging === request.id ? 'Analyzing...' : 'Auto-Triage'}
                      </Button>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" className="w-full rounded-xl font-bold h-11 border-primary/10">
                            Update Status
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48 rounded-xl">
                          <DropdownMenuItem onClick={() => updateStatus(request, 'in-progress')}>
                            <PlayCircle className="w-4 h-4 mr-2 text-blue-500" />
                            Mark In Progress
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => updateStatus(request, 'completed')}>
                            <CheckCircle2 className="w-4 h-4 mr-2 text-green-500" />
                            Mark Completed
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </Card>
              );
            })
        )}
      </div>
    </div>
  );
}
