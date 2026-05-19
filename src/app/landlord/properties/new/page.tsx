"use client";

import { useState } from 'react';
import { useUser, useFirestore, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, collection } from 'firebase/firestore';
import { Card, CardFooter } from "@/components/ui/card";
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

// High-Performance Memory Bridge for Cross-Page Instant Sync
const setMemoryAsset = (id: string, url: string) => {
  if (typeof window === 'undefined') return;
  if (!(window as any).__asset_bridge) (window as any).__asset_bridge = {};
  (window as any).__asset_bridge[id] = url;
};

export default function NewPropertyPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');
  const [propertyType, setPropertyType] = useState('Apartment');
  const [bedrooms, setBedrooms] = useState('1');
  const [bathrooms, setBathrooms] = useState('1');
  
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setImageFiles(prev => [...prev, ...files]);
      const newPreviews = files.map(file => URL.createObjectURL(file));
      setPreviewUrls(prev => [...prev, ...newPreviews]);
    }
  };

  const removeImage = (index: number) => {
    setImageFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    setIsSaving(true);
    const propertyId = doc(collection(db, 'properties')).id;
    const propertyRef = doc(db, 'properties', propertyId);

    // CRITICAL: Seed bridge INSTANTLY with local preview for zero-latency feedback
    if (previewUrls.length > 0) {
      setMemoryAsset(propertyId, previewUrls[0]);
    }

    const fallbackUrl = `https://picsum.photos/seed/${propertyId}/800/600`;

    // Base data with temporary blob/placeholder for instant UI update
    const baseData = {
      id: propertyId,
      landlordId: user.uid,
      addressLine1: address,
      city,
      zipCode,
      description,
      propertyType,
      numberOfBedrooms: parseInt(bedrooms, 10) || 1,
      numberOfBathrooms: parseInt(bathrooms, 10) || 1,
      rentAmount: parseFloat(rentAmount) || 0,
      isOccupied: false,
      isImageUpdating: imageFiles.length > 0,
      imageUrl: previewUrls[0] || fallbackUrl, 
      imageUrls: previewUrls, // Temporary local previews
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      tenantIds: [],
      memberIds: [user.uid],
      isActive: true
    };

    setDocumentNonBlocking(propertyRef, baseData, { merge: true });

    if (imageFiles.length > 0) {
      const uploadPromises = imageFiles.map((file, index) => {
        const formData = new FormData();
        formData.append('file', file);
        const path = `assets/${user.uid}/${propertyId}/${Date.now()}_${index}_${file.name}`;
        return uploadToSupabase(formData, 'property-images', path);
      });

      // Background upload process to replace temporary URLs with permanent ones
      Promise.all(uploadPromises).then((results) => {
        const successfulUrls = results.filter(r => r.success && r.url).map(r => r.url!);
        if (successfulUrls.length > 0) {
          const finalImageUrl = successfulUrls[0];
          const finalImageUrls = successfulUrls;

          updateDocumentNonBlocking(propertyRef, { 
            imageUrl: finalImageUrl, 
            imageUrls: finalImageUrls,
            isImageUpdating: false,
            updatedAt: serverTimestamp() 
          });

          // Sync to relational ledger if available
          syncPropertyToDb({ 
            ...baseData, 
            imageUrl: finalImageUrl, 
            imageUrls: finalImageUrls 
          });
          
          // Refresh bridge with permanent URL
          setMemoryAsset(propertyId, finalImageUrl);
        } else {
          updateDocumentNonBlocking(propertyRef, { isImageUpdating: false });
        }
      }).catch((err) => {
        console.error("Upload process failed:", err);
        updateDocumentNonBlocking(propertyRef, { isImageUpdating: false });
      });
    } else {
      syncPropertyToDb(baseData);
    }

    toast({ title: "Asset Registered", description: "Portfolio inventory updated instantly." });
    router.push(`/landlord/properties/${propertyId}`);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-left">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Register Asset</h1>
            <p className="text-muted-foreground font-medium font-body">Add a high-value property with a photo gallery.</p>
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
                <Label className="font-bold text-xs uppercase tracking-widest text-primary/60 block font-headline">Gallery Management</Label>
                <Button type="button" variant="ghost" size="sm" className="h-8 rounded-lg font-bold text-[10px] uppercase font-headline" onClick={() => document.getElementById('image-input')?.click()}>
                  <Plus className="w-3 h-3 mr-1" /> Add Photos
                </Button>
              </div>

              {previewUrls.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {previewUrls.map((url, index) => (
                    <div key={index} className="relative aspect-video rounded-2xl overflow-hidden group shadow-sm border border-primary/10 bg-white">
                      <Image src={url} alt={`Preview ${index}`} fill className="object-cover" unoptimized={true} />
                      <button 
                        type="button" 
                        onClick={() => removeImage(index)}
                        className="absolute top-2 right-2 bg-black/60 text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                      {index === 0 && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-primary text-white text-[8px] font-bold uppercase rounded-md shadow-lg font-headline">Primary Cover</div>
                      )}
                    </div>
                  ))}
                  <button 
                    type="button" 
                    onClick={() => document.getElementById('image-input')?.click()}
                    className="aspect-video rounded-2xl border-2 border-dashed border-primary/20 hover:border-primary/40 transition-all bg-white flex flex-col items-center justify-center gap-2 group"
                  >
                    <Plus className="w-6 h-6 text-primary/20 group-hover:text-primary/40 transition-colors" />
                    <span className="text-[10px] font-bold text-primary/40 uppercase tracking-widest font-headline">Add More</span>
                  </button>
                </div>
              ) : (
                <div className="relative group overflow-hidden rounded-3xl border-2 border-dashed border-primary/20 hover:border-primary/40 transition-all bg-white aspect-video w-full flex items-center justify-center shadow-inner">
                  <button type="button" onClick={() => document.getElementById('image-input')?.click()} className="flex flex-col items-center gap-3">
                    <div className="p-5 bg-primary/10 rounded-full shadow-sm"><ImageIcon className="w-8 h-8 text-primary" /></div>
                    <span className="text-sm font-bold text-primary font-headline">Upload Specification Photos</span>
                  </button>
                </div>
              )}
              <input id="image-input" type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
              <p className="mt-4 text-[10px] text-muted-foreground font-bold text-center uppercase tracking-widest opacity-60 font-headline">Professional Assets Supported.</p>
            </div>

            <div className="p-8 lg:p-12 space-y-8">
              <div className="grid grid-cols-1 gap-6 text-left">
                <div className="space-y-2">
                  <Label htmlFor="address" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Street Address</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="123 Example Street" className="rounded-xl h-12 bg-muted/20 border-none focus:ring-2 focus:ring-primary font-body font-medium" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="London" className="rounded-xl h-12 bg-muted/20 border-none font-body font-medium" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Postcode</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required placeholder="SW1A 1AA" className="rounded-xl h-12 bg-muted/20 border-none font-body font-medium" />
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
                  <Label htmlFor="description" className="font-bold text-xs uppercase text-primary/60 font-headline tracking-widest">Property Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detail key asset features and high-value specifications..." className="rounded-xl min-h-[120px] bg-muted/20 border-none font-body font-medium" />
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="p-8 bg-muted/10 border-t flex justify-end gap-4">
            <Button type="button" variant="ghost" className="rounded-xl h-12 px-8 font-bold font-headline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="rounded-xl font-bold bg-primary h-12 px-12 shadow-lg shadow-primary/20 min-w-[200px] font-headline text-white hover:bg-primary/90 transition-transform active:scale-95">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
              Register Portfolio Asset
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
