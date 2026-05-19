"use client";

import { useState, useEffect, use } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase,
} from '@/firebase';
import { doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Image as ImageIcon, Loader2, Sparkles, X, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { syncPropertyToDb } from "@/lib/actions/db-sync";
import { uploadToSupabase } from '@/lib/actions/supabase-storage';

const setMemoryAsset = (id: string, url: string) => {
  if (typeof window === 'undefined') return;
  if (!(window as any).__asset_bridge) (window as any).__asset_bridge = {};
  (window as any).__asset_bridge[id] = url;
};

export default function EditPropertyPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const propertyId = resolvedParams.propertyId;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const propertyRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'properties', propertyId);
  }, [db, propertyId]);

  const { data: property, isLoading } = useDoc(propertyRef);

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newImageFiles, setNewImageFiles] = useState<File[]>([]);
  const [newPreviewUrls, setNewPreviewUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (property && !isSaving) {
      setAddress(property.addressLine1 || '');
      setCity(property.city || '');
      setZipCode(property.zipCode || '');
      setRentAmount(property.rentAmount?.toString() || '');
      setDescription(property.description || '');
      setPropertyType(property.propertyType || 'Apartment');
      setBedrooms(property.numberOfBedrooms?.toString() || '1');
      setBathrooms(property.numberOfBathrooms?.toString() || '1');
      setExistingImageUrls(property.imageUrls || [property.imageUrl].filter(Boolean));
    }
  }, [property, isSaving]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setNewImageFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setNewPreviewUrls(prev => [...prev, ...newPreviews]);
    }
  };

  const removeNewImage = (index: number) => {
    setNewImageFiles(prev => prev.filter((_, i) => i !== index));
    setNewPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const removeExistingImage = (index: number) => {
    setExistingImageUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !propertyRef) return;

    setIsSaving(true);

    try {
      let uploadedUrls: string[] = [];
      if (newImageFiles.length > 0) {
        const uploadPromises = newImageFiles.map((file, index) => {
          const formData = new FormData();
          formData.append('file', file);
          const path = `assets/${user.uid}/${propertyId}/${Date.now()}_${index}_${file.name}`;
          return uploadToSupabase(formData, 'property-images', path);
        });

        const results = await Promise.all(uploadPromises);
        uploadedUrls = results.filter(r => r.success && r.url).map(r => r.url!);
      }

      const finalGallery = [...existingImageUrls, ...uploadedUrls];
      const primaryUrl = finalGallery.length > 0 ? finalGallery[0] : '';
      
      if (primaryUrl) setMemoryAsset(propertyId, primaryUrl);

      const serializableData = {
        id: propertyId,
        landlordId: user.uid,
        addressLine1: address,
        city,
        zipCode,
        rentAmount: parseFloat(rentAmount) || 0,
        imageUrl: primaryUrl,
        imageUrls: finalGallery,
        propertyType,
        numberOfBedrooms: parseInt(bedrooms, 10) || 1,
        numberOfBathrooms: parseInt(bathrooms, 10) || 1,
        description: description,
      };

      const firestoreUpdateData = {
        ...serializableData,
        updatedAt: serverTimestamp(),
      };

      await setDoc(propertyRef, firestoreUpdateData, { merge: true });
      await syncPropertyToDb(serializableData);

      toast({ title: "Portfolio Updated", description: "Changes synchronized and remembered permanently." });
      router.push(`/landlord/properties/${propertyId}`);
    } catch (err: any) {
      console.error("Update failed:", err);
      toast({ variant: "destructive", title: "Update Failed", description: "The server encountered an issue with your asset data." });
      setIsSaving(false);
    }
  };

  if (isLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Modify Asset</h1>
            <p className="text-muted-foreground font-medium font-body">Refining specs and gallery for {address || 'Property'}.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1 rounded-full font-bold">
          <Sparkles className="w-3 h-3 mr-2" /> Live Specification
        </Badge>
      </div>

      <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white border border-primary/5">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 lg:p-12 bg-primary/5 border-r border-primary/10">
              <div className="flex justify-between items-center mb-6">
                <Label className="font-bold text-xs uppercase tracking-widest text-primary/60 block font-headline">Gallery Ledger</Label>
                <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase font-headline" onClick={() => document.getElementById('image-input')?.click()}>
                  <Plus className="w-3 h-3 mr-1" /> Add Photos
                </Button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {existingImageUrls.map((url, index) => (
                  <div key={`existing-${index}`} className="relative aspect-video rounded-2xl overflow-hidden group shadow-sm border border-primary/10 bg-white">
                    <Image 
                      src={url} 
                      alt={`Existing ${index}`} 
                      fill 
                      className="object-cover" 
                      unoptimized={true} 
                      data-ai-hint="property view"
                    />
                    <button 
                      type="button" 
                      onClick={() => removeExistingImage(index)}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    {index === 0 && (
                      <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-emerald-500 text-white text-[8px] font-bold uppercase rounded-md shadow-lg font-headline">Cover</div>
                    )}
                  </div>
                ))}
                
                {newPreviewUrls.map((url, index) => (
                  <div key={`new-${index}`} className="relative aspect-video rounded-2xl overflow-hidden group shadow-sm border-2 border-dashed border-accent/40 bg-white">
                    <Image 
                      src={url} 
                      alt={`New ${index}`} 
                      fill 
                      className="object-cover opacity-80" 
                      unoptimized={true} 
                      data-ai-hint="modern home"
                    />
                    <button 
                      type="button" 
                      onClick={() => removeNewImage(index)}
                      className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full opacity-100 transition-opacity hover:bg-red-500"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                <button 
                  type="button" 
                  onClick={() => document.getElementById('image-input')?.click()}
                  className="aspect-video rounded-2xl border-2 border-dashed border-primary/20 hover:border-primary/40 transition-all bg-white flex flex-col items-center justify-center gap-2 group"
                >
                  <Plus className="w-6 h-6 text-primary/20 group-hover:text-primary/40" />
                  <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest font-headline">Select New</span>
                </button>
              </div>
              <input id="image-input" type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </div>

            <div className="p-8 lg:p-12 space-y-8">
              <div className="grid grid-cols-1 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="address" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Street Address</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-body font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-body font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Postcode</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-body font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Asset Class</Label>
                    <Select value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-body font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Apartment">Apartment</SelectItem>
                        <SelectItem value="House">House</SelectItem>
                        <SelectItem value="Condo">Condo</SelectItem>
                        <SelectItem value="Studio">Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Monthly Yield (£)</Label>
                    <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-body font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Bedrooms</Label>
                    <Select value={bedrooms} onValueChange={setBedrooms}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-body font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['1','2','3','4','5+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Bathrooms</Label>
                    <Select value={bathrooms} onValueChange={setBathrooms}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-body font-bold"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {['1','2','3+'].map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Asset Narrative</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Highlight high-fidelity property features..." className="rounded-xl min-h-[120px] bg-muted/20 border-none font-body font-medium" />
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="p-8 bg-muted/10 border-t flex justify-end gap-4">
            <Button type="button" variant="ghost" className="rounded-xl h-12 px-8 font-bold font-headline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="rounded-xl font-bold bg-primary h-12 px-12 shadow-lg shadow-primary/20 min-w-[200px] font-headline text-white hover:bg-primary/90 transition-transform active:scale-95">
              {isSaving ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Syncing...</> : <><Save className="w-5 h-5 mr-2" /> Save Specification</>}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
