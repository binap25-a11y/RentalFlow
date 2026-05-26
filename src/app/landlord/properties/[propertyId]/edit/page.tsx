"use client";

import { useState, useEffect, use, useCallback } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useMemoFirebase,
  updateDocumentNonBlocking,
} from '@/firebase';
import { doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
import { cn, isRealUserUpload, compressImage, withRetry } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

type LedgerItem = {
  id: string;
  previewUrl: string; 
  cloudUrl?: string;   
  status: 'uploading' | 'ready' | 'error';
  isBroken?: boolean;
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
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

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
      
      const urls = property.imageUrls || [];
      const primary = property.imageUrl;
      
      let sortedUrls = [...urls];
      if (primary && urls.includes(primary)) {
        sortedUrls = [primary, ...urls.filter(u => u !== primary)];
      }

      const initialLedger = sortedUrls
        .filter(url => url && isRealUserUpload(url))
        .map(url => ({ 
          id: Math.random().toString(36).substring(7), 
          previewUrl: url, 
          cloudUrl: url, 
          status: 'ready' as const
        }));
        
      setLedger(initialLedger);
      setIsInitialized(true);
    }
  }, [property, isInitialized]);

  /**
   * 🔄 Transactional Visual Sync
   * Visual modifications are committed to Firestore microsecond-instantly.
   * This is strictly isolated from the manual Save button.
   */
  const syncVisualsToFirestore = useCallback((currentLedger: LedgerItem[]) => {
    if (!db || !propertyRef) return;

    const readyUrls = currentLedger
      .filter(i => i.status === 'ready' && i.cloudUrl && isRealUserUpload(i.cloudUrl))
      .map(i => i.cloudUrl!);

    updateDocumentNonBlocking(propertyRef, {
      imageUrl: readyUrls.length > 0 ? readyUrls[0] : null,
      imageUrls: readyUrls,
      updatedAt: serverTimestamp(),
    });
  }, [db, propertyRef]);

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user) return;

    for (const file of files) {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);
      
      const uploadItem: LedgerItem = { id: tempId, previewUrl: localUrl, status: 'uploading' };
      setLedger(prev => [...prev, uploadItem]);

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
        
        setLedger(prev => {
          const updated = prev.map(item => item.id === tempId ? { ...item, cloudUrl: publicUrl, status: 'ready' } : item);
          syncVisualsToFirestore(updated);
          return updated;
        });
      } catch (err) {
        setLedger(prev => prev.map(item => item.id === tempId ? { ...item, status: 'error' } : item));
      }
    }
    e.target.value = '';
  };

  const removeFromLedger = (id: string) => {
    setLedger(prev => {
      const updated = prev.filter(i => i.id !== id);
      syncVisualsToFirestore(updated);
      return updated;
    });
  };

  const setAsPrimary = (id: string) => {
    setLedger(prev => {
      const item = prev.find(i => i.id === id);
      if (!item) return prev;
      const updated = [item, ...prev.filter(i => i.id !== id)];
      syncVisualsToFirestore(updated);
      return updated;
    });
    toast({ title: "Designated Primary Cover" });
  };

  const handleImageError = (id: string) => {
    setLedger(prev => prev.map(item => {
      if (item.id === id) return { ...item, isBroken: true };
      return item;
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !propertyRef) return;

    setIsSaving(true);
    
    // TRANSACTIONAL PROTECTION: Exclude visual fields from manual Save payload.
    // They are handled atomically by syncVisualsToFirestore.
    const serializableData = {
      id: propertyId, 
      landlordId: user.uid, 
      addressLine1: address,
      city, 
      zipCode, 
      rentAmount: parseFloat(rentAmount) || 0,
      propertyType,
      numberOfBedrooms: parseInt(bedrooms, 10) || 1, 
      numberOfBathrooms: parseInt(bathrooms, 10) || 1,
      description: description, 
      isOccupied: property?.isOccupied || false,
      memberIds: property?.memberIds || [user.uid]
    };

    updateDocumentNonBlocking(propertyRef, { ...serializableData, updatedAt: serverTimestamp() });
    
    try {
      await syncPropertyToDb(serializableData);
      toast({ title: "Portfolio Sync Complete" });
      router.push(`/landlord/properties/${propertyId}`);
    } catch (e) {
      router.push(`/landlord/properties/${propertyId}`);
    }
  };

  const isUploading = ledger.some(i => i.status === 'uploading');

  if (isLoading || !isInitialized) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-accent" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-16 text-left bg-background">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button onClick={() => router.back()} className="h-12 w-12 rounded-2xl hover:bg-white/5 transition-all flex items-center justify-center border border-white/5 shadow-2xl">
            <ArrowLeft className="w-6 h-6 text-foreground" />
          </button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-foreground tracking-tight">Modify Asset Specs</h1>
            <p className="text-muted-foreground font-medium font-body text-sm mt-1 opacity-60">Updating {address || 'Property Record'}.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-accent/10 text-accent border-accent/20 px-5 py-2 rounded-full font-bold uppercase tracking-[0.25em] text-[10px]">
          <Sparkles className="w-3.5 h-3.5 mr-2" /> Atomic Sync Active
        </Badge>
      </div>

      <Card className="border-none shadow-2xl overflow-hidden rounded-[3rem] bg-card ring-1 ring-white/5">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-10 bg-white/[0.02] border-r border-white/5">
              <div className="flex justify-between items-center mb-8">
                <Label className="font-bold text-[10px] uppercase tracking-[0.3em] text-muted-foreground opacity-40 font-headline">Visual Asset Ledger</Label>
                <label htmlFor="image-input" className="h-11 rounded-2xl font-bold text-[10px] uppercase font-headline cursor-pointer px-6 bg-accent text-white shadow-2xl shadow-accent/20 flex items-center hover:bg-accent/90 transition-all active:scale-95">
                  <Plus className="w-4 h-4 mr-2" /> Register Assets
                </label>
              </div>

              <ScrollArea className="h-[600px] pr-4">
                <div className="grid grid-cols-2 gap-5">
                  {ledger.map((item, index) => {
                    // Self-Healing Source: fallback to local preview if cloud binary isn't ready
                    const displayUrl = (item.status === 'ready' && item.cloudUrl && !item.isBroken) ? item.cloudUrl : item.previewUrl;
                    
                    return (
                      <div key={item.id} className={cn(
                        "relative aspect-square rounded-[2rem] overflow-hidden group shadow-2xl bg-background border-2 transition-all duration-500",
                        item.status === 'uploading' ? 'opacity-50 grayscale scale-[0.95]' : 'opacity-100',
                        index === 0 ? "border-accent" : "border-transparent",
                        (item.status === 'error' || item.isBroken) && "border-destructive"
                      )}>
                        <img 
                          src={displayUrl} 
                          alt="" 
                          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
                          onError={() => handleImageError(item.id)}
                        />
                        
                        <div className="absolute top-3 right-3 flex gap-2 z-20">
                          <button type="button" onClick={() => setAsPrimary(item.id)} className="bg-black/60 backdrop-blur-xl text-accent p-2.5 rounded-2xl hover:scale-110 transition-transform shadow-2xl border border-white/10">
                            <Star className={cn("w-4 h-4", index === 0 && "fill-accent")} />
                          </button>
                          <button type="button" onClick={() => removeFromLedger(item.id)} className="bg-red-500/80 backdrop-blur-xl text-white p-2.5 rounded-2xl shadow-2xl hover:bg-red-600 transition-all active:scale-90 border border-white/10"><X className="w-4 h-4" /></button>
                        </div>
                        
                        {index === 0 && (
                          <div className="absolute bottom-3 left-3 px-3 py-1 bg-accent text-white text-[8px] font-bold uppercase rounded-full shadow-2xl font-headline z-20 tracking-widest">Cover</div>
                        )}

                        {item.status === 'uploading' && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-xl gap-3">
                             <Loader2 className="w-8 h-8 animate-spin text-primary opacity-60" />
                             <span className="text-[9px] font-bold text-primary uppercase tracking-[0.4em]">Syncing...</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <label htmlFor="image-input" className="aspect-square rounded-[2rem] border-2 border-dashed border-white/5 hover:border-accent/40 transition-all duration-500 bg-white/[0.01] flex flex-col items-center justify-center gap-4 group cursor-pointer shadow-inner">
                    <div className="p-5 bg-white/5 rounded-full group-hover:scale-110 transition-transform duration-500"><Plus className="w-8 h-8 text-white/10 group-hover:text-accent/40" /></div>
                    <span className="text-[9px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-30">Gallery Select</span>
                  </label>
                </div>
              </ScrollArea>
              <input id="image-input" type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </div>

            <div className="p-12 space-y-10">
              <div className="space-y-8 text-left">
                <div className="space-y-3">
                  <Label className="font-bold text-[10px] uppercase tracking-[0.3em] text-muted-foreground opacity-40 font-headline">Operational Location</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} required className="rounded-2xl h-14 bg-muted/30 border-none font-bold text-base px-6 shadow-inner" placeholder="Street Address" />
                </div>
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40 tracking-[0.3em] font-headline">Registry City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} required className="rounded-2xl h-14 bg-muted/30 border-none font-bold text-base px-6 shadow-inner" placeholder="City" />
                  </div>
                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40 tracking-[0.3em] font-headline">Postcode Identity</Label>
                    <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} required className="rounded-2xl h-14 bg-muted/30 border-none font-bold text-base px-6 shadow-inner" placeholder="Postcode" />
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40 tracking-[0.3em] font-headline">Bedrooms</Label>
                    <Select value={bedrooms} onValueChange={setBedrooms}>
                      <SelectTrigger className="rounded-2xl h-14 bg-muted/30 border-none font-bold text-base px-6 shadow-inner focus:ring-accent text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-white/5 bg-card">
                        {[1, 2, 3, 4, 5, 6, 7, 8].map(n => <SelectItem key={n} value={n.toString()} className="font-bold">{n} Bedroom{n > 1 ? 's' : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40 tracking-[0.3em] font-headline">Bathrooms</Label>
                    <Select value={bathrooms} onValueChange={setBathrooms}>
                      <SelectTrigger className="rounded-2xl h-14 bg-muted/30 border-none font-bold text-base px-6 shadow-inner focus:ring-accent text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-xl border-white/5 bg-card">
                        {[1, 2, 3, 4, 5].map(n => <SelectItem key={n} value={n.toString()} className="font-bold">{n} Bathroom{n > 1 ? 's' : ''}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40 tracking-[0.3em] font-headline">Asset Classification</Label>
                    <Select value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger className="rounded-2xl h-14 bg-muted/30 border-none font-bold text-base px-6 shadow-inner focus:ring-accent text-foreground"><SelectValue /></SelectTrigger>
                      <SelectContent className="rounded-2xl border-white/5 bg-card shadow-2xl p-2">
                        <SelectItem value="Apartment" className="rounded-xl font-bold py-3">Apartment Registry</SelectItem>
                        <SelectItem value="House" className="rounded-xl font-bold py-3">Residential House</SelectItem>
                        <SelectItem value="Studio" className="rounded-xl font-bold py-3">Modern Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40 tracking-[0.3em] font-headline">Target Yield (£)</Label>
                    <Input type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-2xl h-14 bg-muted/30 border-none font-bold text-base px-6 shadow-inner" placeholder="0.00" />
                  </div>
                </div>
                <div className="space-y-3">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40 tracking-[0.3em] font-headline">Operational Narrative</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Internal narrative for this asset ledger..." className="rounded-2xl min-h-[160px] bg-muted/30 border-none font-medium text-base px-6 py-5 shadow-inner leading-relaxed text-foreground" />
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="p-10 bg-white/[0.01] border-t border-white/5 flex flex-col md:flex-row justify-end gap-5 shrink-0">
            <Button type="button" variant="ghost" className="w-full md:w-auto rounded-2xl h-14 px-10 font-bold font-headline text-muted-foreground hover:bg-white/5 hover:text-foreground border border-white/5 transition-all" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isUploading || isSaving} className="w-full md:w-auto rounded-2xl font-bold bg-accent h-14 px-14 shadow-2xl shadow-accent/20 font-headline text-white transition-all hover:bg-accent/90 uppercase tracking-[0.2em] text-[11px] border-none hover:scale-[1.02]">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
              Save & Synchronize
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
