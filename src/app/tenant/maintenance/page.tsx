
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

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user || !db || !activeProfile) return;

    setIsSubmitting(true);
    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);

    setDocumentNonBlocking(requestRef, {
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
    }, { merge: true });

    toast({ title: "Request Submitted", description: "Your landlord has been notified." });
    setTitle('');
    setDescription('');
    setTroubleshootResult(null);
    setIsSubmitting(false);
  };

  if (isProfileLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-left">
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Maintenance Hub</h1>
        <p className="text-muted-foreground font-medium">Professional reporting and automated troubleshooting assistance.</p>
      </div>

      {!activeProfile ? (
        <Card className="border-2 border-dashed py-12 text-center bg-amber-50/30">
          <AlertCircle className="w-12 h-12 mx-auto text-amber-500 mb-4" />
          <h3 className="text-lg font-bold">Awaiting Property Link</h3>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm h-fit text-left">
            <CardHeader className="bg-primary text-white rounded-t-2xl">
              <CardTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5" /> Maintenance Shield</CardTitle>
              <CardDescription className="text-white/70">Let Flow Assistant help you troubleshoot before reporting.</CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {troubleshootResult ? (
                <div className="space-y-6 animate-in zoom-in-95">
                  <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-2xl">
                    <p className="text-xs font-bold text-emerald-700 uppercase mb-2">Flow Assistant Suggestion</p>
                    <p className="text-sm font-bold text-black mb-4">{troubleshootResult.encouragement}</p>
                    <ul className="space-y-2">
                      {troubleshootResult.troubleshootingSteps.map((step, i) => (
                        <li key={i} className="flex gap-2 text-xs font-medium text-emerald-800">
                          <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" /> {step}
                        </li>
                      ))}
                    </ul>
                  </div>
                  {troubleshootResult.safetyWarning && (
                    <div className="bg-red-50 border border-red-100 p-4 rounded-2xl flex gap-3">
                      <ShieldAlert className="w-5 h-5 text-red-600 shrink-0" />
                      <div>
                        <p className="text-[10px] font-bold text-red-700 uppercase">Safety Warning</p>
                        <p className="text-xs font-bold text-red-900">{troubleshootResult.safetyWarning}</p>
                      </div>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 rounded-xl font-bold" onClick={() => setTroubleshootResult(null)}>Try Again</Button>
                    <Button className="flex-1 rounded-xl font-bold bg-primary text-white" onClick={() => handleSubmit()}>Still Need Help</Button>
                  </div>
                </div>
              ) : (
                <form className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-primary/60">Issue Title</Label>
                    <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Boiler low pressure" className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase tracking-widest text-primary/60">Description</Label>
                    <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Tell us what's happening..." className="rounded-xl min-h-[120px]" />
                  </div>
                  <Button type="button" className="w-full rounded-xl h-12 bg-accent text-white font-bold" disabled={isTroubleshooting || !description} onClick={handleTroubleshoot}>
                    {isTroubleshooting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Sparkles className="w-4 h-4 mr-2" />}
                    Troubleshoot with AI
                  </Button>
                  <Button type="button" variant="ghost" className="w-full text-xs font-bold text-muted-foreground" onClick={() => handleSubmit()} disabled={!title}>Skip and Report Directly</Button>
                </form>
              )}
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6 text-left">
            <h3 className="text-xl font-bold font-headline flex items-center">
              <Clock className="w-5 h-5 mr-2 text-primary" />
              Request History
            </h3>
            <div className="grid gap-4">
              {isRequestsLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
              ) : !requests || requests.length === 0 ? (
                <div className="py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed">
                  <p className="text-muted-foreground font-bold">No requests found.</p>
                </div>
              ) : (
                requests.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(req => (
                  <Card key={req.id} className="border-none shadow-sm group bg-white rounded-2xl overflow-hidden">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={req.status === 'completed' ? 'secondary' : 'default'} className="uppercase text-[10px] font-bold">
                              {req.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground font-bold">
                              {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold font-headline group-hover:text-primary transition-colors">{req.title}</h4>
                        </div>
                        <div className={`p-2 rounded-xl ${req.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                          {req.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed font-body">{req.description}</p>
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
