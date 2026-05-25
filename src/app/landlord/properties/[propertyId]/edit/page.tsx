"use client";

import { useState, useEffect, use } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase,
  setDocumentNonBlocking,
} from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, Loader2, Sparkles, X, Plus, Star, CheckCircle2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { syncPropertyToDb } from "@/lib/actions/db-sync";
import { supabase } from '@/lib/supabase';
import { cn, isUserUploadedAsset, compressImage } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type LedgerItem = {
  id: string;
  url: string;
  status: 'uploading' | 'ready' | 'error';
  isNew: boolean;
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
  
  const [ledger, setLedger] = useState<LedgerItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  useEffect(() => {
    if (property && !isInitialized) {
      setAddress(property.addressLine1 || '');
      setCity(property.city || '');
      setZipCode(property.zipCode || '');
      setRentAmount(property.rentAmount?.toString() || '');
      setDescription(property.description || '');
      setPropertyType(property.propertyType || 'Apartment');
      setBedrooms(property.numberOfBedrooms?.toString() || '1');
      setBathrooms(property.numberOfBathrooms?.toString() || '1');
      
      const gallery = Array.isArray(property.imageUrls) ? [...property.imageUrls] : [];
      if (property.imageUrl && !gallery.includes(property.imageUrl)) {
        gallery.unshift(property.imageUrl);
      }
      
      const initialLedger = gallery
        .filter(url => isUserUploadedAsset(url))
        .map(url => ({ id: Math.random().toString(), url, status: 'ready' as const, isNew: false }));
        
      setLedger(initialLedger);
      setIsInitialized(true);
    }
  }, [property, isInitialized]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;

    for (const file of files) {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);
      
      const newItem: LedgerItem = {
        id: tempId,
        url: localUrl,
        status: 'uploading',
        isNew: true
      };
      
      setLedger(prev => [...prev, newItem]);

      try {
        const optimizedBlob = await compressImage(file);
        const path = `assets/${user.uid}/${propertyId}/${Date.now()}_${file.name.replace(/\s+/g, '_')}`;
        
        // DIRECT-TO-CLOUD: Resolved persistent failed-to-fetch errors on mobile
        const { error: uploadError } = await supabase.storage
          .from('property-images')
          .upload(path, optimizedBlob, {
            contentType: 'image/jpeg',
            upsert: true
          });

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from('property-images').getPublicUrl(path);
        
        setLedger(prev => prev.map(item => 
          item.id === tempId ? { ...item, url: publicUrl, status: 'ready' } : item
        ));
      } catch (err: any) {
        console.error("Direct Sync Error:", err);
        setLedger(prev => prev.map(item => 
          item.id === tempId ? { ...item, status: 'error' } : item
        ));
        toast({ 
          variant: "destructive", 
          title: "Synchronization Interrupted", 
          description: "Visual delivery failed. Please check your network." 
        });
      }
    }
    e.target.value = '';
  };

  const removeFromLedger = (id: string) => {
    setLedger(prev => prev.filter(i => i.id !== id));
  };

  const setAsPrimary = (id: string) => {
    const item = ledger.find(i => i.id === id);
    if (!item) return;
    setLedger(prev => [item, ...prev.filter(i => i.id !== id)]);
    toast({ title: "Cover Identity Updated" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !propertyRef) return;
    if (ledger.some(i => i.status === 'uploading')) {
      toast({ title: "Synchronizing Assets...", description: "Please wait for background uploads to complete." });
      return;
    }

    setIsSaving(true);

    try {
      const finalUrls = ledger.filter(i => i.status === 'ready').map(i => i.url);
      const primaryUrl = finalUrls.length > 0 ? finalUrls[0] : (property?.imageUrl || '');

      const serializableData = {
        id: propertyId,
        landlordId: user.uid,
        addressLine1: address,
        city,
        zipCode,
        rentAmount: parseFloat(rentAmount) || 0,
        imageUrl: primaryUrl,
        imageUrls: finalUrls,
        propertyType,
        numberOfBedrooms: parseInt(bedrooms, 10) || 1,
        numberOfBathrooms: parseInt(bathrooms, 10) || 1,
        description: description,
        isOccupied: property?.isOccupied || false,
        memberIds: property?.memberIds || [user.uid]
      };

      setDocumentNonBlocking(propertyRef, {
        ...serializableData,
        updatedAt: serverTimestamp(),
      }, { merge: true });

      await syncPropertyToDb(serializableData);

      toast({ title: "Portfolio Synchronized" });
      router.push(`/landlord/properties/${propertyId}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
      setIsSaving(false);
    }
  };

  if (isLoading || !isInitialized) return <div className="flex h-[70vh] items-center justify-center bg-background"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 text-left bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.back()} className="h-10 w-10 rounded-full hover:bg-primary/5 transition-colors flex items-center justify-center">
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-headline font-bold text-foreground tracking-tight">Modify Asset Specs</h1>
            <p className="text-muted-foreground font-medium font-body text-xs mt-0.5">Updating {address || 'Property Record'}.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 px-4 py-1 rounded-full font-bold uppercase tracking-widest text-[9px]">
          <Sparkles className="w-3 h-3 mr-2 text-accent" /> Direct Sync Active
        </Badge>
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-[2.5rem] bg-card ring-1 ring-border">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-8 bg-muted/10 border-r border-border">
              <div className="flex justify-between items-center mb-6">
                <Label className="font-bold text-[10px] uppercase tracking-[0.2em] text-muted-foreground opacity-60 font-headline">Visual Inventory</Label>
                <label htmlFor="image-input" className="h-10 rounded-xl font-bold text-[10px] uppercase font-headline cursor-pointer px-5 bg-accent text-white shadow-lg flex items-center hover:opacity-90 transition-all">
                  <Plus className="w-3.5 h-3.5 mr-2" /> Add Assets
                </label>
              </div>

              <ScrollArea className="h-[400px] pr-4">
                <div className="grid grid-cols-2 gap-4">
                  {ledger.map((item, index) => (
                    <div key={item.id} className={cn(
                      "relative aspect-video rounded-2xl overflow-hidden group shadow-sm bg-background border-2 transition-all",
                      item.status === 'uploading' ? 'opacity-50 grayscale scale-[0.98]' : 'opacity-100',
                      index === 0 ? "border-accent" : "border-transparent",
                      item.status === 'error' && "border-destructive"
                    )}>
                      <Image src={item.url} alt={`Asset ${index}`} fill className="object-cover" unoptimized />
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
                      {item.status === 'ready' && (
                        <div className="absolute bottom-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg animate-in zoom-in duration-300">
                           <CheckCircle2 className="w-3" />
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
              <div className="space-y-6 text-left">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Street Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold text-foreground" />
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
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-bold text-foreground">
                        <SelectValue />
                      </SelectTrigger>
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
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Narrative for this asset..." className="rounded-xl min-h-[120px] bg-muted/20 border-none font-medium text-foreground leading-relaxed" />
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="p-8 bg-muted/5 border-t flex flex-col md:flex-row justify-end gap-4 shrink-0">
            <Button type="button" variant="ghost" className="w-full md:w-auto rounded-xl h-12 px-8 font-bold font-headline text-muted-foreground" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving || ledger.some(i => i.status === 'uploading')} className="w-full md:w-auto rounded-xl font-bold bg-accent h-12 px-12 shadow-xl shadow-accent/20 font-headline text-white transition-all hover:scale-[1.02] uppercase tracking-widest text-xs border-none">
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Save & Synchronize
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
