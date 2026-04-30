
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Building2, MapPin, Plus, Trash2, Edit3, Loader2, Image as ImageIcon, Upload, Save, X, Bed, Bath, Square } from "lucide-react";
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

  // Form State
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('London');
  const [state, setState] = useState('UK');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  const [squareFootage, setSquareFootage] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setImageFile(file);
      if (previewUrl && previewUrl.startsWith('blob:')) URL.revokeObjectURL(previewUrl);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const resetForm = () => {
    setAddress('');
    setCity('London');
    setState('UK');
    setZipCode('');
    setRentAmount('');
    setDescription('');
    setPropertyType('Apartment');
    setBedrooms('1');
    setBathrooms('1');
    setSquareFootage('');
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
    setCity(property.city || 'London');
    setState(property.state || 'UK');
    setZipCode(property.zipCode);
    setRentAmount(property.rentAmount?.toString() || '');
    setDescription(property.description || '');
    setPropertyType(property.propertyType || 'Apartment');
    setBedrooms(property.numberOfBedrooms?.toString() || '1');
    setBathrooms(property.numberOfBathrooms?.toString() || '1');
    setSquareFootage(property.squareFootage?.toString() || '');
    setPreviewUrl(property.imageUrl || null);
    setImageFile(null);
    setIsAddDialogOpen(true);
  };

  const handleSaveProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !storage) return;

    setIsSubmitting(true);
    
    try {
      const propertyId = editingProperty ? editingProperty.id : doc(collection(db, 'dummy')).id;
      const propertyRef = doc(db, 'properties', propertyId);
      
      let finalImageUrl = previewUrl || `https://picsum.photos/seed/${propertyId}/800/600`;

      if (imageFile) {
        const storageRef = ref(storage, `Images/properties/${user.uid}/${propertyId}/${imageFile.name}`);
        const uploadResult = await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
      }

      const data = {
        id: propertyId,
        landlordId: user.uid,
        addressLine1: address,
        city: city,
        state: state,
        zipCode: zipCode,
        description: description,
        propertyType: propertyType,
        numberOfBedrooms: Number(bedrooms),
        numberOfBathrooms: Number(bathrooms),
        squareFootage: squareFootage ? Number(squareFootage) : null,
        rentAmount: Number(rentAmount),
        isOccupied: editingProperty?.isOccupied || false,
        imageUrl: finalImageUrl,
        updatedAt: serverTimestamp(),
      };

      if (editingProperty) {
        updateDocumentNonBlocking(propertyRef, data);
        toast({ title: "Property Updated", description: "Your changes have been saved." });
      } else {
        setDocumentNonBlocking(propertyRef, { ...data, createdAt: serverTimestamp(), isActive: true }, { merge: true });
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
            <Button onClick={handleOpenAddDialog} className="rounded-xl shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 font-bold h-11">
              <Plus className="w-4 h-4 mr-2" />
              Add New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[800px] w-[95vw] max-h-[95vh] p-0 rounded-2xl overflow-hidden flex flex-col border-none shadow-2xl">
            <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left relative">
              <DialogTitle className="text-2xl font-headline font-bold text-primary">
                {editingProperty ? 'Modify Property Asset' : 'New Property Details'}
              </DialogTitle>
              <DialogDescription className="text-sm font-medium text-muted-foreground">
                {editingProperty ? 'Update full details and showcase photo.' : 'Enter complete profile details for your new rental.'}
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveProperty} className="flex-1 overflow-hidden flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <div className="px-8 py-8 space-y-10">
                  <div className="space-y-4">
                    <Label className="font-bold text-xs uppercase tracking-widest text-primary/60">Property Showcase Photo</Label>
                    <div className="relative group overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-all bg-muted/20">
                      <div className={cn(
                        "w-full h-56 overflow-hidden flex flex-col items-center justify-center relative",
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
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                               <Button 
                                 type="button" 
                                 variant="secondary" 
                                 className="rounded-full font-bold shadow-xl h-10 px-6"
                                 onClick={() => document.getElementById('image-input-dialog')?.click()}
                               >
                                 <Upload className="w-4 h-4 mr-2" />
                                 Change Photo
                               </Button>
                               <Button 
                                 type="button" 
                                 variant="destructive" 
                                 className="rounded-full font-bold shadow-xl h-10 px-6"
                                 onClick={() => { setPreviewUrl(null); setImageFile(null); }}
                               >
                                 <X className="w-4 h-4 mr-2" />
                                 Remove
                               </Button>
                            </div>
                          </>
                        ) : (
                          <button 
                            type="button"
                            onClick={() => document.getElementById('image-input-dialog')?.click()}
                            className="flex flex-col items-center gap-3 p-8 w-full h-full hover:bg-muted/30 transition-colors"
                          >
                            <div className="p-4 bg-primary/10 rounded-full text-primary">
                              <ImageIcon className="w-8 h-8" />
                            </div>
                            <div className="text-center">
                              <p className="font-bold text-base text-primary">Upload Property Image</p>
                              <p className="text-xs text-muted-foreground mt-1">Recommended: JPG/PNG, 800x600px. Max 5MB.</p>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-4 md:col-span-2">
                      <Label htmlFor="address-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Full Address</Label>
                      <Input id="address-dlg" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="e.g. 221B Baker Street" className="rounded-xl h-12" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="city-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">City</Label>
                      <Input id="city-dlg" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="London" className="rounded-xl h-12" />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="zip-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Postcode / Zip</Label>
                      <Input id="zip-dlg" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required placeholder="NW1 6XE" className="rounded-xl h-12" />
                    </div>

                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase tracking-widest text-primary/60">Property Type</Label>
                      <Select value={propertyType} onValueChange={setPropertyType}>
                        <SelectTrigger className="rounded-xl h-12">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Apartment">Apartment</SelectItem>
                          <SelectItem value="House">House</SelectItem>
                          <SelectItem value="Condo">Condo</SelectItem>
                          <SelectItem value="Townhouse">Townhouse</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="rent-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Monthly Rent (£)</Label>
                      <Input id="rent-dlg" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required placeholder="1500" className="rounded-xl h-12" />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase tracking-widest text-primary/60">Bedrooms</Label>
                        <Select value={bedrooms} onValueChange={setBedrooms}>
                          <SelectTrigger className="rounded-xl h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {[1,2,3,4,5,6].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase tracking-widest text-primary/60">Bathrooms</Label>
                        <Select value={bathrooms} onValueChange={setBathrooms}>
                          <SelectTrigger className="rounded-xl h-12">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {[1,2,3,4].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="sqft-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Square Footage (sqft)</Label>
                      <Input id="sqft-dlg" type="number" value={squareFootage} onChange={(e) => setSquareFootage(e.target.value)} placeholder="850" className="rounded-xl h-12" />
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="desc-dlg" className="font-bold text-xs uppercase tracking-widest text-primary/60">Brief Description</Label>
                      <Input id="desc-dlg" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Spacious modern garden flat..." className="rounded-xl h-12" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              <DialogFooter className="p-6 bg-muted/10 border-t shrink-0">
                <div className="flex w-full gap-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    className="flex-1 h-12 rounded-xl font-bold"
                    onClick={() => setIsAddDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-[2] h-12 rounded-xl font-bold bg-primary hover:bg-primary/90 shadow-xl shadow-primary/10 transition-all" 
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Saving...</>
                    ) : (
                      <><Save className="w-5 h-5 mr-2" /> {editingProperty ? "Update Asset" : "Create Asset"}</>
                    )}
                  </Button>
                </div>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {properties?.map((property) => (
          <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-500 rounded-2xl bg-card">
            <div className="relative h-60 w-full overflow-hidden">
              <Image 
                src={property.imageUrl || "https://picsum.photos/seed/house/800/600"} 
                alt={property.addressLine1} 
                fill 
                className="object-cover transition-transform duration-700 group-hover:scale-110" 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <Badge className={cn(
                "absolute top-4 right-4 font-bold shadow-lg py-1 px-3 uppercase text-[10px]",
                property.isOccupied ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
              )}>
                {property.isOccupied ? 'Occupied' : 'Vacant'}
              </Badge>
              <div className="absolute bottom-4 left-4 flex gap-2 translate-y-8 group-hover:translate-y-0 transition-transform">
                <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-primary font-bold text-[10px]"><Bed className="w-3 h-3 mr-1" /> {property.numberOfBedrooms}</Badge>
                <Badge variant="secondary" className="bg-white/90 backdrop-blur-sm text-primary font-bold text-[10px]"><Bath className="w-3 h-3 mr-1" /> {property.numberOfBathrooms}</Badge>
              </div>
            </div>
            <CardHeader className="pb-2">
              <CardTitle className="text-xl font-bold font-headline group-hover:text-primary transition-colors line-clamp-1">{property.addressLine1}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center font-medium"><MapPin className="w-4 h-4 mr-1 text-primary/40" /> {property.zipCode}, {property.city}</p>
            </CardHeader>
            <CardContent className="pb-2">
              <p className="text-2xl font-bold text-primary font-headline">£{property.rentAmount}<span className="text-xs text-muted-foreground font-normal"> / month</span></p>
            </CardContent>
            <CardFooter className="flex flex-col gap-3 pt-4 border-t border-muted/50">
              <div className="flex gap-3 w-full">
                <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-11 border-primary/10 hover:bg-primary hover:text-white transition-all" asChild>
                  <Link href={`/landlord/properties/${property.id}`}><Building2 className="w-4 h-4 mr-2" /> View Details</Link>
                </Button>
                <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-11 border-primary/10 text-primary hover:bg-primary/5 transition-all" onClick={() => handleOpenEditDialog(property)}>
                  <Edit3 className="w-4 h-4 mr-2" /> Edit
                </Button>
              </div>
              <Button variant="ghost" className="w-full rounded-xl h-10 text-xs text-destructive hover:bg-destructive/10 font-bold" onClick={() => handleDeleteProperty(property.id)}>
                <Trash2 className="w-4 h-4 mr-2" /> Decommission Asset
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
