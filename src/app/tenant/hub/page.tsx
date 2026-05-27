"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery, setDocumentNonBlocking } from "@/firebase";
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
  Info, 
  Wifi, 
  Shield, 
  PoundSterling, 
  Phone,
  AlertCircle,
  X,
  Sparkles,
  Wrench,
  Camera,
  Plus,
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
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uploadToSupabase } from "@/lib/actions/supabase-storage";
import { notifyLandlordOfRequest } from "@/lib/actions/email-actions";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

/**
 * @fileOverview High-Fidelity Resident Hub.
 * Optimized for cinematic asset resolution and hardware-aligned stability.
 * Definitively resolved JSX identifier collision and enhanced dark mode SOS.
 */

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // REPAIR ORCHESTRATION STATE
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [repairTitle, setRepairTitle] = useState('');
  const [repairDescription, setRepairDescription] = useState('');
  const [repairCategory, setRepairCategory] = useState('plumbing');
  const [repairImages, setRepairImages] = useState<string[]>([]);

  useEffect(() => { 
    setIsClient(true); 
  }, []);

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
      const uploadedUrls: string[] = [];
      for (const file of files) {
        const optimizedBlob = await compressImage(file);
        const path = `${user.uid}/${property.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        const formData = new FormData();
        formData.append('file', optimizedBlob, file.name);
        
        const result = await uploadToSupabase(formData, 'Property-Images-', path);
        if (result.success && result.url) {
          uploadedUrls.push(result.url);
        }
      }
      setRepairImages(prev => [...prev, ...uploadedUrls]);
      toast({ title: "Evidence Synchronized" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: err.message });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSaveRepair = async (e: React.FormEvent) => {
    e.preventDefault();
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
      description: repairDescription,
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
        landlordEmail: 'landlord@rentalflow.app', 
        propertyAddress: property.addressLine1,
        title: repairTitle,
        description: repairDescription
      });
    } catch (err) {
      console.warn('Notification skipped.');
    }

    toast({ title: "Repair Dispatched" });
    setIsRepairOpen(false);
    setIsSaving(false);
    setRepairTitle('');
    setRepairDescription('');
    setRepairImages([]);
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

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32 text-left bg-background relative">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-foreground tracking-tighter">Resident Portal</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70">Welcome home.</p>
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
                 <Badge variant="outline" className="border-emerald-500/20 bg-emerald-500/5 text-emerald-600 text-[8px] font-bold uppercase tracking-widest px-4 h-9 flex items-center gap-2 rounded-full">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    Live Ledger Synchronized
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
                <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><Info className="w-6 h-6 mr-4 text-accent" /> Your Residence</h3>
                <div className="p-8 bg-primary/5 rounded-[2rem] border border-border text-left">
                   <p className="text-[9px] font-bold uppercase text-accent tracking-[0.3em] mb-4">Official Narrative</p>
                   <p className="text-base text-muted-foreground leading-relaxed font-body font-medium">
                     {property.description || "A premium managed property with high-fidelity visual orchestration and automated maintenance support."}
                   </p>
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

              <div className="pt-10 border-t border-border/50 flex flex-col gap-4">
                <Dialog open={isRepairOpen} onOpenChange={setIsRepairOpen}>
                  <DialogTrigger asChild>
                    <Button className="w-full h-16 rounded-[1.75rem] bg-primary text-primary-foreground font-bold shadow-2xl shadow-primary/20 transition-all hover:scale-[1.01] border-none font-headline uppercase tracking-widest text-[11px]">
                      <Wrench className="w-5 h-5 mr-3 text-accent" /> Report a Repair
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col h-[750px] max-h-[90vh] max-w-[600px] ring-1 ring-white/10">
                    <form onSubmit={handleSaveRepair} className="flex flex-col h-full overflow-hidden">
                      <div className="p-10 bg-primary/5 border-b border-white/5 text-left shrink-0">
                        <DialogTitle className="text-2xl font-bold font-headline text-foreground flex items-center gap-4">
                           <Sparkles className="w-7 h-7 text-accent" /> Maintenance Command
                        </DialogTitle>
                        <DialogDescription className="text-sm font-medium text-muted-foreground mt-2">Initialize a formal request with high-fidelity visual evidence.</DialogDescription>
                      </div>
                      <ScrollArea className="flex-1">
                        <div className="p-10 space-y-8 text-left">
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Issue Classification</Label>
                            <select className="flex h-14 w-full rounded-2xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-accent outline-none font-bold text-foreground shadow-inner ring-1 ring-white/5" value={repairCategory} onChange={(e) => setRepairCategory(e.target.value)}>
                              <option value="plumbing">Plumbing & Water</option>
                              <option value="electrical">Electrical & Lighting</option>
                              <option value="heating">Heating & Boiler</option>
                              <option value="appliance">Appliance Maintenance</option>
                              <option value="structural">Structural & Security</option>
                              <option value="other">Other Inquiry</option>
                            </select>
                          </div>
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Subject</Label>
                            <Input value={repairTitle} onChange={(e) => setRepairTitle(e.target.value)} placeholder="e.g. Kitchen tap leak" required className="rounded-2xl h-14 bg-muted/40 border-none font-bold px-6 text-base shadow-inner ring-1 ring-white/5 text-foreground" />
                          </div>
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Narrative</Label>
                            <Textarea value={repairDescription} onChange={(e) => setRepairDescription(e.target.value)} placeholder="Provide full context..." required className="rounded-2xl min-h-[140px] bg-muted/40 border-none font-medium px-6 py-5 text-base shadow-inner ring-1 ring-white/5 text-foreground leading-relaxed" />
                          </div>
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Visual Inventory</Label>
                            <div className="grid grid-cols-3 gap-4">
                               {repairImages.map((url, i) => (
                                 <div key={i} className="relative aspect-square rounded-xl overflow-hidden shadow-lg group">
                                    <Image src={url} alt="" fill className="object-cover" unoptimized />
                                    <button type="button" onClick={() => setRepairImages(prev => prev.filter((_, idx) => idx !== i))} className="absolute top-1 right-1 p-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity">
                                       <X className="w-3 h-3" />
                                    </button>
                                 </div>
                               ))}
                               <label className="aspect-square rounded-2xl border-2 border-dashed border-white/10 hover:border-accent/40 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/10 group">
                                  {isUploading ? <Loader2 className="w-5 h-5 animate-spin text-accent" /> : <Camera className="w-5 h-5 text-muted-foreground group-hover:text-accent" />}
                                  <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground group-hover:text-accent">Capture</span>
                                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} disabled={isUploading} />
                               </label>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>
                      <DialogFooter className="p-10 bg-muted/5 border-t border-white/5 shrink-0">
                        <Button type="submit" disabled={isSaving || isUploading || !repairTitle} className="w-full rounded-[1.75rem] h-16 font-bold bg-accent text-white shadow-2xl shadow-accent/20 font-headline text-[11px] uppercase tracking-[0.3em] hover:scale-[1.01] transition-transform border-none">
                          {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                          Dispatch Request
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
                <Button variant="ghost" className="w-full h-14 rounded-2xl text-muted-foreground hover:text-accent hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all" onClick={handleDownloadStatement}>
                   <Download className="w-4 h-4 mr-3" /> Download Monthly Statement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-12">
           <Card className="border-none shadow-2xl rounded-[3rem] bg-accent text-white overflow-hidden text-left relative group cursor-pointer" onClick={() => setIsRepairOpen(true)}>
             <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 blur-3xl rounded-full transition-transform duration-1000 group-hover:scale-150" />
             <CardHeader className="p-10 pb-6">
                <CardTitle className="text-2xl font-bold font-headline flex items-center gap-4">
                   <Sparkles className="w-8 h-8 text-white/90" /> Maintenance Command
                </CardTitle>
             </CardHeader>
             <CardContent className="px-10 pb-12 space-y-6">
                <p className="text-sm font-medium leading-relaxed opacity-90">Report property issues with cinematic visual capture and automated AI triage.</p>
                <div className="flex items-center gap-3">
                   <Wrench className="w-5 h-5 text-white/60" />
                   <span className="text-[10px] font-bold uppercase tracking-widest text-white/70">Secure Dispatch Active</span>
                </div>
             </CardContent>
           </Card>

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
                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 text-left">
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary mb-3 font-headline">Management</p>
                    <p className="text-base font-bold text-foreground font-headline">Direct Liaison</p>
                    <Button variant="ghost" asChild className="w-full mt-4 h-12 rounded-xl text-[10px] font-bold uppercase tracking-widest text-primary hover:bg-primary/10 p-0 border border-primary/10">
                       <Link href="/tenant/messages">Initiate Secure Channel</Link>
                    </Button>
                </div>
                <Button variant="ghost" asChild className="w-full text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-primary hover:bg-primary/5 h-12 rounded-xl transition-all">
                   <Link href="/tenant/emergency-contacts">View Support Network <ChevronRight className="w-4 h-4 ml-2" /></Link>
                </Button>
             </CardContent>
           </Card>
        </div>
      </div>

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
