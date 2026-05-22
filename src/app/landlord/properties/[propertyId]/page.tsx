"use client";

import { useState, use, useRef, useMemo, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useDoc, 
  useCollection, 
  useMemoFirebase, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking,
} from '@/firebase';
import { collection, doc, serverTimestamp, query, where, setDoc } from 'firebase/firestore';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  MapPin, Wrench, FileCheck, 
  Edit3, Loader2, Save, ArrowLeft,
  Bed, Bath, X, Maximize2
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn, getResolvedGallery } from "@/lib/utils";
import Image from "next/image";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";

export default function PropertyManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const propertyId = resolvedParams.propertyId;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);

  const propertyRef = useMemoFirebase(() => {
    if (!db) return null;
    return doc(db, 'properties', propertyId);
  }, [db, propertyId]);

  const { data: property, isLoading: isPropLoading } = useDoc(propertyRef);

  const gallery = useMemo(() => {
    return getResolvedGallery(property?.imageUrl, property?.imageUrls);
  }, [property]);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'tenantProfiles'), 
      where('propertyId', '==', propertyId),
      where('landlordId', '==', user.uid)
    );
  }, [db, propertyId, user]);

  const { data: tenants } = useCollection(tenantsQuery);

  const [isEditingRent, setIsEditingRent] = useState(false);
  const [rentAmount, setRentAmount] = useState('');
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  const handleUpdateRent = () => {
    if (!propertyRef) return;
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: Number(rentAmount),
      updatedAt: serverTimestamp(),
    });
    setIsEditingRent(false);
    toast({ title: "Yield Adjusted" });
  };

  if (!isClient || isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  if (!property) return <div className="p-20 text-center font-bold font-headline text-primary opacity-40">Asset record not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">{property.addressLine1}</h1>
            <p className="text-muted-foreground flex items-center font-medium font-body text-sm mt-1">
              <MapPin className="w-4 h-4 mr-1 text-primary/60" /> {property.city}, {property.zipCode}
            </p>
          </div>
        </div>
        <Button variant="outline" className="rounded-xl font-bold h-11 border-primary/20 bg-white shadow-sm font-headline" asChild>
          <Link href={`/landlord/properties/${propertyId}/edit`}>
            <Edit3 className="w-4 h-4 mr-2" /> Modify Specs
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden bg-white rounded-[2.5rem] border border-primary/5">
            <Carousel className="w-full">
              <CarouselContent>
                {gallery.map((url: string, index: number) => (
                  <CarouselItem key={`${url}-${index}`}>
                    <div className="relative h-[450px] w-full bg-muted cursor-zoom-in group" onClick={() => setLightboxUrl(url)}>
                      <Image 
                        src={url} 
                        alt={`Property ${index}`} 
                        fill 
                        className="object-cover transition-transform duration-700 group-hover:scale-105" 
                        unoptimized 
                        priority={index === 0}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center">
                        <Maximize2 className="w-10 h-10 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      {index === 0 && (
                        <div className="absolute top-6 left-6 px-4 py-1.5 bg-primary text-white text-[10px] font-bold uppercase rounded-full shadow-2xl font-headline">Cover Asset</div>
                      )}
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
              <CarouselPrevious className="left-4 bg-white/80 border-none shadow-xl h-10 w-10 hover:bg-white" />
              <CarouselNext className="right-4 bg-white/80 border-none shadow-xl h-10 w-10 hover:bg-white" />
            </Carousel>
            
            <CardContent className="pt-6 text-left p-10 space-y-8">
              <div className="flex flex-wrap gap-4 items-center">
                <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                  <Bed className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary font-headline uppercase">{property.numberOfBedrooms || 1} Bed</span>
                </div>
                <div className="flex items-center gap-2 bg-primary/5 px-4 py-2 rounded-xl border border-primary/10">
                  <Bath className="w-4 h-4 text-primary" />
                  <span className="text-sm font-bold text-primary font-headline uppercase">{property.numberOfBathrooms || 1} Bath</span>
                </div>
                <Badge variant="outline" className="h-10 px-4 rounded-xl border-primary/10 font-bold text-primary bg-primary/[0.02] uppercase text-[10px] tracking-widest">
                  {property.propertyType}
                </Badge>
              </div>

              <div className="flex flex-wrap gap-12 items-end border-t pt-8 border-primary/5">
                <div className="space-y-1">
                  <Label className="text-muted-foreground font-bold text-[10px] uppercase tracking-[0.2em] font-headline">Monthly Yield</Label>
                  <div className="flex items-center gap-4">
                    {isEditingRent ? (
                      <Input type="number" value={rentAmount || property.rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="rounded-xl h-12 w-32 bg-muted/20 border-none font-bold text-lg" />
                    ) : (
                      <p className="text-4xl font-bold text-primary font-headline tracking-tighter">£{property.rentAmount}</p>
                    )}
                    <Button variant="ghost" size="icon" onClick={isEditingRent ? handleUpdateRent : () => setIsEditingRent(true)} className="rounded-full hover:bg-primary/5 transition-colors">
                      {isEditingRent ? <Save className="w-5 h-5 text-emerald-600" /> : <Edit3 className="w-5 h-5 text-muted-foreground" />}
                    </Button>
                  </div>
                </div>
                <div className="p-4 px-8 bg-primary/5 rounded-2xl border border-primary/5">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground font-headline mb-1 tracking-widest">Portfolio Status</p>
                  <p className={cn("font-bold font-headline text-lg uppercase", property.isOccupied ? 'text-emerald-600' : 'text-amber-600')}>{property.isOccupied ? 'Occupied' : 'Vacant'}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid grid-cols-4 w-full bg-muted/30 p-1.5 rounded-[1.25rem] h-auto gap-2 border border-primary/5">
              <TabsTrigger value="tenants" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">Residents</TabsTrigger>
              <TabsTrigger value="docs" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">Vault</TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">Repairs</TabsTrigger>
              <TabsTrigger value="inspections" className="rounded-xl py-3 font-bold data-[state=active]:bg-primary data-[state=active]:text-white transition-all font-headline text-xs">Audits</TabsTrigger>
            </TabsList>
            <TabsContent value="tenants" className="mt-8 space-y-4">
               {tenants && tenants.length > 0 ? (
                 tenants.map(tenant => (
                    <div key={tenant.id} className="flex items-center justify-between p-6 bg-white rounded-[1.75rem] border border-primary/5 shadow-sm">
                      <div className="flex items-center gap-5 text-left">
                        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl font-headline">
                          {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                        </div>
                        <div>
                          <p className="font-bold font-headline text-xl text-primary tracking-tight">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-sm text-muted-foreground font-medium font-body">{tenant.email}</p>
                        </div>
                      </div>
                    </div>
                 ))
               ) : (
                 <div className="p-20 text-center bg-muted/10 rounded-[2.5rem] border-2 border-dashed border-primary/10">
                    <p className="text-sm text-muted-foreground font-bold font-headline mb-4 opacity-50">No residents assigned.</p>
                 </div>
               )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center overflow-hidden">
          <DialogTitle className="sr-only">Visual Asset Preview</DialogTitle>
          {lightboxUrl && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image 
                src={lightboxUrl} 
                alt="High resolution property asset" 
                width={1600} 
                height={1200} 
                className="object-contain max-w-full max-h-[90vh] rounded-2xl" 
                unoptimized 
              />
              <button 
                onClick={() => setLightboxUrl(null)}
                className="absolute top-4 right-4 bg-black/60 text-white p-2 rounded-full hover:bg-black transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
