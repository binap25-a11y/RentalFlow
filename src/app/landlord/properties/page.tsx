
"use client";

import { useState } from 'react';
import { useUser, useFirestore, useStorage, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, MapPin, Plus, Trash2, Edit3, Loader2, Image as ImageIcon, X, Images } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";

export default function PropertiesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'properties');
  }, [db, user]);

  const { data: properties, isLoading } = useCollection(propertiesQuery);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');
  
  // File State
  const [mainFile, setMainFile] = useState<File | null>(null);
  const [additionalFiles, setAdditionalFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMainFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const handleAdditionalFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      setAdditionalFiles(prev => [...prev, ...Array.from(files)]);
    }
  };

  const clearMainImage = () => {
    setMainFile(null);
    setPreviewUrl(null);
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !storage) return;

    const rentValue = Number(rentAmount);
    if (rentValue < 0) {
      toast({ variant: "destructive", title: "Invalid Rent", description: "Monthly rent cannot be negative." });
      return;
    }

    setIsSubmitting(true);
    const propertyId = doc(collection(db, 'dummy')).id;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);

    try {
      let mainImageUrl = 'https://picsum.photos/seed/rental/800/600';
      if (mainFile) {
        const mainImageRef = ref(storage, `properties/${propertyId}/main_${mainFile.name}`);
        await uploadBytes(mainImageRef, mainFile);
        mainImageUrl = await getDownloadURL(mainImageRef);
      }

      setDocumentNonBlocking(propertyRef, {
        id: propertyId,
        landlordId: user.uid,
        addressLine1: address,
        city: 'London',
        state: 'UK',
        zipCode: zipCode,
        description: description,
        numberOfBedrooms: 2,
        numberOfBathrooms: 1,
        rentAmount: rentValue,
        isOccupied: false,
        imageUrl: mainImageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      for (const file of additionalFiles) {
        const docId = doc(collection(db, 'dummy')).id;
        const galleryRef = ref(storage, `properties/${propertyId}/gallery/${docId}_${file.name}`);
        await uploadBytes(galleryRef, file);
        const url = await getDownloadURL(galleryRef);

        const docRef = doc(db, 'documents', docId);
        setDocumentNonBlocking(docRef, {
          id: docId,
          fileName: file.name,
          fileUrl: url,
          documentType: 'Property Photo',
          propertyId: propertyId,
          uploadedByUserId: user.uid,
          landlordId: user.uid,
          createdAt: serverTimestamp(),
        }, { merge: true });
      }

      toast({ title: "Property Added", description: "Property and gallery photos have been saved." });
      setIsAddDialogOpen(false);
      setAddress('');
      setZipCode('');
      setRentAmount('');
      setDescription('');
      setMainFile(null);
      setPreviewUrl(null);
      setAdditionalFiles([]);
    } catch (error) {
      toast({ variant: "destructive", title: "Upload Failed", description: "Could not save property photos." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);
    deleteDocumentNonBlocking(propertyRef);
    toast({ title: "Property Deleted" });
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Properties</h1>
          <p className="text-muted-foreground font-medium">Manage your rental assets and occupancy status.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Add New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddProperty}>
              <DialogHeader>
                <DialogTitle>Add Property</DialogTitle>
                <DialogDescription>Enter the details of your new rental property.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-4">
                  <Label>Property Photos (Bucket Storage)</Label>
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Main Banner</Label>
                    {previewUrl ? (
                      <div className="relative h-40 w-full rounded-xl overflow-hidden border">
                        <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                        <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-8 w-8 rounded-full" onClick={clearMainImage}>
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-muted/30 hover:bg-muted/50">
                        <ImageIcon className="w-6 h-6 mb-2 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground font-semibold">Upload Banner</p>
                        <input type="file" className="hidden" accept="image/*" onChange={handleMainFileChange} />
                      </label>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Gallery</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {additionalFiles.map((file, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border group">
                          <Image src={URL.createObjectURL(file)} alt="Gallery" fill className="object-cover" />
                          <button type="button" onClick={() => removeAdditionalImage(idx)} className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40">
                        <Images className="w-5 h-5 text-muted-foreground" />
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleAdditionalFilesChange} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Postcode</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent">Monthly Rent (£)</Label>
                    <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Save to Cloud Storage"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties?.map((property) => (
          <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="relative h-48 w-full">
              <Image src={property.imageUrl} alt={property.addressLine1} fill className="object-cover transition-transform group-hover:scale-105" />
              <Badge className={`absolute top-4 right-4 ${property.isOccupied ? 'bg-green-500' : 'bg-amber-500'}`}>
                {property.isOccupied ? 'Occupied' : 'Vacant'}
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-lg font-bold font-headline">{property.addressLine1}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center"><MapPin className="w-3 h-3 mr-1" /> {property.zipCode}</p>
            </CardHeader>
            <CardFooter className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-lg h-9 text-xs font-bold" asChild>
                <Link href={`/landlord/properties/${property.id}`}><Edit3 className="w-3 h-3 mr-2" /> Manage</Link>
              </Button>
              <Button variant="ghost" className="rounded-lg h-9 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProperty(property.id)}>
                <Trash2 className="w-3 h-3 mr-2" /> Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
