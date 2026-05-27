"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery, useDoc, setDocumentNonBlocking } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, 
  Loader2, 
  Building2, 
  ChevronRight, 
  ReceiptText,
  ShieldCheck, 
  Download, 
  Wifi, 
  Shield, 
  PoundSterling, 
  Phone,
  AlertCircle,
  X,
  Sparkles,
  Wrench,
  Camera,
  Save
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { cn, getResolvedImageUrl, getResolvedGallery, compressImage } from "@/lib/utils";
import { query, collection, where, doc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";
import { 
  Dialog, 
  DialogContent, 
  DialogTitle,
  DialogHeader, 
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import Image from "next/image";
import { useToast } from "@/hooks/use-toast";
import { uploadToSupabase } from "@/lib/actions/supabase-storage";
import { notifyLandlordOfRequest } from "@/lib/actions/email-actions";

/**
 * @fileOverview High-Fidelity Personalized Resident Hub.
 * Optimized for hardware-aligned syntax and cinematic asset resolution.
 * Resolved identifier collisions for zero-latency performance.
 */

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // MAINTENANCE STATE
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [repairTitle, setRepairTitle] = useState('');
  const [repairDesc, setRepairDesc] = useState('');
  const [repairCategory, setRepairCategory] = useState('General');
  const [repairImages, setRepairImages] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => { 
    setIsClient(true); 
  }, []);

  // PROFILE SYNC
  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userDocRef);

  // PROPERTY SYNC
  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "properties", userId: user.uid });
  }, [db, user]);
  
  const { data: properties, loading: isPropLoading } = useCollection(propertiesQuery);
  const property = properties?.[0];

  // ASSET RESOLUTION
  const gallery = useMemo(() => {
    if (!property) return [];
    return getResolvedGallery(property.imageUrl, property.imageUrls);
  }, [property]);

  // FINANCE SYNC
  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    const now = new Date();
    return query(
      collection(db, 'rentPayments'), 
      where('tenantId', '==', user.uid), 
      where('month', '==', now.getMonth() + 1), 
      where('year', '==', now.getFullYear())
    );
  }, [db, user]);
  const { data: payments } = useCollection(paymentsQuery);
  const currentPayment = payments?.[0];

  const handleDownloadStatement = async () => {
    if (!property) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.text(`RENTAL STATEMENT - ${property.addressLine1}`, 20, 20);
    doc.save(`Statement_${property.addressLine1.replace(/\s+/g, '_')}_${format(new Date(), 'MMM_yyyy')}.pdf`);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !user || !property) return;

    setIsUploading(true);
    try {
      const urls: string[] = [];
      for (const file of files) {
        const optimized = await compressImage(file);
        const path = `${user.uid}/${property.id}/repairs/${Date.now()}-${file.name}`;
        const formData = new FormData();
        formData.append('file', optimized, file.name);
        const res = await uploadToSupabase(formData, 'Property-Images-', path);
        if (res.success && res.url) urls.push(res.url);
      }
      setRepairImages(prev => [...prev, ...urls]);
      toast({ title: "Evidence Captured" });
    } catch (err) {
      toast({ variant: "destructive", title: "Capture Failure" });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveRepair = async () => {
    if (!user || !db || !property || !repairTitle) return;
    setIsSaving(true);

    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);

    const payload = {
      id: requestId,
      propertyId: property.id,
      landlordId: property.landlordId,
      tenantId: user.uid,
      memberIds: property.memberIds || [user.uid, property.landlordId],
      title: repairTitle,
      description: repairDesc,
      category: repairCategory,
      status: 'pending',
      priority: 'routine',
      imageUrls: repairImages,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setDocumentNonBlocking(requestRef, payload, { merge: true });

    try {
      await notifyLandlordOfRequest({
        landlordEmail: 'management@rentalflow.app',
        propertyAddress: property.addressLine1,
        title: repairTitle,
        description: repairDesc
      });
    } catch (e) {}

    toast({ title: "Repair Notified", description: "Management has been alerted." });
    setIsRepairOpen(false);
    setRepairTitle('');
    setRepairDesc('');
    setRepairImages([]);
    setIsSaving(false);
  };

  if (!isClient || isPropLoading) {
    return (
      <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000 pb-32 text-left bg-background">
        <div className="h-[450px] w-full bg-muted/40 animate-pulse rounded-[3rem]" />
        <div className="space-y-4">
          <div className="h-10 w-64 bg-muted rounded-full animate-pulse" />
          <div className="h-6 w-48 bg-muted/40 rounded-full animate-pulse" />
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="max-w-7xl mx-auto space-y-12 py-32 text-center">
        <Building2 className="w-16 h-16 mx-auto text-muted-foreground/20 mb-6" />
        <h1 className="text-3xl font-headline font-bold text-foreground tracking-tighter">Registry Verification</h1>
        <p className="text-muted-foreground max-w-sm mx-auto font-medium">Once your landlord links your residency to a property, your hub will be initialized.</p>
      </div>
    );
  }

  const residentName = profile?.firstName || user?.displayName?.split(' ')[0] || 'Resident';

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32 text-left bg-background relative">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-foreground tracking-tighter">Welcome home, {residentName}</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70 leading-relaxed">Your residency hub is active and synchronized.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          <Card className="border-none shadow-2xl overflow-hidden bg-card group ring-1 ring-border rounded-[3rem]">
            <div className="relative w-full bg-muted overflow-hidden">
              {gallery.length > 0 ? (
                <Carousel key={gallery.join(',')} className="w-full group/carousel">
                  <CarouselContent>
                    {gallery.map((url, index) => (
                      <CarouselItem key={`${url}-${index}`}>
                        <div className="relative h-[450px] md:h-[550px] w-full cursor-zoom-in overflow-hidden" onClick={() => setLightboxUrl(url)}>
                          <Image src={url} alt={`Asset View ${index + 1}`} fill className="object-cover transition-transform duration-1000 group-hover/carousel:scale-105" unoptimized priority={index === 0} />
                        </div>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  {gallery.length > 1 && (
                    <>
                      <CarouselPrevious className="left-6 bg-black/40 border-none shadow-2xl text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity" />
                      <CarouselNext className="right-6 bg-black/40 border-none shadow-2xl text-white opacity-0 group-hover/carousel:opacity-100 transition-opacity" />
                    </>
                  )}
                  <div className="absolute top-8 left-8 px-5 py-2 bg-accent text-white text-[11px] font-bold uppercase rounded-full shadow-2xl font-headline z-10 tracking-[0.1em] flex items-center gap-2">
                     <Sparkles className="w-4 h-4" /> Property Visual Inventory
                  </div>
                </Carousel>
              ) : (
                <div className="relative h-[450px] md:h-[550px] w-full bg-gradient-to-br from-primary/20 to-accent/20 flex flex-col items-center justify-center gap-4">
                  <div className="p-8 bg-white/5 rounded-[2rem] border border-white/5 shadow-inner">
                    <Building2 className="w-24 h-24 text-muted-foreground/10" />
                  </div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-primary/30 font-headline">Awaiting visual identity</p>
                </div>
              )}
            </div>

            <div className="p-10 border-b border-border bg-white/[0.01] space-y-4">
               <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground tracking-tight leading-tight">
                 {property.addressLine1}, {property.city}, {property.zipCode}
               </h2>
               <div className="flex items-center gap-4 flex-wrap">
                 <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold uppercase tracking-[0.2em] text-[10px] py-2.5 px-6 rounded-full shadow-sm font-headline shrink-0 h-fit">
                   <ShieldCheck className="w-4 h-4 mr-2" /> Active Tenancy
                 </Badge>
               </div>
            </div>

            <CardContent className="p-10 md:p-12 space-y-12">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><ReceiptText className="w-6 h-6 mr-4 text-accent" /> Monthly Rent</h3>
                  <Button variant="ghost" asChild className="rounded-xl font-bold text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-accent/10 hover:text-accent transition-all duration-300">
                    <Link href="/tenant/payments">View history <ChevronRight className="w-3.5 h-3.5 ml-1" /></Link>
                  </Button>
                </div>
                <div className="p-10 bg-muted/20 rounded-[2.5rem] border border-border shadow-inner relative overflow-hidden group text-left">
                   <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:rotate-12 transition-transform duration-1000">
                      <PoundSterling className="w-32 h-32" />
                   </div>
                   <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.3em] font-headline opacity-50 mb-3">Verified Ledger</p>
                   <p className="text-6xl font-bold font-headline text-foreground tracking-tighter mb-4">£{property.rentAmount?.toLocaleString()}</p>
                   <Badge className={cn("w-full h-14 flex items-center justify-center font-bold text-[11px] rounded-2xl shadow-sm uppercase tracking-[0.2em] border transition-all duration-700", currentPayment?.status === 'paid' ? "bg-emerald-500 text-white border-transparent" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                     {currentPayment?.status === 'paid' ? "Receipted & Collected" : "Collection Pending"}
                   </Badge>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="font-bold font-headline text-xl text-foreground flex items-center tracking-tight"><ShieldCheck className="w-5 h-5 mr-3 text-accent" /> Property DNA</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-muted/10 rounded-2xl border border-border/50 flex items-center gap-4 min-w-0">
                     <div className="p-3 bg-white dark:bg-muted rounded-xl shadow-sm text-accent shrink-0"><Wifi className="w-5 h-5" /></div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase opacity-40 font-headline">Connectivity</p>
                        <p className="text-sm font-bold leading-tight whitespace-normal break-words">{property.connectivityStatus || 'Ultra-Fast Fiber Enabled'}</p>
                     </div>
                  </div>
                  <div className="p-6 bg-muted/10 rounded-2xl border border-border/50 flex items-center gap-4 min-w-0">
                     <div className="p-3 bg-white dark:bg-muted rounded-xl shadow-sm text-accent shrink-0"><Shield className="w-5 h-5" /></div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase opacity-40 font-headline">Compliance</p>
                        <p className="text-sm font-bold leading-tight whitespace-normal break-words">{property.complianceStatus || 'EPC Grade B / Certified'}</p>
                     </div>
                  </div>
                </div>
              </div>

              <div className="pt-10 border-t border-border/50 space-y-6">
                <Button className="w-full h-16 rounded-[1.75rem] bg-accent hover:bg-accent/90 text-white font-bold text-sm uppercase tracking-widest shadow-2xl shadow-accent/20 border-none transition-all hover:scale-[1.01]" onClick={() => setIsRepairOpen(true)}>
                   <Wrench className="w-5 h-5 mr-3" /> Report a Repair
                </Button>
                <Button variant="ghost" className="w-full h-14 rounded-2xl text-muted-foreground hover:text-accent hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all" onClick={handleDownloadStatement}>
                   <Download className="w-4 h-4 mr-3" /> Download Monthly Statement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-12">
           <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-10 pb-4 border-b border-border bg-muted/5 text-left">
               <CardTitle className="text-xl font-headline font-bold flex items-center text-foreground">
                 <AlertCircle className="w-6 h-6 mr-4 text-accent" />
                 Real-Time Support
               </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-8 text-left">
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 text-left">
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-red-600 dark:text-red-400 mb-3 font-headline">Primary SOS</p>
                    <p className="text-base font-bold text-foreground font-headline">Emergency Services</p>
                    <p className="text-lg font-bold mt-4 flex items-center text-red-600 dark:text-red-400">
                      <Phone className="w-5 h-5 mr-3 opacity-40" /> 999
                    </p>
                </div>
                <Button variant="ghost" asChild className="w-full text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-primary hover:bg-primary/5 h-12 rounded-xl transition-all">
                   <Link href="/tenant/emergency-contacts">View Support Network <ChevronRight className="w-4 h-4 ml-2" /></Link>
                </Button>
             </CardContent>
           </Card>
        </div>
      </div>

      <Dialog open={isRepairOpen} onOpenChange={setIsRepairOpen}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card max-w-[600px] flex flex-col max-h-[90vh] ring-1 ring-white/10">
          <div className="p-10 bg-primary text-primary-foreground border-b border-white/10 text-left shrink-0">
             <DialogHeader>
                <DialogTitle className="text-2xl font-bold font-headline tracking-tight flex items-center gap-4">
                   <Wrench className="w-8 h-8 text-accent" /> Register Repair
                </DialogTitle>
                <DialogDescription className="text-primary-foreground/60 font-medium text-sm mt-2">Identify a maintenance issue for immediate management review.</DialogDescription>
             </DialogHeader>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-10 space-y-10 text-left">
               <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">Issue Category</Label>
                  <select 
                    className="flex h-14 w-full rounded-2xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-accent outline-none font-bold text-foreground shadow-inner"
                    value={repairCategory}
                    onChange={(e) => setRepairCategory(e.target.value)}
                  >
                    <option value="Plumbing">Plumbing & Water</option>
                    <option value="Electrical">Electrical & Power</option>
                    <option value="Heating">Heating & Gas</option>
                    <option value="Appliance">Appliances</option>
                    <option value="General">General Maintenance</option>
                  </select>
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">Repair Subject</Label>
                  <Input value={repairTitle} onChange={(e) => setRepairTitle(e.target.value)} placeholder="e.g. Kitchen tap leak" className="rounded-2xl h-14 bg-muted/40 border-none font-bold px-6 shadow-inner" />
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">Context Ledger</Label>
                  <Textarea value={repairDesc} onChange={(e) => setRepairDesc(e.target.value)} placeholder="Detailed narrative of the fault..." className="rounded-3xl min-h-[140px] bg-muted/40 border-none font-medium px-6 py-5 shadow-inner leading-relaxed" />
               </div>
               <div className="space-y-3">
                  <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">Visual Evidence</Label>
                  <div className="grid grid-cols-2 gap-4">
                     {repairImages.map((img, i) => (
                       <div key={i} className="relative aspect-square rounded-2xl overflow-hidden border border-border shadow-sm">
                          <Image src={img} alt="Evidence" fill className="object-cover" unoptimized />
                          <button onClick={() => setRepairImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-2 right-2 p-1 bg-black/60 rounded-lg text-white backdrop-blur-sm"><X className="w-3 h-3" /></button>
                       </div>
                     ))}
                     <label className="aspect-square rounded-2xl border-2 border-dashed border-border hover:border-accent transition-all bg-muted/10 flex flex-col items-center justify-center gap-2 cursor-pointer group">
                        {isUploading ? <Loader2 className="w-6 h-6 animate-spin text-accent" /> : <Camera className="w-6 h-6 text-muted-foreground opacity-40 group-hover:opacity-100" />}
                        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground opacity-40">Add Asset</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                     </label>
                  </div>
               </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-10 bg-muted/5 border-t border-border shrink-0">
             <Button className="w-full h-16 rounded-[1.75rem] bg-accent hover:bg-accent/90 text-white font-bold uppercase tracking-widest text-[11px] shadow-2xl shadow-accent/20 border-none" onClick={handleSaveRepair} disabled={isSaving || !repairTitle}>
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                Finalize & Notify Management
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center overflow-hidden">
          <DialogTitle className="sr-only">Visual Asset Preview</DialogTitle>
          {lightboxUrl && (
            <div className="relative w-full h-full flex items-center justify-center">
              <Image src={lightboxUrl} alt="Asset Preview" fill className="object-contain" unoptimized />
              <button onClick={() => setLightboxUrl(null)} className="absolute top-8 right-8 bg-black/60 backdrop-blur-xl text-white p-4 rounded-full hover:bg-black transition-all hover:scale-110 active:scale-95 shadow-2xl">
                <X className="w-7 h-7" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
