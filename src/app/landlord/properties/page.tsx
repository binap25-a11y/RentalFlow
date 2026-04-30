"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useStorage } from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Building2, MapPin, Plus, Trash2, Edit3, Loader2, Image as ImageIcon, Upload, X, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function PropertiesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const storage = useStorage();
  const { toast } = useToast();

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'properties'),
      where('landlordId', '==', user.uid)
    );
  }, [db, user]);

  const { data: properties, isLoading } = useCollection(propertiesQuery);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && !previewUrl.startsWith('http')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setImageFile(file);
      if (previewUrl && !previewUrl.startsWith('http')) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const resetForm = () => {
    setAddress('');
    setZipCode('');
    setRentAmount('');
    setDescription('');
    setImageFile(null);
    setPreviewUrl(null);
    setEditingProperty(null);
  };

  const handleOpenAddDialog = () => {
    resetForm();
    setIsAddDialogOpen(true);
  };

  const handleOpenEditDialog = (property: any) => {
    setEditingProperty(property);
    setAddress(property.addressLine1);
    setZipCode(property.zipCode);
    setRentAmount(property.rentAmount.toString());
    setDescription(property.description || '');
    setPreviewUrl(property.imageUrl);
    setIsAddDialogOpen(true);
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !storage) return;

    const rentValue = Number(rentAmount);
    if (rentValue < 0) {
      toast({ variant: "destructive", title: "Invalid Rent", description: "Monthly rent cannot be negative." });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const propertyId = editingProperty ? editingProperty.id : doc(collection(db, 'dummy')).id;
      const propertyRef = doc(db, 'properties', propertyId);
      
      let finalImageUrl = editingProperty ? editingProperty.imageUrl : `https://picsum.photos/seed/${propertyId}/800/600`;

      if (imageFile) {
        // Path matches requirements, using Firebase Storage folder 'Images'
        const storageRef = ref(storage, `Images/properties/${user.uid}/${propertyId}/${imageFile.name}`);
        const uploadResult = await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
      }

      const data = {
        id: propertyId,
        landlordId: user.uid,
        addressLine1: address,
        city: editingProperty?.city || 'London',
        state: editingProperty?.state || 'UK',
        zipCode: zipCode,
        description: description,
        numberOfBedrooms: editingProperty?.numberOfBedrooms || 2,
        numberOfBathrooms: editingProperty?.numberOfBathrooms || 1,
        rentAmount: rentValue,
        isOccupied: editingProperty?.isOccupied || false,
        imageUrl: finalImageUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingProperty) {
        updateDocumentNonBlocking(propertyRef, data);
        toast({ title: "Property Updated", description: "Your changes have been saved." });
      } else {
        setDocumentNonBlocking(propertyRef, { ...data, createdAt: serverTimestamp() }, { merge: true });
        toast({ title: "Property Added", description: "Successfully created in your portfolio." });
      }

      setIsAddDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: error.message || "Could not save property record." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'properties', propertyId);
    deleteDocumentNonBlocking(propertyRef);
    toast({ title: "Property Deleted" });
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Portfolio Management</h1>
          <p className="text-muted-foreground font-medium font-body">Add, view and manage your rental assets.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAddDialog} className="rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold">
              <Plus className="w-4 h-4 mr-2" />
              Add New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[650px] w-[95vw] max-h-[95vh] p-0 rounded-2xl overflow-hidden flex flex-col border-none shadow-2xl">
            <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
              <DialogTitle className="text-2xl font-headline font-bold text-primary">
                {editingProperty ? 'Modify Property Asset' : 'New Property Details'}
              </DialogTitle>
              <DialogDescription className="font-medium">
                {editingProperty ? 'Update the details and images for this property.' : 'Complete the profile for your new rental property.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveProperty} className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 p-6">
                <div className="grid gap-8">
                  <div className="space-y-4">
                    <Label className="font-bold text-xs uppercase tracking-widest text-primary/60">Property Showcase Photo</Label>
                    <div className="relative group overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-all bg-muted/30">
                      <div className={cn(
                        "w-full h-64 overflow-hidden flex flex-col items-center justify-center",
                        previewUrl && "bg-transparent"
                      )}>
                        {previewUrl ? (
                          <>
                            <Image 
                              src={previewUrl} 
                              alt="Property Preview" 
                              fill 
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <Button 
                                 type="button" 
                                 variant="secondary" 
                                 className="rounded-full font-bold shadow-xl"
                                 onClick={() => document.getElementById('image-input-dialog')?.click()}
                               >
                                 <Upload className="w-4 h-4 mr-2" />
                                 Change Property Image
                               </Button>
                            </div>
                          </>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => document.getElementById('image-input-dialog')?.click()}
                            className="flex flex-col items-center gap-3 p-12 w-full h-full"
                          >
                            <div className="p-4 bg-primary/10 rounded-full text-primary">
                              <ImageIcon className="w-8 h-8" />
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-base text-primary">Upload Property Photo</p>
                              <p className="text-xs text-muted-foreground mt-1">First impressions matter. Use high-quality images.</p>
                            </div>
                          </button>
                        )}
                      </div>
                      <Input 
                        id="image-input-dialog" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageChange}
                      />
                    </div>
                  </div>

                  <div className="grid gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="address-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Property Address</Label>
                      <Input id="address-dlg" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="e.g. 42 Baker Street" className="rounded-xl h-12" />
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <Label htmlFor="zipCode-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Postcode / Zip</Label>
                        <Input id="zipCode-dlg" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required placeholder="NW1 6XE" className="rounded-xl h-12" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rent-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Monthly Rent (£)</Label>
                        <Input id="rent-dlg" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required placeholder="1850" className="rounded-xl h-12" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="desc-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Brief Description</Label>
                      <Input id="desc-dlg" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Spacious 2-bed apartment near central park..." className="rounded-xl h-12" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-muted/20 border-t shrink-0">
                <Button type="submit" className="w-full h-14 rounded-xl font-bold text-lg shadow-xl shadow-primary/20 transition-all hover:scale-[1.01] active:scale-[0.99]" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Finalizing...</>
                  ) : (
                    <><Save className="w-5 h-5 mr-2" /> {editingProperty ? "Update Property Record" : "Confirm Property Creation"}</>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {properties?.map((property) => (
          <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-500 rounded-2xl bg-card">
            <div className="relative h-56 w-full overflow-hidden">
              <Image 
                src={property.imageUrl} 
                alt={property.addressLine1} 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-110" 
                data-ai-hint="luxury property"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Badge className={cn(
                "absolute top-4 right-4 font-bold shadow-lg py-1 px-3 uppercase text-[10px]",
                property.isOccupied ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
              )}>
                {property.isOccupied ? 'Occupied' : 'Vacant'}
              </Badge>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold font-headline group-hover:text-primary transition-colors line-clamp-1">{property.addressLine1}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center font-medium"><MapPin className="w-4 h-4 mr-1 text-primary/40" /> {property.zipCode}</p>
            </CardHeader>
            <CardFooter className="flex flex-col gap-3 pt-4">
              <div className="flex gap-3 w-full">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10 hover:bg-primary hover:text-white transition-all" asChild>
                  <Link href={`/landlord/properties/${property.id}`}><Building2 className="w-4 h-4 mr-2" /> Details</Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10 text-primary hover:bg-primary/5 transition-all" onClick={() => handleOpenEditDialog(property)}>
                  <Edit3 className="w-4 h-4 mr-2" /> Edit
                </Button>
              </div>
              <Button variant="ghost" className="w-full rounded-xl h-10 text-xs text-destructive hover:bg-destructive/10 font-bold" onClick={() => handleDeleteProperty(property.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Delete Asset
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
