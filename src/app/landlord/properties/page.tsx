"use client";

import { useState, useEffect } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking, updateDocumentNonBlocking, useStorage } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Building2, MapPin, Plus, Trash2, Edit3, Image as ImageIcon, Upload, Save, X, Bed, Bath, Loader2 } from "lucide-react";
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
    return collection(db, 'users', user.uid, 'properties');
  }, [db, user]);

  const { data: properties, isLoading } = useCollection(propertiesQuery);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editingProperty, setEditingProperty] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
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
    setCity('');
    setState('');
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
    setAddress(property.addressLine1 || '');
    setCity(property.city || '');
    setState(property.state || '');
    setZipCode(property.zipCode || '');
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
    if (!user || !db) return;

    setIsSubmitting(true);
    
    try {
      const propertyId = editingProperty ? editingProperty.id : crypto.randomUUID();
      const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);
      
      let finalImageUrl = previewUrl || `https://picsum.photos/seed/${propertyId}/800/600`;

      if (imageFile && storage) {
        const storageRef = ref(storage, `Images/${user.uid}/${propertyId}/${imageFile.name}`);
        const uploadResult = await uploadBytes(storageRef, imageFile);
        finalImageUrl = await getDownloadURL(uploadResult.ref);
      }

      const data = {
        id: propertyId,
        landlordId: user.uid,
        addressLine1: address,
        city,
        state,
        zipCode,
        description,
        propertyType,
        numberOfBedrooms: Number(bedrooms),
        numberOfBathrooms: Number(bathrooms),
        squareFootage: squareFootage ? Number(squareFootage) : null,
        rentAmount: Number(rentAmount),
        isOccupied: editingProperty?.isOccupied || false,
        imageUrl: finalImageUrl,
        updatedAt: serverTimestamp(),
        members: { [user.uid]: 'owner' }
      };

      if (editingProperty) {
        updateDocumentNonBlocking(propertyRef, data);
        toast({ title: "Property Updated" });
      } else {
        setDocumentNonBlocking(propertyRef, { 
          ...data, 
          createdAt: serverTimestamp(), 
          isActive: true
        }, { merge: true });
        toast({ title: "Property Created" });
      }

      setIsAddDialogOpen(false);
      resetForm();
    } catch (error: any) {
      toast({ variant: "destructive", title: "Save Failed", description: error.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);
    deleteDocumentNonBlocking(propertyRef);
    toast({ title: "Property Removed" });
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Portfolio Management</h1>
          <p className="text-muted-foreground font-medium">Manage your property assets and details.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAddDialog} className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-11 px-6">
              <Plus className="w-4 h-4 mr-2" />
              Add New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[750px] p-0 rounded-2xl overflow-hidden flex flex-col h-[90vh] border-none shadow-2xl">
            <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
              <DialogTitle className="text-2xl font-headline font-bold text-primary flex items-center gap-2">
                <Building2 className="w-6 h-6" />
                {editingProperty ? 'Modify Asset' : 'New Property Details'}
              </DialogTitle>
              <DialogDescription>Enter property specifications and upload a photo.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveProperty} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <div className="p-6 md:p-8 space-y-8">
                  <div className="space-y-4">
                    <Label className="font-bold text-xs uppercase tracking-widest text-primary/60 font-headline">Presentation</Label>
                    <div className="relative group overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-all bg-muted/20 aspect-video w-full flex items-center justify-center">
                      {previewUrl ? (
                        <>
                          <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                             <Button type="button" variant="secondary" size="sm" onClick={() => document.getElementById('image-input')?.click()}>Change</Button>
                             <Button type="button" variant="destructive" size="sm" onClick={() => { setPreviewUrl(null); setImageFile(null); }}>Remove</Button>
                          </div>
                        </>
                      ) : (
                        <button type="button" onClick={() => document.getElementById('image-input')?.click()} className="flex flex-col items-center gap-2">
                          <ImageIcon className="w-10 h-10 text-primary/40" />
                          <span className="text-sm font-bold text-primary">Upload Photo</span>
                        </button>
                      )}
                      <input id="image-input" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-left">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address" className="font-bold text-xs uppercase text-primary/60">Street Address</Label>
                      <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="123 Example Rd" className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="font-bold text-xs uppercase text-primary/60">City</Label>
                      <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="London" className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode" className="font-bold text-xs uppercase text-primary/60">Postcode</Label>
                      <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required placeholder="NW1 6XE" className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-primary/60">Type</Label>
                      <Select value={propertyType} onValueChange={setPropertyType}>
                        <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          <SelectItem value="Apartment">Apartment</SelectItem>
                          <SelectItem value="House">House</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-primary/60">Bedrooms</Label>
                      <Select value={bedrooms} onValueChange={setBedrooms}>
                        <SelectTrigger className="rounded-xl h-12"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {['1','2','3','4+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="rent" className="font-bold text-xs uppercase text-primary/60">Rent (£)</Label>
                      <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-xl h-12" />
                    </div>
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="description" className="font-bold text-xs uppercase text-primary/60">Description</Label>
                      <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Modern features..." className="rounded-xl min-h-[100px]" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              <DialogFooter className="p-6 bg-muted/10 border-t shrink-0 flex gap-3">
                <Button type="button" variant="outline" className="rounded-xl h-12" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                <Button type="submit" className="rounded-xl font-bold bg-primary h-12 min-w-[150px]" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {editingProperty ? "Update Asset" : "Create Asset"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {!properties || properties.length === 0 ? (
          <div className="col-span-full py-20 text-center flex flex-col items-center justify-center bg-muted/10 rounded-3xl border-2 border-dashed">
            <Building2 className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
            <p className="text-muted-foreground">No properties in your portfolio yet.</p>
            <Button variant="link" onClick={handleOpenAddDialog} className="font-bold text-primary">Add first property</Button>
          </div>
        ) : (
          properties.map((property) => (
            <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-xl transition-all rounded-2xl bg-card">
              <div className="relative h-64 w-full overflow-hidden">
                <Image 
                  src={property.imageUrl || "https://picsum.photos/seed/house/800/600"} 
                  alt={property.addressLine1} 
                  fill 
                  className="object-cover transition-transform duration-700 group-hover:scale-110" 
                />
                <Badge className={cn(
                  "absolute top-4 right-4 font-bold shadow-lg py-1 px-4 uppercase text-[10px]",
                  property.isOccupied ? 'bg-emerald-500' : 'bg-amber-500'
                )}>
                  {property.isOccupied ? 'Occupied' : 'Vacant'}
                </Badge>
              </div>
              <CardHeader className="pb-2 text-left">
                <CardTitle className="text-xl font-bold font-headline truncate">{property.addressLine1}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center"><MapPin className="w-4 h-4 mr-1 opacity-40" /> {property.zipCode}</p>
              </CardHeader>
              <CardContent className="pb-2 text-left">
                <p className="text-2xl font-bold text-primary">£{property.rentAmount}<span className="text-xs text-muted-foreground font-normal"> / month</span></p>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 pt-4 border-t border-muted/50">
                <div className="flex gap-2 w-full">
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10" asChild>
                    <Link href={`/landlord/properties/${property.id}`}><Building2 className="w-4 h-4 mr-1" /> View</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10" onClick={() => handleOpenEditDialog(property)}>
                    <Edit3 className="w-4 h-4 mr-1" /> Edit
                  </Button>
                </div>
                <Button variant="ghost" className="w-full rounded-xl h-9 text-xs text-destructive font-bold" onClick={() => handleDeleteProperty(property.id)}>
                  <Trash2 className="w-4 h-4 mr-2" /> Decommission
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}