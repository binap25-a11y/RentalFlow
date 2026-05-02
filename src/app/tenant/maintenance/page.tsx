
"use client";

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, getTenantCollectionQuery } from "@/firebase";
import { doc, serverTimestamp, collection } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, Plus, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function TenantMaintenancePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const tenantProfileQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({
      db,
      collectionName: "tenantProfiles",
      userId: user.uid
    });
  }, [db, user]);

  const { data: tenantProfiles, isLoading: isProfileLoading } = useCollection(tenantProfileQuery);
  const activeProfile = tenantProfiles?.[0];

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({
      db,
      collectionName: "maintenanceRequests",
      userId: user.uid
    });
  }, [db, user]);

  const { data: requests, isLoading: isRequestsLoading } = useCollection(requestsQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !activeProfile) {
      toast({
        variant: "destructive",
        title: "Assignment Required",
        description: "You must be assigned to a property to submit requests."
      });
      return;
    }

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
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    setTimeout(() => {
      setIsSubmitting(false);
      setTitle('');
      setDescription('');
      toast({ title: "Request Submitted", description: "Maintenance has been logged with your landlord." });
    }, 800);
  };

  if (isProfileLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Maintenance Hub</h1>
        <p className="text-muted-foreground font-medium">Report issues and track their resolution status.</p>
      </div>

      {!activeProfile ? (
        <Card className="border-2 border-dashed py-12 text-center bg-amber-50/30">
          <div className="p-4 bg-amber-100 rounded-full w-fit mx-auto mb-4 text-amber-600">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold">Awaiting Property Link</h3>
          <p className="text-muted-foreground max-sm mx-auto">
            You are not currently linked to a property. Please contact your landlord to enable maintenance reporting.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <Card className="lg:col-span-1 border-none shadow-sm h-fit">
            <CardHeader>
              <CardTitle>Submit New Request</CardTitle>
              <CardDescription>Reporting for property {activeProfile.propertyId.slice(0, 8)}...</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Issue Title</Label>
                  <Input 
                    id="title" 
                    value={title} 
                    onChange={(e) => setTitle(e.target.value)} 
                    placeholder="e.g., Leaking Kitchen Sink" 
                    required 
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea 
                    id="desc" 
                    value={description} 
                    onChange={(e) => setDescription(e.target.value)} 
                    placeholder="Tell us more about the problem..." 
                    className="min-h-[120px]"
                    required 
                  />
                </div>
                <Button type="submit" className="w-full rounded-xl bg-accent hover:bg-accent/90 shadow-lg shadow-accent/20" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                  Submit Request
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="lg:col-span-2 space-y-6">
            <h3 className="text-xl font-bold font-headline flex items-center">
              <Clock className="w-5 h-5 mr-2 text-primary" />
              Request History
            </h3>
            
            <div className="grid gap-4">
              {isRequestsLoading ? (
                <div className="flex justify-center py-20"><Loader2 className="animate-spin" /></div>
              ) : !requests || requests.length === 0 ? (
                <div className="py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed">
                  <p className="text-muted-foreground">You haven't submitted any maintenance requests yet.</p>
                </div>
              ) : (
                requests.slice().sort((a, b) => {
                  const dateA = a.createdAt ? (a.createdAt.seconds || 0) : 0;
                  const dateB = b.createdAt ? (b.createdAt.seconds || 0) : 0;
                  return dateB - dateA;
                }).map(req => (
                  <Card key={req.id} className="border-none shadow-sm group">
                    <CardContent className="p-6">
                      <div className="flex justify-between items-start mb-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={req.status === 'completed' ? 'secondary' : 'default'} className="uppercase text-[10px] font-bold">
                              {req.status}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight">
                              {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'PPp') : 'Just now'}
                            </span>
                          </div>
                          <h4 className="text-lg font-bold font-headline group-hover:text-primary transition-colors">{req.title}</h4>
                        </div>
                        <div className={`p-2 rounded-xl ${req.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
                          {req.status === 'completed' ? <CheckCircle2 className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">{req.description}</p>
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
