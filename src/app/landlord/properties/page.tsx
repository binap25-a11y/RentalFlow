"use client";

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, getLandlordCollectionQuery, deleteDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, collection, query, where, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, MapPin, Plus, Bed, Bath, 
  Loader2, Trash2, RotateCcw, Archive, 
  Search, ShieldAlert
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { cn, getResolvedImageUrl } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * @fileOverview High-Fidelity Portfolio Registry.
 * Implements Cascading Delete Protocol for financial and operational consistency.
 * Optimized: Deleting a property now purges all scheduled inspections.
 */

export default function PropertiesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setIsClient(true);
  }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: allProperties, loading } = useCollection(propertiesQuery);

  const activeProperties = useMemo(() => 
    allProperties?.filter(p => !p.isDeleted && (
      p.addressLine1?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.city?.toLowerCase().includes(searchQuery.toLowerCase())
    )) || [], 
  [allProperties, searchQuery]);

  const archivedProperties = useMemo(() => 
    allProperties?.filter(p => p.isDeleted) || [], 
  [allProperties]);

  const handleArchiveProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'properties', propertyId);
    updateDocumentNonBlocking(propertyRef, { 
      isDeleted: true, 
      deletedAt: serverTimestamp(),
      updatedAt: serverTimestamp() 
    });
    toast({ title: "Asset Archived", description: "Financial overview updated." });
  };

  const handleRestoreProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'properties', propertyId);
    updateDocumentNonBlocking(propertyRef, { 
      isDeleted: false, 
      deletedAt: null,
      updatedAt: serverTimestamp() 
    });
    toast({ title: "Asset Restored", description: "Synchronized back to inventory." });
  };

  const handlePermanentDelete = async (propertyId: string) => {
    if (!user || !db) return;
    
    // 1. Delete Primary Asset
    const propertyRef = doc(db, 'properties', propertyId);
    deleteDocumentNonBlocking(propertyRef);

    // 2. Cascade Delete all related records (Inspections, Repairs, Finance)
    const relatedCollections = [
      'maintenanceRequests',
      'inspections',
      'emergencyContacts',
      'tenantProfiles',
      'documents',
      'rentPayments'
    ];

    for (const collName of relatedCollections) {
      try {
        const q = query(collection(db, collName), where('propertyId', '==', propertyId));
        const snaps = await getDocs(q);
        snaps.docs.forEach(d => {
          deleteDocumentNonBlocking(doc(db, collName, d.id));
        });
      } catch (e) {
        console.warn(`Cascading Purge Warning: Failed to clean ${collName}`);
      }
    }

    toast({ 
      title: "Asset Purged", 
      description: "Scheduled inspections and all historical records removed." 
    });
  };

  if (!isClient) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-12 text-left">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-headline font-bold text-foreground tracking-tight">Portfolio Inventory</h1>
          <p className="text-muted-foreground font-medium font-body text-sm opacity-70">Managing your high-fidelity property assets.</p>
        </div>
        <div className="flex items-center gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground opacity-40" />
            <Input 
              placeholder="Search assets..." 
              className="pl-10 h-10 rounded-xl bg-muted/20 border-none font-bold text-xs" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <Button asChild className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-10 px-6 shadow-lg shadow-primary/20 text-primary-foreground text-xs uppercase tracking-widest font-headline">
            <Link href="/landlord/properties/new"><Plus className="w-4 h-4 mr-2" /> Register Asset</Link>
          </Button>
        </div>
      </div>

      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="bg-muted/30 p-1 rounded-xl h-11 border border-border mb-8">
          <TabsTrigger value="inventory" className="rounded-lg px-8 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs uppercase tracking-widest font-headline transition-all">
            Active ({activeProperties.length})
          </TabsTrigger>
          <TabsTrigger value="archive" className="rounded-lg px-8 font-bold data-[state=active]:bg-accent data-[state=active]:text-white text-xs uppercase tracking-widest font-headline transition-all">
            Recovery ({archivedProperties.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="mt-0 outline-none">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              <div className="col-span-full py-24 text-center flex flex-col items-center justify-center opacity-40">
                <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
                <p className="text-[10px] font-bold uppercase tracking-[0.4em] font-headline">Syncing Ledger</p>
              </div>
            ) : activeProperties.length === 0 ? (
              <div className="col-span-full py-24 text-center flex flex-col items-center justify-center bg-card rounded-[2.5rem] border-2 border-dashed border-border group hover:border-primary/20 transition-colors">
                <div className="p-8 bg-primary/5 rounded-[2rem] mb-6 group-hover:scale-110 transition-transform">
                   <Building2 className="w-16 h-16 text-primary opacity-20" />
                </div>
                <h3 className="text-xl font-headline font-bold text-foreground mb-2">No Active Assets</h3>
                <p className="text-sm text-muted-foreground font-medium mb-8">Begin your roadmap by registering your first property.</p>
                <Button variant="outline" asChild className="rounded-xl font-bold border-border text-foreground h-12 px-8 hover:bg-primary/5">
                  <Link href="/landlord/properties/new">Initialize First Asset</Link>
                </Button>
              </div>
            ) : (
              activeProperties.map((property) => {
                const imageUrl = getResolvedImageUrl(property.imageUrl, property.imageUrls);
                return (
                  <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-2xl transition-all duration-500 rounded-[2.5rem] bg-card ring-1 ring-border">
                    <div className="relative aspect-video w-full overflow-hidden bg-muted">
                      {imageUrl ? (
                        <img 
                          src={imageUrl} 
                          alt={property.addressLine1} 
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-110" 
                        />
                      ) : (
                        <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                          <Building2 className="w-12 h-12 text-muted-foreground/20" />
                        </div>
                      )}
                      <Badge className={cn("absolute top-6 right-6 font-bold shadow-2xl py-1.5 px-4 text-[9px] uppercase tracking-widest rounded-full border-none", property.isOccupied ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white')}>
                        {property.isOccupied ? 'Occupied' : 'Vacant'}
                      </Badge>
                    </div>
                    <CardHeader className="pb-2 text-left space-y-2 p-8 min-w-0">
                      <Badge variant="outline" className="text-[8px] uppercase font-bold text-accent border-accent/20 w-fit tracking-widest py-0.5 px-2 font-headline bg-accent/5">
                        {property.propertyType}
                      </Badge>
                      <CardTitle className="text-xl font-bold font-headline truncate tracking-tight text-foreground group-hover:text-accent transition-colors block w-full">{property.addressLine1}</CardTitle>
                      <p className="text-xs text-muted-foreground flex items-center font-medium font-body opacity-60 truncate w-full"><MapPin className="w-3.5 h-3.5 mr-1.5 text-accent shrink-0" /> {property.city}, {property.zipCode}</p>
                    </CardHeader>
                    <CardContent className="pb-6 text-left px-8">
                      <div className="flex gap-6 items-center mb-6 py-4 border-y border-border/50">
                        <span className="flex items-center text-[10px] font-bold text-muted-foreground font-headline uppercase tracking-widest"><Bed className="w-4 h-4 mr-2 text-primary opacity-40" /> {property.numberOfBedrooms || 1} Bed</span>
                        <span className="flex items-center text-[10px] font-bold text-muted-foreground font-headline uppercase tracking-widest"><Bath className="w-4 h-4 mr-2 text-primary opacity-40" /> {property.numberOfBathrooms || 1} Bath</span>
                      </div>
                      <p className="text-2xl font-bold text-foreground font-headline tracking-tighter truncate">£{property.rentAmount?.toLocaleString()}<span className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest ml-2 opacity-40">/ month</span></p>
                    </CardContent>
                    <CardFooter className="flex gap-2 p-6 pt-2 bg-muted/5 border-t border-border">
                      <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-11 font-headline uppercase tracking-widest text-[9px] border-border bg-card hover:bg-primary/5 transition-all" asChild>
                        <Link href={`/landlord/properties/${property.id}`}>Command Hub</Link>
                      </Button>
                      <Button variant="outline" size="icon" className="h-11 w-11 rounded-xl border-border bg-card text-muted-foreground hover:text-accent hover:bg-accent/5 shrink-0" asChild>
                         <Link href={`/landlord/properties/${property.id}/edit`}><Plus className="w-4 h-4" /></Link>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-11 w-11 rounded-xl text-destructive/40 hover:text-white hover:bg-red-500 transition-all shrink-0" onClick={() => handleArchiveProperty(property.id)}>
                        <Archive className="w-4 h-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })
            )}
          </div>
        </TabsContent>

        <TabsContent value="archive" className="mt-0 outline-none">
          <div className="space-y-6">
            <div className="bg-accent/5 border border-accent/10 p-6 rounded-2xl flex gap-4 items-start shadow-inner">
               <ShieldAlert className="w-6 h-6 text-accent shrink-0 mt-0.5" />
               <div>
                  <p className="text-sm font-bold text-foreground font-headline">Recovery Vault</p>
                  <p className="text-xs text-muted-foreground leading-relaxed mt-1 font-medium">Assets in this vault are excluded from analytics. Records can be restored instantly.</p>
               </div>
            </div>

            <div className="grid gap-4">
              {archivedProperties.length === 0 ? (
                <div className="py-24 text-center bg-card rounded-[2.5rem] border border-border flex flex-col items-center justify-center opacity-40">
                   <Archive className="w-12 h-12 text-foreground mb-4" />
                   <p className="text-xs font-bold font-headline uppercase tracking-widest">Vault Empty</p>
                </div>
              ) : (
                archivedProperties.map(property => {
                  const imageUrl = getResolvedImageUrl(property.imageUrl, property.imageUrls);
                  return (
                    <Card key={property.id} className="border-none shadow-sm rounded-2xl bg-card ring-1 ring-border overflow-hidden">
                      <CardContent className="p-4 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-5 w-full text-left min-w-0">
                          <div className="relative h-16 w-24 rounded-xl overflow-hidden bg-muted shrink-0">
                            {imageUrl ? <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover grayscale" /> : <Building2 className="w-6 h-6 text-muted-foreground/30" />}
                          </div>
                          <div className="min-w-0 flex-1">
                             <h4 className="font-bold text-base font-headline text-foreground truncate block">{property.addressLine1}</h4>
                             <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 truncate">Archived: {property.deletedAt ? new Date(property.deletedAt.seconds * 1000).toLocaleDateString() : 'Recently'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
                          <Button variant="outline" className="flex-1 md:flex-none rounded-xl font-bold h-11 px-6 border-border text-foreground hover:bg-accent/10 hover:text-accent" onClick={() => handleRestoreProperty(property.id)}>
                            <RotateCcw className="w-4 h-4 mr-2" /> Restore
                          </Button>

                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" className="flex-1 md:flex-none rounded-xl font-bold h-11 px-6 text-destructive/60 hover:text-white hover:bg-red-500">
                                <Trash2 className="w-4 h-4 mr-2" /> Purge Asset
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="rounded-[2rem] border-none shadow-2xl bg-card p-10">
                              <AlertDialogHeader className="text-left">
                                <AlertDialogTitle className="text-2xl font-headline font-bold text-foreground">Purge Asset Record?</AlertDialogTitle>
                                <AlertDialogDescription className="text-muted-foreground font-medium text-base mt-2">
                                  This action is irreversible. All <strong>scheduled inspections</strong>, maintenance history, and financial ledgers for <strong>{property.addressLine1}</strong> will be permanently purged.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter className="mt-8 gap-3">
                                <AlertDialogCancel className="rounded-xl h-12 font-bold font-headline uppercase tracking-widest text-[10px] border-border">Cancel</AlertDialogCancel>
                                <AlertDialogAction 
                                  onClick={() => handlePermanentDelete(property.id)}
                                  className="rounded-xl h-12 font-bold bg-red-600 hover:bg-red-700 text-white font-headline uppercase tracking-widest text-[10px] border-none"
                                >
                                  Purge All Records
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
