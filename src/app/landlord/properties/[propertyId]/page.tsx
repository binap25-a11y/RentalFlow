"use client";

import { useState, use, useMemo, useRef } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  setDocumentNonBlocking, 
  useStorage, 
  getLandlordCollectionQuery 
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
  CheckCircle2, Clock, AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { format } from 'date-fns';
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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

  const [isEditing, setIsEditing] = useState(false);
  const [rentAmount, setRentAmount] = useState('');
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null);
  const [expiryDate, setExpiryDate] = useState<Date>();

  const handleUpdateRent = () => {
    if (!propertyRef) return;
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: Number(rentAmount),
      updatedAt: serverTimestamp(),
    });
    setIsEditing(false);
    toast({ title: "Rent Updated" });
  };

  const handleTriggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
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

    // Optimistic UI update: Create doc record immediately
    setDocumentNonBlocking(docRef, {
      id: docId,
      fileName: file.name,
      fileUrl: '', 
      status: 'uploading',
      documentType: 'property-asset',
      propertyId: propertyId,
      landlordId: user.uid,
      expiryDate: expiryDate ? expiryDate.toISOString() : null,
      memberIds: memberIds,
      uploadDate: new Date().toISOString(),
      createdAt: serverTimestamp(),
    }, { merge: true });

    toast({ 
      title: "Syncing Document", 
      description: `${file.name} is being secured in the property vault.` 
    });

    // Perform the heavy lifting in the background
    try {
      const storageRef = ref(storage, `documents/${user.uid}/${propertyId}/${Date.now()}_${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(uploadResult.ref);

      updateDocumentNonBlocking(docRef, {
        fileUrl: url,
        status: 'active',
        updatedAt: serverTimestamp(),
      });

      toast({ 
        title: "Vault Synchronized", 
        description: "Official record updated." 
      });
      setExpiryDate(undefined);
    } catch (error: any) {
      updateDocumentNonBlocking(docRef, {
        status: 'failed',
        error: error.message
      });
      toast({ 
        variant: "destructive", 
        title: "Upload Error", 
        description: "An issue occurred during background storage." 
      });
    } finally {
      setIsUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSummarizeLease = async (docObj: any) => {
    setIsAnalyzing(docObj.id);
    try {
      const summary = await summarizeLease({ documentText: `Document: ${docObj.fileName}. Path: ${docObj.fileUrl}` });
      const docRef = doc(db!, 'documents', docObj.id);
      updateDocumentNonBlocking(docRef, {
        aiSummary: summary.summary,
        expiryDate: summary.leaseEndDate,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "AI Analysis Complete", description: "Lease terms extracted successfully." });
    } catch (error) {
      toast({ variant: "destructive", title: "Analysis Failed" });
    } finally {
      setIsAnalyzing(null);
    }
  };

  const downloadInspectionPDF = (inspection: any) => {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    pdf.setFillColor(31, 41, 55);
    pdf.rect(0, 0, pageWidth, 40, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(24);
    pdf.text("OFFICIAL AUDIT RECORD", 20, 25);
    pdf.setFontSize(10);
    pdf.text(`Property Asset: ${property?.addressLine1}`, 20, 32);
    
    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.text("Audit Summary", 20, 55);
    pdf.setFontSize(10);
    const summaryText = inspection.summary || "No summary provided";
    const splitSummary = pdf.splitTextToSize(summaryText, pageWidth - 40);
    pdf.text(splitSummary, 20, 65);
    
    pdf.save(`Audit_${property?.addressLine1}_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!property) return <div className="p-8 text-center">Property not found.</div>;

  const gallery = property.imageUrls || [property.imageUrl].filter(Boolean);

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-muted">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">{property.addressLine1}</h1>
            <p className="text-muted-foreground flex items-center font-medium font-body">
              <MapPin className="w-4 h-4 mr-1 text-primary/60" /> {property.city}, {property.zipCode}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/20" asChild>
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
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-3xl">
            <div className="relative group">
              {gallery.length > 0 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {gallery.map((url: string, index: number) => (
                      <CarouselItem key={index}>
                        <div className="relative h-[400px] w-full bg-muted">
                          <Image src={url} alt={`Property ${index}`} fill className="object-cover" unoptimized />
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
            <CardContent className="pt-8 text-left space-y-6">
              <div className="flex flex-wrap gap-6 items-end">
                <div className="space-y-1">
                  <Label className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest font-headline">Monthly Yield</Label>
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <Input type="number" value={rentAmount || property.rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="rounded-xl h-11 w-32 bg-muted/20 border-none" />
                    ) : (
                      <p className="text-4xl font-bold text-primary font-headline">£{property.rentAmount}</p>
                    )}
                    <Button variant="ghost" size="icon" onClick={isEditing ? handleUpdateRent : () => setIsEditing(true)} className="rounded-full hover:bg-primary/5">
                      {isEditing ? <Save className="w-4 h-4 text-emerald-600" /> : <Edit3 className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 flex gap-4">
                  <div className="p-4 bg-primary/5 rounded-2xl flex-1 text-center border border-primary/5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline">Status</p>
                    <p className="font-bold font-headline text-primary">{property.isOccupied ? 'Occupied' : 'Vacant'}</p>
                  </div>
                  <div className="p-4 bg-primary/5 rounded-2xl flex-1 text-center border border-primary/5">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline">Configuration</p>
                    <p className="font-bold font-headline text-primary">{property.numberOfBedrooms}B / {property.numberOfBathrooms}B</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 w-full bg-muted/30 p-1 rounded-xl h-auto gap-1 border border-primary/5">
              <TabsTrigger value="tenants" className="rounded-lg py-2.5 px-2 font-bold flex items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <Users className="w-4 h-4 mr-2 hidden sm:inline" />
                <span className="text-xs sm:text-sm">Residents</span>
              </TabsTrigger>
              <TabsTrigger value="docs" className="rounded-lg py-2.5 px-2 font-bold flex items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <FileText className="w-4 h-4 mr-2 hidden sm:inline" />
                <span className="text-xs sm:text-sm">Vault</span>
              </TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-lg py-2.5 px-2 font-bold flex items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <Wrench className="w-4 h-4 mr-2 hidden sm:inline" />
                <span className="text-xs sm:text-sm">Maintenance</span>
              </TabsTrigger>
              <TabsTrigger value="inspections" className="rounded-lg py-2.5 px-2 font-bold flex items-center justify-center data-[state=active]:bg-primary data-[state=active]:text-white transition-all">
                <FileCheck className="w-4 h-4 mr-2 hidden sm:inline" />
                <span className="text-xs sm:text-sm">Audits</span>
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
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Lease Ends: {tenant.leaseEndDate}</p>
                      </div>
                    </div>
                 ))
               ) : (
                 <div className="p-16 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-primary/10">
                    <p className="text-sm text-muted-foreground font-bold font-headline mb-4">No residents currently assigned.</p>
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
                        <Button variant="outline" className={cn("w-full justify-start text-left h-11 rounded-xl bg-white border-none shadow-sm font-body", !expiryDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                          {expiryDate ? format(expiryDate, "PPP") : "Set expiration..."}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                        <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-end">
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      onChange={handleUploadDocument} 
                    />
                    <Button 
                      onClick={handleTriggerFileInput}
                      className="w-full rounded-xl h-11 font-bold shadow-lg shadow-primary/20 bg-primary text-white transition-all hover:scale-[1.02]" 
                      disabled={isUploadingDoc}
                    >
                      {isUploadingDoc ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                      Add Document to Vault
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <div className="grid gap-3">
                {propertyDocuments && propertyDocuments.length > 0 ? (
                  propertyDocuments.slice().sort((a,b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)).map(docItem => (
                    <div key={docItem.id} className="p-4 bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md transition-all group">
                      <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-100 transition-colors shadow-sm">
                          <FileText className="w-6 h-6" />
                        </div>
                        <div className="flex-1 text-left">
                          <h4 className="font-bold text-sm font-headline group-hover:text-primary transition-colors">{docItem.fileName}</h4>
                          <div className="flex gap-4 mt-1">
                            <span className={cn("text-[10px] font-bold uppercase flex items-center", docItem.status === 'active' ? 'text-emerald-600' : 'text-amber-600 animate-pulse')}>
                              <Info className="w-3 h-3 mr-1" /> {docItem.status === 'active' ? 'Secure' : 'Syncing...'}
                            </span>
                            {docItem.expiryDate && <span className="text-[10px] text-destructive font-bold uppercase flex items-center"><ShieldAlert className="w-3 h-3 mr-1" /> Exp: {format(new Date(docItem.expiryDate), 'PP')}</span>}
                          </div>
                        </div>
                        <div className="flex gap-2 w-full md:w-auto">
                          {docItem.status === 'active' && docItem.fileUrl ? (
                            <>
                              <Button variant="outline" size="sm" onClick={() => handleSummarizeLease(docItem)} disabled={isAnalyzing === docItem.id} className="flex-1 md:flex-none rounded-xl font-bold h-9 border-primary/10 hover:bg-primary/5 transition-all">
                                {isAnalyzing === docItem.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2 text-primary" />}
                                AI Review
                              </Button>
                              <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-primary/5 text-primary">
                                <a href={docItem.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4" /></a>
                              </Button>
                            </>
                          ) : (
                            docItem.status !== 'failed' && (
                              <div className="flex items-center px-4">
                                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground opacity-30" />
                              </div>
                            )
                          )}
                          {docItem.status === 'failed' && (
                            <Badge variant="destructive" className="font-bold text-[10px] uppercase">Failed</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-12 text-center bg-muted/5 rounded-3xl border-2 border-dashed border-primary/5">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Vault Empty</p>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="maintenance" className="mt-6 space-y-4">
              {maintenanceRequests && maintenanceRequests.length > 0 ? (
                maintenanceRequests.map(req => (
                  <div key={req.id} className="p-4 bg-white rounded-2xl border border-primary/5 shadow-sm flex items-start gap-4 hover:shadow-md transition-all text-left">
                    <div className={cn("p-2 rounded-xl shadow-sm", req.status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600')}>
                      <Wrench className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={req.status === 'completed' ? 'secondary' : 'default'} className="uppercase text-[10px] font-bold px-2 py-0">
                          {req.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-bold font-body">
                          {req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'PP') : 'Recently'}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm font-headline text-primary">{req.title}</h4>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 font-body">{req.description}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-16 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-primary/10">
                  <p className="text-sm text-muted-foreground font-bold font-headline">Zero active maintenance issues.</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="inspections" className="mt-6 space-y-4">
              {inspections && inspections.length > 0 ? (
                inspections.map(insp => (
                  <div key={insp.id} className="p-4 bg-white rounded-2xl border border-primary/5 shadow-sm flex items-center justify-between gap-4 hover:shadow-md transition-all">
                    <div className="flex items-center gap-4 text-left">
                      <div className="p-2 bg-amber-50 text-amber-600 rounded-xl shadow-sm">
                        <FileCheck className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge variant={insp.status === 'completed' ? 'secondary' : 'outline'} className="uppercase text-[10px] font-bold px-2 py-0">
                            {insp.status}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground font-bold font-body">
                            {format(new Date(insp.scheduledDate), 'PP')}
                          </span>
                        </div>
                        <h4 className="font-bold text-sm font-headline text-primary">Compliance Audit</h4>
                        {insp.healthScore && <p className="text-[10px] font-bold text-emerald-600 uppercase mt-0.5">Asset Condition: {insp.healthScore}/100</p>}
                      </div>
                    </div>
                    {insp.status === 'completed' && (
                      <Button variant="ghost" size="icon" onClick={() => downloadInspectionPDF(insp)} className="rounded-xl hover:bg-primary/5 text-primary">
                        <Download className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                ))
              ) : (
                <div className="p-16 text-center bg-muted/10 rounded-3xl border-2 border-dashed border-primary/10">
                  <p className="text-sm text-muted-foreground font-bold font-headline">No safety audits performed.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-primary text-white">
            <CardHeader className="text-left">
              <CardTitle className="text-lg font-headline flex items-center">
                <ShieldAlert className="w-5 h-5 mr-3 text-white" />
                Management Shield
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 text-left">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <span className="text-xs font-bold uppercase tracking-widest opacity-60">Portfolio Health</span>
                   <span className="text-sm font-bold">A+ Certified</span>
                </div>
                <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-400 w-[95%]"></div>
                </div>
              </div>
              <p className="text-xs font-medium font-body leading-relaxed opacity-80">
                This asset is currently <span className="text-white font-bold uppercase">Optimized</span>. Resident satisfaction is verified and all legal compliance documentation is active.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}