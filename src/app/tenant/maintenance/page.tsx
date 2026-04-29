
"use client";

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking } from "@/firebase";
import { collection, doc, serverTimestamp, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Wrench, Clock, AlertCircle, Plus, Loader2, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

export default function TenantMaintenancePage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Find the tenant's property assignment
  const assignmentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "tenants"), // Using a denormalized top-level collection if exists, otherwise search profiles
      where("userProfileId", "==", user.uid)
    );
  }, [db, user]);

  // For the prototype, we assume the tenant knows their property ID or we fetch it from their profile
  // Let's assume the user profile has the property information
  const userProfileQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile } = useCollection(useMemoFirebase(() => {
    // This is a simplified search for the resident's property in the prototype
    if (!db || !user) return null;
    return collectionGroup(db, "tenants");
  }, [db, user]));

  // In a real scenario, we'd have the tenant's propertyId in their profile
  // For this prototype, we'll allow them to submit to "Current Residence"
  const propertyId = "simulated-property-id";
  const landlordId = "simulated-landlord-id";

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collectionGroup(db, "maintenanceRequests"),
      where("reportedByUserId", "==", user.uid)
    );
  }, [db, user]);

  const { data: requests, isLoading } = useCollection(requestsQuery);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    setIsSubmitting(true);
    const requestId = doc(collection(db, 'dummy')).id;
    
    // We'd ideally have real IDs here. In the prototype, we use path variables
    const requestRef = doc(db, 'users', landlordId, 'properties', propertyId, 'maintenanceRequests', requestId);

    setDocumentNonBlocking(requestRef, {
      id: requestId,
      propertyId,
      landlordId, // Added for easy filtering
      reportedByUserId: user.uid,
      title,
      description,
      status: 'pending',
      priority: 'routine', // Default, triage will update
      category: 'general',
      submittedAt: new Date().toISOString(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    setTimeout(() => {
      setIsSubmitting(false);
      setTitle('');
      setDescription('');
      toast({ title: "Request Submitted", description: "Your maintenance request has been logged and sent to your landlord." });
    }, 800);
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Maintenance Hub</h1>
        <p className="text-muted-foreground font-medium">Report issues and track their resolution status.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-1 border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle>Submit New Request</CardTitle>
            <CardDescription>Provide details about the issue you're experiencing.</CardDescription>
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
              <Button type="submit" className="w-full rounded-xl bg-accent hover:bg-accent/90" disabled={isSubmitting}>
                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                Submit Request
              </Button>
            </form>
          </CardContent>
        </Card>

        <div className="lg:col-span-2 space-y-6">
          <h3 className="text-xl font-bold font-headline flex items-center">
            <Clock className="w-5 h-5 mr-2 text-primary" />
            Your Request History
          </h3>
          
          <div className="grid gap-4">
            {!requests || requests.length === 0 ? (
              <div className="py-20 text-center bg-muted/20 rounded-2xl border-2 border-dashed">
                <p className="text-muted-foreground">You haven't submitted any maintenance requests yet.</p>
              </div>
            ) : (
              requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(req => (
                <Card key={req.id} className="border-none shadow-sm group">
                  <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant={req.status === 'completed' ? 'secondary' : 'default'} className="uppercase text-[10px]">
                            {req.status}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {req.createdAt ? format(new Date(req.createdAt), 'PPp') : 'Just now'}
                          </span>
                        </div>
                        <h4 className="text-lg font-bold font-headline group-hover:text-primary transition-colors">{req.title}</h4>
                      </div>
                      <div className={`p-2 rounded-lg ${req.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600'}`}>
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
    </div>
  );
}

// Ensure collectionGroup is imported correctly
import { collectionGroup } from 'firebase/firestore';
