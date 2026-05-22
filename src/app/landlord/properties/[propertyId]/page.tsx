"use client";

import { useState, use, useMemo, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  setDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, 
  Edit3, Loader2, Save, ArrowLeft,
  Bed, Bath, X, Maximize2, FileText, Wrench, 
  ClipboardList, Plus, Download, Trash2, Calendar,
  ShieldCheck, AlertCircle, Clock
} from "lucide-react";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle, 
  DialogHeader, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { cn, getResolvedGallery } from "@/lib/utils";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { uploadToSupabase } from '@/lib/actions/supabase-storage';
import { syncDocumentToDb } from '@/lib/actions/db-sync';
import { format } from 'date-fns';

export default function PropertyManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const propertyId = resolvedParams.propertyId;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  // 1. Property Core Data
  const propertyRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'properties', propertyId);
  }, [db, propertyId]);

  const { data: property, isLoading: isPropLoading } = useDoc(propertyRef);

  const gallery = useMemo(() => {
    return getResolvedGallery(property?.imageUrl, property?.imageUrls);
  }, [property]);

  // 2. Tenants for this property
  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'tenantProfiles'), 
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: tenants } = useCollection(tenantsQuery);

  // 3. Vault Documents
  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'documents'),
      where('propertyId', '==', propertyId),
      where('memberIds', 'array-contains', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: documents } = useCollection(docsQuery);

  // 4. Maintenance Requests
  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'maintenanceRequests'),
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: maintenance } = useCollection(maintenanceQuery);

  // 5. Inspections/Audits
  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'inspections'),
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: inspections } = useCollection(inspectionsQuery);

  // State Management
  const [isEditingRent, setIsEditingRent] = useState(false);
  const [rentAmount, setRentAmount] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState('Certificate');
  const [newDocFile, setNewDocFile] = useState<File | null>(null);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);

  const handleUpdateRent = () => {
    if (!propertyRef) return;
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: Number(rentAmount),
      updatedAt: serverTimestamp(),
    });
    setIsEditingRent(false);
    toast({ title: "Yield Adjusted" });
  };

  const handleUploadDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !newDocFile || !property) return;

    setIsUploadingDoc(true);
    const docId = doc(collection(db, 'documents')).id;
    const docRef = doc(db, 'documents', docId);

    try {
      const formData = new FormData();
      formData.append('file', newDocFile);
      const path = `vault/${user.uid}/${propertyId}/${Date.now()}_${newDocFile.name}`;
      
      const res = await uploadToSupabase(formData, 'property-documents', path);
      if (!res.success) throw new Error(res.error);

      const docData = {
        id: docId,
        propertyId: propertyId,
        landlordId: user.uid,
        memberIds: property.memberIds || [user.uid],
        fileName: newDocName || newDocFile.name,
        fileUrl: res.url || '',
        documentType: newDocType,
        uploadDate: new Date().toISOString(),
      };

      setDocumentNonBlocking(docRef, {
        ...docData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await syncDocumentToDb(docData);

      toast({ title: "Vault Item Synchronized", description: "Compliance document added to property records." });
      setIsDocDialogOpen(false);
      setNewDocName('');
      setNewDocFile(null);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: err.message });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleDeleteDocument = (id: string) => {
    if (!db) return;
    const docRef = doc(db, 'documents', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Document Purged" });
  };

  if (!isClient || isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!property) return <div className="p-20 text-center font-bold font-headline text-primary opacity-40">Asset record not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">{property.addressLine1}</h1>
            <p className="text-muted-foreground flex items-center font-medium font-body text-sm mt-1">
              <MapPin className="w-4 h-4 mr-1 text-primary/60" /> {property.city}, {property.zipCode}
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/20 bg-white shadow-sm font-headline" asChild>
            <Link href={`/landlord/properties/${propertyId}/edit`}>
              <Edit3 className="w-4 h-4 mr-2" /> Modify Specs
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Visual Showcase */}
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-[2.5rem] border border-primary/5">
            <Carousel className="w-full">
              <CarouselContent>
                {gallery.map((url: string, index: number) => (
                  <CarouselItem key={`${url}-${index}`}>
                    <div className="relative h-[450px] w-full bg-muted cursor-zoom-in group" onClick={() => setLightboxUrl(url)}>
                      <Image 
                        src={url} 
                        alt={`Property ${index}`} 
                        fill 
                        className="object-cover transition-transform duration-700 group-hover:scale-105" 
                        unoptimized 
                        priority={index === 0}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {index === 0 && (
                        <div className="absolute top-6 left-6 px-4 py-1.5 bg-primary text-white text-[10px] font-bold uppercase rounded-full shadow-2xl font-headline">Cover Asset</div>
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4 bg-white/80 border-none shadow-xl h-10 w-10 hover:bg-white" />
              <CarouselNext className="right-4 bg-white/80 border-none shadow-xl h-10 w-10 hover:bg-white" />
            </Carousel>
            
            <CardContent className="pt-6 text-left p-10 space-y-8">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                  <Bed className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary font-headline uppercase">{property.numberOfBedrooms || 1} Bed</span>
                </div>
                <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                  <Bath className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary font-headline uppercase">{property.numberOfBathrooms || 1} Bath</span>
                </div>
                <Badge variant="outline" className="h-10 px-4 rounded-xl border-primary/10 font-bold text-primary bg-primary/[0.02] uppercase text-[10px] tracking-widest">
                  {property.propertyType}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-12 items-end border-t pt-8 border-primary/5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground font-bold text-[10px] uppercase tracking-[0.2em] font-headline">Monthly Yield</Label>
                  <div className="flex items-center gap-4">
                    {isEditingRent ? (
                      <Input type="number" value={rentAmount || property.rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="rounded-xl h-12 w-32 bg-muted/20 border-none font-bold text-lg" />
                    ) : (
                      <p className="text-4xl font-bold text-primary font-headline tracking-tighter">£{property.rentAmount}</p>
                    )}
                    <Button variant="ghost" size="icon" onClick={isEditingRent ? handleUpdateRent : () => setIsEditingRent(true)} className="rounded-full hover:bg-primary/5 transition-colors">
                      {isEditingRent ? <Save className="w-5 h-5 text-emerald-600" /> : <Edit3 className="w-5 h-5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="p-4 px-8 bg-primary/5 rounded-2xl border border-primary/5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline mb-1 tracking-widest">Portfolio Status</p>
                  <p className={cn("font-bold font-headline text-lg uppercase", property.isOccupied ? 'text-emerald-600' : 'text-amber-600')}>{property.isOccupied ? 'Occupied' : 'Vacant'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Operational Tabs */}
          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid grid-cols-4 w-full bg-muted/30 p-1.5 rounded-[1.25rem] h-auto gap-2 border border-primary/5">
              <TabsTrigger value="tenants" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">Residents</TabsTrigger>
              <TabsTrigger value="docs" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">Vault</TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">Repairs</TabsTrigger>
              <TabsTrigger value="inspections" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">Audits</TabsTrigger>
            </TabsList>

            {/* Residents Content */}
            <TabsContent value="tenants" className="mt-8 space-y-4">
               {tenants && tenants.length > 0 ? (
                 tenants.map(tenant => (
                    <div key={tenant.id} className="flex items-center justify-between p-6 bg-white rounded-[1.75rem] border border-primary/5 shadow-sm">
                      <div className="flex items-center gap-5 text-left">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl font-headline">
                          {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold font-headline text-xl text-primary tracking-tight">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-sm text-muted-foreground font-medium font-body">{tenant.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" asChild className="rounded-xl text-primary">
                        <Link href="/landlord/messages">
                          <Clock className="w-5 h-5" />
                        </Link>
                      </Button>
                    </div>
                 ))
               ) : (
                 <div className="p-20 text-center bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-primary/10">
                    <p className="text-sm text-muted-foreground font-bold font-headline mb-4 opacity-50">No residents assigned.</p>
                    <Button asChild className="rounded-xl font-bold bg-primary text-white">
                      <Link href="/landlord/tenants">Assign Resident</Link>
                    </Button>
                 </div>
               )}
            </TabsContent>

            {/* Vault Content */}
            <TabsContent value="docs" className="mt-8 space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold font-headline text-lg text-primary">Property Vault</h3>
                <Dialog open={isDocDialogOpen} onOpenChange={setIsDocDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="rounded-xl font-bold bg-primary text-white h-10">
                      <Plus className="w-4 h-4 mr-2" /> Upload Certificate
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl border-none shadow-2xl">
                    <DialogHeader className="text-left">
                      <DialogTitle className="text-xl font-bold font-headline">Vault Orchestration</DialogTitle>
                      <DialogDescription>Add a compliance document or property guide to the records.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUploadDocument} className="space-y-6 pt-4">
                      <div className="space-y-2 text-left">
                        <Label className="font-bold text-xs uppercase text-primary/60">Document Label</Label>
                        <Input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="e.g. Gas Safety 2025" required className="rounded-xl h-12" />
                      </div>
                      <div className="space-y-2 text-left">
                        <Label className="font-bold text-xs uppercase text-primary/60">Asset Category</Label>
                        <select className="flex h-12 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none" value={newDocType} onChange={(e) => setNewDocType(e.target.value)}>
                          <option value="Certificate">Compliance Certificate</option>
                          <option value="Lease">Lease Agreement</option>
                          <option value="Manual">Property Guide/Manual</option>
                        </select>
                      </div>
                      <div className="space-y-2 text-left">
                        <Label className="font-bold text-xs uppercase text-primary/60">File Attachment</Label>
                        <Input type="file" onChange={(e) => setNewDocFile(e.target.files?.[0] || null)} required className="rounded-xl h-12 py-3" />
                      </div>
                      <DialogFooter>
                        <Button type="submit" disabled={isUploadingDoc} className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg text-white">
                          {isUploadingDoc ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                          Synchronize with Vault
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-4">
                {!documents || documents.length === 0 ? (
                  <div className="p-16 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-primary/10">
                    <FileText className="w-12 h-12 mx-auto text-primary/20 mb-4" />
                    <p className="text-sm text-muted-foreground font-bold font-headline">Vault Empty</p>
                  </div>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-primary/5 shadow-sm group hover:border-primary/20 transition-all">
                      <div className="flex items-center gap-4 text-left">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div>
                          <p className="font-bold text-base text-primary leading-tight">{doc.fileName}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">{doc.documentType} • Shared {doc.uploadDate ? format(new Date(doc.uploadDate), 'PP') : 'Recently'}</p>
                        </div>
                      </div>
                      <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-lg text-primary hover:bg-primary/5">
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/5" onClick={() => handleDeleteDocument(doc.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Repairs Content */}
            <TabsContent value="maintenance" className="mt-8 space-y-4">
               <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold font-headline text-lg text-primary">Repair Ledger</h3>
                <Button variant="outline" asChild className="rounded-xl font-bold h-10 border-primary/20">
                  <Link href="/landlord/maintenance">Open Maintenance Hub</Link>
                </Button>
              </div>
              <div className="grid gap-4">
                {!maintenance || maintenance.length === 0 ? (
                  <div className="p-16 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-primary/10">
                    <Wrench className="w-12 h-12 mx-auto text-primary/20 mb-4" />
                    <p className="text-sm text-muted-foreground font-bold font-headline">No active repairs</p>
                  </div>
                ) : (
                  maintenance.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(req => (
                    <div key={req.id} className="p-6 bg-white rounded-[1.75rem] border border-primary/5 shadow-sm text-left">
                       <div className="flex justify-between items-start mb-3">
                          <div className="flex gap-2">
                             <Badge className={cn("uppercase text-[9px] font-bold", req.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 'bg-sky-100 text-sky-700')}>{req.status}</Badge>
                             <Badge variant="outline" className="uppercase text-[9px] font-bold border-primary/10">{req.priority}</Badge>
                          </div>
                          <span className="text-[9px] font-bold text-muted-foreground uppercase flex items-center">
                             <Clock className="w-3 h-3 mr-1" /> {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'p') : 'Just now'}
                          </span>
                       </div>
                       <h4 className="font-bold text-base font-headline mb-1">{req.title}</h4>
                       <p className="text-sm text-muted-foreground line-clamp-2 font-body">{req.description}</p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            {/* Audits Content */}
            <TabsContent value="inspections" className="mt-8 space-y-4">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold font-headline text-lg text-primary">Compliance Audits</h3>
                <Button variant="outline" asChild className="rounded-xl font-bold h-10 border-primary/20">
                  <Link href="/landlord/inspections">Schedule Audit</Link>
                </Button>
              </div>
              <div className="grid gap-4">
                {!inspections || inspections.length === 0 ? (
                  <div className="p-16 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-primary/10">
                    <ClipboardList className="w-12 h-12 mx-auto text-primary/20 mb-4" />
                    <p className="text-sm text-muted-foreground font-bold font-headline">No audit history</p>
                  </div>
                ) : (
                  inspections.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map(insp => (
                    <div key={insp.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-primary/5 shadow-sm">
                      <div className="flex items-center gap-4 text-left">
                        <div className="bg-primary/5 p-3 rounded-xl flex flex-col items-center justify-center text-primary font-headline min-w-[70px]">
                           <span className="text-[9px] font-bold uppercase">{format(new Date(insp.scheduledDate), 'MMM')}</span>
                           <span className="text-xl font-bold">{format(new Date(insp.scheduledDate), 'dd')}</span>
                        </div>
                        <div>
                          <p className="font-bold text-base text-primary leading-tight">Property Safety Audit</p>
                          <Badge variant="secondary" className="mt-1.5 uppercase text-[9px] font-bold">{insp.status}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="rounded-xl font-bold text-xs text-primary">
                        <Link href="/landlord/inspections">
                          {insp.status === 'completed' ? 'View Record' : 'Start Audit'}
                        </Link>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar Info / Quick Stats */}
        <div className="space-y-8">
           <Card className="border-none shadow-sm rounded-[2rem] bg-primary text-white overflow-hidden text-left">
             <CardHeader className="pb-4">
                <CardTitle className="text-xl font-bold font-headline flex items-center gap-2">
                   <ShieldCheck className="w-5 h-5 text-accent" /> Security Context
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-4">
                <div className="p-4 bg-white/10 rounded-2xl border border-white/10">
                   <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest mb-1">Asset Isolation</p>
                   <p className="text-sm font-medium">This asset is strictly isolated. Only designated residents and management can access the vault.</p>
                </div>
             </CardContent>
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden text-left">
             <CardHeader className="pb-4 border-b border-primary/5">
                <CardTitle className="text-lg font-bold font-headline flex items-center gap-2 text-primary">
                   <AlertCircle className="w-5 h-5 text-accent" /> Compliance Health
                </CardTitle>
             </CardHeader>
             <CardContent className="pt-6 space-y-4">
                <div className="flex items-center justify-between">
                   <span className="text-xs font-bold text-muted-foreground uppercase">Certificates</span>
                   <Badge className="bg-emerald-100 text-emerald-700 border-none font-bold uppercase text-[9px]">{documents?.length || 0} Records</Badge>
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-xs font-bold text-muted-foreground uppercase">Open Repairs</span>
                   <Badge className={cn("border-none font-bold uppercase text-[9px]", (maintenance?.filter(m => m.status !== 'completed').length || 0) > 0 ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                      {maintenance?.filter(m => m.status !== 'completed').length || 0} Pending
                   </Badge>
                </div>
                <div className="flex items-center justify-between">
                   <span className="text-xs font-bold text-muted-foreground uppercase">Audit Status</span>
                   <Badge className="bg-blue-100 text-blue-700 border-none font-bold uppercase text-[9px]">Verified</Badge>
                </div>
             </CardContent>
           </Card>
        </div>
      </div>

      {/* High-Fidelity Modal Viewer */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center overflow-hidden">
          <DialogTitle className="sr-only">Visual Asset Preview</DialogTitle>
          {lightboxUrl && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image 
                src={lightboxUrl} 
                alt="High resolution property asset" 
                width={1600} 
                height={1200} 
                className="object-contain max-w-full max-h-[90vh] rounded-2xl" 
                unoptimized 
              />
              <button 
                onClick={() => setLightboxUrl(null)}
                className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
