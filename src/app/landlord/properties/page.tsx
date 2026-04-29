
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
import { Building2, MapPin, Plus, Trash2, Edit3, Loader2, Image as ImageIcon, Upload, X } from "lucide-react";
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
    return query(
      collection(db, 'properties'),
      where('landlordId', '==', user.uid)
    );
  }, [db, user]);

  const { data: properties, isLoading } = useCollection(propertiesQuery);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setImageFile(file);
    if (file) {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    } else {
      setPreviewUrl(null);
    }
  };

  const resetForm = () => {
    setAddress('');
    setZipCode('');
    setRentAmount('');
    setDescription('');
    setImageFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
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
        const storageRef = ref(storage, `properties/${user.uid}/${propertyId}/${imageFile.name}`);
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
          <DialogContent className="sm:max-w-[550px] max-h-[90vh] p-0 rounded-2xl overflow-hidden flex flex-col border-none shadow-2xl">
            <DialogHeader className="p-6 bg-primary/5 border-b">
              <DialogTitle className="text-2xl font-headline font-bold text-primary">
                {editingProperty ? 'Edit Property' : 'Property Details'}
              </DialogTitle>
              <DialogDescription className="font-medium">
                {editingProperty ? 'Update the details for this property asset.' : 'Enter the address and financial details for your new property.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSaveProperty} className="flex-1 overflow-hidden flex flex-col">
              <ScrollArea className="flex-1 p-6">
                <div className="grid gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="address" className="font-bold text-xs uppercase tracking-widest text-primary/60">Full Address</Label>
                    <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="123 Example Street" className="rounded-xl h-11" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="zipCode" className="font-bold text-xs uppercase tracking-widest text-primary/60">Postcode</Label>
                      <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required placeholder="SW1A 1AA" className="rounded-xl h-11" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent" className="font-bold text-xs uppercase tracking-widest text-primary/60">Monthly Rent (£)</Label>
                      <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required placeholder="1200" className="rounded-xl h-11" />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="desc" className="font-bold text-xs uppercase tracking-widest text-primary/60">Public Description</Label>
                    <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Modern flat with garden access..." className="rounded-xl h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="image" className="font-bold text-xs uppercase tracking-widest text-primary/60">Property Showcase Photo</Label>
                    <div className="flex flex-col items-center gap-4">
                      <Input 
                        id="image" 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageChange}
                      />
                      <Button 
                        type="button" 
                        variant="outline" 
                        className="w-full h-48 border-dashed border-2 rounded-2xl flex flex-col items-center justify-center gap-2 overflow-hidden relative group hover:bg-primary/5 hover:border-primary/20 transition-all"
                        onClick={() => document.getElementById('image')?.click()}
                      >
                        {previewUrl ? (
                          <div className="absolute inset-0 w-full h-full">
                            <Image 
                              src={previewUrl} 
                              alt="Preview" 
                              fill 
                              className="object-cover"
                            />
                            <div className="absolute inset-0 bg-black/40 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                              <Upload className="w-8 h-8 text-white mb-1" />
                              <span className="text-white text-xs font-bold">Change Photo</span>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="p-3 bg-primary/5 rounded-full text-primary">
                                <Upload className="w-6 h-6" />
                            </div>
                            <span className="text-sm text-muted-foreground font-semibold">Click to upload photo</span>
                            <span className="text-[10px] text-muted-foreground/60 uppercase tracking-widest font-bold">JPG, PNG, WEBP</span>
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 bg-muted/20 border-t">
                <Button type="submit" className="w-full h-12 rounded-xl font-bold text-lg shadow-lg shadow-primary/10" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Saving...</>
                  ) : (
                    editingProperty ? "Save Changes" : "Confirm Property Creation"
                  )}
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
              <Image 
                src={property.imageUrl} 
                alt={property.addressLine1} 
                fill 
                className="object-cover transition-transform group-hover:scale-105" 
                data-ai-hint="rental property"
              />
              <Badge className={`absolute top-4 right-4 font-bold ${property.isOccupied ? 'bg-green-500' : 'bg-amber-500'}`}>
                {property.isOccupied ? 'Occupied' : 'Vacant'}
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-lg font-bold font-headline">{property.addressLine1}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center"><MapPin className="w-3 h-3 mr-1" /> {property.zipCode}</p>
            </CardHeader>
            <CardFooter className="grid grid-cols-2 gap-2">
              <div className="flex gap-2 w-full">
                <Button variant="outline" size="sm" className="flex-1 rounded-lg font-bold h-9" asChild>
                  <Link href={`/landlord/properties/${property.id}`}><Building2 className="w-3 h-3 mr-2" /> Details</Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1 rounded-lg font-bold h-9 border-primary/20 text-primary hover:bg-primary/5" onClick={() => handleOpenEditDialog(property)}>
                  <Edit3 className="w-3 h-3 mr-2" /> Edit
                </Button>
              </div>
              <Button variant="ghost" className="col-span-2 rounded-lg h-9 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProperty(property.id)}>
                <Trash2 className="w-3 h-3 mr-2" /> Remove Asset
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
