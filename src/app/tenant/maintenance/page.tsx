"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  setDocumentNonBlocking, 
  getTenantCollectionQuery 
} from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { 
  maintenanceTroubleshoot, 
  type MaintenanceTroubleshootOutput 
} from "@/ai/flows/maintenance-troubleshooting-flow";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription, 
  CardFooter 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Wrench, 
  Clock, 
  Plus, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ShieldAlert, 
  ChevronRight,
  Activity,
  History
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { notifyLandlordOfRequest } from "@/lib/actions/email-actions";
import { cn } from "@/lib/utils";

/**
 * @fileOverview High-Fidelity Resident Maintenance Hub.
 * Features the "Flow Shield" AI troubleshooting engine and a Real-Time Operational Ledger.
 * Optimized for professional visibility of all notified work and in-progress updates.
 */

export default function TenantMaintenancePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTroubleshooting, setIsTroubleshooting] = useState(false);
  const [troubleshootResult, setTroubleshootResult] = useState<MaintenanceTroubleshootOutput | null>(null);

  const tenantProfileQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "tenantProfiles", userId: user.uid });
  }, [db, user]);

  const { data: tenantProfiles, isLoading: isProfileLoading } = useCollection(tenantProfileQuery);
  const activeProfile = tenantProfiles?.[0];

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "maintenanceRequests", userId: user.uid });
  }, [db, user]);

  const { data: requests, isLoading: isRequestsLoading } = useCollection(requestsQuery);

  // Sorting: Work in progress first, then by date
  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    return [...requests].sort((a, b) => {
      // Completed items go to bottom
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
      // Otherwise sort by most recent
      return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    });
  }, [requests]);

  const handleTroubleshoot = async () => {
    if (!description.trim()) return;
    setIsTroubleshooting(true);
    try {
      const result = await maintenanceTroubleshoot({ issueDescription: description });
      setTroubleshootResult(result);
    } catch (error) {
      toast({ variant: "destructive", title: "Assistant error" });
    } finally {
      setIsTroubleshooting(false);
    }
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !db || !activeProfile) return;

    setIsSubmitting(true);
    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);

    const payload = {
      id: requestId,
      propertyId: activeProfile.propertyId,
      landlordId: activeProfile.landlordId,
      tenantId: user.uid,
      memberIds: activeProfile.memberIds || [user.uid, activeProfile.landlordId],
      title,
      description,
      status: 'pending',
      priority: 'routine',
      category: 'general',
      cost: 0,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setDocumentNonBlocking(requestRef, payload, { merge: true });

    try {
      await notifyLandlordOfRequest({
        landlordEmail: activeProfile.email || 'landlord@rentaflow.app',
        propertyAddress: 'Property Asset',
        title,
        description
      });
    } catch (e) {
      console.warn('Email dispatch skipped or failed.');
    }

    toast({ title: "Work Notified", description: "The maintenance record has been synchronized with management." });
    setTitle('');
    setDescription('');
    setTroubleshootResult(null);
    setIsSubmitting(false);
  };

  if (!isClient || isProfileLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary w-12 h-12 opacity-60" /></div>;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto pb-24 text-left">
      <div className="space-y-4">
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1.5 rounded-full font-bold uppercase tracking-[0.2em] text-[9px] mb-2">
           <Activity className="w-3.5 h-3.5 mr-2" /> Real-Time Operations
        </Badge>
        <h1 className="text-4xl font-headline font-bold text-foreground tracking-tight">Maintenance Hub</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70 leading-relaxed max-w-3xl">
          Report new issues with AI-driven troubleshooting or track the real-time progress of existing property repairs.
        </p>
      </div>

      {!activeProfile ? (
        <Card className="border-2 border-dashed py-32 text-center bg-card rounded-[3rem] flex flex-col items-center justify-center shadow-inner">
          <AlertCircle className="w-16 h-16 text-primary/10 mb-6" />
          <h3 className="text-2xl font-bold font-headline text-primary/40 uppercase tracking-widest">Awaiting Registry</h3>
          <p className="text-base text-muted-foreground mt-2 max-w-sm mx-auto font-medium">Once your landlord links your residency to a property, maintenance reporting will be initialized here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* 1. REPORTING SUITE */}
          <div className="lg:col-span-4 space-y-8">
            <Card className="border-none shadow-2xl h-fit rounded-[2.5rem] overflow-hidden bg-card ring-1 ring-border">
              <CardHeader className="bg-primary p-10 text-primary-foreground">
                <CardTitle className="flex items-center gap-4 text-2xl font-headline font-bold">
                  <Sparkles className="w-8 h-8 text-accent" /> 
                  Flow Shield
                </CardTitle>
                <p className="text-xs opacity-70 font-bold uppercase tracking-widest font-headline mt-1">AI-Powered Triage</p>
              </CardHeader>
              <CardContent className="p-10 space-y-8">
                {troubleshootResult ? (
                  <div className="space-y-8 animate-in zoom-in-95 duration-500">
                    <div className="bg-emerald-500/5 border border-emerald-500/10 p-8 rounded-[2rem] shadow-inner">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase mb-4 tracking-[0.2em] font-headline">Concierge Guidance</p>
                      <p className="text-sm font-bold text-foreground mb-6 leading-relaxed">{troubleshootResult.encouragement}</p>
                      <ul className="space-y-4">
                        {troubleshootResult.troubleshootingSteps.map((step, i) => (
                          <li key={i} className="flex gap-4 text-xs font-bold text-muted-foreground leading-snug">
                            <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-500" /> {step}
                          </li>
                        ))}
                      </ul>
                    </div>
                    
                    {troubleshootResult.safetyWarning && (
                      <div className="bg-red-500/5 border border-red-500/10 p-6 rounded-2xl flex gap-4 items-start shadow-inner">
                        <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
                        <div>
                          <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest font-headline">Safety Protocol</p>
                          <p className="text-xs font-bold text-red-950 dark:text-red-100 mt-1 leading-relaxed">{troubleshootResult.safetyWarning}</p>
                        </div>
                      </div>
                    )}
                    
                    <div className="flex gap-4 pt-2">
                      <Button variant="outline" className="flex-1 rounded-xl font-bold h-14 border-border text-xs uppercase tracking-widest" onClick={() => setTroubleshootResult(null)}>Recalibrate Issue</Button>
                      <Button className="flex-1 rounded-xl font-bold bg-primary text-primary-foreground shadow-2xl h-14 border-none text-xs uppercase tracking-widest" onClick={() => handleSubmit()}>Still Need Help</Button>
                    </div>
                  </div>
                ) : (
                  <form className="space-y-8">
                    <div className="space-y-3">
                      <Label className="font-bold text-[10px] uppercase tracking-[0.3em] text-muted-foreground opacity-40 font-headline">Issue Identifier</Label>
                      <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Master Bedroom Radiator Leak" className="rounded-2xl h-14 bg-muted/20 border-none font-bold text-foreground px-6 shadow-inner ring-1 ring-white/5" />
                    </div>
                    <div className="space-y-3">
                      <Label className="font-bold text-[10px] uppercase tracking-[0.3em] text-muted-foreground opacity-40 font-headline">Detailed Narrative</Label>
                      <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide full context for our maintenance team..." className="rounded-2xl min-h-[200px] bg-muted/20 border-none font-medium text-foreground leading-relaxed px-6 py-5 shadow-inner ring-1 ring-white/5" />
                    </div>
                    <div className="space-y-4 pt-4">
                      <Button type="button" className="w-full rounded-2xl h-16 bg-accent text-white font-bold shadow-2xl shadow-accent/20 transition-all hover:scale-[1.02] border-none font-headline uppercase tracking-widest text-[11px]" disabled={isTroubleshooting || !description} onClick={handleTroubleshoot}>
                        {isTroubleshooting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Sparkles className="w-5 h-5 mr-3" />}
                        Orchestrate Troubleshooting
                      </Button>
                      <Button type="button" variant="ghost" className="w-full text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] hover:bg-muted/50 h-12 rounded-xl transition-all" onClick={() => handleSubmit()} disabled={!title}>Skip & Notify Directly</Button>
                    </div>
                  </form>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 2. OPERATIONAL LEDGER */}
          <div className="lg:col-span-8 space-y-10">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-2xl font-bold font-headline flex items-center text-foreground tracking-tight">
                <History className="w-7 h-7 mr-4 text-accent" />
                Operational Ledger
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40 font-headline">Live Feed</p>
            </div>
            
            <div className="grid gap-6">
              {isRequestsLoading ? (
                <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-40">
                   <Loader2 className="w-12 h-12 animate-spin text-primary" />
                   <p className="text-[10px] font-bold uppercase tracking-[0.4em] font-headline">Synchronizing Records...</p>
                </div>
              ) : !sortedRequests || sortedRequests.length === 0 ? (
                <Card className="py-32 text-center bg-muted/5 rounded-[3rem] border-2 border-dashed border-border opacity-50 shadow-inner flex flex-col items-center justify-center">
                  <div className="p-8 bg-muted rounded-[2.5rem] mb-6"><Wrench className="w-16 h-16 text-foreground/20" /></div>
                  <p className="text-foreground font-bold font-headline uppercase tracking-[0.3em] text-xs">No maintenance records initialized</p>
                </Card>
              ) : (
                sortedRequests.map(req => (
                  <Card key={req.id} className="border-none shadow-sm group bg-card rounded-[2.5rem] overflow-hidden ring-1 ring-border transition-all hover:shadow-2xl hover:ring-accent/10">
                    <CardContent className="p-10">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                        <div className="space-y-4 flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-4">
                            <Badge className={cn(
                              "uppercase text-[10px] font-bold px-5 py-1.5 tracking-[0.2em] rounded-full border-none shadow-sm font-headline",
                              req.status === 'completed' ? 'bg-emerald-500 text-white' : 
                              req.status === 'in-progress' ? 'bg-accent text-white animate-pulse' :
                              'bg-primary/10 text-primary'
                            )}>
                              {req.status}
                            </Badge>
                            <span className="text-[11px] text-muted-foreground font-bold uppercase tracking-widest flex items-center opacity-60 font-headline">
                              <Clock className="w-4 h-4 mr-2" />
                              {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                            </span>
                          </div>
                          <h4 className="text-2xl font-bold font-headline text-foreground group-hover:text-accent transition-colors leading-tight tracking-tight truncate block">{req.title}</h4>
                          <p className="text-base text-muted-foreground leading-relaxed font-body font-medium opacity-80">{req.description}</p>
                        </div>
                        
                        <div className={cn(
                          "p-6 rounded-[2rem] shadow-inner transition-transform group-hover:scale-110 shrink-0",
                          req.status === 'completed' ? "bg-emerald-500/5 text-emerald-500" : "bg-primary/5 text-primary"
                        )}>
                          {req.status === 'completed' ? <CheckCircle2 className="w-10 h-10" /> : <Wrench className="w-10 h-10" />}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
