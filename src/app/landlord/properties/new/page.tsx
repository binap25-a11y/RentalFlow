"use client";

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, setDocumentNonBlocking, updateDocumentNonBlocking } from '@/firebase';
import { doc, serverTimestamp, collection } from 'firebase/firestore';
import { Card, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Sparkles, X, Plus, Star } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { syncPropertyToDb } from "@/lib/actions/db-sync";
import { supabase } from '@/lib/supabase';
import { cn, compressImage, withRetry, isRealUserUpload, RENTALFLOW_NEUTRAL_FALLBACK } from '@/lib/utils';
import { ScrollArea } from "@/components/ui/scroll-area";

const BRAND_FALLBACK = RENTALFLOW_NEUTRAL_FALLBACK;

type LedgerItem = {
  id: string;
  previewUrl: string; 
  cloudUrl?: string;   
  status: 'uploading' | 'ready' | 'error';
};

export default function NewPropertyPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  // 🔐 Stable Identity Pre-Generation
  const propertyId = useMemo(() => {
    if (!db) return '';
    return doc(collection(db, 'properties')).id;
  }, [db]);

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

  /**
   * 🔄 Direct Transactional Persistence
   * Overwrites Firestore micro-seconds after binary delivery.
   * Strictly purges placeholders if user uploads exist.
   */
  const performDirectSync = (currentLedger: LedgerItem[]) => {
    if (!db || !user || !propertyId) return;

    const readyUrls = currentLedger
      .filter(i => i.status === 'ready' && i.cloudUrl)
      .map(i => i.cloudUrl!);

    const userOnly = readyUrls.filter(isRealUserUpload);
    const finalGallery = userOnly.length > 0 ? userOnly : readyUrls;
    const primaryUrl = finalGallery.length > 0 ? finalGallery[0] : BRAND_FALLBACK;

    const propertyRef = doc(db, 'properties', propertyId);
    setDocumentNonBlocking(propertyRef, {
      id: propertyId,
      landlordId: user.uid,
      imageUrl: primaryUrl,
      imageUrls: finalGallery,
      updatedAt: serverTimestamp(),
      memberIds: [user.uid]
    }, { merge: true });
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user || !propertyId) return;

    let updatedLedger = [...ledger];

    for (const file of files) {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);
      
      const newItem: LedgerItem = { id: tempId, previewUrl: localUrl, status: 'uploading' };
      updatedLedger = [...updatedLedger, newItem];
      setLedger(updatedLedger);

      try {
        const optimizedBlob = await compressImage(file);
        const path = `assets/${user.uid}/${propertyId}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        const publicUrl = await withRetry(async () => {
          const { error: uploadError } = await supabase.storage
            .from('property-images')
            .upload(path, optimizedBlob, { contentType: 'image/jpeg', upsert: true });
          if (uploadError) throw uploadError;
          const { data: { publicUrl: url } } = supabase.storage.from('property-images').getPublicUrl(path);
          return url;
        });
        
        updatedLedger = updatedLedger.map(item => 
          item.id === tempId ? { ...item, cloudUrl: publicUrl, status: 'ready' } : item
        );
        setLedger(updatedLedger);
        
        // TRANSACTIONAL SYNC: Ensure database record exists and includes images immediately
        performDirectSync(updatedLedger);
        toast({ title: "Visual Binary Synchronized" });
      } catch (err) {
        setLedger(prev => prev.map(item => 
          item.id === tempId ? { ...item, status: 'error' } : item
        ));
        toast({ variant: "destructive", title: "Sync Failed" });
      }
    }
    e.target.value = '';
  };

  const removeFromLedger = (id: string) => {
    const updated = ledger.filter(i => i.id !== id);
    setLedger(updated);
    performDirectSync(updated);
    toast({ title: "Asset Removed" });
  };

  const setAsPrimary = (id: string) => {
    const item = ledger.find(i => i.id === id);
    if (!item) return;
    const updated = [item, ...ledger.filter(i => i.id !== id)];
    setLedger(updated);
    performDirectSync(updated);
    toast({ title: "Cover Identity Updated" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !propertyId) return;
    setIsSaving(true);
    const propertyRef = doc(db, 'properties', propertyId);

    try {
      const finalImageUrls = ledger.filter(i => i.status === 'ready').map(i => i.cloudUrl!);
      const userUploads = finalImageUrls.filter(isRealUserUpload);
      const purgedGallery = userUploads.length > 0 ? userUploads : finalImageUrls;
      const finalImageUrl = purgedGallery.length > 0 ? purgedGallery[0] : BRAND_FALLBACK;

      const serializableData = {
        id: propertyId, landlordId: user.uid, addressLine1: address,
        city, zipCode, rentAmount: parseFloat(rentAmount) || 0,
        imageUrl: finalImageUrl, imageUrls: purgedGallery, propertyType,
        numberOfBedrooms: parseInt(bedrooms, 10) || 1, numberOfBathrooms: parseInt(bathrooms, 10) || 1,
        description: description, isOccupied: false, memberIds: [user.uid]
      };

      setDocumentNonBlocking(propertyRef, {
        ...serializableData,
        tenantIds: [], isActive: true, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
      }, { merge: true });

      await syncPropertyToDb(serializableData);
      toast({ title: "Asset Registered" });
      router.push(`/landlord/properties/${propertyId}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Registration Failed", description: err.message });
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 text-left bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="h-10 w-10 rounded-full hover:bg-primary/5 transition-colors flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-foreground tracking-tight">Register Asset</h1>
            <p className="text-muted-foreground font-medium font-body text-sm">Adding a high-value property with professional visual orchestration.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 px-4 py-1 rounded-full font-bold uppercase tracking-widest text-[9px]">
          <Sparkles className="w-3 h-3 mr-2 text-accent" /> Storage-First Sync Enabled
        </Badge>
      </div>

      <Card className="border-none shadow-2xl overflow-hidden rounded-[2.5rem] bg-card ring-1 ring-border">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-10 bg-muted/10 border-r border-border">
              <div className="flex justify-between items-center mb-6">
                <Label className="font-bold text-[10px] uppercase tracking-widest text-muted-foreground opacity-60 font-headline">Visual Inventory</Label>
                <label htmlFor="image-input" className="h-10 rounded-xl font-bold text-[10px] uppercase font-headline cursor-pointer px-5 bg-accent text-white shadow-lg flex items-center hover:bg-accent/90 transition-all active:scale-95">
                  <Plus className="w-3.5 h-3.5 mr-2" /> Add Assets
                </label>
              </div>

              <ScrollArea className="h-[450px] pr-4">
                <div className="grid grid-cols-2 gap-4">
                  {ledger.map((item, index) => (
                    <div key={item.id} className={cn(
                      "relative aspect-video rounded-2xl overflow-hidden group shadow-sm bg-background border-2 transition-all",
                      item.status === 'uploading' ? 'opacity-50 grayscale scale-[0.98]' : 'opacity-100',
                      index === 0 ? "border-accent" : "border-transparent",
                      item.status === 'error' && "border-destructive"
                    )}>
                      <img 
                        src={item.previewUrl} 
                        alt={`Asset ${index}`} 
                        className="absolute inset-0 h-full w-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = BRAND_FALLBACK;
                        }}
                      />
                      <div className="absolute top-2 right-2 flex gap-1 z-20">
                        <button type="button" onClick={() => setAsPrimary(item.id)} className="bg-card/90 text-accent p-2 rounded-xl hover:scale-110 transition-transform shadow-lg border border-border"><Star className={cn("w-3.5 h-3.5", index === 0 && "fill-accent")} /></button>
                        <button type="button" onClick={() => removeFromLedger(item.id)} className="bg-red-500 text-white p-2 rounded-xl shadow-lg hover:bg-red-600 transition-all active:scale-90"><X className="w-3.5 h-3.5" /></button>
                      </div>
                      
                      {item.status === 'uploading' && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-md gap-2">
                           <Loader2 className="w-6 h-6 animate-spin text-accent" />
                           <span className="text-[8px] font-bold text-accent uppercase tracking-[0.2em]">Synchronizing...</span>
                        </div>
                      )}
                    </div>
                  ))}
                  <label htmlFor="image-input" className="aspect-video rounded-2xl border-2 border-dashed border-accent/20 hover:border-accent/40 transition-all bg-muted/5 flex flex-col items-center justify-center gap-2 group cursor-pointer shadow-inner">
                    <Plus className="w-6 h-6 text-accent/20 group-hover:text-accent/40" />
                    <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">Gallery Select</span>
                  </label>
                </div>
              </ScrollArea>
              <input id="image-input" type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </div>

            <div className="p-10 space-y-8">
              <div className="grid grid-cols-1 gap-6 text-left">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Street Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} required placeholder="e.g. 12 High Street" className="rounded-xl h-12 bg-muted/20 border-none font-bold text-foreground" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold text-foreground" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Postcode</Label>
                    <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold text-foreground" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Asset Class</Label>
                    <Select value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-bold text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        <SelectItem value="Apartment">Apartment</SelectItem>
                        <SelectItem value="House">House</SelectItem>
                        <SelectItem value="Studio">Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Monthly Yield (£)</Label>
                    <Input type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold text-foreground" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Operational Narrative</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description for internal records..." className="rounded-xl min-h-[140px] bg-muted/20 border-none font-medium text-foreground leading-relaxed" />
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="p-10 bg-muted/5 border-t flex flex-col md:flex-row justify-end gap-4">
            <Button type="button" variant="ghost" className="w-full md:w-auto rounded-xl h-12 px-8 font-bold font-headline text-muted-foreground" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving || ledger.some(i => i.status === 'uploading')} className="w-full md:w-auto rounded-xl font-bold bg-accent h-12 px-12 shadow-xl shadow-accent/20 font-headline text-white transition-all hover:bg-accent/90 uppercase tracking-widest text-xs border-none">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Synchronize Asset
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
