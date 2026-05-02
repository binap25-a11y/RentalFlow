
"use client";

import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, getTenantCollectionQuery } from "@/firebase";
import { doc } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, FileText, Download, AlertCircle, Wrench, ShieldAlert, Loader2, Home } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format, isValid } from "date-fns";
import { useMemo } from "react";

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();

  const propertyQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({
      db,
      collectionName: "properties",
      userId: user.uid
    });
  }, [db, user]);

  const { data: properties, isLoading: isPropLoading } = useCollection(propertyQuery);
  const property = properties?.[0];

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({
      db,
      collectionName: "maintenanceRequests",
      userId: user.uid
    });
  }, [db, user]);

  const { data: requests, isLoading: isRequestsLoading } = useCollection(requestsQuery);
  
  const activeRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => r.status !== 'completed');
  }, [requests]);

  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({
      db,
      collectionName: "documents",
      userId: user.uid
    });
  }, [db, user]);

  const { data: documents } = useCollection(docsQuery);

  if (isPropLoading || isRequestsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Syncing your resident portal...</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-6 bg-muted rounded-full">
          <Home className="w-12 h-12 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-bold font-headline">Welcome to RentalFlow</h2>
        <p className="text-muted-foreground max-w-md">
          It looks like you haven't been assigned to a property yet. 
          Please contact your landlord to link your account.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="text-left">
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Resident Hub</h1>
          <p className="text-muted-foreground font-medium">Welcome home.</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/20 text-white" asChild>
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
              src={property.imageUrl || "https://picsum.photos/seed/home/800/600"} 
              alt={property.addressLine1} 
              fill 
              className="object-cover"
              data-ai-hint="modern apartment interior"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white text-left">
              <p className="flex items-center text-sm mb-1 opacity-90"><MapPin className="w-4 h-4 mr-1" /> {property.addressLine1}</p>
              <h2 className="text-2xl font-headline font-bold">{property.zipCode}</h2>
            </div>
          </div>
          <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4 text-left">
              <h3 className="font-bold font-headline text-lg">About Your Residence</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {property.description}
              </p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="bg-primary/10 text-primary border-none">Active Lease</Badge>
                <Badge variant="outline" className="border-primary/20">£{property.rentAmount}/mo</Badge>
              </div>
            </div>
            <div className="space-y-4 text-left">
              <h3 className="font-bold font-headline text-lg flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-red-500" />
                Management Contact
              </h3>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-muted">
                  <div className="text-left">
                    <p className="text-sm font-bold">24/7 Maintenance</p>
                    <p className="text-[10px] text-muted-foreground uppercase font-bold">Emergency Support</p>
                  </div>
                  <Button size="icon" variant="ghost" className="rounded-full text-primary hover:bg-primary/10" asChild>
                    <a href="tel:0800000000">
                      <Phone className="w-4 h-4" />
                    </a>
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader className="text-left">
              <CardTitle className="text-xl font-headline flex items-center justify-between">
                Active Requests
                <Badge className="bg-accent text-white">{activeRequests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeRequests.length > 0 ? (
                activeRequests.map(req => {
                  const createdAt = req.createdAt ? new Date(req.createdAt.seconds * 1000) : null;
                  return (
                    <div key={req.id} className="p-4 rounded-xl bg-muted/30 border border-muted text-left">
                      <div className="flex items-center justify-between mb-2">
                        <Badge variant="outline" className="capitalize text-[10px] font-bold border-primary/20">
                          {req.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {createdAt && isValid(createdAt) ? format(createdAt, 'PP') : 'Just now'}
                        </span>
                      </div>
                      <p className="text-sm font-semibold text-primary mb-1 truncate">{req.title || req.description}</p>
                      <div className="flex items-center text-xs text-muted-foreground">
                        <Wrench className="w-3 h-3 mr-1" /> {req.category}
                      </div>
                    </div>
                  );
                })
              ) : (
                <p className="text-sm text-center py-4 text-muted-foreground italic">No active requests</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader className="text-left">
              <CardTitle className="text-xl font-headline">Vault</CardTitle>
              <CardDescription>Your lease and building guides</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {documents && documents.length > 0 ? (
                documents.slice(0, 3).map(doc => {
                  const uploadDate = doc.uploadDate ? new Date(doc.uploadDate) : null;
                  return (
                    <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-xl cursor-pointer group">
                      <div className="flex items-center">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mr-3 group-hover:bg-blue-100">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm font-bold truncate max-w-[150px]">{doc.fileName}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {uploadDate && isValid(uploadDate) ? format(uploadDate, 'PP') : 'Recently'}
                          </p>
                        </div>
                      </div>
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                        <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </a>
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">No documents shared yet.</p>
              )}
              {documents && documents.length > 3 && (
                <Button variant="ghost" className="w-full text-xs text-primary font-bold" asChild>
                  <Link href="/tenant/documents">View All Documents</Link>
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
