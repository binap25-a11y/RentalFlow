
"use client";

import { useState, use, useRef } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Building2, MapPin, Users, Wrench, FileCheck, Phone, 
  Trash2, Edit3, Loader2, Save, Plus, ArrowLeft,
  Download, FileText, Info, Camera, Image as ImageIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { format, isBefore, addDays } from "date-fns";
import Image from "next/image";
import Link from "next/link";

const DOC_TYPES = ['Tenancy Agreement', 'EICR', 'Gas Safety', 'EPC', 'Insurance', 'Other'];

export default function PropertyManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const { propertyId } = resolvedParams;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const propertyRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid, 'properties', propertyId);
  }, [db, user, propertyId]);

  const { data: property, isLoading: isPropLoading } = useDoc(propertyRef);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'properties', propertyId, 'tenants');
  }, [db, user, propertyId]);

  const { data: tenants } = useCollection(tenantsQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'documents'), 
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, user, propertyId]);

  const { data: documents } = useCollection(docsQuery);

  const photos = documents?.filter(d => d.documentType === 'Property Photo') || [];
  const complianceDocs = documents?.filter(d => d.documentType !== 'Property Photo') || [];

  const [isEditing, setIsEditing] = useState(false);
  const [rentAmount, setRentAmount] = useState('');
  const [newDocType, setNewDocType] = useState('Tenancy Agreement');
  const [newDocExpiry, setNewDocExpiry] = useState('');
  const [isUploading, setIsUploading] = useState(false);

  const handleUpdateRent = () => {
    if (!propertyRef) return;
    const rentValue = Number(rentAmount);
    if (rentValue < 0) {
      toast({ variant: "destructive", title: "Invalid Rent", description: "Monthly rent cannot be negative." });
      return;
    }
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: rentValue,
      updatedAt: serverTimestamp(),
    });
    setIsEditing(false);
    toast({ title: "Rent Updated", description: "Property rent has been updated." });
  };

  const handleUploadDoc = () => {
    if (!user || !db) return;
    setIsUploading(true);
    const docId = doc(collection(db, 'dummy')).id;
    const docRef = doc(db, 'documents', docId);

    setDocumentNonBlocking(docRef, {
      id: docId,
      fileName: `${newDocType}_${propertyId}.pdf`,
      fileUrl: `https://rentalflow.docs/simulated/${docId}`,
      documentType: newDocType,
      propertyId: propertyId,
      expiryDate: newDocExpiry,
      uploadedByUserId: user.uid, // REQUIRED BY SECURITY RULES
      landlordId: user.uid,       // REQUIRED BY SECURITY RULES
      createdAt: serverTimestamp(),
    }, { merge: true });

    setTimeout(() => {
      setIsUploading(false);
      setNewDocExpiry('');
      toast({ title: "Document Uploaded", description: `${newDocType} has been saved to your vault.` });
    }, 1000);
  };

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && user && db) {
      setIsUploading(true);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        const docId = doc(collection(db, 'dummy')).id;
        const docRef = doc(db, 'documents', docId);

        setDocumentNonBlocking(docRef, {
          id: docId,
          fileName: file.name,
          fileUrl: base64String,
          documentType: 'Property Photo',
          propertyId: propertyId,
          uploadedByUserId: user.uid, // REQUIRED BY SECURITY RULES
          landlordId: user.uid,       // REQUIRED BY SECURITY RULES
          createdAt: serverTimestamp(),
        }, { merge: true });

        setIsUploading(false);
        toast({ title: "Photo Added", description: "Image added to property gallery." });
      };
      reader.readAsDataURL(file);
    }
  };

  const getDocStatus = (expiryDate: string) => {
    if (!expiryDate) return { label: 'Permanent', variant: 'secondary' as const };
    const expiry = new Date(expiryDate);
    const today = new Date();
    if (isBefore(expiry, today)) return { label: 'Expired', variant: 'destructive' as const };
    if (isBefore(expiry, addDays(today, 30))) return { label: 'Renewal Due', variant: 'default' as const };
    return { label: 'Valid', variant: 'outline' as const };
  };

  if (isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!property) return <div>Property not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">{property.addressLine1}</h1>
          <p className="text-muted-foreground flex items-center"><MapPin className="w-4 h-4 mr-1" /> {property.zipCode}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Financial Details</CardTitle>
                <Badge variant={property.isOccupied ? "default" : "secondary"}>
                  {property.isOccupied ? "Occupied" : "Vacant"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="space-y-1 flex-1">
                  <Label>Monthly Rent (£)</Label>
                  {isEditing ? (
                    <Input 
                      type="number" 
                      min="0"
                      value={rentAmount || property.rentAmount} 
                      onChange={(e) => setRentAmount(e.target.value)}
                    />
                  ) : (
                    <p className="text-3xl font-bold text-primary">£{property.rentAmount}</p>
                  )}
                </div>
                {isEditing ? (
                  <Button onClick={handleUpdateRent} className="rounded-xl"><Save className="w-4 h-4 mr-2" /> Save</Button>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl"><Edit3 className="w-4 h-4 mr-2" /> Edit Rent</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid w-full grid-cols-6 bg-muted/50 p-1">
              <TabsTrigger value="tenants"><Users className="w-4 h-4 mr-2" /> Residents</TabsTrigger>
              <TabsTrigger value="gallery"><Camera className="w-4 h-4 mr-2" /> Gallery</TabsTrigger>
              <TabsTrigger value="docs"><FileText className="w-4 h-4 mr-2" /> Vault</TabsTrigger>
              <TabsTrigger value="maintenance"><Wrench className="w-4 h-4 mr-2" /> Maintenance</TabsTrigger>
              <TabsTrigger value="inspections"><FileCheck className="w-4 h-4 mr-2" /> Inspections</TabsTrigger>
              <TabsTrigger value="contacts"><Phone className="w-4 h-4 mr-2" /> Contacts</TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-headline">Assigned Residents</h3>
                <Button size="sm" className="rounded-xl" asChild>
                  <Link href="/landlord/tenants">
                    <Plus className="w-4 h-4 mr-2" /> Assign Resident
                  </Link>
                </Button>
              </div>
              
              {!tenants || tenants.length === 0 ? (
                <Card className="border-dashed border-2 py-10 flex flex-col items-center justify-center text-center">
                  <Badge variant="outline" className="mb-4 text-amber-600 bg-amber-50">PROPERTY VACANT</Badge>
                  <p className="text-sm text-muted-foreground">No tenants currently assigned to this property.</p>
                </Card>
              ) : (
                tenants.map(tenant => (
                  <Card key={tenant.id} className="border-none shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                          {tenant.firstName[0]}{tenant.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-xs text-muted-foreground">{tenant.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="gallery" className="mt-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-headline">Property Gallery</h3>
                <Button size="sm" className="rounded-xl" onClick={() => fileInputRef.current?.click()}>
                  <Plus className="w-4 h-4 mr-2" /> Add Photos
                </Button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAddPhoto} />
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="relative aspect-video rounded-xl overflow-hidden group shadow-sm border">
                  <Image src={property.imageUrl || 'https://picsum.photos/seed/main/800/600'} alt="Main" fill className="object-cover" />
                  <div className="absolute top-2 left-2">
                    <Badge className="bg-primary text-[10px]">MAIN PHOTO</Badge>
                  </div>
                </div>
                {photos.map((photo) => (
                  <div key={photo.id} className="relative aspect-video rounded-xl overflow-hidden group shadow-sm border">
                    <Image src={photo.fileUrl} alt="Gallery item" fill className="object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <Button variant="destructive" size="icon" className="h-8 w-8 rounded-full">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="docs" className="mt-6 space-y-6">
              <Card className="border-none shadow-sm bg-primary/5">
                <CardContent className="p-6">
                  <h4 className="font-bold mb-4 flex items-center"><Plus className="w-4 h-4 mr-2" /> Add Compliance Document</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>Document Type</Label>
                      <Select value={newDocType} onValueChange={setNewDocType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {DOC_TYPES.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Expiry Date</Label>
                      <Input type="date" value={newDocExpiry} onChange={(e) => setNewDocExpiry(e.target.value)} />
                    </div>
                    <div className="flex items-end">
                      <Button className="w-full rounded-xl" onClick={handleUploadDoc} disabled={isUploading}>
                        {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Upload to Vault"}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <h3 className="text-lg font-bold font-headline">Compliance Vault</h3>
                <div className="grid gap-4">
                  {!complianceDocs || complianceDocs.length === 0 ? (
                    <p className="text-center py-10 text-muted-foreground italic">No compliance documents uploaded yet.</p>
                  ) : (
                    complianceDocs.map(doc => {
                      const status = getDocStatus(doc.expiryDate);
                      return (
                        <Card key={doc.id} className="border-none shadow-sm group hover:bg-muted/30 transition-colors">
                          <CardContent className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <div className="p-3 bg-white rounded-xl shadow-sm">
                                <FileText className="w-5 h-5 text-primary" />
                              </div>
                              <div>
                                <h4 className="font-bold text-sm">{doc.documentType}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {doc.expiryDate ? `Expires: ${format(new Date(doc.expiryDate), 'PPP')}` : 'Permanent Record'}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3">
                              <Badge variant={status.variant}>{status.label}</Badge>
                              <Button variant="ghost" size="icon" className="rounded-full"><Download className="w-4 h-4" /></Button>
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

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader><CardTitle>Portfolio Status</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-accent/10 rounded-xl flex gap-3">
                <Info className="w-5 h-5 text-accent shrink-0" />
                <p className="text-xs text-accent-foreground leading-relaxed italic">
                  Keep your EICR and Gas Safety up to date to ensure legal compliance for your property.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
