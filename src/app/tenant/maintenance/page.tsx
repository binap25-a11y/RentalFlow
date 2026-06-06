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
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  ShieldAlert, 
  History,
  CalendarDays,
  HardHat,
  Activity
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format, isValid } from "date-fns";
import { notifyLandlordOfRequest } from "@/lib/actions/email-actions";
import { cn } from "@/lib/utils";

/**
 * @fileOverview High-Fidelity Resident Maintenance Hub.
 * Refined with smaller, professional-grade standardized buttons.
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

  const sortedRequests = useMemo(() => {
    if (!requests) return [];
    return [...requests].sort((a, b) => {
      if (a.status === 'completed' && b.status !== 'completed') return 1;
      if (a.status !== 'completed' && b.status === 'completed') return -1;
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
    if (!user || !db || !activeProfile || !title) return;

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
        landlordEmail: 'management@rentalflow.app',
        propertyAddress: 'Property Asset',
        title,
        description
      });
    } catch (e) {}

    toast({ title: "Work Notified" });
    setTitle('');
    setDescription('');
    setTroubleshootResult(null);
    setIsSubmitting(false);
  };

  if (!isClient || isProfileLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary w-12 h-12 opacity-60" /></div>;

  return (
    <div className="space-y-16 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-6xl mx-auto pb-32 text-left bg-background">
      <div className="space-y-4">
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1.5 rounded-full font-bold uppercase tracking-[0.25em] text-[10px] mb-2">
           <Activity className="w-4 h-4 mr-2" /> Real-Time Operations Hub
        </Badge>
        <h1 className="text-4xl md:text-6xl font-headline font-bold text-foreground tracking-tighter">Maintenance Command</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70 leading-relaxed max-w-3xl">
          Dispatch requests with hardware-accelerated AI triage and track the real-time progress of your portfolio assets.
        </p>
      </div>

      {!activeProfile ? (
        <Card className="border-2 border-dashed py-32 text-center bg-card rounded-[3.5rem] flex flex-col items-center justify-center shadow-inner ring-1 ring-border/10">
          <AlertCircle className="w-20 h-20 text-primary opacity-5 mb-8 animate-pulse" />
          <h3 className="text-2xl font-bold font-headline text-primary/40 uppercase tracking-[0.3em]">Awaiting Registry Verification</h3>
          <p className="text-lg text-muted-foreground mt-4 max-w-sm mx-auto font-medium leading-relaxed">Link your residency with management to begin official maintenance reporting.</p>
        </Card>
      ) : (
        <div className="space-y-24">
          {/* FLOW SHIELD: AI DIAGNOSTIC PANEL */}
          <section className="space-y-10">
            <div className="flex items-center justify-between px-4">
               <h3 className="text-2xl font-bold font-headline flex items-center text-foreground tracking-tight">
                 <Sparkles className="w-8 h-8 mr-4 text-accent" />
                 Diagnostic Command
               </h3>
               <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40 font-headline">AI-Powered Safety Triage</p>
            </div>
            
            <Card className="border-none shadow-2xl rounded-[3.5rem] overflow-hidden bg-card ring-1 ring-border">
              <div className="bg-primary p-10 text-primary-foreground flex flex-col md:flex-row items-center gap-8 border-b border-white/10 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-10 opacity-5"><Sparkles className="w-48 h-48" /></div>
                <div className="p-4 bg-white/10 rounded-2xl shadow-inner shrink-0 backdrop-blur-xl">
                  <Sparkles className="w-10 h-10 text-accent" />
                </div>
                <div className="space-y-1 text-left relative z-10">
                  <h4 className="text-2xl font-headline font-bold tracking-tight leading-none">AI Maintenance Assistant</h4>
                  <p className="text-sm opacity-70 leading-relaxed font-medium max-w-xl">Orchestrate safe, professional troubleshooting steps before notifying management to ensure high-fidelity residency performance.</p>
                </div>
              </div>
              
              <div className="p-12 bg-card min-w-0">
                   {troubleshootResult ? (
                    <div className="space-y-10 animate-in zoom-in-95 duration-700 text-left">
                      <div className="bg-emerald-500/5 border border-emerald-500/10 p-12 rounded-[3rem] shadow-inner">
                        <div className="flex items-center gap-4 mb-8">
                           <Badge className="bg-emerald-500 text-white border-none text-[10px] font-bold uppercase tracking-[0.2em] px-5 py-2 rounded-full font-headline">Verified Strategy</Badge>
                        </div>
                        <p className="text-2xl font-bold text-foreground mb-10 leading-[0.95] tracking-tight">{troubleshootResult.encouragement}</p>
                        <div className="space-y-8">
                          {troubleshootResult.troubleshootingSteps.map((step, i) => (
                            <div key={i} className="flex gap-6 items-start">
                              <div className="p-3 bg-emerald-500/10 rounded-full shrink-0 border border-emerald-500/20 shadow-sm">
                                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                              </div>
                              <p className="text-lg font-bold text-muted-foreground leading-relaxed">
                                {step}
                              </p>
                            </div>
                          ))}
                        </div>
                        {troubleshootResult.safetyWarning && (
                          <div className="mt-12 p-8 bg-red-500/5 rounded-3xl border border-red-500/10 flex items-start gap-6 shadow-inner">
                             <ShieldAlert className="w-8 h-8 text-red-600 shrink-0 mt-1" />
                             <p className="text-base font-bold text-red-900/80 leading-relaxed">{troubleshootResult.safetyWarning}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <Button className="h-14 rounded-2xl font-bold bg-primary text-primary-foreground shadow-2xl px-12 border-none font-headline uppercase tracking-[0.2em] text-[11px] hover:scale-[1.01] transition-transform active:scale-95" onClick={() => handleSubmit()}>Notify Management</Button>
                        <Button variant="ghost" className="h-14 rounded-2xl font-bold px-10 text-muted-foreground hover:bg-muted font-headline uppercase tracking-[0.2em] text-[10px]" onClick={() => setTroubleshootResult(null)}>Recalibrate Diagnostic</Button>
                      </div>
                    </div>
                  ) : (
                    <form className="space-y-10 text-left" onSubmit={(e) => e.preventDefault()}>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                        <div className="space-y-3">
                          <Label className="font-bold text-[11px] uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Fault Identifier</Label>
                          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Master bathroom fault" className="rounded-xl h-12 bg-muted/30 border-none font-bold text-foreground px-6 shadow-inner ring-1 ring-white/10 text-base" />
                        </div>
                        <div className="space-y-3">
                           <Label className="font-bold text-[11px] uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Residency Synchronization</Label>
                           <div className="h-12 bg-primary/5 rounded-xl border border-dashed border-primary/20 flex items-center px-6 gap-4">
                              <div className="w-2.5 h-2.5 rounded-full bg-accent animate-pulse" />
                              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/60 font-headline">Awaiting Ledger Context</span>
                           </div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <Label className="font-bold text-[11px] uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Detailed Narrative</Label>
                        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Provide full context for the AI engine..." className="rounded-[2rem] min-h-[180px] bg-muted/30 border-none font-medium text-foreground leading-relaxed px-6 py-6 shadow-inner ring-1 ring-white/10 text-base" />
                      </div>
                      <div className="flex flex-col sm:flex-row gap-4 pt-4">
                        <Button type="button" className="rounded-2xl h-14 bg-accent text-white font-bold shadow-2xl shadow-accent/20 transition-all hover:scale-[1.01] active:scale-95 border-none font-headline uppercase tracking-[0.2em] text-[11px] px-12" disabled={isTroubleshooting || !description} onClick={handleTroubleshoot}>
                          {isTroubleshooting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Sparkles className="w-5 h-5 mr-3" />}
                          Orchestrate AI Diagnostic
                        </Button>
                        <Button type="button" variant="ghost" className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] hover:bg-muted/50 h-14 rounded-2xl transition-all px-10 font-headline" onClick={() => handleSubmit()} disabled={!title}>Skip & Direct Notify</Button>
                      </div>
                    </form>
                  )}
                </div>
            </Card>
          </section>

          {/* OPERATIONAL LEDGER: AUDIT TRAIL */}
          <section className="space-y-10">
            <div className="flex items-center justify-between px-4">
              <h3 className="text-2xl font-bold font-headline flex items-center text-foreground tracking-tight">
                <History className="w-8 h-8 mr-4 text-accent" />
                Operational Ledger
              </h3>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40 font-headline hidden sm:block">Verified Audit Trail</p>
            </div>
            
            <div className="grid grid-cols-1 gap-8">
              {isRequestsLoading ? (
                <div className="flex flex-col items-center justify-center py-40 gap-6 opacity-40">
                   <Loader2 className="w-16 h-16 animate-spin text-primary" />
                   <p className="text-[11px] font-bold uppercase tracking-[0.5em] text-muted-foreground font-headline">Synchronizing Records Vault...</p>
                </div>
              ) : !sortedRequests || sortedRequests.length === 0 ? (
                <Card className="py-40 text-center bg-muted/5 rounded-[4rem] border-2 border-dashed border-border opacity-50 shadow-inner flex flex-col items-center justify-center">
                  <div className="p-10 bg-muted rounded-[3rem] mb-8"><Wrench className="w-20 h-20 text-foreground/10" /></div>
                  <p className="text-foreground font-bold font-headline uppercase tracking-[0.4em] text-sm">No maintenance records initialized</p>
                </Card>
              ) : (
                sortedRequests.map(req => {
                  const scheduledDate = req.scheduledDate ? new Date(req.scheduledDate) : null;
                  return (
                    <Card key={req.id} className="border-none shadow-sm group bg-card rounded-[3rem] overflow-hidden ring-1 ring-border transition-all hover:shadow-2xl hover:ring-accent/20">
                      <CardContent className="p-10">
                        <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                          <div className="space-y-6 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-3">
                              <Badge className={cn(
                                "uppercase text-[9px] font-bold px-5 py-1.5 tracking-[0.2em] rounded-full border-none shadow-md font-headline",
                                req.status === 'completed' ? 'bg-emerald-500 text-white' : 
                                req.status === 'in-progress' ? 'bg-accent text-white animate-pulse' :
                                'bg-primary/10 text-primary'
                              )}>
                                {req.status}
                              </Badge>
                              <Badge variant="outline" className={cn(
                                "uppercase text-[9px] font-bold border-border font-headline tracking-[0.2em] px-5 py-1.5 rounded-full shadow-sm",
                                req.priority === 'critical' ? 'border-red-500/50 text-red-600 bg-red-500/5 font-extrabold' : 'text-muted-foreground opacity-60'
                              )}>
                                {req.priority}
                              </Badge>
                            </div>
                            
                            <div className="space-y-2 text-left">
                              <h4 className="text-2xl font-bold font-headline text-foreground group-hover:text-accent transition-colors leading-[0.95] tracking-tighter block truncate w-full">{req.title}</h4>
                              <p className="text-base text-muted-foreground leading-relaxed font-body font-medium opacity-80 whitespace-normal break-words max-w-4xl">{req.description}</p>
                            </div>

                            <div className="flex flex-wrap gap-8 pt-8 border-t border-border/50">
                               <div className="flex items-center gap-3">
                                  <Clock className="w-4 h-4 text-muted-foreground opacity-40" />
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] font-headline">
                                    Notified: {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'p') : 'Just now'}
                                  </span>
                               </div>
                               {scheduledDate && isValid(scheduledDate) && (
                                 <div className="flex items-center gap-3 text-accent">
                                    <CalendarDays className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-headline">
                                      Target: {format(scheduledDate, 'PPP')}
                                    </span>
                                 </div>
                               )}
                               {req.assignedContractorId && (
                                 <div className="flex items-center gap-3 text-emerald-600">
                                    <HardHat className="w-4 h-4" />
                                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] font-headline">
                                      Trade Dispatched
                                    </span>
                                 </div>
                               )}
                            </div>
                          </div>
                          
                          <div className={cn(
                            "p-8 rounded-[2.5rem] shadow-inner transition-transform group-hover:scale-110 shrink-0 border border-transparent",
                            req.status === 'completed' ? "bg-emerald-500/5 text-emerald-500 border-emerald-500/10" : "bg-primary/5 text-primary border-primary/10"
                          )}>
                            {req.status === 'completed' ? <CheckCircle2 className="w-12 h-12" /> : <Wrench className="w-12 h-12" />}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
