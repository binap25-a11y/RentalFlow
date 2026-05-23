"use client";

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, getTenantCollectionQuery } from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { maintenanceTroubleshoot, type MaintenanceTroubleshootOutput } from "@/ai/flows/maintenance-troubleshooting-flow";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, Plus, Loader2, CheckCircle2, AlertCircle, Sparkles, ShieldAlert, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { notifyLandlordOfRequest } from "@/lib/actions/email-actions";

export default function TenantMaintenancePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

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

  const propertyQuery = useMemoFirebase(() => {
    if (!db || !activeProfile?.propertyId) return null;
    return doc(db, 'properties', activeProfile.propertyId);
  }, [db, activeProfile]);
  // Note: For email address of landlord, we rely on the system mapping 
  // or fetch it from the user profiles. For this prototype, we notify the tenantId mapping.

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

    // Background Email Notification
    try {
      // Landlord email typically matches their identity or a designated ops email.
      // In a real environment, we'd fetch this from the /users/ collection.
      // For the prototype, we trigger the notification using a placeholder if needed.
      await notifyLandlordOfRequest({
        landlordEmail: activeProfile.email || 'landlord@rentaflow.app',
        propertyAddress: 'Property Asset', // This would ideally be the real address
        title,
        description
      });
    } catch (e) {
      console.warn('Email dispatch skipped or failed.');
    }

    toast({ title: "Request Submitted", description: "Your landlord has been notified." });
    setTitle('');
    setDescription('');
    setTroubleshootResult(null);
    setIsSubmitting(false);
  };

  if (isProfileLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12">
      <div className="text-left">
        <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Maintenance Hub</h1>
        <p className="text-muted-foreground font-medium font-body">Professional reporting and automated troubleshooting assistance.</p>
      </div>

      {!activeProfile ? (
        <Card className="border-2 border-dashed py-24 text-center bg-card rounded-[2.5rem] flex flex-col items-center justify-center">
          <AlertCircle className="w-12 h-12 text-primary/10 mb-4" />
          <h3 className="text-xl font-bold font-headline text-primary/40">Awaiting Property Assignment</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">Once your landlord links your profile to a property, you can report issues here.</p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm h-fit text-left rounded-[2rem] overflow-hidden bg-card">
            <CardHeader className="bg-primary text-white p-8">
              <CardTitle className="flex items-center gap-3 text-2xl font-headline font-bold">
                <Sparkles className="w-6 h-6 text-accent" /> 
                Flow Shield
              </CardTitle>
              <CardDescription className="text-white/70 font-medium">Automated troubleshooting before reporting.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {troubleshootResult ? (
                <div className="space-y-6 animate-in zoom-in-95 duration-500">
                  <div className="bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-100 dark:border-emerald-900/20 p-6 rounded-2xl">
                    <p className="text-[10px] font-bold text-emerald-700 uppercase mb-3 tracking-widest font-headline">Assistant Guidance</p>
                    <p className="text-sm font-bold text-emerald-950 dark:text-emerald-50 mb-4 leading-relaxed">{troubleshootResult.encouragement}</p>
                    <ul className="space-y-3">
                      {troubleshootResult.troubleshootingSteps.map((step, i) => (
                        <li key={i} className="flex gap-3 text-xs font-bold text-emerald-800 dark:text-emerald-200">
                          <ChevronRight className="w-4 h-4 shrink-0 text-emerald-500" /> {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {troubleshootResult.safetyWarning && (
                    <div className="bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20 p-6 rounded-2xl flex gap-4">
                      <ShieldAlert className="w-6 h-6 text-red-600 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-red-700 uppercase tracking-widest font-headline">Safety Protocol</p>
                        <p className="text-xs font-bold text-red-950 dark:text-red-100 mt-1">{troubleshootResult.safetyWarning}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <Button variant="outline" className="flex-1 rounded-xl font-bold h-12" onClick={() => setTroubleshootResult(null)}>Try Again</Button>
                    <Button className="flex-1 rounded-xl font-bold bg-primary text-white shadow-xl shadow-primary/20 h-12" onClick={() => handleSubmit()}>Still Need Help</Button>
                  </div>
                </div>
              ) : (
                <form className="space-y-6">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-primary/40 font-headline">Issue Label</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Kitchen tap leak" className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-primary/40 font-headline">Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the problem in detail..." className="rounded-xl min-h-[150px] bg-muted/20 border-none font-medium" />
                  </div>
                  <div className="space-y-3 pt-2">
                    <Button type="button" className="w-full rounded-xl h-12 bg-accent text-white font-bold shadow-xl shadow-accent/20 hover:scale-[1.02] transition-all" disabled={isTroubleshooting || !description} onClick={handleTroubleshoot}>
                      {isTroubleshooting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                      Troubleshoot with AI
                    </Button>
                    <Button type="button" variant="ghost" className="w-full text-[10px] font-bold text-muted-foreground uppercase tracking-widest hover:bg-muted/50" onClick={() => handleSubmit()} disabled={!title}>Skip & Report Directly</Button>
                  </div>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6 text-left">
            <h3 className="text-xl font-bold font-headline flex items-center text-primary tracking-tight">
              <Clock className="w-5 h-5 mr-3 text-accent" />
              Operational History
            </h3>
            <div className="grid gap-4">
              {isRequestsLoading ? (
                <div className="flex justify-center py-24"><Loader2 className="animate-spin text-primary" /></div>
              ) : !requests || requests.length === 0 ? (
                <div className="py-24 text-center bg-card rounded-[2.5rem] border-2 border-dashed border-primary/5">
                  <Wrench className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                  <p className="text-muted-foreground font-bold font-headline uppercase tracking-widest text-[10px]">No active requests on record</p>
                </div>
              ) : (
                requests.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(req => (
                  <Card key={req.id} className="border-none shadow-sm group bg-card rounded-2xl overflow-hidden border border-transparent hover:border-primary/5 transition-all">
                    <CardContent className="p-8">
                      <div className="flex flex-col md:flex-row justify-between items-start gap-4 mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-3">
                            <Badge className={cn(
                              "uppercase text-[9px] font-bold px-3 py-1 tracking-widest",
                              req.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-blue-100 text-blue-700'
                            )}>
                              {req.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest flex items-center">
                              <Clock className="w-3 h-3 mr-1 opacity-40" />
                              {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                            </span>
                          </div>
                          <h4 className="text-xl font-bold font-headline text-foreground group-hover:text-primary transition-colors leading-tight mt-2">{req.title}</h4>
                        </div>
                        <div className={cn(
                          "p-4 rounded-2xl shadow-inner",
                          req.status === 'completed' ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600' : 'bg-blue-50 dark:bg-blue-900/10 text-blue-600'
                        )}>
                          {req.status === 'completed' ? <CheckCircle2 className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed font-body font-medium">{req.description}</p>
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
