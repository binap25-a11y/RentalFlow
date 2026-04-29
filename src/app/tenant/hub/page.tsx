
"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, FileText, Download, AlertCircle, Wrench, ShieldAlert, Loader2 } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format } from "date-fns";

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();

  // Fetch tenant's maintenance requests
  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // Tenants view their own reported requests across the system
    const { collectionGroup } = require('firebase/firestore');
    return query(
      collectionGroup(db, "maintenanceRequests"),
      where("reportedByUserId", "==", user.uid)
    );
  }, [db, user]);

  const { data: requests, isLoading: isRequestsLoading } = useCollection(requestsQuery);
  const activeRequests = requests?.filter(r => r.status !== 'completed') || [];

  // Fetch documents assigned to this resident
  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // Filter by tenantUserProfileId as required by security rules for tenant access
    return query(
      collection(db, "documents"),
      where("tenantUserProfileId", "==", user.uid)
    );
  }, [db, user]);

  const { data: documents } = useCollection(docsQuery);

  if (isRequestsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Resident Hub</h1>
          <p className="text-muted-foreground font-medium">Welcome back to your sanctuary.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/20" asChild>
          <Link href="/tenant/maintenance">
            <AlertCircle className="w-4 h-4 mr-2" />
            Request Maintenance
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <div className="relative h-64 w-full">
            <Image 
              src="https://picsum.photos/seed/home/800/600" 
              alt="Home" 
              fill 
              className="object-cover"
              data-ai-hint="modern apartment interior"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <p className="flex items-center text-sm mb-1 opacity-90"><MapPin className="w-4 h-4 mr-1" /> Your Managed Property</p>
              <h2 className="text-2xl font-headline font-bold">Property Overview</h2>
            </div>
          </div>
          <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-bold font-headline text-lg">About Your Residence</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Welcome to your managed home. Use this portal to view active lease documents, 
                emergency guides, and manage your maintenance requests directly with your landlord.
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Active Lease</Badge>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-bold font-headline text-lg flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-red-500" />
                Emergency Contact
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-muted">
                  <div>
                    <p className="text-sm font-bold">Property Management</p>
                    <p className="text-xs text-muted-foreground">Emergency Support</p>
                  </div>
                  <Button size="icon" variant="ghost" className="rounded-full text-primary hover:bg-primary/10">
                    <Phone className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center justify-between">
                Active Requests
                <Badge className="bg-accent">{activeRequests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeRequests.length > 0 ? (
                activeRequests.map(req => (
                  <div key={req.id} className="p-4 rounded-xl bg-muted/30 border border-muted">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="capitalize text-[10px] font-bold">{req.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {req.createdAt ? format(new Date(req.createdAt), 'PP') : 'Just now'}
                      </span>
                    </div>
                    <p className="text-sm font-semibold text-primary mb-1 truncate">{req.title || req.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Wrench className="w-3 h-3 mr-1" /> {req.category}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center py-4 text-muted-foreground italic">No active requests</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-headline">Documents</CardTitle>
              <CardDescription>Your lease and building guides</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents && documents.length > 0 ? (
                documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-xl cursor-pointer group">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mr-3 group-hover:bg-blue-100">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold truncate max-w-[150px]">{doc.fileName}</p>
                        <p className="text-[10px] text-muted-foreground">Uploaded {doc.createdAt ? format(new Date(doc.createdAt), 'PP') : 'Recently'}</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">No shared documents available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
