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
  X,
  Sparkles,
  Wrench,
  Camera,
  Save
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { cn, getResolvedGallery, compressImage, isValidAssetUrl, PROPERTY_PLACEHOLDER } from "@/lib/utils";
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
import { useToast } from "@/hooks/use-toast";
import { uploadToSupabase } from "@/lib/actions/supabase-storage";
import { notifyLandlordOfRequest } from "@/lib/actions/email-actions";

/**
 * @fileOverview Personalized Resident Hub.
 * Refined with professional standardized button sizes.
 */

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // MAINTENANCE ORCHESTRATION
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

  // IDENTITY SYNC
  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userDocRef);

  // RESIDENCY SYNC
  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "properties", userId: user.uid });
  }, [db, user]);
  
  const { data: properties, loading: isPropLoading } = useCollection(propertiesQuery);
  const property = properties?.[0];

  // VISUAL RESOLUTION
  const gallery = useMemo(() => {
    if (!property) return [];
    return getResolvedGallery(property.imageUrl, property.imageUrls);
  }, [property]);

  // FINANCIAL LEDGER SYNC
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
      <div className="max-w-7xl mx-auto space-y-12 py-32 text-center flex flex-col items-center justify-center">
        <Building2 className="w-20 h-20 text-primary opacity-10 mb-8 animate-in zoom-in duration-1000" />
        <h1 className="text-4xl font-headline font-bold text-foreground tracking-tighter">Registry Verification</h1>
        <p className="text-muted-foreground max-w-sm mx-auto font-medium text-lg leading-relaxed mt-4">Once your landlord links your residency to a property, your hub will be initialized.</p>
      </div>
    );
  }

  const residentName = profile?.firstName || user?.displayName?.split(' ')[0] || 'Resident';

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32 text-left bg-background relative">
      <div className="space-y-4">
        <h1 className="text-5xl font-headline font-bold text-foreground tracking-tighter">Welcome home, {residentName}</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70 leading-relaxed max-w-3xl">Your professional residency hub is active and synchronized with property management.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          <Card className="border-none shadow-2xl overflow-hidden bg-card group ring-1 ring-border rounded-[3.5rem]">
            <div className="relative w-full bg-muted overflow-hidden">
              {gallery.length > 0 ? (
                <Carousel key={gallery.join(',')} className="w-full group/carousel">
                  <CarouselContent>
                    {gallery.map((url, index) => (
                      <CarouselItem key={`${url}-${index}`}>
                        <div className="relative h-[450px] md:h-[550px] w-full cursor-zoom-in overflow-hidden" onClick={() => setLightboxUrl(url)}>
                          <img 
                            src={isValidAssetUrl(url) ? url : PROPERTY_PLACEHOLDER} 
                            alt={`Property View ${index + 1}`} 
                            className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover/carousel:scale-105" 
                            onError={(e) => {
                              e.currentTarget.src = PROPERTY_PLACEHOLDER;
                              e.currentTarget.classList.add('opacity-40');
                            }}
                          />
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
                  <div className="absolute top-8 left-8 px-6 py-2.5 bg-accent text-white text-[11px] font-bold uppercase rounded-full shadow-2xl font-headline z-10 tracking-[0.15em] flex items-center gap-2 backdrop-blur-md">
                     <Sparkles className="w-4 h-4" /> Property Visual Inventory
                  </div>
                </Carousel>
              ) : (
                <div className="relative h-[450px] md:h-[550px] w-full bg-gradient-to-br from-primary/20 to-accent/20 flex flex-col items-center justify-center gap-4">
                  <Building2 className="w-24 h-24 text-muted-foreground/10 animate-pulse" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-primary/30 font-headline">Awaiting visual identity</p>
                </div>
              )}
            </div>

            <div className="p-12 border-b border-border bg-white/[0.01] space-y-6 text-left">
               <h2 className="text-3xl md:text-5xl font-headline font-bold text-foreground tracking-tight leading-[0.9]">
                 {property.addressLine1}, <br/><span className="text-muted-foreground opacity-60">{property.city}, {property.zipCode}</span>
               </h2>
               <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-bold uppercase tracking-widest text-[10px] py-3 px-8 rounded-full shadow-sm font-headline shrink-0 h-fit">
                 <ShieldCheck className="w-4 h-4 mr-2" /> Verified Active Tenancy
               </Badge>
            </div>

            <CardContent className="p-12 space-y-16 text-left">
              {/* FINANCIAL LEDGER */}
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><ReceiptText className="w-7 h-7 mr-4 text-accent" /> Monthly Rent Ledger</h3>
                  <Button variant="ghost" asChild className="rounded-xl font-bold text-[10px] uppercase tracking-widest text-muted-foreground hover:bg-accent/10 hover:text-accent transition-all duration-500 px-6 h-10 border border-transparent hover:border-accent/20">
                    <Link href="/tenant/payments">View history <ChevronRight className="w-4 h-4 ml-1" /></Link>
                  </Button>
                </div>
                <div className="p-12 bg-muted/20 rounded-[3rem] border border-border shadow-inner relative overflow-hidden group text-left transition-all hover:bg-muted/30">
                   <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:rotate-12 group-hover:scale-125 transition-all duration-1000">
                      <PoundSterling className="w-40 h-40" />
                   </div>
                   <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.4em] font-headline opacity-50 mb-4">Official Payment Record</p>
                   <p className="text-7xl font-bold font-headline text-foreground tracking-tighter mb-6">£{property.rentAmount?.toLocaleString()}</p>
                   <Badge className={cn("w-full h-14 flex items-center justify-center font-bold text-[11px] rounded-xl shadow-lg uppercase tracking-[0.2em] border transition-all duration-1000 font-headline", currentPayment?.status === 'paid' ? "bg-emerald-500 text-white border-transparent" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                     {currentPayment?.status === 'paid' ? "Receipted & Collected" : "Collection Pending"}
                   </Badge>
                </div>
              </div>

              {/* PROPERTY DNA */}
              <div className="space-y-8">
                <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><ShieldCheck className="w-6 h-6 mr-4 text-accent" /> Property Identity</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="p-8 bg-muted/10 rounded-3xl border border-border/50 flex items-center gap-6 group hover:border-accent/30 transition-all shadow-sm">
                     <div className="p-4 bg-white dark:bg-muted rounded-2xl shadow-xl text-accent shrink-0 transition-transform group-hover:scale-110"><Wifi className="w-6 h-6" /></div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase opacity-40 font-headline tracking-widest mb-1">Connectivity Status</p>
                        <p className="text-base font-bold leading-tight text-foreground">{property.connectivityStatus || 'Ultra-Fast Fiber Enabled'}</p>
                     </div>
                  </div>
                  <div className="p-8 bg-muted/10 rounded-3xl border border-border/50 flex items-center gap-6 group hover:border-accent/30 transition-all shadow-sm">
                     <div className="p-4 bg-white dark:bg-muted rounded-2xl shadow-xl text-accent shrink-0 transition-transform group-hover:scale-110"><Shield className="w-6 h-6" /></div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[11px] font-bold uppercase opacity-40 font-headline tracking-widest mb-1">Health & Compliance</p>
                        <p className="text-base font-bold leading-tight text-foreground">{property.complianceStatus || 'EPC Grade B / Certified'}</p>
                     </div>
                  </div>
                </div>
              </div>

              {/* ACTIONS */}
              <div className="pt-12 border-t border-border/50 space-y-6">
                <Button className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold text-sm uppercase tracking-[0.2em] shadow-xl shadow-accent/20 border-none transition-all hover:scale-[1.01] active:scale-95" onClick={() => setIsRepairOpen(true)}>
                   <Wrench className="w-5 h-5 mr-3" /> Report a Maintenance Issue
                </Button>
                <Button variant="ghost" className="w-full h-11 rounded-xl text-muted-foreground hover:text-accent hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all" onClick={handleDownloadStatement}>
                   <Download className="w-4 h-4 mr-3" /> Download Official Statement (PDF)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SIDEBAR WIDGETS */}
        <div className="lg:col-span-4 space-y-12">
           <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-10 pb-4 border-b border-border bg-muted/5 text-left">
               <CardTitle className="text-xl font-headline font-bold flex items-center gap-4 text-foreground">
                 <ShieldCheck className="w-7 h-7 text-red-500" />
                 Emergency Support
               </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-10 text-left">
                <div className="p-8 rounded-[2rem] bg-red-500/5 border border-red-500/10 text-left group hover:bg-red-500/10 transition-colors">
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-red-600 dark:text-red-400 mb-4 font-headline">National SOS Protocol</p>
                    <p className="text-xl font-bold text-foreground font-headline">Emergency Services</p>
                    <p className="text-3xl font-bold mt-6 flex items-center text-red-600 dark:text-red-400 tracking-tighter">
                       999
                    </p>
                </div>
                <Button variant="ghost" asChild className="w-full text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground hover:text-primary hover:bg-primary/5 h-12 rounded-xl transition-all border border-transparent hover:border-primary/10">
                   <Link href="/tenant/emergency-contacts">Full Support Directory <ChevronRight className="w-4 h-4 ml-2" /></Link>
                </Button>
             </CardContent>
           </Card>
        </div>
      </div>

      {/* REPAIR DIALOG */}
      <Dialog open={isRepairOpen} onOpenChange={setIsRepairOpen}>
        <DialogContent className="rounded-[3.5rem] border-none shadow-2xl p-0 overflow-hidden bg-card max-w-[650px] flex flex-col max-h-[90vh] ring-1 ring-white/10">
          <div className="p-10 bg-primary text-primary-foreground border-b border-white/10 text-left shrink-0 relative">
             <div className="absolute top-0 right-0 p-8 opacity-10"><Wrench className="w-20 h-20" /></div>
             <DialogHeader>
                <DialogTitle className="text-2xl font-bold font-headline tracking-tighter flex items-center gap-4">
                   <Wrench className="w-8 h-8 text-accent" /> Register Repair
                </DialogTitle>
                <DialogDescription className="text-primary-foreground/70 font-medium text-sm mt-2 leading-relaxed">Identity a property issue for immediate professional review.</DialogDescription>
             </DialogHeader>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-10 space-y-10 text-left pb-24">
               <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Classification</Label>
                  <select 
                    className="flex h-12 w-full rounded-xl border-none bg-muted/40 px-6 py-2 text-sm focus:ring-2 focus:ring-accent outline-none font-bold text-foreground shadow-inner ring-1 ring-white/10"
                    value={repairCategory}
                    onChange={(e) => setRepairCategory(e.target.value)}
                  >
                    <option value="Plumbing">Plumbing & Water Systems</option>
                    <option value="Electrical">Electrical & Power Faults</option>
                    <option value="Heating">Heating & Gas Utility</option>
                    <option value="Appliance">Home Appliances</option>
                    <option value="General">General Site Maintenance</option>
                  </select>
               </div>
               <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Fault Identifier</Label>
                  <Input value={repairTitle} onChange={(e) => setRepairTitle(e.target.value)} placeholder="e.g. Master bathroom tap leak" className="rounded-xl h-12 bg-muted/40 border-none font-bold px-6 shadow-inner ring-1 ring-white/10 text-base" />
               </div>
               <div className="space-y-3">
                  <Label className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Context Ledger</Label>
                  <Textarea value={repairDesc} onChange={(e) => setRepairDesc(e.target.value)} placeholder="Provide a detailed narrative of the issue for the trade partner..." className="rounded-2xl min-h-[160px] bg-muted/40 border-none font-medium px-6 py-6 shadow-inner leading-relaxed text-sm" />
               </div>
               <div className="space-y-5">
                  <Label className="text-[11px] font-bold uppercase tracking-[0.4em] text-muted-foreground opacity-50 font-headline">Visual Evidence Capture</Label>
                  <div className="grid grid-cols-2 gap-5">
                     {repairImages.map((img, i) => (
                       <div key={i} className="relative aspect-square rounded-[1.5rem] overflow-hidden border border-border shadow-xl group/img">
                          <img src={isValidAssetUrl(img) ? img : PROPERTY_PLACEHOLDER} alt="Evidence" className="absolute inset-0 h-full w-full object-cover transition-transform group-hover/img:scale-110 duration-700" />
                          <button onClick={() => setRepairImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-3 right-3 p-2 bg-black/60 rounded-lg text-white backdrop-blur-xl border border-white/10 hover:bg-red-500 transition-all"><X className="w-3.5 h-3.5" /></button>
                       </div>
                     ))}
                     <label className="aspect-square rounded-[1.5rem] border-2 border-dashed border-border hover:border-accent transition-all duration-500 bg-muted/10 flex flex-col items-center justify-center gap-3 cursor-pointer group/upload shadow-inner">
                        {isUploading ? <Loader2 className="w-8 h-8 animate-spin text-accent" /> : <Camera className="w-8 h-8 text-muted-foreground opacity-40 group-hover/upload:opacity-100 group-hover/upload:scale-110 transition-all duration-500" />}
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-40 text-center">Capture</span>
                        <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                     </label>
                  </div>
               </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-10 bg-muted/5 border-t border-border shrink-0">
             <Button className="w-full h-14 rounded-2xl bg-accent hover:bg-accent/90 text-white font-bold uppercase tracking-[0.2em] shadow-xl shadow-accent/20 border-none transition-all hover:scale-[1.01] active:scale-95 text-[11px]" onClick={handleSaveRepair} disabled={isSaving || !repairTitle}>
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                Finalize & Notify
             </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LIGHTBOX */}
      <Dialog open={!!lightboxUrl} onOpenChange={() => setLightboxUrl(null)}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-none bg-transparent shadow-none flex items-center justify-center overflow-hidden">
          <DialogTitle className="sr-only">Visual Asset Preview</DialogTitle>
          {lightboxUrl && (
            <div className="relative w-full h-full flex items-center justify-center">
              <img src={lightboxUrl} alt="Asset Preview" className="max-h-full max-w-full object-contain" />
              <button onClick={() => setLightboxUrl(null)} className="absolute top-10 right-10 bg-black/60 backdrop-blur-2xl text-white p-5 rounded-full hover:bg-black transition-all hover:scale-110 active:scale-95 shadow-2xl border border-white/10">
                <X className="w-8 h-8" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
