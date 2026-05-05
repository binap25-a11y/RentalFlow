
"use client";

import { useState, use, useMemo } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking, useStorage } from '@/firebase';
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
  Calendar as CalendarIcon, Sparkles, Image as ImageIcon
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

export default function PropertyManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const propertyId = resolvedParams.propertyId;
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();
  const router = useRouter();

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

  const handleUploadDocument = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !db || !storage || !property) return;

    setIsUploadingDoc(true);
    const docId = doc(collection(db, 'documents')).id;

    try {
      const storageRef = ref(storage, `documents/${user.uid}/${propertyId}/${file.name}`);
      const uploadResult = await uploadBytes(storageRef, file);
      const url = await getDownloadURL(uploadResult.ref);

      const docRef = doc(db, 'documents', docId);
      
      setDocumentNonBlocking(docRef, {
        id: docId,
        fileName: file.name,
        fileUrl: url,
        documentType: 'property-asset',
        propertyId: propertyId,
        userId: user.uid, 
        landlordId: user.uid,
        expiryDate: expiryDate ? expiryDate.toISOString() : null,
        memberIds: property.memberIds || [user.uid],
        uploadDate: new Date().toISOString(),
        createdAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: "Document Uploaded" });
      setExpiryDate(undefined);
    } catch (error: any) {
      toast({ variant: "destructive", title: "Upload Failed", description: error.message });
    } finally {
      setIsUploadingDoc(false);
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

  if (isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!property) return <div className="p-8 text-center">Property not found.</div>;

  const gallery = property.imageUrls || [property.imageUrl].filter(Boolean);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">{property.addressLine1}</h1>
            <p className="text-muted-foreground flex items-center font-medium font-body"><MapPin className="w-4 h-4 mr-1 text-primary/60" /> {property.zipCode}</p>
          </div>
        </div>
        <div className="flex gap-2">
           <Button variant="outline" className="rounded-xl font-bold h-11" asChild>
             <Link href={`/landlord/properties/${propertyId}/edit`}><Edit3 className="w-4 h-4 mr-2" /> Specification</Link>
           </Button>
           <Button className="rounded-xl font-bold h-11 shadow-lg shadow-primary/20" asChild>
             <Link href={`/landlord/messages?prop=${propertyId}`}>Message Resident</Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden bg-card rounded-2xl">
            <div className="relative group">
              {gallery.length > 0 ? (
                <Carousel className="w-full">
                  <CarouselContent>
                    {gallery.map((url: string, index: number) => (
                      <CarouselItem key={index}>
                        <div className="relative h-[400px] w-full">
                          <Image src={url} alt={`Property ${index}`} fill className="object-cover" />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="left-4" />
                  <CarouselNext className="right-4" />
                </Carousel>
              ) : (
                <div className="h-[400px] bg-muted flex items-center justify-center text-muted-foreground">
                  <ImageIcon className="w-12 h-12" />
                </div>
              )}
            </div>
            <CardContent className="pt-8 text-left space-y-6">
              <div className="flex flex-wrap gap-6 items-end">
                <div className="space-y-1">
                  <Label className="text-muted-foreground font-bold text-[10px] uppercase tracking-widest font-headline">Monthly Rent</Label>
                  <div className="flex items-center gap-3">
                    {isEditing ? (
                      <Input type="number" value={rentAmount || property.rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="rounded-xl h-11 w-32" />
                    ) : (
                      <p className="text-4xl font-bold text-primary font-headline">£{property.rentAmount}</p>
                    )}
                    <Button variant="ghost" size="icon" onClick={isEditing ? handleUpdateRent : () => setIsEditing(true)} className="rounded-full">
                      {isEditing ? <Save className="w-4 h-4 text-emerald-600" /> : <Edit3 className="w-4 h-4 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="flex-1 flex gap-4">
                  <div className="p-4 bg-muted/40 rounded-2xl flex-1 text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline">Status</p>
                    <p className="font-bold font-headline">{property.isOccupied ? 'Occupied' : 'Vacant'}</p>
                  </div>
                  <div className="p-4 bg-muted/40 rounded-2xl flex-1 text-center">
                    <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline">Bed/Bath</p>
                    <p className="font-bold font-headline">{property.numberOfBedrooms} / {property.numberOfBathrooms}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants" className="w-full">
            <div className="overflow-x-auto pb-2 -mx-1 px-1 no-scrollbar">
              <TabsList className="inline-flex w-max min-w-full bg-muted/50 p-1 rounded-xl h-auto">
                <TabsTrigger value="tenants" className="rounded-lg py-2.5 px-6 font-bold whitespace-nowrap"><Users className="w-4 h-4 mr-2" /> Residents</TabsTrigger>
                <TabsTrigger value="docs" className="rounded-lg py-2.5 px-6 font-bold whitespace-nowrap"><FileText className="w-4 h-4 mr-2" /> Portfolio Vault</TabsTrigger>
                <TabsTrigger value="maintenance" className="rounded-lg py-2.5 px-6 font-bold whitespace-nowrap"><Wrench className="w-4 h-4 mr-2" /> Maintenance</TabsTrigger>
                <TabsTrigger value="inspections" className="rounded-lg py-2.5 px-6 font-bold whitespace-nowrap"><FileCheck className="w-4 h-4 mr-2" /> Audits</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="tenants" className="mt-6 space-y-4">
               {tenants && tenants.length > 0 ? (
                 tenants.map(tenant => (
                    <div key={tenant.id} className="flex items-center justify-between p-4 bg-white rounded-2xl border border-primary/5 shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg font-headline">
                          {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                        </div>
                        <div className="text-left">
                          <p className="font-bold font-headline text-lg">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-xs text-muted-foreground font-medium font-body">{tenant.email}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant="outline" className="font-bold border-primary/20 text-primary mb-1">Active Resident</Badge>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase">Lease Ends: {tenant.leaseEndDate}</p>
                      </div>
                    </div>
                 ))
               ) : (
                 <div className="p-12 text-center bg-muted/20 rounded-2xl border-2 border-dashed">
                    <p className="text-sm text-muted-foreground font-bold font-headline mb-4">No residents currently assigned.</p>
                    <Button asChild className="rounded-xl"><Link href="/landlord/tenants">Assign Resident</Link></Button>
                 </div>
               )}
            </TabsContent>

            <TabsContent value="docs" className="mt-6 space-y-6">
              <Card className="border-none shadow-sm bg-primary/5 rounded-2xl">
                <CardContent className="pt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 text-left">
                    <Label className="text-[10px] font-bold font-headline uppercase tracking-widest text-primary/60">Compliance Expiry</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left h-11 rounded-xl bg-white border-none shadow-sm", !expiryDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {expiryDate ? format(expiryDate, "PPP") : "Set optional expiry"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 rounded-2xl border-none shadow-2xl" align="start">
                        <Calendar mode="single" selected={expiryDate} onSelect={setExpiryDate} initialFocus />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="flex items-end">
                    <input type="file" id="doc-upload" className="hidden" onChange={handleUploadDocument} disabled={isUploadingDoc} />
                    <Button asChild className="w-full rounded-xl h-11 font-bold shadow-lg shadow-primary/20" disabled={isUploadingDoc}>
                      <label htmlFor="doc-upload" className="cursor-pointer">
                        {isUploadingDoc ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        Add Document to Vault
                      </label>
                    </Button>
                  </div>
                </CardContent>
              </Card>
              
              <div className="grid gap-3">
                {propertyDocuments?.map(docItem => (
                  <div key={docItem.id} className="p-4 bg-white rounded-2xl border border-primary/5 shadow-sm hover:shadow-md transition-all group">
                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center">
                      <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl group-hover:bg-blue-100 transition-colors">
                        <FileText className="w-6 h-6" />
                      </div>
                      <div className="flex-1 text-left">
                        <h4 className="font-bold text-sm font-headline group-hover:text-primary transition-colors">{docItem.fileName}</h4>
                        <div className="flex gap-4 mt-1">
                          <span className="text-[10px] text-muted-foreground font-bold uppercase flex items-center"><Info className="w-3 h-3 mr-1" /> {docItem.documentType}</span>
                          {docItem.expiryDate && <span className="text-[10px] text-amber-600 font-bold uppercase flex items-center"><ShieldAlert className="w-3 h-3 mr-1" /> Exp: {format(new Date(docItem.expiryDate), 'PP')}</span>}
                        </div>
                      </div>
                      <div className="flex gap-2 w-full md:w-auto">
                        <Button variant="outline" size="sm" onClick={() => handleSummarizeLease(docItem)} disabled={isAnalyzing === docItem.id} className="flex-1 md:flex-none rounded-xl font-bold h-9 border-primary/10 hover:bg-primary/5">
                          {isAnalyzing === docItem.id ? <Loader2 className="w-3 h-3 animate-spin mr-2" /> : <Sparkles className="w-3 h-3 mr-2 text-primary" />}
                          AI Analysis
                        </Button>
                        <Button variant="ghost" size="icon" asChild className="rounded-xl hover:bg-primary/5">
                          <a href={docItem.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="w-4 h-4 text-primary" /></a>
                        </Button>
                      </div>
                    </div>
                    {docItem.aiSummary && (
                      <div className="mt-4 p-4 bg-primary/5 rounded-xl border border-primary/10 text-left">
                        <p className="text-[10px] font-bold text-primary uppercase tracking-widest mb-2 font-headline">AI Vault Summary</p>
                        <p className="text-xs font-bold leading-relaxed font-body text-black">{docItem.aiSummary}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="bg-primary text-white text-left">
              <CardTitle className="text-lg font-headline flex items-center">
                <ShieldAlert className="w-5 h-5 mr-3" />
                Management Shield
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6 text-left">
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                   <span className="text-xs font-bold text-muted-foreground uppercase font-headline">Portfolio Health</span>
                   <span className="text-sm font-bold text-emerald-600">A+ Verified</span>
                </div>
                <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                   <div className="h-full bg-emerald-500 w-[95%]"></div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground font-medium font-body leading-relaxed">
                Your asset is currently <span className="text-primary font-bold uppercase">Optimized</span>. Resident satisfaction is high and all compliance documents are valid.
              </p>
              <Button variant="outline" className="w-full rounded-xl font-bold h-11 border-primary/20 hover:bg-primary hover:text-white transition-all">
                Portfolio Health Audit
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
