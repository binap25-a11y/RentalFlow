"use client";

import { useState, use, useRef, useMemo } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  setDocumentNonBlocking, 
  deleteDocumentNonBlocking,
  useStorage, 
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, Users, Wrench, FileCheck, 
  Trash2, Edit3, Loader2, Save, ArrowLeft,
  Download, FileText, ShieldAlert, Upload, 
  Calendar as CalendarIcon, Image as ImageIcon,
  Bed, Bath, ChevronRight, AlertTriangle, CheckCircle2
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
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isBefore } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

// Zero-Quota Memory Bridge
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
  const storage = useStorage();
  const { toast } = useToast();
  const router = useRouter();
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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
    if (!file || !user || !db || !storage || !property) return;

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
      fileUrl: '', 
      status: 'active',
      documentType: 'property-asset',
      propertyId: propertyId,
      landlordId: user.uid,
      expiryDate: uploadExpiryDate ? uploadExpiryDate.toISOString() : null,
      memberIds: memberIds,
      uploadDate: new Date().toISOString(),
      createdAt: serverTimestamp(),
    };

    setDocumentNonBlocking(docRef, baseDocData, { merge: true });
    syncDocumentToDb({ ...baseDocData, fileUrl: 'pending' });

    try {
      const storageRef = ref(storage, `documents/${user.uid}/${propertyId}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(uploadResult.ref);

      updateDocumentNonBlocking(docRef, {
        fileUrl: url,
        updatedAt: serverTimestamp(),
      });

      syncDocumentToDb({ ...baseDocData, fileUrl: url });
      toast({ title: "Vault Updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload Failed" });
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

  if (isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!property) return <div className="p-8 text-center font-bold">Asset record not found.</div>;

  const activeImageUrl = property.imageUrl || `https://picsum.photos/seed/rentalflow-pro-identity/800/600`;
  const gallery = property.imageUrls || [activeImageUrl].filter(Boolean);

  const getPriorityColor = (priority: string) => {
    switch(priority?.toLowerCase()) {
      case 'critical': return 'bg-red-500 text-white';
      case 'urgent': return 'bg-orange-500 text-white';
      case 'routine': return 'bg-blue-500 text-white';
      default: return 'bg-muted text-muted-foreground';
    }
  };

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
           <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/20 bg-white" asChild>
             <Link href={`/landlord/properties/${propertyId}/edit`}>
               <Edit3 className="w-4 h-4 mr-2" /> Specification
             </Link>
           </Button>
           <Button className="rounded-xl font-bold h-11 shadow-lg shadow-primary/20 bg-primary text-white" asChild>
             <Link href={`/landlord/messages?prop=${propertyId}`}>Contact Residents</Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-[2.5rem]">
            <Carousel className="w-full">
              <CarouselContent>
                {gallery.map((url: string, index: number) => (
                  <CarouselItem key={index}>
                    <div className="relative h-[400px] w-full bg-muted">
                      <Image src={url} alt={`Property ${index}`} fill className="object-cover" unoptimized={true} />
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4 bg-white/80" />
              <CarouselNext className="right-4 bg-white/80" />
            </Carousel>
            
            <CardContent className="pt-6 text-left p-10 space-y-8">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                  <Bed className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary">{property.numberOfBedrooms || 1} Bed</span>
                </div>
                <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                  <Bath className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary">{property.numberOfBathrooms || 1} Bath</span>
                </div>
                <Badge variant="outline" className="h-10 px-4 rounded-xl border-primary/10 font-bold text-primary bg-primary/[0.02]">
                  {property.propertyType}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-12 items-end border-t pt-8 border-primary/5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest font-headline">Monthly Yield</Label>
                  <div className="flex items-center gap-4">
                    {isEditingRent ? (
                      <Input type="number" value={rentAmount || property.rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="rounded-xl h-12 w-32 bg-muted/20 border-none font-bold" />
                    ) : (
                      <p className="text-4xl font-bold text-primary font-headline">£{property.rentAmount}</p>
                    )}
                    <Button variant="ghost" size="icon" onClick={isEditingRent ? handleUpdateRent : () => setIsEditingRent(true)} className="rounded-full">
                      {isEditingRent ? <Save className="w-5 h-5 text-emerald-600" /> : <Edit3 className="w-5 h-5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="p-4 px-8 bg-primary/5 rounded-2xl border border-primary/5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline mb-1">Portfolio Status</p>
                  <p className={cn("font-bold font-headline text-lg", property.isOccupied ? 'text-emerald-600' : 'text-amber-600')}>{property.isOccupied ? 'Occupied' : 'Vacant'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid grid-cols-4 w-full bg-muted/30 p-1.5 rounded-[1.25rem] h-auto gap-2 border border-primary/5">
              <TabsTrigger value="tenants" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <Users className="w-4 h-4 mr-2" /> Residents
              </TabsTrigger>
              <TabsTrigger value="docs" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <FileText className="w-4 h-4 mr-2" /> Vault
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <Wrench className="w-4 h-4 mr-2" /> Repairs
              </TabsTrigger>
              <TabsTrigger value="inspections" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
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
                          <p className="font-bold font-headline text-xl text-primary">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-sm text-muted-foreground font-medium font-body">{tenant.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="font-bold border-emerald-200 text-emerald-700 bg-emerald-50 mb-1">Active Lease</Badge>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Expires: {tenant.leaseEndDate}</p>
                      </div>
                    </div>
                 ))
               ) : (
                 <div className="p-20 text-center bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-primary/10">
                    <p className="text-sm text-muted-foreground font-bold font-headline mb-4 opacity-50">No residents assigned to this asset.</p>
                    <Button asChild className="rounded-xl font-bold bg-primary text-white px-8"><Link href="/landlord/tenants">Assign Resident</Link></Button>
                 </div>
               )}
            </TabsContent>

            <TabsContent value="docs" className="mt-8 space-y-6">
              <Card className="border-none shadow-sm bg-primary/5 rounded-[1.75rem] border border-primary/5 overflow-hidden">
                <CardContent className="p-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2 text-left">
                    <Label className="text-[10px] font-bold font-headline uppercase tracking-widest text-primary/60">Compliance Expiry</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className={cn(
                            "w-full justify-start text-left h-12 rounded-xl bg-white border-none shadow-sm font-body px-4 transition-all hover:scale-[1.01]", 
                            !uploadExpiryDate && "text-muted-foreground"
                          )}
                        >
                          <CalendarIcon className="mr-3 h-4 w-4 text-primary shrink-0" />
                          <span className="flex-1 truncate text-xs sm:text-sm font-bold">
                            {uploadExpiryDate ? format(uploadExpiryDate, "PPP") : "Set Deadline (Optional)"}
                          </span>
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                        <Calendar mode="single" selected={uploadExpiryDate} onSelect={setUploadExpiryDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-end">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadDocument} />
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl h-12 font-bold shadow-lg shadow-primary/20 bg-primary text-white transition-transform active:scale-95" disabled={isUploadingDoc}>
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
                    <p className="text-muted-foreground font-bold font-headline opacity-50">Vault is empty.</p>
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
                            <p className="text-sm font-bold truncate text-primary leading-tight">{doc.fileName}</p>
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              <p className="text-[9px] text-muted-foreground font-bold uppercase whitespace-nowrap bg-muted/30 px-2 py-0.5 rounded-full">Uploaded: {doc.uploadDate ? format(new Date(doc.uploadDate), 'PP') : 'Recently'}</p>
                              {doc.expiryDate && (
                                <Badge variant="outline" className="text-[9px] h-5 px-2 border-amber-200 text-amber-700 bg-amber-50 whitespace-nowrap font-bold">Expires {format(new Date(doc.expiryDate), 'PP')}</Badge>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                          {downloadUrl && downloadUrl !== 'pending' ? (
                            <Button variant="ghost" size="icon" className="rounded-xl hover:bg-primary/5 text-primary h-11 w-11 shadow-sm border border-transparent hover:border-primary/10 transition-all" asChild>
                              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" download={doc.fileName}>
                                <Download className="w-5 h-5" />
                              </a>
                            </Button>
                          ) : (
                            <div className="px-4 py-2 flex items-center gap-3 bg-muted/50 rounded-xl">
                              <Loader2 className="w-4 h-4 animate-spin text-primary/40" />
                            </div>
                          )}
                          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-destructive/5 text-destructive/40 hover:text-destructive h-11 w-11 transition-all" onClick={() => handleDeleteDocument(doc.id)}>
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
                           <Badge className={cn("text-[10px] font-bold uppercase px-3 py-1", getPriorityColor(req.priority))}>{req.priority}</Badge>
                           <Badge variant="outline" className="text-[10px] font-bold uppercase border-primary/10">{req.status}</Badge>
                         </div>
                         <span className="text-[10px] text-muted-foreground font-bold flex items-center"><CalendarIcon className="w-3 h-3 mr-1" /> {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'PP') : 'Today'}</span>
                      </div>
                      <h4 className="font-bold text-xl text-primary font-headline mb-2">{req.title}</h4>
                      <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 font-body">{req.description}</p>
                      <div className="mt-4 pt-4 border-t border-primary/5 flex justify-end">
                        <Button variant="ghost" className="text-xs font-bold text-primary rounded-xl" asChild>
                          <Link href="/landlord/maintenance">Manage in Hub <ChevronRight className="w-4 h-4 ml-1" /></Link>
                        </Button>
                      </div>
                    </div>
                 ))
               ) : (
                 <div className="py-20 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-primary/10">
                   <p className="text-muted-foreground font-bold opacity-50">No maintenance repairs logged for this property.</p>
                 </div>
               )}
            </TabsContent>

            <TabsContent value="inspections" className="mt-8 space-y-4">
              {inspections && inspections.length > 0 ? (
                inspections.map(insp => (
                   <div key={insp.id} className="p-6 bg-white rounded-[1.75rem] border border-primary/5 text-left flex justify-between items-center group hover:shadow-md transition-all gap-4">
                     <div className="flex items-center gap-5 min-w-0">
                       <div className={cn("p-4 rounded-2xl flex flex-col items-center justify-center min-w-[70px] shrink-0", insp.status === 'completed' ? 'bg-emerald-50 text-emerald-700' : 'bg-blue-50 text-blue-700')}>
                         <span className="text-[10px] font-bold uppercase">{insp.scheduledDate ? format(new Date(insp.scheduledDate), 'MMM') : 'TBC'}</span>
                         <span className="text-2xl font-bold font-headline">{insp.scheduledDate ? format(new Date(insp.scheduledDate), 'dd') : '??'}</span>
                       </div>
                       <div className="min-w-0">
                         <h4 className="text-lg font-bold text-primary font-headline truncate">Compliance Audit Record</h4>
                         <div className="flex items-center gap-3 mt-1 flex-wrap">
                           <Badge variant={insp.status === 'completed' ? 'secondary' : 'default'} className="uppercase text-[9px] font-bold">{insp.status}</Badge>
                           {insp.healthScore && (
                             <span className="text-[10px] font-bold text-emerald-600 flex items-center"><CheckCircle2 className="w-3 h-3 mr-1" /> Score: {insp.healthScore}/100</span>
                           )}
                         </div>
                       </div>
                     </div>
                     <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/20 hover:bg-primary hover:text-white transition-all shrink-0" asChild>
                       <Link href="/landlord/inspections">View Audit <ChevronRight className="w-4 h-4 ml-1" /></Link>
                     </Button>
                   </div>
                ))
              ) : (
                <div className="py-20 text-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-primary/10">
                  <p className="text-muted-foreground font-bold opacity-50">No official audits have been recorded.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-primary text-white">
            <CardHeader className="text-left p-8 bg-white/5">
              <CardTitle className="text-xl font-headline flex items-center">
                <ShieldAlert className="w-6 h-6 mr-3 text-accent" />
                Asset Compliance Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-left p-8">
              <div className="space-y-3">
                 <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest opacity-60">
                   <span>Composite Grade</span>
                   <span>{assetStatus.score}%</span>
                 </div>
                 <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                   <div className={cn("h-full transition-all duration-1000", assetStatus.color)} style={{ width: `${assetStatus.score}%` }}></div>
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
              <p className="text-[10px] font-bold uppercase opacity-30 tracking-[0.3em] text-center mt-4">Real-Time Portfolio Audit Engine</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
