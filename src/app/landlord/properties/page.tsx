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
import { Building2, MapPin, Plus, Save, Image as ImageIcon, Bed, Bath, Loader2, Edit3, Trash2 } from "lucide-react";
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
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Portfolio Assets</h1>
          <p className="text-muted-foreground font-medium">Monitoring and managing your property inventory.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
          setIsAddDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button onClick={handleOpenAddDialog} className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Register New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[750px] p-0 rounded-2xl overflow-hidden flex flex-col h-[90vh] border-none shadow-2xl">
            <DialogHeader className="p-6 bg-primary/5 border-b shrink-0 text-left">
              <DialogTitle className="text-2xl font-headline font-bold text-primary flex items-center gap-2">
                <Building2 className="w-6 h-6" />
                {editingProperty ? 'Modify Asset' : 'New Property Details'}
              </DialogTitle>
              <DialogDescription className="font-medium text-primary/60">Comprehensive details for your rental listing.</DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveProperty} className="flex-1 flex flex-col min-h-0">
              <ScrollArea className="flex-1">
                <div className="p-6 md:p-8 space-y-10">
                  <div className="space-y-4">
                    <Label className="font-bold text-xs uppercase tracking-widest text-primary/60 font-headline">Property Presentation</Label>
                    <div className="relative group overflow-hidden rounded-2xl border-2 border-dashed border-muted-foreground/20 hover:border-primary/40 transition-all bg-muted/20 aspect-video w-full flex items-center justify-center shadow-inner">
                      {previewUrl ? (
                        <>
                          <Image src={previewUrl} alt="Preview" fill className="object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                             <Button type="button" variant="secondary" size="sm" className="rounded-lg font-bold" onClick={() => document.getElementById('image-input')?.click()}>Change Photo</Button>
                             <Button type="button" variant="destructive" size="sm" className="rounded-lg font-bold" onClick={() => { setPreviewUrl(null); setImageFile(null); }}>Remove</Button>
                          </div>
                        </>
                      ) : (
                        <button type="button" onClick={() => document.getElementById('image-input')?.click()} className="flex flex-col items-center gap-3 group/btn">
                          <div className="p-4 bg-white rounded-full shadow-md group-hover/btn:scale-110 transition-transform">
                            <ImageIcon className="w-8 h-8 text-primary/60" />
                          </div>
                          <span className="text-sm font-bold text-primary">Upload Property Image</span>
                        </button>
                      )}
                      <input id="image-input" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 text-left">
                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="address" className="font-bold text-xs uppercase text-primary/60">Street Address</Label>
                      <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="e.g. 10 Downing Street" className="rounded-xl h-12 border-primary/10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="city" className="font-bold text-xs uppercase text-primary/60">City</Label>
                      <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="London" className="rounded-xl h-12 border-primary/10" />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode" className="font-bold text-xs uppercase text-primary/60">Postcode</Label>
                      <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required placeholder="SW1A 2AA" className="rounded-xl h-12 border-primary/10" />
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 md:col-span-2">
                       <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-primary/60">Type</Label>
                        <Select value={propertyType} onValueChange={setPropertyType}>
                          <SelectTrigger className="rounded-xl h-12 border-primary/10"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            <SelectItem value="Apartment">Apartment</SelectItem>
                            <SelectItem value="House">House</SelectItem>
                            <SelectItem value="Condo">Condo</SelectItem>
                            <SelectItem value="Studio">Studio</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="rent" className="font-bold text-xs uppercase text-primary/60">Monthly Rent (£)</Label>
                        <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-xl h-12 border-primary/10" />
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4 md:col-span-2">
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-primary/60">Bedrooms</Label>
                        <Select value={bedrooms} onValueChange={setBedrooms}>
                          <SelectTrigger className="rounded-xl h-12 border-primary/10"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {['1','2','3','4','5+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-primary/60">Bathrooms</Label>
                        <Select value={bathrooms} onValueChange={setBathrooms}>
                          <SelectTrigger className="rounded-xl h-12 border-primary/10"><SelectValue /></SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {['1','2','3+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sqft" className="font-bold text-xs uppercase text-primary/60">Sq. Ft.</Label>
                        <Input id="sqft" type="number" value={squareFootage} onChange={(e) => setSquareFootage(e.target.value)} placeholder="850" className="rounded-xl h-12 border-primary/10" />
                      </div>
                    </div>

                    <div className="space-y-2 md:col-span-2">
                      <Label htmlFor="description" className="font-bold text-xs uppercase text-primary/60">Asset Description</Label>
                      <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe key features, local amenities, and condition..." className="rounded-xl min-h-[120px] border-primary/10" />
                    </div>
                  </div>
                </div>
              </ScrollArea>
              
              <DialogFooter className="p-6 bg-muted/20 border-t shrink-0 flex gap-4">
                <Button type="button" variant="ghost" className="rounded-xl h-12 px-6 font-bold" onClick={() => setIsAddDialogOpen(false)}>Discard</Button>
                <Button type="submit" className="rounded-xl font-bold bg-primary h-12 px-8 flex-1 md:flex-none md:min-w-[200px] shadow-lg shadow-primary/20" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  {editingProperty ? "Update Record" : "Create Asset"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {!properties || properties.length === 0 ? (
          <div className="col-span-full py-24 text-center flex flex-col items-center justify-center bg-muted/10 rounded-[2rem] border-4 border-dashed border-primary/5">
            <Building2 className="w-16 h-16 text-primary/10 mb-6" />
            <h3 className="text-xl font-headline font-bold text-primary/40 mb-2">Portfolio is Empty</h3>
            <p className="text-muted-foreground font-medium mb-6">Begin by registering your first property asset.</p>
            <Button variant="outline" onClick={handleOpenAddDialog} className="rounded-xl font-bold border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
              Add First Property
            </Button>
          </div>
        ) : (
          properties.map((property) => (
            <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-2xl transition-all duration-500 rounded-2xl bg-card border border-primary/5">
              <div className="relative h-64 w-full overflow-hidden">
                <Image 
                  src={property.imageUrl || "https://picsum.photos/seed/house/800/600"} 
                  alt={property.addressLine1} 
                  fill 
                  className="object-cover transition-transform duration-700 group-hover:scale-105" 
                  data-ai-hint="modern house"
                />
                <Badge className={cn(
                  "absolute top-4 right-4 font-bold shadow-xl py-1.5 px-4 uppercase text-[10px] tracking-widest",
                  property.isOccupied ? 'bg-emerald-500 hover:bg-emerald-600' : 'bg-amber-500 hover:bg-amber-600'
                )}>
                  {property.isOccupied ? 'Occupied' : 'Vacant'}
                </Badge>
              </div>
              <CardHeader className="pb-2 text-left space-y-1">
                <div className="flex justify-between items-start">
                  <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary/60 border-primary/10">{property.propertyType}</Badge>
                  <div className="flex gap-3 text-muted-foreground text-xs font-bold">
                    <span className="flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {property.numberOfBedrooms}</span>
                    <span className="flex items-center gap-1"><Bath className="w-3.5 h-3.5" /> {property.numberOfBathrooms}</span>
                  </div>
                </div>
                <CardTitle className="text-xl font-bold font-headline truncate pt-1">{property.addressLine1}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center font-medium"><MapPin className="w-4 h-4 mr-1.5 text-primary/30" /> {property.city}, {property.zipCode}</p>
              </CardHeader>
              <CardContent className="pb-4 text-left">
                <p className="text-2xl font-bold text-primary">£{property.rentAmount}<span className="text-xs text-muted-foreground font-medium tracking-tight"> / month</span></p>
              </CardContent>
              <CardFooter className="flex flex-col gap-2 pt-4 border-t border-primary/5 bg-primary/[0.02]">
                <div className="flex gap-2 w-full">
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10 hover:bg-primary hover:text-white transition-all" asChild>
                    <Link href={`/landlord/properties/${property.id}`}>Manage</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10 hover:bg-primary/5" onClick={() => handleOpenEditDialog(property)}>
                    Edit Details
                  </Button>
                </div>
                <Button variant="ghost" className="w-full rounded-xl h-9 text-[10px] text-destructive/40 hover:text-destructive hover:bg-destructive/5 font-bold uppercase tracking-widest" onClick={() => handleDeleteProperty(property.id)}>
                  Decommission Asset
                </Button>
              </CardFooter>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
