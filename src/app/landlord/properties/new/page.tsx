"use client";

import { useState } from 'react';
import { useUser, useFirestore, setDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, collection } from 'firebase/firestore';
import { Card, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Image as ImageIcon, Loader2, Sparkles, X, Plus, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { syncPropertyToDb } from "@/lib/actions/db-sync";
import { uploadToSupabase } from '@/lib/actions/supabase-storage';
import { cn, isUserUploadedAsset } from '@/lib/utils';

type LedgerItem = {
  id: string;
  url: string;
  file: File;
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
  
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      const newItems = files.map(file => ({
        id: Math.random().toString(),
        url: URL.createObjectURL(file),
        file
      }));
      setLedger(prev => [...prev, ...newItems]);
    }
  };

  const removeFromLedger = (id: string) => {
    const item = ledger.find(i => i.id === id);
    if (item) URL.revokeObjectURL(item.url);
    setLedger(prev => prev.filter(i => i.id !== id));
  };

  const setAsPrimary = (id: string) => {
    const item = ledger.find(i => i.id === id);
    if (!item) return;
    setLedger(prev => [item, ...prev.filter(i => i.id !== id)]);
    toast({ title: "Primary Identity Set", description: "Designated as the cover visual." });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    setIsSaving(true);
    const propertyId = doc(collection(db, 'properties')).id;
    const propertyRef = doc(db, 'properties', propertyId);

    try {
      const uploadResults = await Promise.all(ledger.map(async (item, index) => {
        const formData = new FormData();
        formData.append('file', item.file);
        const path = `assets/${user.uid}/${propertyId}/${Date.now()}_${index}_${item.file.name}`;
        const res = await uploadToSupabase(formData, 'property-images', path);
        if (!res.success) throw new Error(res.error || "Image upload failed");
        return res.url || '';
      }));

      const finalImageUrls = uploadResults.filter(url => isUserUploadedAsset(url));
      const finalImageUrl = finalImageUrls.length > 0 ? finalImageUrls[0] : '';

      const serializableData = {
        id: propertyId,
        landlordId: user.uid,
        addressLine1: address,
        city,
        zipCode,
        rentAmount: parseFloat(rentAmount) || 0,
        imageUrl: finalImageUrl,
        imageUrls: finalImageUrls,
        propertyType,
        numberOfBedrooms: parseInt(bedrooms, 10) || 1,
        numberOfBathrooms: parseInt(bathrooms, 10) || 1,
        description: description,
        isOccupied: false,
        memberIds: [user.uid]
      };

      setDocumentNonBlocking(propertyRef, {
        ...serializableData,
        tenantIds: [],
        isActive: true,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      const syncResult = await syncPropertyToDb(serializableData);
      if (!syncResult.success) {
        console.warn("Relational sync failed but Firestore was updated.");
      }

      toast({ title: "Asset Registered", description: "Visual and record data synchronized." });
      ledger.forEach(item => URL.revokeObjectURL(item.url));
      router.push(`/landlord/properties/${propertyId}`);
    } catch (err: any) {
      console.error("Asset registration failed:", err);
      const isRlsError = err.message?.toLowerCase().includes('security policy');
      toast({ 
        variant: "destructive", 
        title: isRlsError ? "Security Policy Error" : "Registration Failed", 
        description: isRlsError 
          ? "Upload denied by Supabase. Please check storage policies." 
          : err.message || "Check storage availability and try again." 
      });
      setIsSaving(false);
    }
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
            <p className="text-muted-foreground font-medium font-body">Adding a high-value property with professional visuals.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1 rounded-full font-bold">
          <Sparkles className="w-3 h-3 mr-2" /> Specification Engine
        </Badge>
      </div>

      <Card className="border-none shadow-xl overflow-hidden rounded-[2rem] bg-white border border-primary/5">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 lg:p-12 bg-primary/5 border-r border-primary/10">
              <div className="flex justify-between items-center mb-6 text-left">
                <Label className="font-bold text-xs uppercase tracking-widest text-primary/60 block font-headline">Visual Orchestration</Label>
                <label htmlFor="image-input" className="h-8 rounded-lg font-bold text-[10px] uppercase font-headline cursor-pointer px-3 bg-muted/50 flex items-center hover:bg-muted transition-colors">
                  <Plus className="w-3 h-3 mr-1" /> Add Photos
                </label>
              </div>

              {ledger.length > 0 ? (
                <div className="grid grid-cols-2 gap-4">
                  {ledger.map((item, index) => (
                    <div key={item.id} className={cn(
                      "relative aspect-video rounded-2xl overflow-hidden group shadow-sm bg-white border-2 transition-all",
                      index === 0 ? "border-primary" : "border-transparent"
                    )}>
                      <Image src={item.url} alt={`Preview ${index}`} fill className="object-cover" unoptimized />
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                        <button type="button" onClick={() => setAsPrimary(item.id)} title="Set as Primary" className="bg-white/90 text-primary p-1.5 rounded-lg hover:scale-110 shadow-lg"><Star className={cn("w-3.5 h-3.5", index === 0 && "fill-primary")} /></button>
                        <button type="button" onClick={() => removeFromLedger(item.id)} className="bg-black/60 text-white p-1.5 rounded-lg hover:bg-red-500 shadow-lg"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      {index === 0 && (
                        <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-primary text-white text-[8px] font-bold uppercase rounded-md shadow-lg font-headline">Cover Visual</div>
                      )}
                    </div>
                  ))}
                  <label 
                    htmlFor="image-input"
                    className="aspect-video rounded-2xl border-2 border-dashed border-primary/20 hover:border-primary/40 transition-all bg-white flex flex-col items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus className="w-6 h-6 text-primary/20" />
                  </label>
                </div>
              ) : (
                <label htmlFor="image-input" className="relative group overflow-hidden rounded-3xl border-2 border-dashed border-primary/20 hover:border-primary/40 transition-all bg-white aspect-video w-full flex items-center justify-center shadow-inner cursor-pointer">
                  <div className="flex flex-col items-center gap-3">
                    <div className="p-5 bg-primary/10 rounded-full"><ImageIcon className="w-8 h-8 text-primary" /></div>
                    <span className="text-sm font-bold text-primary font-headline">Upload Property Assets</span>
                  </div>
                </label>
              )}
              <input id="image-input" type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </div>

            <div className="p-8 lg:p-12 space-y-8">
              <div className="grid grid-cols-1 gap-6 text-left">
                <div className="space-y-2">
                  <Label htmlFor="address" className="font-bold text-xs uppercase text-primary/60 font-headline">Street Address</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="123 Street" className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="city" className="font-bold text-xs uppercase text-primary/60 font-headline">City</Label>
                    <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="zipCode" className="font-bold text-xs uppercase text-primary/60 font-headline">Postcode</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required placeholder="SW1A" className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 font-headline">Asset Class</Label>
                    <Select value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-bold">
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Apartment">Apartment</SelectItem>
                        <SelectItem value="House">House</SelectItem>
                        <SelectItem value="Studio">Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent" className="font-bold text-xs uppercase text-primary/60 font-headline">Monthly Yield (£)</Label>
                    <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description" className="font-bold text-xs uppercase text-primary/60 font-headline">Property Description</Label>
                  <Textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Key features..." className="rounded-xl min-h-[120px] bg-muted/20 border-none" />
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="p-8 bg-muted/10 border-t flex justify-end gap-4">
            <Button type="button" variant="ghost" className="rounded-xl h-12 px-8 font-bold font-headline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving} className="rounded-xl font-bold bg-primary h-12 px-12 shadow-lg shadow-primary/20 min-w-[200px] font-headline text-white">
              {isSaving ? <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Syncing...</> : <><Save className="w-5 h-5 mr-2" /> Register Asset</>}
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}