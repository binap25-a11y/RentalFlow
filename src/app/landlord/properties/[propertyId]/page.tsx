"use client";

import { useState, use, useRef, useEffect } from 'react';
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
  Building2, MapPin, Users, Wrench, FileCheck, Phone, 
  Trash2, Edit3, Loader2, Save, ArrowLeft,
  Download, FileText, Info, ShieldAlert, Upload, 
  Calendar as CalendarIcon, Sparkles, Image as ImageIcon,
  CheckCircle2, Clock, AlertTriangle, X, Eye, Bed, Bath
} from "lucide-react";
import { 
  Popover, 
  PopoverContent, 
  PopoverTrigger 
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { summarizeLease } from "@/ai/flows/summarize-lease-flow";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { jsPDF } from "jspdf";
import { syncDocumentToDb } from "@/lib/actions/db-sync";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { format, isValid, parseISO } from 'date-fns';
import { useToast } from "@/hooks/use-toast";

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

  const [sessionPreview, setSessionPreview] = useState<string | null>(null);

  useEffect(() => {
    // Instant Bridge: Check for temporary selection in session
    const cached = sessionStorage.getItem(`preview_${propertyId}`);
    if (cached) setSessionPreview(cached);
    
    // Purge bridge ONLY once the cloud upload is confirmed by the database
    if (property && !property.isImageUpdating) {
      sessionStorage.removeItem(`preview_${propertyId}`);
      setSessionPreview(null);
    }
  }, [property, propertyId]);

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

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'maintenanceRequests'),
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: maintenanceRequests } = useCollection(maintenanceQuery);

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
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [uploadExpiryDate, setUploadExpiryDate] = useState<Date>();

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

    const memberIds = Array.from(new Set([
      user.uid,
      ...(property.memberIds || []),
      ...(tenants?.map(t => t.userId).filter(Boolean) || [])
    ]));

    setDocumentNonBlocking(docRef, {
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
    }, { merge: true });

    try {
      const storageRef = ref(storage, `documents/${user.uid}/${propertyId}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(uploadResult.ref);

      updateDocumentNonBlocking(docRef, {
        fileUrl: url,
        updatedAt: serverTimestamp(),
      });

      syncDocumentToDb({
        id: docId,
        propertyId: propertyId,
        landlordId: user.uid,
        fileName: file.name,
        fileUrl: url,
        documentType: 'property-asset',
        expiryDate: uploadExpiryDate ? uploadExpiryDate.toISOString() : null
      });

      toast({ title: "Vault Updated" });
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload Failed" });
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  if (isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!property) return <div className="p-8 text-center font-bold">Asset record not found.</div>;

  // Render Priority: 1. Session Bridge (while updating) > 2. Database URL > 3. Fallback
  const activeImageUrl = (property.isImageUpdating && sessionPreview) 
    ? sessionPreview 
    : property.imageUrl || `https://picsum.photos/seed/${propertyId}/800/600`;

  const gallery = property.imageUrls || [activeImageUrl].filter(Boolean);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">{property.addressLine1}</h1>
            <div className="flex items-center gap-4 mt-1">
              <p className="text-muted-foreground flex items-center font-medium font-body text-sm">
                <MapPin className="w-4 h-4 mr-1 text-primary/60" /> {property.city}, {property.zipCode}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/20 bg-white" asChild>
             <Link href={`/landlord/properties/${propertyId}/edit`}>
               <Edit3 className="w-4 h-4 mr-2" /> Specification
             </Link>
           </Button>
           <Button className="rounded-xl font-bold h-11 shadow-lg shadow-primary/20 bg-primary text-white" asChild>
             <Link href={`/landlord/messages?prop=${propertyId}`}>Message Residents</Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl relative">
            <div className="relative group">
              {gallery.length > 0 ? (
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
              ) : (
                <div className="h-[400px] bg-muted/30 flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-12 h-12 opacity-20" />
                </div>
              )}
            </div>
            <CardContent className="pt-8 text-left space-y-8">
              {/* Repositioned Configuration below the Carousel */}
              <div className="flex flex-wrap gap-4 items-center border-b pb-8 border-primary/5">
                <div className="flex items-center gap-3 text-primary font-bold px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
                  <Bed className="w-5 h-5" /> 
                  <span className="text-lg">{property.numberOfBedrooms} Bedrooms</span>
                </div>
                <div className="flex items-center gap-3 text-primary font-bold px-4 py-2 bg-primary/5 rounded-2xl border border-primary/10">
                  <Bath className="w-5 h-5" /> 
                  <span className="text-lg">{property.numberOfBathrooms} Bathrooms</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-6 items-end">
                <div className="space-y-1">
                  <Label className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest font-headline">Monthly Yield</Label>
                  <div className="flex items-center gap-3">
                    {isEditingRent ? (
                      <Input type="number" value={rentAmount || property.rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="rounded-xl h-11 w-32 bg-muted/20 border-none" />
                    ) : (
                      <p className="text-4xl font-bold text-primary font-headline">£{property.rentAmount}</p>
                    )}
                    <Button variant="ghost" size="icon" onClick={isEditingRent ? handleUpdateRent : () => setIsEditingRent(true)} className="rounded-full hover:bg-primary/5">
                      {isEditingRent ? <Save className="w-4 h-4 text-emerald-600" /> : <Edit3 className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 flex gap-4">
                  <div className="p-4 bg-primary/5 rounded-2xl flex-1 text-center border border-primary/5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline">Status</p>
                    <p className="font-bold font-headline text-primary">{property.isOccupied ? 'Occupied' : 'Vacant'}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid grid-cols-4 w-full bg-muted/30 p-1 rounded-xl h-auto gap-1 border border-primary/5">
              <TabsTrigger value="tenants" className="rounded-lg py-2.5 px-0 font-bold flex flex-col sm:flex-row items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-white">
                <Users className="w-4 h-4 sm:mr-2" />
                <span className="text-[10px] sm:text-sm">Residents</span>
              </TabsTrigger>
              <TabsTrigger value="docs" className="rounded-lg py-2.5 px-0 font-bold flex flex-col sm:flex-row items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-white">
                <FileText className="w-4 h-4 sm:mr-2" />
                <span className="text-[10px] sm:text-sm">Vault</span>
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-lg py-2.5 px-0 font-bold flex flex-col sm:flex-row items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-white">
                <Wrench className="w-4 h-4 sm:mr-2" />
                <span className="text-[10px] sm:text-sm">Repairs</span>
              </TabsTrigger>
              <TabsTrigger value="inspections" className="rounded-lg py-2.5 px-0 font-bold flex flex-col sm:flex-row items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-white">
                <FileCheck className="w-4 h-4 sm:mr-2" />
                <span className="text-[10px] sm:text-sm">Audits</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="mt-6 space-y-4">
               {tenants && tenants.length > 0 ? (
                 tenants.map(tenant => (
                    <div key={tenant.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center gap-4 text-left">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg font-headline">
                          {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold font-headline text-lg text-primary">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-xs text-muted-foreground font-medium font-body">{tenant.email}</p>
                        </div>
                      </div>
                      <div className="text-right hidden sm:block">
                        <Badge variant="outline" className="font-bold border-primary/20 text-primary mb-1">Active</Badge>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Ends: {tenant.leaseEndDate}</p>
                      </div>
                    </div>
                 ))
               ) : (
                 <div className="p-16 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-primary/10">
                    <p className="text-sm text-muted-foreground font-bold font-headline mb-4">No residents assigned.</p>
                    <Button asChild className="rounded-xl font-bold bg-primary text-white shadow-lg shadow-primary/10"><Link href="/landlord/tenants">Link Resident</Link></Button>
                 </div>
               )}
            </TabsContent>

            <TabsContent value="docs" className="mt-6 space-y-6">
              <Card className="border-none shadow-sm bg-primary/5 rounded-2xl border border-primary/5">
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-left">
                    <Label className="text-[10px] font-bold font-headline uppercase tracking-widest text-primary/60">Compliance Deadline</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left h-11 rounded-xl bg-white border-none shadow-sm font-body", !uploadExpiryDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {uploadExpiryDate ? format(uploadExpiryDate, "PPP") : "Select future date..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                        <Calendar mode="single" selected={uploadExpiryDate} onSelect={setUploadExpiryDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-end">
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleUploadDocument} />
                    <Button onClick={() => fileInputRef.current?.click()} className="w-full rounded-xl h-11 font-bold shadow-lg shadow-primary/20 bg-primary text-white" disabled={isUploadingDoc}>
                      {isUploadingDoc ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Add Document
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-primary text-white">
            <CardHeader className="text-left">
              <CardTitle className="text-lg font-headline flex items-center">
                <ShieldAlert className="w-5 h-5 mr-3" />
                Asset Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-left">
              <div className="space-y-2">
                 <div className="flex justify-between items-center text-xs font-bold opacity-60"><span>Compliance</span><span>95%</span></div>
                 <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden"><div className="h-full bg-emerald-400 w-[95%]"></div></div>
              </div>
              <p className="text-xs font-medium font-body leading-relaxed opacity-80">This asset is verified and compliant with UK residential safety regulations.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
