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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, 
  Edit3, Loader2, Save, ArrowLeft,
  Bed, Bath, X, FileText, Wrench, 
  ClipboardList, Plus, Download, Trash2,
  ShieldCheck, AlertCircle, Clock,
  CheckCircle2, FileUp, Users, Building2, Sparkles, Camera
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
import { cn, getResolvedGallery, isRealUserUpload, getResolvedImageUrl, compressImage } from "@/lib/utils";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";

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

  const propertyRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'properties', propertyId);
  }, [db, propertyId]);

  const { data: property, isLoading: isPropLoading } = useDoc(propertyRef);

  const gallery = useMemo(() => {
    if (!property) return [];
    return getResolvedGallery(property.imageUrl, property.imageUrls);
  }, [property]);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'tenantProfiles'), 
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: tenants } = useCollection(tenantsQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'documents'),
      where('propertyId', '==', propertyId),
      where('memberIds', 'array-contains', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: documents } = useCollection(docsQuery);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'maintenanceRequests'),
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: maintenance } = useCollection(maintenanceQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'inspections'),
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: inspections } = useCollection(inspectionsQuery);

  const latestAudit = useMemo(() => {
    if (!inspections || inspections.length === 0) return null;
    return inspections
      .filter(i => i.status === 'completed')
      .sort((a, b) => new Date(b.conductedDate).getTime() - new Date(a.conductedDate).getTime())[0];
  }, [inspections]);

  const [isEditingRent, setIsEditingRent] = useState(false);
  const [rentAmount, setRentAmount] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [newDocName, setNewDocName] = useState('');
  const [newDocType, setNewDocType] = useState('Certificate');
  const [uploadedDocUrl, setUploadedDocUrl] = useState<string | null>(null);
  const [isDocDialogOpen, setIsDocDialogOpen] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user || !property || !propertyRef) return;

    setIsUploadingImage(true);
    const existingUrls = Array.isArray(property.imageUrls) ? property.imageUrls : [];
    const newUrls = [...existingUrls];

    try {
      for (const file of files) {
        const optimizedBlob = await compressImage(file);
        const path = `${user.uid}/${propertyId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        const formData = new FormData();
        formData.append('file', optimizedBlob, file.name);
        
        const result = await uploadToSupabase(formData, 'Property-Images-', path);
        if (!result.success) throw new Error(result.error);
        newUrls.push(result.url!);
      }

      updateDocumentNonBlocking(propertyRef, {
        imageUrl: property.imageUrl || newUrls[0],
        imageUrls: newUrls,
        updatedAt: serverTimestamp(),
      });

      toast({ title: "Visual Assets Synchronized" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: err.message });
    } finally {
      setIsUploadingImage(false);
      e.target.value = '';
    }
  };

  const handleUpdateRent = () => {
    if (!propertyRef) return;
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: Number(rentAmount),
      updatedAt: serverTimestamp(),
    });
    setIsEditingRent(false);
    toast({ title: "Yield Adjusted" });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !property) return;

    setIsUploadingDoc(true);
    setUploadedDocUrl(null);

    const path = `${user.uid}/${propertyId}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      
      const result = await uploadToSupabase(formData, 'property-docs', path);
      if (!result.success) throw new Error(result.error);
      
      setUploadedDocUrl(result.url!);
      if (!newDocName) setNewDocName(file.name.split('.')[0]);
      toast({ title: "Sync Ready" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sync Interrupted", description: err.message });
    } finally {
      setIsUploadingDoc(false);
    }
  };

  const handleFinalizeDocument = async (e: React.FormEvent) => {
    e.preventDefault();
    if ( !user || !db || !uploadedDocUrl || !property) return;

    const docId = doc(collection(db, 'documents')).id;
    const docRef = doc(db, 'documents', docId);

    const docData = {
      id: docId,
      propertyId: propertyId,
      landlordId: user.uid,
      memberIds: property.memberIds || [user.uid],
      fileName: newDocName,
      fileUrl: uploadedDocUrl,
      documentType: newDocType,
      uploadDate: new Date().toISOString(),
    };

    setDocumentNonBlocking(docRef, {
      ...docData,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    await syncDocumentToDb(docData);

    toast({ title: "Vault Item Registered" });
    setIsDocDialogOpen(false);
    setNewDocName('');
    setUploadedDocUrl(null);
  };

  const downloadRentStatement = async () => {
    if (!property) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const period = format(new Date(), 'MMMM yyyy');
    doc.text(`RENTAL STATEMENT - ${property.addressLine1}`, 20, 20);
    doc.save(`Statement_${property.addressLine1.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDeleteDocument = (id: string) => {
    if (!db) return;
    const docRef = doc(db, 'documents', id);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Document Purged" });
  };

  if (!isClient || isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!property) return <div className="p-20 text-center font-bold font-headline text-foreground opacity-40">Asset record not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12 bg-background">
      <div className="flex flex-col gap-6 text-left border-b border-white/5 pb-10">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-2xl hover:bg-primary/5 transition-colors h-10 w-10 border border-white/5 shrink-0 shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl md:text-5xl font-headline font-bold text-foreground tracking-tight truncate">{property.addressLine1}</h1>
            <p className="text-muted-foreground flex items-center font-medium font-body text-xs md:text-lg mt-1 opacity-60">
              <MapPin className="w-4 h-4 md:w-5 md:h-5 mr-2 text-accent" /> {property.city}, {property.zipCode}
            </p>
          </div>
        </div>
        
        <div className="flex flex-wrap gap-4 pl-14">
          <Button variant="outline" onClick={downloadRentStatement} className="rounded-xl font-bold h-11 border-border bg-card shadow-lg font-headline text-[10px] uppercase tracking-widest px-8 hover:bg-white/5 transition-all">
            <Download className="w-4 h-4 mr-2 text-accent" /> Rent Statement
          </Button>
          
          <label htmlFor="direct-gallery-upload" className="cursor-pointer">
            <Button variant="outline" className="rounded-xl font-bold h-11 border-border bg-card shadow-lg font-headline text-[10px] uppercase tracking-widest px-8 hover:bg-white/5 transition-all pointer-events-none">
              {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin mr-2 text-accent" /> : <Camera className="w-4 h-4 mr-2 text-accent" />}
              Add Photos
            </Button>
          </label>
          <input id="direct-gallery-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />

          <Button variant="outline" className="rounded-xl font-bold h-11 border-border bg-card shadow-lg font-headline text-[10px] uppercase tracking-widest px-8 hover:bg-white/5 transition-all" asChild>
            <Link href={`/landlord/properties/${propertyId}/edit`}>
              <Edit3 className="w-4 h-4 mr-2 text-accent" /> Modify Specs
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2 space-y-10">
          <Card className="border-none shadow-2xl overflow-hidden bg-card rounded-[3rem] ring-1 ring-white/5">
            {gallery.length > 0 ? (
              <Carousel key={gallery.join(',')} className="w-full group">
                <CarouselContent>
                  {gallery.map((url: string, index: number) => (
                    <CarouselItem key={`${url}-${index}`}>
                      <div className="relative h-[400px] md:h-[550px] w-full bg-muted cursor-zoom-in overflow-hidden" onClick={() => setLightboxUrl(url)}>
                        <Image 
                          src={url} 
                          alt="" 
                          fill
                          className="object-cover transition-transform duration-1000 group-hover:scale-105"
                          unoptimized
                          priority={index === 0}
                        />
                        {index === 0 && (
                          <div className="absolute top-8 left-8 px-5 py-2 bg-accent text-white text-[11px] font-bold uppercase rounded-full shadow-2xl font-headline z-10 tracking-[0.1em] flex items-center gap-2">
                             <Sparkles className="w-4 h-4" /> Primary Asset Identity
                          </div>
                        )}
                      </div>
                    </CarouselItem>
                  ))}
                </CarouselContent>
                <CarouselPrevious className="left-6 bg-black/40 border-none shadow-2xl text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                <CarouselNext className="right-6 bg-black/40 border-none shadow-2xl text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </Carousel>
            ) : (
              <div className="relative h-[400px] md:h-[550px] w-full bg-gradient-to-br from-primary/10 to-accent/5 flex flex-col items-center justify-center gap-4">
                <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 shadow-inner">
                   {isUploadingImage ? <Loader2 className="w-16 h-16 animate-spin text-accent opacity-40" /> : <Building2 className="w-16 h-16 text-muted-foreground/30" />}
                </div>
                <div className="text-center px-8">
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/30 font-headline mb-4">No Visual Identity Recorded</p>
                  <label htmlFor="empty-state-upload" className="cursor-pointer">
                    <Button variant="outline" className="rounded-[1.25rem] font-bold h-12 px-8 border-accent/20 text-accent bg-accent/5 hover:bg-accent/10 transition-all pointer-events-none">
                      {isUploadingImage ? <Loader2 className="w-4 h-4 animate-spin mr-2 text-accent" /> : <Camera className="w-4 h-4 mr-2 text-accent" />}
                      Initialize Identity
                    </Button>
                  </label>
                  <input id="empty-state-upload" type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploadingImage} />
                </div>
              </div>
            )}
            
            <CardContent className="p-10 md:p-12 space-y-10 text-left">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-3 bg-primary/5 px-5 py-3 rounded-2xl border border-white/5 shadow-inner">
                  <Bed className="w-5 h-5 text-accent" />
                  <span className="text-sm font-bold text-foreground font-headline uppercase tracking-widest">{property.numberOfBedrooms || 1} Bed</span>
                </div>
                <div className="flex items-center gap-3 bg-primary/5 px-5 py-3 rounded-2xl border border-white/5 shadow-inner">
                  <Bath className="w-5 h-5 text-accent" />
                  <span className="text-sm font-bold text-foreground font-headline uppercase tracking-widest">{property.numberOfBathrooms || 1} Bath</span>
                </div>
                <Badge variant="outline" className="h-11 px-6 rounded-2xl border-white/10 font-bold text-foreground bg-white/5 uppercase text-[10px] tracking-[0.2em] font-headline">
                  {property.propertyType}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-12 items-end border-t pt-10 border-white/5">
                <div className="space-y-2">
                  <Label className="text-muted-foreground font-bold text-[10px] uppercase tracking-[0.3em] font-headline opacity-50">Operational Yield</Label>
                  <div className="flex items-center gap-6">
                    {isEditingRent ? (
                      <Input type="number" value={rentAmount || property.rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="rounded-2xl h-14 w-32 bg-muted/30 border-none font-bold text-xl px-6" />
                    ) : (
                      <p className="text-5xl font-bold text-foreground font-headline tracking-tighter">£{property.rentAmount?.toLocaleString()}</p>
                    )}
                    <button onClick={isEditingRent ? handleUpdateRent : () => setIsEditingRent(true)} className="rounded-2xl hover:bg-primary/5 h-12 w-12 border border-white/5 flex items-center justify-center transition-all">
                      {isEditingRent ? <Save className="w-5 h-5 text-emerald-500" /> : <Edit3 className="w-5 h-5 text-muted-foreground opacity-60" />}
                    </button>
                  </div>
                </div>
                <div className="p-4 px-8 bg-primary/5 rounded-[2rem] border border-white/5 shadow-inner">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline mb-1 tracking-[0.2em] opacity-50">Occupancy State</p>
                  <p className={cn("font-bold font-headline text-lg uppercase tracking-widest", property.isOccupied ? 'text-emerald-500' : 'text-amber-500')}>{property.isOccupied ? 'Occupied' : 'Vacant'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants" className="w-full">
            <ScrollArea className="w-full">
              <TabsList className="flex w-full bg-muted/40 p-2 rounded-[2rem] h-auto gap-2 border border-white/5">
                {['tenants', 'docs', 'maintenance', 'inspections'].map((tab) => (
                  <TabsTrigger key={tab} value={tab} className="flex-1 rounded-[1.5rem] py-3.5 font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-headline text-[10px] uppercase tracking-[0.2em] transition-all">
                    {tab === 'tenants' ? 'Residents' : tab === 'docs' ? 'Vault' : tab === 'maintenance' ? 'Repairs' : 'Audits'}
                  </TabsTrigger>
                ))}
              </TabsList>
            </ScrollArea>

            <TabsContent value="tenants" className="mt-10 space-y-5">
               {tenants && tenants.length > 0 ? (
                 tenants.map(tenant => (
                    <div key={tenant.id} className="flex items-center justify-between p-6 bg-card rounded-[2.5rem] border border-white/5 shadow-xl group hover:border-accent/30 transition-all">
                      <div className="flex items-center gap-5 text-left">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl font-headline shadow-inner border border-white/5">
                          {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold font-headline text-xl text-foreground tracking-tight group-hover:text-accent transition-colors">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-sm text-muted-foreground font-medium font-body opacity-70">{tenant.email}</p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" asChild className="rounded-2xl h-12 w-12 text-muted-foreground hover:text-foreground hover:bg-white/5 border border-white/5">
                        <Link href="/landlord/messages"><Clock className="w-6 h-6" /></Link>
                      </Button>
                    </div>
                 ))
               ) : (
                 <div className="p-24 text-center bg-muted/10 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center">
                    <div className="p-6 bg-white/5 rounded-full mb-6"><Users className="w-12 h-12 text-white/10" /></div>
                    <p className="text-sm text-muted-foreground font-bold font-headline mb-8 opacity-40 uppercase tracking-[0.3em]">Resident Assignment Pending</p>
                    <Button asChild className="rounded-[1.5rem] font-bold bg-accent text-white shadow-2xl shadow-accent/20 text-xs h-12 px-10 border-none hover:scale-105 transition-transform">
                      <Link href="/landlord/tenants">Initialize Resident Profile</Link>
                    </Button>
                 </div>
               )}
            </TabsContent>

            <TabsContent value="docs" className="mt-10 space-y-8">
              <div className="flex justify-between items-center px-2">
                <h3 className="font-bold font-headline text-2xl text-foreground tracking-tight">Property Vault</h3>
                <Dialog open={isDocDialogOpen} onOpenChange={(o) => { setIsDocDialogOpen(o); if(!o) setUploadedDocUrl(null); }}>
                  <DialogTrigger asChild>
                    <Button className="rounded-[1.5rem] font-bold bg-accent text-white h-12 shadow-2xl shadow-accent/20 px-8 text-[10px] uppercase tracking-[0.2em] border-none hover:scale-105 transition-transform">
                      <Plus className="w-4 h-4 mr-2" /> Register Record
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3.5rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col h-[750px] max-h-[90vh] max-w-[550px] ring-1 ring-white/10">
                    <form onSubmit={handleFinalizeDocument} className="flex flex-col h-full overflow-hidden">
                      <div className="p-10 bg-primary/5 border-b border-white/5 text-left shrink-0">
                        <DialogTitle className="text-2xl font-bold font-headline text-foreground tracking-tight">Vault Orchestration</DialogTitle>
                        <DialogDescription className="text-sm font-medium text-muted-foreground mt-2">Add compliance documents or high-fidelity property guides.</DialogDescription>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto min-h-0 bg-white/[0.01]">
                        <div className="p-10 space-y-10">
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Visual Asset Ledger</Label>
                            <div className="relative group">
                               <label htmlFor="vault-file" className="w-full h-48 rounded-[2.5rem] border-2 border-dashed border-white/10 hover:border-primary/40 transition-all flex flex-col items-center justify-center gap-4 cursor-pointer bg-muted/10 shadow-inner overflow-hidden">
                                  {isUploadingDoc ? (
                                    <div className="flex flex-col items-center gap-3">
                                      <Loader2 className="w-12 h-12 animate-spin text-primary opacity-40" />
                                      <span className="text-[10px] font-bold text-primary uppercase tracking-[0.4em]">Syncing Binary...</span>
                                    </div>
                                  ) : uploadedDocUrl ? (
                                    <div className="flex flex-col items-center gap-3 animate-in zoom-in duration-500">
                                      <div className="p-4 bg-emerald-500/10 rounded-full"><CheckCircle2 className="w-10 h-10 text-emerald-500" /></div>
                                      <span className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] px-4 text-center">Binary Sync Complete</span>
                                    </div>
                                  ) : (
                                    <>
                                      <div className="p-5 bg-white/5 rounded-full group-hover:scale-110 transition-transform duration-500"><FileUp className="w-10 h-10 text-muted-foreground opacity-30" /></div>
                                      <span className="text-[10px] font-bold text-muted-foreground opacity-40 uppercase tracking-[0.3em]">Select Binary Asset</span>
                                    </>
                                  )}
                               </label>
                               <input id="vault-file" type="file" onChange={handleFileSelect} required className="hidden" disabled={isUploadingDoc} />
                            </div>
                          </div>

                          <div className="space-y-3 animate-in slide-in-from-top-4 duration-700">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Record Identity</Label>
                            <Input value={newDocName} onChange={(e) => setNewDocName(e.target.value)} placeholder="e.g. Gas Safety Record 2025" required className="rounded-2xl h-14 bg-muted/40 border-none font-bold px-6 text-base shadow-inner ring-1 ring-white/5" />
                          </div>
                          
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Asset Classification</Label>
                            <select className="flex h-14 w-full rounded-2xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-accent outline-none font-bold text-foreground shadow-inner ring-1 ring-white/5" value={newDocType} onChange={(e) => setNewDocType(e.target.value)}>
                              <option value="Certificate">Compliance Certificate</option>
                              <option value="Lease">Lease Agreement</option>
                              <option value="Manual">Property Manual</option>
                              <option value="Inventory">Check-in Inventory</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      <DialogFooter className="p-10 bg-muted/5 border-t border-white/5 shrink-0">
                        <Button type="submit" disabled={isUploadingDoc || !uploadedDocUrl || !newDocName} className="w-full rounded-[1.75rem] h-16 font-bold bg-accent text-white shadow-2xl shadow-accent/20 font-headline text-[11px] uppercase tracking-[0.3em] hover:scale-[1.01] transition-transform border-none">
                          <ShieldCheck className="w-5 h-5 mr-3" />
                          Finalize Ledger Entry
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>

              <div className="grid gap-5">
                {!documents || documents.length === 0 ? (
                  <div className="p-24 text-center bg-muted/10 rounded-[3rem] border-2 border-dashed border-white/5 flex flex-col items-center">
                    <FileText className="w-16 h-16 mx-auto text-white/5 mb-6" />
                    <p className="text-xs text-muted-foreground font-bold font-headline uppercase tracking-[0.4em] opacity-40">Vault Empty</p>
                  </div>
                ) : (
                  documents.map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-6 bg-card rounded-[2rem] border border-white/5 shadow-xl group hover:border-accent/30 transition-all">
                      <div className="flex items-center gap-5 text-left">
                        <div className="p-4 bg-accent/10 text-accent rounded-2xl shadow-inner border border-accent/20">
                          <FileText className="w-7 h-7" />
                        </div>
                        <div>
                          <p className="font-bold text-lg text-foreground leading-tight tracking-tight">{doc.fileName}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-2 tracking-[0.15em] opacity-60">
                            {doc.documentType} • Shared {doc.uploadDate ? format(new Date(doc.uploadDate), 'PP') : 'Recently'}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-3">
                        <Button variant="ghost" size="icon" asChild className="h-12 w-12 rounded-2xl text-muted-foreground hover:text-accent hover:bg-white/5 border border-white/5">
                          <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="w-5 h-5" /></a>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-2xl text-destructive/40 hover:text-destructive hover:bg-destructive/5 border border-white/5" onClick={() => handleDeleteDocument(doc.id)}>
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-10 space-y-5">
              <div className="grid gap-5">
                {!maintenance || maintenance.length === 0 ? (
                  <div className="p-24 text-center bg-muted/10 rounded-[3rem] border-2 border-dashed border-white/5">
                    <Wrench className="w-16 h-16 mx-auto text-white/5 mb-6" />
                    <p className="text-xs text-muted-foreground font-bold font-headline uppercase tracking-[0.4em] opacity-40">No Active Events</p>
                  </div>
                ) : (
                  maintenance.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(req => (
                    <div key={req.id} className="p-8 bg-card rounded-[2.5rem] border border-white/5 shadow-xl text-left hover:border-accent/30 transition-all">
                       <div className="flex justify-between items-start mb-5">
                          <div className="flex gap-3">
                             <Badge className={cn("uppercase text-[9px] font-bold font-headline tracking-[0.2em] px-4 py-1.5 rounded-full", req.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500' : 'bg-accent/10 text-accent')}>
                                {req.status}
                             </Badge>
                             <Badge variant="outline" className="uppercase text-[9px] font-bold border-white/10 font-headline tracking-[0.2em] opacity-60 px-4 py-1.5 rounded-full">
                                {req.priority}
                             </Badge>
                          </div>
                          <span className="text-[10px] font-bold text-muted-foreground uppercase flex items-center tracking-widest opacity-40">
                             <Clock className="w-4 h-4 mr-2" /> {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'p') : 'Just now'}
                          </span>
                       </div>
                       <h4 className="font-bold text-xl font-headline mb-2 text-foreground tracking-tight">{req.title}</h4>
                       <p className="text-sm text-muted-foreground line-clamp-2 font-body font-medium leading-relaxed opacity-80">{req.description}</p>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="inspections" className="mt-10 space-y-8">
              <div className="grid gap-5">
                {!inspections || inspections.length === 0 ? (
                  <div className="p-24 text-center bg-muted/10 rounded-[3rem] border-2 border-dashed border-white/5">
                    <ClipboardList className="w-16 h-16 mx-auto text-white/5 mb-6" />
                    <p className="text-xs text-muted-foreground font-bold font-headline uppercase tracking-[0.4em] opacity-40">Audit History Empty</p>
                  </div>
                ) : (
                  inspections.sort((a, b) => new Date(b.scheduledDate).getTime() - new Date(a.scheduledDate).getTime()).map(insp => (
                    <div key={insp.id} className="flex items-center justify-between p-6 bg-card rounded-[2.5rem] border border-white/5 shadow-xl hover:border-accent/30 transition-all">
                      <div className="flex items-center gap-6 text-left">
                        <div className="bg-primary/5 p-4 rounded-[1.5rem] flex flex-col items-center justify-center text-foreground font-headline min-w-[70px] ring-1 ring-white/5 shadow-inner">
                           <span className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-40">{format(new Date(insp.scheduledDate), 'MMM')}</span>
                           <span className="text-2xl font-bold">{format(new Date(insp.scheduledDate), 'dd')}</span>
                        </div>
                        <div>
                          <p className="font-bold text-lg text-foreground leading-tight tracking-tight">Portfolio Safety Audit</p>
                          <Badge variant="secondary" className="uppercase text-[9px] font-bold mt-2 tracking-[0.2em] bg-white/5 border border-white/5 text-muted-foreground">{insp.status}</Badge>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm" asChild className="rounded-2xl font-bold text-[10px] uppercase tracking-[0.2em] text-accent hover:bg-accent/10 h-11 px-8 border border-white/5 transition-all">
                        <Link href="/landlord/inspections">Review Audit</Link>
                      </Button>
                    </div>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-10">
           <Card className="border-none shadow-2xl rounded-[3rem] bg-accent text-white overflow-hidden text-left relative">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full" />
             <CardHeader className="pb-6 p-10">
                <CardTitle className="text-2xl font-bold font-headline flex items-center gap-4">
                   <ShieldCheck className="w-8 h-8 text-white/90" /> Security Context
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 px-10 pb-12">
                <div className="p-6 bg-white/10 rounded-[2rem] border border-white/10 shadow-inner space-y-3">
                   <p className="text-[10px] font-bold uppercase opacity-60 tracking-[0.3em] font-headline">Asset Isolation Protocol</p>
                   <p className="text-sm font-medium leading-relaxed opacity-90">This visual ledger is strictly isolated. Only designated residents and authorized administrators can access high-fidelity binary records.</p>
                </div>
                <div className="flex items-center gap-3 px-2">
                   <CheckCircle2 className="w-5 h-5 text-white/60" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Encrypted Cloud Sync Active</span>
                </div>
             </CardContent>
           </Card>

           <Card className="border-none shadow-2xl rounded-[3rem] bg-card overflow-hidden text-left ring-1 ring-white/5">
             <CardHeader className="pb-6 p-10 border-b border-white/5 bg-white/[0.02]">
                <CardTitle className="text-xl font-bold font-headline flex items-center gap-4 text-foreground">
                   <AlertCircle className="w-6 h-6 text-accent" /> Health Analytics
                </CardTitle>
             </CardHeader>
             <CardContent className="pt-10 space-y-6 px-10 pb-12">
                {[
                  { label: "Vault Records", value: `${documents?.length || 0} Assets`, color: "text-emerald-500", bg: "bg-emerald-500/10" },
                  { label: "Pending Repairs", value: `${maintenance?.filter(m => m.status !== 'completed').length || 0} Open`, color: (maintenance?.filter(m => m.status !== 'completed').length || 0) > 0 ? "text-amber-500" : "text-emerald-500", bg: (maintenance?.filter(m => m.status !== 'completed').length || 0) > 0 ? "bg-amber-500/10" : "bg-emerald-500/10" },
                  { label: "Safety Status", value: latestAudit ? 'Verified' : 'Pending', color: latestAudit ? "text-accent" : "text-muted-foreground", bg: latestAudit ? "bg-accent/10" : "bg-white/5" }
                ].map((stat, i) => (
                  <div key={i} className="flex items-center justify-between group">
                     <span className="text-[11px] font-bold text-muted-foreground uppercase font-headline tracking-[0.2em] opacity-40 group-hover:opacity-60 transition-opacity">{stat.label}</span>
                     <Badge className={cn("border-none font-bold uppercase text-[10px] font-headline tracking-[0.2em] px-4 py-1.5 rounded-full shadow-inner", stat.bg, stat.color)}>
                        {stat.value}
                     </Badge>
                  </div>
                ))}
             </CardContent>
           </Card>
        </div>
      </div>

      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center overflow-hidden">
          <DialogTitle className="sr-only">Visual Asset Preview</DialogTitle>
          {lightboxUrl && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image src={lightboxUrl} alt="" fill className="object-contain" unoptimized />
              <button onClick={() => setLightboxUrl(null)} className="absolute top-8 right-8 bg-black/60 backdrop-blur-xl text-white p-4 rounded-full hover:bg-black transition-all hover:scale-110 active:scale-95 shadow-2xl"><X className="w-7 h-7" /></button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
