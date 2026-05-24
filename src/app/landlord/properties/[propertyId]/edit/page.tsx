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
import { uploadToSupabase, deleteFromSupabase } from '@/lib/actions/supabase-storage';
import { cn, isUserUploadedAsset } from "@/lib/utils";

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

    const newItems: LedgerItem[] = files.map(file => ({
      id: Math.random().toString(),
      url: URL.createObjectURL(file),
      status: 'uploading',
      isNew: true
    }));
    
    setLedger(prev => [...prev, ...newItems]);

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const itemId = newItems[i].id;
      
      const formData = new FormData();
      formData.append('file', file);
      const path = `assets/${user.uid}/${propertyId}/${Date.now()}_${file.name}`;
      
      try {
        const res = await uploadToSupabase(formData, 'property-images', path);
        if (res.success && res.url) {
          setLedger(prev => prev.map(item => 
            item.id === itemId ? { ...item, url: res.url!, status: 'ready' } : item
          ));
        } else {
          throw new Error(res.error);
        }
      } catch (err) {
        setLedger(prev => prev.map(item => 
          item.id === itemId ? { ...item, status: 'error' } : item
        ));
        toast({ variant: "destructive", title: "Storage Sync Failed", description: "Binary upload error." });
      }
    }
  };

  const removeFromLedger = async (id: string) => {
    const item = ledger.find(i => i.id === id);
    if (!item) return;

    if (item.isNew && item.url.startsWith('blob:')) {
      URL.revokeObjectURL(item.url);
    } else if (item.url.includes('supabase.co')) {
      // Background purge for removed assets
      const pathMatch = item.url.split('/signed/')[1]?.split('?')[0] || item.url.split('/public/')[1]?.split('?')[0];
      if (pathMatch) {
        const pathSegments = pathMatch.split('/');
        pathSegments.shift(); 
        const relativePath = pathSegments.join('/');
        deleteFromSupabase('property-images', relativePath);
      }
    }
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
      toast({ title: "Assets Syncing...", description: "Please wait for binary uploads to complete." });
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

      toast({ title: "Portfolio Updated", description: "Records and visuals synchronized." });
      router.push(`/landlord/properties/${propertyId}`);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Update Failed", description: err.message });
      setIsSaving(false);
    }
  };

  if (isLoading || !isInitialized) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-5xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-12 text-left">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">Modify Asset</h1>
            <p className="text-muted-foreground font-medium font-body text-sm">Refining specs for {address || 'Property'}.</p>
          </div>
        </div>
        <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1 rounded-full font-bold">
          <Sparkles className="w-3 h-3 mr-2" /> Asset Orchestration
        </Badge>
      </div>

      <Card className="border-none shadow-xl overflow-hidden rounded-[2.5rem] bg-card ring-1 ring-border">
        <form onSubmit={handleSave}>
          <div className="grid grid-cols-1 lg:grid-cols-2">
            <div className="p-10 bg-primary/5 border-r border-border">
              <div className="flex justify-between items-center mb-6 text-left">
                <Label className="font-bold text-xs uppercase tracking-widest text-muted-foreground opacity-60 font-headline">Visual Inventory</Label>
                <label htmlFor="image-input" className="h-9 rounded-lg font-bold text-[10px] uppercase font-headline cursor-pointer px-4 bg-background border border-border shadow-sm flex items-center hover:bg-muted transition-colors text-foreground">
                  <Plus className="w-3 h-3 mr-2" /> Add Photos
                </label>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {ledger.map((item, index) => (
                  <div key={item.id} className={cn(
                    "relative aspect-video rounded-2xl overflow-hidden group shadow-sm bg-background border-2 transition-all",
                    item.status === 'uploading' ? 'opacity-50 grayscale' : 'opacity-100',
                    index === 0 ? "border-primary" : "border-transparent"
                  )}>
                    <Image src={item.url} alt={`Asset ${index}`} fill className="object-cover" unoptimized />
                    <div className="absolute top-2 right-2 flex gap-1 z-20">
                      <button type="button" onClick={() => setAsPrimary(item.id)} className="bg-background/90 text-primary p-1.5 rounded-lg hover:scale-110 transition-transform shadow-lg"><Star className={cn("w-3.5 h-3.5", index === 0 && "fill-primary")} /></button>
                      <button type="button" onClick={() => removeFromLedger(item.id)} className="bg-red-500 text-white p-1.5 rounded-lg shadow-lg"><X className="w-3.5 h-3.5" /></button>
                    </div>
                    {item.status === 'uploading' && (
                      <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                         <Loader2 className="w-6 h-6 animate-spin text-primary" />
                      </div>
                    )}
                    {item.status === 'ready' && (
                      <div className="absolute bottom-2 right-2 bg-emerald-500 text-white p-1 rounded-full shadow-lg">
                         <CheckCircle2 className="w-3 h-3" />
                      </div>
                    )}
                  </div>
                ))}
                <label htmlFor="image-input" className="aspect-video rounded-2xl border-2 border-dashed border-primary/20 hover:border-primary/40 transition-all bg-background flex flex-col items-center justify-center gap-2 group cursor-pointer">
                  <Plus className="w-6 h-6 text-primary/20 group-hover:text-primary/40" />
                </label>
              </div>
              <input id="image-input" type="file" accept="image/*" multiple className="hidden" onChange={handleImageChange} />
            </div>

            <div className="p-10 space-y-8">
              <div className="space-y-6 text-left">
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Street Address</Label>
                  <Input value={address} onChange={(e) => setAddress(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">City</Label>
                    <Input value={city} onChange={(e) => setCity(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Postcode</Label>
                    <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Asset Class</Label>
                    <Select value={propertyType} onValueChange={setPropertyType}>
                      <SelectTrigger className="rounded-xl h-12 bg-muted/20 border-none font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Apartment">Apartment</SelectItem>
                        <SelectItem value="House">House</SelectItem>
                        <SelectItem value="Studio">Studio</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Monthly Yield (£)</Label>
                    <Input type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Description</Label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Narrative for this asset..." className="rounded-xl min-h-[120px] bg-muted/20 border-none font-medium" />
                </div>
              </div>
            </div>
          </div>
          <CardFooter className="p-10 bg-muted/5 border-t flex justify-end gap-4">
            <Button type="button" variant="ghost" className="rounded-xl h-12 px-8 font-bold font-headline" onClick={() => router.back()}>Cancel</Button>
            <Button type="submit" disabled={isSaving || ledger.some(i => i.status === 'uploading')} className="rounded-xl font-bold bg-primary h-12 px-12 shadow-lg shadow-primary/20 font-headline text-primary-foreground transition-all hover:scale-[1.02]">
              {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
              Synchronize Changes
            </Button>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
