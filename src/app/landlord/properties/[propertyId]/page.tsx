"use client";

import { useState, use, useRef, useMemo, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  setDocumentNonBlocking, 
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, Users, Wrench, FileCheck, 
  Trash2, Edit3, Loader2, Save, ArrowLeft,
  Download, FileText, Upload, 
  Calendar as CalendarIcon, 
  Bed, Bath, ChevronRight, AlertTriangle, CheckCircle2,
  Clock, ShieldCheck
} from "lucide-react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { syncDocumentToDb, deleteDocumentFromDb } from "@/lib/actions/db-sync";
import { uploadToSupabase } from '@/lib/actions/supabase-storage';
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isBefore } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

const getMemoryAsset = (id: string) => {
  if (typeof window === 'undefined') return null;
  return (window as any).__asset_bridge?.[id] || null;
};

const setMemoryAsset = (id: string, url: string) => {
  if (typeof window === 'undefined') return;
  if (!(window as any).__asset_bridge) (window as any).__asset_bridge = {};
  (window as any).__asset_bridge[id] = url;
};

export default function PropertyManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const propertyId = resolvedParams.propertyId;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const propertyRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'properties', propertyId);
  }, [db, propertyId]);

  const { data: property, isLoading: isPropLoading } = useDoc(propertyRef);

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
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: propertyDocuments } = useCollection(docsQuery);

  const maintenanceRequestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'maintenanceRequests'),
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: maintenanceRequests } = useCollection(maintenanceRequestsQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'inspections'),
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: inspections } = useCollection(inspectionsQuery);

  const [isEditingRent, setIsEditingRent] = useState(false);
  const [rentAmount, setRentAmount] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [uploadExpiryDate, setUploadExpiryDate] = useState<Date>();

  const assetStatus = useMemo(() => {
    let score = 100;
    const reasons: string[] = [];
    const today = new Date();

    if (!propertyDocuments || propertyDocuments.length === 0) {
      score -= 30;
      reasons.push("Missing property records");
    } else {
      const expiredDocs = propertyDocuments.filter(d => {
        if (!d.expiryDate) return false;
        return isBefore(new Date(d.expiryDate), today);
      });
      if (expiredDocs.length > 0) {
        score -= Math.min(40, expiredDocs.length * 20);
        reasons.push(`${expiredDocs.length} expired certificate(s)`);
      }
    }

    if (maintenanceRequests) {
      const active = maintenanceRequests.filter(r => r.status !== 'completed');
      const critical = active.filter(r => r.priority === 'critical');
      if (critical.length > 0) {
        score -= 40;
        reasons.push("Pending critical repairs");
      } else if (active.length > 0) {
        score -= 15;
        reasons.push(`${active.length} active repair(s)`);
      }
    }

    if (inspections) {
      const overdue = inspections.filter(i => {
        if (i.status === 'completed' || !i.scheduledDate) return false;
        return isBefore(new Date(i.scheduledDate), today);
      });
      if (overdue.length > 0) {
        score -= 20;
        reasons.push("Compliance audit overdue");
      }
    }

    const finalScore = Math.max(0, score);
    let color = "bg-emerald-400";
    let message = "Fully verified and compliant.";

    if (finalScore < 60) {
      color = "bg-red-500";
      message = reasons[0] || "Immediate attention required.";
    } else if (finalScore < 90) {
      color = "bg-amber-500";
      message = reasons[0] || "Minor compliance updates required.";
    }

    return { score: finalScore, color, message };
  }, [propertyDocuments, maintenanceRequests, inspections]);

  // HARDEN: Reactive Gallery Sync Engine
  const gallery = useMemo(() => {
    if (!isClient) return [];
    
    const bridgeUrl = getMemoryAsset(propertyId);
    let dbUrls: string[] = [];

    if (property) {
      dbUrls = property.imageUrls && property.imageUrls.length > 0 
        ? property.imageUrls 
        : (property.imageUrl ? [property.imageUrl] : []);
    }

    // Filter out temporary blobs from DB record to avoid broken links after reload
    const cleanDbUrls = dbUrls.filter(url => url && !url.startsWith('blob:'));

    // If we have a session bridge URL (uploaded just now), prioritize it at the front
    if (bridgeUrl) {
      const otherUrls = cleanDbUrls.filter(u => u !== bridgeUrl);
      return [bridgeUrl, ...otherUrls];
    }

    return cleanDbUrls.length > 0 ? cleanDbUrls : [`https://picsum.photos/seed/${propertyId}/800/600`];
  }, [property, propertyId, isClient]);

  const handleUpdateRent = () => {
    if (!propertyRef) return;
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: Number(rentAmount),
      updatedAt: serverTimestamp(),
    });
    setIsEditingRent(false);
    toast({ title: "Yield Adjusted" });
  };

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !db || !property) return;

    setIsUploadingDoc(true); 
    const docId = doc(collection(db, 'documents')).id;
    const docRef = doc(db, 'documents', docId);
    
    const localUrl = URL.createObjectURL(file);
    setMemoryAsset(docId, localUrl);

    const residentIds = tenants?.map(t => t.userId).filter(Boolean) || [];
    const memberIds = Array.from(new Set([user.uid, ...(property.memberIds || []), ...residentIds]));

    const baseDocData = {
      id: docId,
      fileName: file.name,
      fileUrl: localUrl,
      status: 'active',
      documentType: 'property-asset',
      propertyId: propertyId,
      landlordId: user.uid,
      expiryDate: uploadExpiryDate ? uploadExpiryDate.toISOString() : null,
      memberIds: memberIds,
      uploadDate: new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    try {
      const formData = new FormData();
      formData.append('file', file);
      const path = `vault/${user.uid}/${propertyId}/${Date.now()}_${file.name}`;
      
      const result = await uploadToSupabase(formData, 'property-documents', path);
      
      if (result.success && result.url) {
        const finalDocData = { ...baseDocData, fileUrl: result.url };
        
        // Construct plain serializable data for the server action
        const serializableDocData = {
          id: docId,
          propertyId: propertyId,
          landlordId: user.uid,
          fileName: file.name,
          fileUrl: result.url,
          documentType: 'property-asset',
          expiryDate: uploadExpiryDate ? uploadExpiryDate.toISOString() : null,
        };

        await setDocumentNonBlocking(docRef, finalDocData, { merge: true });
        await syncDocumentToDb(serializableDocData);
        setMemoryAsset(docId, result.url);
        toast({ title: "Vault Updated" });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: error.message });
    } finally {
      setIsUploadingDoc(false);
      setUploadExpiryDate(undefined);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteDocument = async (docId: string) => {
    if (!db) return;
    const docRef = doc(db, 'documents', docId);
    deleteDocumentNonBlocking(docRef);
    deleteDocumentFromDb(docId);
    toast({ title: "Document Removed" });
  };

  const getPriorityColor = (priority: string) => {
    switch(priority?.toLowerCase()) {
      case 'critical': return 'bg-red-500 text-white';
      case 'urgent': return 'bg-orange-500 text-white';
      case 'routine': return 'bg-blue-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  if (!isClient || isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!property) return <div className="p-20 text-center font-bold font-headline text-primary opacity-40">Asset record not found in ledger.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
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
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/20 bg-white shadow-sm font-headline" asChild>
             <Link href={`/landlord/properties/${propertyId}/edit`}>
               <Edit3 className="w-4 h-4 mr-2" /> Specification
             </Link>
           </Button>
           <Button className="rounded-xl font-bold h-11 shadow-lg shadow-primary/20 bg-primary text-white font-headline" asChild>
             <Link href={`/landlord/messages?prop=${propertyId}`}>Contact Residents</Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-[2.5rem] border border-primary/5">
            <Carousel className="w-full">
              <CarouselContent>
                {gallery.map((url: string, index: number) => (
                  <CarouselItem key={`${url}-${index}`}>
                    <div className="relative h-[450px] w-full bg-muted">
                      <Image 
                        src={url} 
                        alt={`Property ${index}`} 
                        fill 
                        className="object-cover" 
                        unoptimized={true} 
                        data-ai-hint="luxury property" 
                      />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4 bg-white/80 border-none shadow-xl h-10 w-10" />
              <CarouselNext className="right-4 bg-white/80 border-none shadow-xl h-10 w-10" />
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

          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid grid-cols-4 w-full bg-muted/30 p-1.5 rounded-[1.25rem] h-auto gap-2 border border-primary/5">
              <TabsTrigger value="tenants" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">
                <Users className="w-4 h-4 mr-2" /> Residents
              </TabsTrigger>
              <TabsTrigger value="docs" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">
                <FileText className="w-4 h-4 mr-2" /> Vault
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">
                <Wrench className="w-4 h-4 mr-2" /> Repairs
              </TabsTrigger>
              <TabsTrigger value="inspections" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">
                <FileCheck className="w-4 h-4 mr-2" /> Audits
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="mt-8 space-y-4">
               {tenants && tenants.length > 0 ? (
                 tenants.map(tenant => (
                    <div key={tenant.id} className="flex items-center justify-between p-6 bg-white rounded-[1.75rem] border border-primary/5 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-5 text-left">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl font-headline">
                          {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold font-headline text-xl text-primary tracking-tight">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-sm text-muted-foreground font-medium font-body">{tenant.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="font-bold border-emerald-200 text-emerald-700 bg-emerald-50 mb-1 uppercase text-[10px]">Active Lease</Badge>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest font-headline">Expires: {tenant.leaseEndDate}</p>
                      </div>
                    </div>
                 ))
               ) : (
                 <div className="p-20 text-center bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-primary/10">
                    <p className="text-sm text-muted-foreground font-bold font-headline mb-4 opacity-50">No residents assigned to this asset.</p>
                    <Button asChild className="rounded-xl font-bold bg-primary text-white px-8 font-headline"><Link href="/landlord/tenants">Assign Resident</Link></Button>
                 </div>
               )}
            </TabsContent>

            <TabsContent value="docs" className="mt-8 space-y-6">
              <Card className="border-none shadow-sm bg-primary/5 rounded-[1.75rem] border border-primary/5 overflow-hidden">
                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-left min-w-0">
                    <Label className="text-[10px] font-bold font-headline uppercase tracking-[0.2em] text-primary/60">Compliance Expiry</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className={cn(
                            "w-full justify-start text-left h-12 rounded-xl bg-white border-none shadow-sm font-body px-4 transition-all hover:scale-[1.01] overflow-hidden", 
                            !uploadExpiryDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-3 h-4 w-4 text-primary shrink-0" />
                          <span className="flex-1 text-[13px] font-bold whitespace-normal leading-tight">
                            {uploadExpiryDate ? format(uploadExpiryDate, "PPP") : "Set Deadline (Optional)"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl overflow-hidden" align="start">
                        <Calendar mode="single" selected={uploadExpiryDate} onSelect={setUploadExpiryDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-end">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadDocument} />
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20 bg-primary text-white transition-transform active:scale-95 font-headline" disabled={isUploadingDoc}>
                      {isUploadingDoc ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      <span className="truncate">Push to Vault</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <div className="grid gap-4">
                {!propertyDocuments || propertyDocuments.length === 0 ? (
                  <div className="py-20 text-center bg-muted/5 rounded-[2rem] border-2 border-dashed border-primary/5">
                    <FileText className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                    <p className="text-muted-foreground font-bold font-headline opacity-50 uppercase tracking-widest">Vault is empty.</p>
                  </div>
                ) : (
                  propertyDocuments.map(doc => {
                    const downloadUrl = getMemoryAsset(doc.id) || doc.fileUrl;
                    return (
                      <div key={doc.id} className="flex items-center justify-between p-5 bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md transition-all gap-4">
                        <div className="flex items-center gap-4 text-left min-w-0 flex-1">
                          <div className="p-3 bg-blue-50 text-blue-600 rounded-xl shrink-0">
                            <FileText className="w-6 h-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-bold truncate text-primary leading-tight font-body">{doc.fileName}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <p className="text-[9px] text-muted-foreground font-bold uppercase whitespace-nowrap bg-muted/30 px-2 py-0.5 rounded-full font-headline">Uploaded: {doc.uploadDate ? format(new Date(doc.uploadDate), 'PP') : 'Recently'}</p>
                              {doc.expiryDate && (
                                <Badge variant="outline" className="text-[9px] h-5 px-2 border-amber-200 text-amber-700 bg-amber-50 whitespace-nowrap font-bold uppercase">Expires {format(new Date(doc.expiryDate), 'PP')}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {downloadUrl && downloadUrl !== 'pending' && !downloadUrl.startsWith('blob:') ? (
                            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/5 text-primary h-11 w-11 shadow-sm border border-transparent hover:border-primary/10 transition-all" asChild title="Download">
                              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={doc.fileName}>
                                <Download className="w-5 h-5" />
                              </a>
                            </Button>
                          ) : (
                            <div className="px-4 py-2 flex items-center gap-3 bg-muted/50 rounded-xl">
                              <Loader2 className="w-4 h-4 animate-spin text-primary/40" />
                            </div>
                          )}
                          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-destructive/5 text-destructive/40 hover:text-destructive h-11 w-11 transition-all" onClick={() => handleDeleteDocument(doc.id)} title="Remove">
                            <Trash2 className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-8 space-y-4">
               {maintenanceRequests && maintenanceRequests.length > 0 ? (
                 maintenanceRequests.map(req => (
                    <div key={req.id} className="p-6 bg-white rounded-[1.75rem] border border-primary/5 text-left group hover:shadow-md transition-all">
                      <div className="flex justify-between items-start mb-4">
                         <div className="flex items-center gap-3">
                           <Badge className={cn("text-[10px] font-bold uppercase px-3 py-1 shadow-sm", getPriorityColor(req.priority))}>{req.priority}</Badge>
                           <Badge variant="outline" className="text-[10px] font-bold uppercase border-primary/10 bg-primary/[0.02] tracking-widest">{req.status}</Badge>
                         </div>
                         <span className="text-[10px] text-muted-foreground font-bold flex items-center opacity-60 font-headline uppercase"><Clock className="w-3 h-3 mr-1" /> {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'PP') : 'Recently'}</span>
                      </div>
                      <h4 className="font-bold text-xl text-primary font-headline mb-2 leading-tight tracking-tight">{req.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 font-body font-medium">{req.description}</p>
                      <div className="mt-6 pt-4 border-t border-primary/5 flex justify-end">
                        <Button variant="ghost" className="text-xs font-bold text-primary rounded-xl hover:bg-primary/5 font-headline uppercase tracking-widest" asChild>
                          <Link href="/landlord/maintenance">Open Maintenance Hub <ChevronRight className="w-4 h-4 ml-1" /></Link>
                        </Button>
                      </div>
                    </div>
                 ))
               ) : (
                 <div className="py-20 text-center bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-primary/10">
                   <Wrench className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                   <p className="text-muted-foreground font-bold font-headline opacity-50 uppercase tracking-widest">No repairs logged.</p>
                 </div>
               )}
            </TabsContent>

            <TabsContent value="inspections" className="mt-8 space-y-4">
              {inspections && inspections.length > 0 ? (
                inspections.map(insp => (
                   <div key={insp.id} className="p-6 bg-white rounded-[1.75rem] border border-primary/5 text-left flex justify-between items-center group hover:shadow-md transition-all gap-4">
                     <div className="flex items-center gap-5 min-w-0">
                       <div className={cn("p-4 rounded-2xl flex flex-col items-center justify-center min-w-[70px] shrink-0 shadow-inner", insp.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700')}>
                         <span className="text-[10px] font-bold uppercase opacity-60 tracking-wider font-headline">{insp.scheduledDate ? format(new Date(insp.scheduledDate), 'MMM') : 'TBC'}</span>
                         <span className="text-2xl font-bold font-headline">{insp.scheduledDate ? format(new Date(insp.scheduledDate), 'dd') : '??'}</span>
                       </div>
                       <div className="min-w-0">
                         <h4 className="text-lg font-bold text-primary font-headline truncate tracking-tight">Safety & Compliance Audit</h4>
                         <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                           <Badge variant={insp.status === 'completed' ? 'secondary' : 'default'} className="uppercase text-[9px] font-bold shadow-sm">{insp.status}</Badge>
                           {insp.healthScore && (
                             <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center border border-emerald-100 font-headline uppercase"><CheckCircle2 className="w-3 h-3 mr-1" /> Score: {insp.healthScore}/100</span>
                           )}
                         </div>
                       </div>
                     </div>
                     <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/20 hover:bg-primary hover:text-white transition-all shrink-0 shadow-sm font-headline" asChild>
                       <Link href="/landlord/inspections">Audit Details <ChevronRight className="w-4 h-4 ml-1" /></Link>
                     </Button>
                   </div>
                ))
              ) : (
                <div className="py-20 text-center bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-primary/10">
                  <ShieldCheck className="w-12 h-12 text-primary/10 mx-auto mb-4" />
                  <p className="text-muted-foreground font-bold font-headline opacity-50 uppercase tracking-widest">No audits recorded.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-primary text-white sticky top-24 border border-white/5">
            <CardHeader className="text-left p-8 bg-white/5">
              <CardTitle className="text-xl font-headline flex items-center tracking-tight">
                <AlertTriangle className="w-6 h-6 mr-3 text-accent" />
                Asset Health Score
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-left p-8">
              <div className="space-y-3">
                 <div className="flex justify-between items-center text-xs font-bold uppercase tracking-[0.2em] opacity-60 font-headline">
                   <span>Composite Grade</span>
                   <span>{assetStatus.score}%</span>
                 </div>
                 <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                   <div className={cn("h-full transition-all duration-1000 ease-out", assetStatus.color)} style={{ width: `${assetStatus.score}%` }}></div>
                 </div>
              </div>
              <div className="p-5 bg-white/10 rounded-[1.5rem] border border-white/10 backdrop-blur-md">
                <div className="flex gap-3 items-start">
                   <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                   <p className="text-sm font-bold font-body leading-relaxed">
                     {assetStatus.message}
                   </p>
                </div>
              </div>
              <p className="text-[10px] font-bold uppercase opacity-30 tracking-[0.4em] text-center mt-4 font-headline">Real-Time Audit Engine</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}