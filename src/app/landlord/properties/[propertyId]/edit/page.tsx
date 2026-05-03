
"use client";

import { useState, useEffect, use } from 'react';
import { useUser, useFirestore, useDoc, useMemoFirebase, useStorage, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Image as ImageIcon, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";

export default function EditPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
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

  const { data: property, isLoading } = useDoc(propertyRef);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (property) {
      setAddress(property.addressLine1 || '');
      setCity(property.city || '');
      setZipCode(property.zipCode || '');
      setRentAmount(property.rentAmount?.toString() || '');
      setDescription(property.description || '');
      setPropertyType(property.propertyType || 'Apartment');
      setBedrooms(property.numberOfBedrooms?.toString() || '1');
      setBathrooms(property.numberOfBathrooms?.toString() || '1');
      setPreviewUrl(property.imageUrl || null);
    }
  }, [property]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file) {
      setImageFile(file);
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !propertyRef) return;

    setIsSubmitting(true);
    
    try {
      let currentImageUrl = property?.imageUrl || previewUrl;

      // Only perform upload if a new file is actually present
      if (imageFile && storage) {
        const storageRef = ref(storage, `properties/${user.uid}/${propertyId}/${Date.now()}_${imageFile.name}`);
        const result = await uploadBytes(storageRef, imageFile);
        currentImageUrl = await getDownloadURL(result.ref);
      }

      const updateData = {
        addressLine1: address,
        city,
        zipCode,
        description,
        propertyType,
        numberOfBedrooms: Number(bedrooms),
        numberOfBathrooms: Number(bathrooms),
        rentAmount: Number(rentAmount),
        imageUrl: currentImageUrl,
        updatedAt: serverTimestamp(),
      };

      // Initiate update and immediately transition UI for "instant" feel
      updateDocumentNonBlocking(propertyRef, updateData);

      toast({ 
        title: "Portfolio Updated", 
        description: "Your modifications are being synchronized." 
      });
      
      router.push(`/landlord/properties/${propertyId}`);
    } catch (error: any) {
      toast({ 
        variant: "destructive", 
        title: "Save Failed", 
        description: error.message || "An error occurred while saving." 
      });
      setIsSubmitting(false);
    }
  };

  if (isLoading) return <div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex items-center gap-4 text-left">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Modify Asset</h1>
          <p className="text-muted-foreground font-medium font-body">Refining specifications for {address || 'Property'}.</p>
        </div>
      </div>

      <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white text-left">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 lg:p-12 bg-primary/5 border-r border-primary/10">
              <Label className="font-bold text-xs uppercase tracking-widest text-primary/60 mb-4 block font-headline">Property Presentation</Label>
              <div className="relative group overflow-hidden rounded-3xl border-2 border-dashed border-primary/20 hover:border-primary/40 transition-all bg-white aspect-video w-full flex items-center justify-center shadow-inner">
                {previewUrl ? (
                  <>
                    <Image 
                      src={previewUrl} 
                      alt="Preview" 
                      fill 
                      className="object-cover" 
                      unoptimized={true} 
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                       <Button type="button" variant="secondary" size="sm" className="rounded-xl font-bold font-headline" onClick={() => document.getElementById('image-input')?.click()}>Change Photo</Button>
                    </div>
                  </>
                ) : (
                  <button type="button" onClick={() => document.getElementById('image-input')?.click()} className="flex flex-col items-center gap-3">
                    <div className="p-5 bg-primary/10 rounded-full shadow-sm">
                      <ImageIcon className="w-8 h-8 text-primary" />
                    </div>
                    <span className="text-sm font-bold text-primary font-headline">Upload Cover Image</span>
                  </button>
                )}
                <input id="image-input" type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
              </div>
            </div>

            <div className="p-8 lg:p-12 space-y-8">
              <div className="grid grid-cols-1 gap-6 text-left">
                <div className="space-y-2">
                  <Label htmlFor="address" className="font-bold text-xs uppercase text-primary/60 font-headline">Street Address</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="123 Example Street" className="rounded-xl h-12 bg-muted/20 border-none focus:ring-2 focus:ring-primary font-body" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-bold text-xs uppercase text-primary/60 font-headline">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="London" className="rounded-xl h-12 bg-muted/20 border-none font-body" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="font-bold text-xs uppercase text-primary/60 font-headline">Postcode</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required placeholder="SW1A 1AA" className="rounded-xl h-12 bg-muted/20 border-none font-body" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 font-headline">Asset Type</Label>
                    <Select value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-body"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Apartment">Apartment</SelectItem>
                        <SelectItem value="House">House</SelectItem>
                        <SelectItem value="Condo">Condo</SelectItem>
                        <SelectItem value="Studio">Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent" className="font-bold text-xs uppercase text-primary/60 font-headline">Monthly Rent (£)</Label>
                    <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-body" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 font-headline">Bedrooms</Label>
                    <Select value={bedrooms} onValueChange={setBedrooms}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-body"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['1','2','3','4','5+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 font-headline">Bathrooms</Label>
                    <Select value={bathrooms} onValueChange={setBathrooms}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-body"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['1','2','3+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="font-bold text-xs uppercase text-primary/60 font-headline">Description & Features</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Key features, local amenities, etc." className="rounded-xl min-h-[120px] bg-muted/20 border-none font-body" />
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="p-8 bg-muted/10 border-t flex justify-end gap-4">
            <Button type="button" variant="ghost" className="rounded-xl h-12 px-8 font-bold font-headline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" className="rounded-xl font-bold bg-primary h-12 px-12 shadow-lg shadow-primary/20 min-w-[200px] font-headline text-white hover:bg-primary/90" disabled={isSubmitting}>
              {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Save Changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
