"use client";

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
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
  
  // Main Image State
  const [imageUrl, setImageUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Additional Images State
  const [additionalImages, setAdditionalImages] = useState<string[]>([]);

  const handleMainFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setPreviewUrl(base64String);
        setImageUrl(base64String);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAdditionalFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const filesArray = Array.from(files);
      filesArray.forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAdditionalImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  const clearMainImage = () => {
    setPreviewUrl(null);
    setImageUrl('');
  };

  const removeAdditionalImage = (index: number) => {
    setAdditionalImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    const rentValue = Number(rentAmount);
    if (rentValue < 0) {
      toast({
        variant: "destructive",
        title: "Invalid Rent",
        description: "Monthly rent cannot be negative.",
      });
      return;
    }

    setIsSubmitting(true);
    const propertyId = doc(collection(db, 'dummy')).id;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);

    // 1. Create the main property document
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
      imageUrl: imageUrl || 'https://picsum.photos/seed/rental/800/600',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // 2. Create documents for each additional image
    additionalImages.forEach((base64, idx) => {
      const docId = doc(collection(db, 'dummy')).id;
      const docRef = doc(db, 'documents', docId);
      setDocumentNonBlocking(docRef, {
        id: docId,
        fileName: `gallery_${idx}_${propertyId}.jpg`,
        fileUrl: base64,
        documentType: 'Property Photo',
        propertyId: propertyId,
        uploadedByUserId: user.uid,
        landlordId: user.uid,
        createdAt: serverTimestamp(),
      }, { merge: true });
    });

    setTimeout(() => {
      setIsSubmitting(false);
      setIsAddDialogOpen(false);
      setAddress('');
      setZipCode('');
      setRentAmount('');
      setDescription('');
      setImageUrl('');
      setPreviewUrl(null);
      setAdditionalImages([]);
      toast({ title: "Property Added", description: "The property and gallery have been added to your portfolio." });
    }, 800);
  };

  const handleDeleteProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);
    deleteDocumentNonBlocking(propertyRef);
    toast({ title: "Property Deleted", description: "The property has been removed from your portfolio." });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Loading your portfolio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Properties</h1>
          <p className="text-muted-foreground font-medium">Manage your rental assets and occupancy status.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Add New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px] rounded-2xl max-h-[90vh] overflow-y-auto">
            <form onSubmit={handleAddProperty}>
              <DialogHeader>
                <DialogTitle>Add Property</DialogTitle>
                <DialogDescription>
                  Enter the details of your new rental property.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-4">
                <div className="space-y-4">
                  <Label>Property Photos</Label>
                  
                  {/* Main Image Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Main Banner Photo</Label>
                    {previewUrl ? (
                      <div className="relative h-40 w-full rounded-xl overflow-hidden border">
                        <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                        <Button 
                          type="button" 
                          variant="destructive" 
                          size="icon" 
                          className="absolute top-2 right-2 h-8 w-8 rounded-full"
                          onClick={clearMainImage}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-full">
                        <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-xl cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors">
                          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center px-4">
                            <ImageIcon className="w-6 h-6 mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground font-semibold">Click to upload main photo</p>
                          </div>
                          <input type="file" className="hidden" accept="image/*" onChange={handleMainFileChange} />
                        </label>
                      </div>
                    )}
                  </div>

                  {/* Additional Images Upload */}
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground uppercase font-bold tracking-wider">Additional Gallery Photos</Label>
                    <div className="grid grid-cols-4 gap-3">
                      {additionalImages.map((img, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden border group">
                          <Image src={img} alt={`Additional ${idx}`} fill className="object-cover" />
                          <button 
                            type="button"
                            onClick={() => removeAdditionalImage(idx)}
                            className="absolute top-1 right-1 bg-destructive text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      <label className="aspect-square flex flex-col items-center justify-center border-2 border-dashed rounded-lg cursor-pointer bg-muted/20 hover:bg-muted/40 transition-colors">
                        <Images className="w-5 h-5 text-muted-foreground" />
                        <span className="text-[10px] mt-1 font-bold text-muted-foreground uppercase">Add More</span>
                        <input type="file" className="hidden" accept="image/*" multiple onChange={handleAdditionalFilesChange} />
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Lease St, London" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Postcode</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="E1 6AN" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent">Monthly Rent (£)</Label>
                    <Input id="rent" type="number" min="0" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} placeholder="1500" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Short Description</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Modern 2-bed apartment..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-12 rounded-xl text-base font-bold shadow-lg shadow-primary/20" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Building2 className="w-4 h-4 mr-2" />}
                  Save Property & Gallery
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!properties || properties.length === 0 ? (
        <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-primary/5 rounded-full mb-4">
            <Building2 className="w-12 h-12 text-primary/40" />
          </div>
          <h3 className="text-xl font-bold font-headline mb-2">No Properties Found</h3>
          <p className="text-muted-foreground max-w-sm mb-6">Start building your portfolio by adding your first rental property.</p>
          <Button variant="outline" onClick={() => setIsAddDialogOpen(true)} className="rounded-xl border-primary/20 hover:bg-primary/5">
            Add Property Now
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300">
              <div className="relative h-48 w-full">
                <Image 
                  src={property.imageUrl || 'https://picsum.photos/seed/prop/800/600'} 
                  alt={property.addressLine1} 
                  fill 
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                  data-ai-hint="rental property"
                />
                <Badge className={`absolute top-4 right-4 shadow-sm ${property.isOccupied ? 'bg-green-500' : 'bg-amber-500'}`}>
                  {property.isOccupied ? 'Occupied' : 'Vacant'}
                </Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold font-headline line-clamp-1 group-hover:text-primary transition-colors">{property.addressLine1}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center">
                  <MapPin className="w-3 h-3 mr-1" /> {property.zipCode}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">{property.description}</p>
                <div className="flex items-center justify-between">
                  <div className="text-xl font-bold text-primary">
                    £{property.rentAmount}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                <Button variant="outline" className="rounded-lg h-9 text-xs font-bold border-primary/10 hover:bg-primary/5" asChild>
                  <Link href={`/landlord/properties/${property.id}`}>
                    <Edit3 className="w-3 h-3 mr-2" />
                    Manage
                  </Link>
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="rounded-lg h-9 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-2xl">
                    <DialogHeader>
                      <DialogTitle>Are you absolutely sure?</DialogTitle>
                      <DialogDescription>
                        This will permanently delete the property "{property.addressLine1}" and all associated data. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="destructive" className="rounded-xl w-full" onClick={() => handleDeleteProperty(property.id)}>Confirm Delete</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
