"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery, setDocumentNonBlocking } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  MapPin, AlertCircle, 
  Loader2, Building2, 
  ChevronRight, ReceiptText,
  ShieldCheck, Download, 
  Info, Wifi, Shield, PoundSterling, Phone, Wrench,
  Plus, Camera, X, Save, CheckCircle2, AlertTriangle, Sparkles
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { cn, getResolvedImageUrl, compressImage } from "@/lib/utils";
import { query, collection, where, doc, serverTimestamp } from "firebase/firestore";
import { format } from "date-fns";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { uploadToSupabase } from "@/lib/actions/supabase-storage";
import { notifyLandlordOfRequest } from "@/lib/actions/email-actions";
import { useToast } from "@/hooks/use-toast";
import Image from "next/image";

/**
 * @fileOverview High-Fidelity Resident Hub (Optimized).
 * Hierarchy: Cinematic Hero -> Identity -> Rent Ledger -> Narrative -> Property DNA -> Actions.
 * Features an integrated repair reporting suite with visual evidence capture.
 */

type ImageLedger = {
  id: string;
  previewUrl: string;
  cloudUrl?: string;
  status: 'uploading' | 'ready' | 'error';
};

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  // PROPERTY SYNC
  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "properties", userId: user.uid });
  }, [db, user]);
  
  const { data: properties, isLoading: isPropLoading } = useCollection(propertiesQuery);
  const property = properties?.[0];

  const tenantProfileQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "tenantProfiles", userId: user.uid });
  }, [db, user]);
  const { data: profiles } = useCollection(tenantProfileQuery);
  const profile = profiles?.[0];

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

  // REPAIR ORCHESTRATION STATE
  const [isRepairOpen, setIsRepairOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [repairCategory, setRepairCategory] = useState("other");
  const [repairTitle, setRepairTitle] = useState("");
  const [repairDescription, setRepairDescription] = useState("");
  const [imageLedger, setImageLedger] = useState<ImageLedger[]>([]);

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

    for (const file of files) {
      const tempId = Math.random().toString(36).substring(7);
      const localUrl = URL.createObjectURL(file);
      
      setImageLedger(prev => [...prev, { id: tempId, previewUrl: localUrl, status: 'uploading' }]);

      try {
        const optimizedBlob = await compressImage(file);
        const path = `${user.uid}/maintenance-evidence/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
        
        const formData = new FormData();
        formData.append('file', optimizedBlob, file.name);
        
        const result = await uploadToSupabase(formData, 'Property-Images-', path);
        if (!result.success) throw new Error(result.error);
        
        setImageLedger(prev => prev.map(item => 
          item.id === tempId ? { ...item, cloudUrl: result.url, status: 'ready' as const } : item
        ));
      } catch (err: any) {
        setImageLedger(prev => prev.map(item => item.id === tempId ? { ...item, status: 'error' as const } : item));
        toast({ variant: "destructive", title: "Sync Failed", description: err.message });
      }
    }
    e.target.value = '';
  };

  const removeImage = (id: string) => {
    setImageLedger(prev => prev.filter(item => item.id !== id));
  };

  const handleSaveRepair = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !property || !profile) return;

    setIsSaving(true);
    try {
      const requestId = doc(collection(db, 'maintenanceRequests')).id;
      const requestRef = doc(db, 'maintenanceRequests', requestId);

      const readyUrls = imageLedger
        .filter(i => i.status === 'ready' && i.cloudUrl)
        .map(i => i.cloudUrl!);

      const payload = {
        id: requestId,
        propertyId: property.id,
        landlordId: property.landlordId || profile.landlordId,
        tenantId: user.uid,
        memberIds: property.memberIds || [user.uid, property.landlordId],
        title: repairTitle,
        description: repairDescription,
        category: repairCategory,
        status: 'pending',
        priority: 'routine',
        evidenceUrls: readyUrls,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      setDocumentNonBlocking(requestRef, payload, { merge: true });

      // Notify Landlord via Resend
      await notifyLandlordOfRequest({
        landlordEmail: profile.email || 'landlord@rentalfow.app',
        propertyAddress: property.addressLine1,
        title: repairTitle,
        description: repairDescription
      });

      toast({ title: "Repair Logged", description: "Management has been notified of the request." });
      setIsRepairOpen(false);
      setRepairTitle("");
      setRepairDescription("");
      setImageLedger([]);
    } catch (err: any) {
      toast({ variant: "destructive", title: "Reporting Failed", description: err.message });
    } finally {
      setIsSaving(false);
    }
  };

  if (!isClient || isPropLoading) return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000 pb-32 text-left bg-background">
      <div className="h-[400px] w-full bg-muted/40 animate-pulse rounded-[3rem]" />
      <div className="space-y-4">
        <div className="h-10 w-64 bg-muted rounded-full animate-pulse" />
        <div className="h-6 w-48 bg-muted/40 rounded-full animate-pulse" />
      </div>
    </div>
  );

  if (!property) return (
    <div className="max-w-7xl mx-auto space-y-12 py-32 text-center">
      <Building2 className="w-16 h-16 mx-auto text-muted-foreground/20 mb-6" />
      <h1 className="text-3xl font-headline font-bold text-foreground">Registry Verification</h1>
      <p className="text-muted-foreground max-w-sm mx-auto">Once your landlord links your residency to a property, your hub will be initialized here.</p>
    </div>
  );

  const primaryImageUrl = getResolvedImageUrl(property?.imageUrl, property?.imageUrls);

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32 text-left bg-background relative">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-foreground tracking-tighter">Resident Portal</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70">Welcome home.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-10">
          <Card className="border-none shadow-2xl overflow-hidden bg-card group ring-1 ring-border">
            {/* 1. CINEMATIC HERO */}
            <div className="relative h-[450px] md:h-[550px] w-full bg-muted overflow-hidden">
              {primaryImageUrl ? (
                <img 
                  src={primaryImageUrl} 
                  alt={property.addressLine1} 
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Building2 className="w-24 h-24 text-muted-foreground/10" />
                </div>
              )}
            </div>

            {/* 2. IDENTITY BAR */}
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
              {/* 3. RENT LEDGER */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><ReceiptText className="w-6 h-6 mr-4 text-accent" /> Monthly Rent</h3>
                  <Button variant="ghost" asChild className="rounded-xl font-bold text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent">
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

              {/* 4. RESIDENCE NARRATIVE */}
              <div className="space-y-6">
                <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><Info className="w-6 h-6 mr-4 text-accent" /> Your Residence</h3>
                <div className="p-8 bg-primary/5 rounded-[2rem] border border-border text-left">
                   <p className="text-[9px] font-bold uppercase text-accent tracking-[0.3em] mb-4">Official Narrative</p>
                   <p className="text-base text-muted-foreground leading-relaxed font-body font-medium">
                     {property.description || "A premium managed property with high-fidelity visual orchestration and automated maintenance support."}
                   </p>
                </div>
              </div>

              {/* 5. PROPERTY DNA */}
              <div className="space-y-6">
                <h3 className="font-bold font-headline text-xl text-foreground flex items-center tracking-tight"><ShieldCheck className="w-5 h-5 mr-3 text-accent" /> Property DNA</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="p-6 bg-muted/10 rounded-2xl border border-border/50 flex items-center gap-4 min-w-0">
                     <div className="p-3 bg-white rounded-xl shadow-sm text-accent shrink-0"><Wifi className="w-5 h-5" /></div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase opacity-40">Connectivity</p>
                        <p className="text-sm font-bold leading-tight whitespace-normal break-words">{property.connectivityStatus || 'Ultra-Fast Fiber Enabled'}</p>
                     </div>
                  </div>
                  <div className="p-6 bg-muted/10 rounded-2xl border border-border/50 flex items-center gap-4 min-w-0">
                     <div className="p-3 bg-white rounded-xl shadow-sm text-accent shrink-0"><Shield className="w-5 h-5" /></div>
                     <div className="min-w-0 flex-1">
                        <p className="text-[10px] font-bold uppercase opacity-40">Compliance</p>
                        <p className="text-sm font-bold leading-tight whitespace-normal break-words">{property.complianceStatus || 'EPC Grade B / Certified'}</p>
                     </div>
                  </div>
                </div>
              </div>

              {/* 6. ORCHESTRATED ACTIONS */}
              <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row gap-4">
                <Button variant="outline" className="flex-1 h-16 rounded-[1.75rem] border-border bg-card hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all" onClick={handleDownloadStatement}>
                   <Download className="w-5 h-5 mr-3 text-accent" /> Download Statement
                </Button>
                
                <Dialog open={isRepairOpen} onOpenChange={setIsRepairOpen}>
                  <DialogTrigger asChild>
                    <Button className="flex-1 h-16 rounded-[1.75rem] bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-[10px] uppercase tracking-widest font-headline shadow-2xl shadow-primary/20 transition-all border-none">
                       <Wrench className="w-5 h-5 mr-3 text-accent" /> Report a Repair
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[650px] p-0 rounded-[3rem] border-none shadow-2xl flex flex-col h-[85vh] overflow-hidden bg-card ring-1 ring-white/10">
                    <form onSubmit={handleSaveRepair} className="flex flex-col h-full overflow-hidden">
                      <div className="p-10 bg-primary/5 border-b border-white/5 text-left shrink-0">
                        <div className="flex items-center gap-4 mb-2">
                           <div className="p-3 bg-accent/10 rounded-2xl text-accent"><Sparkles className="w-6 h-6" /></div>
                           <DialogTitle className="text-2xl font-bold font-headline text-foreground tracking-tight">Maintenance Request</DialogTitle>
                        </div>
                        <DialogDescription className="text-sm font-medium text-muted-foreground">Notify management of property requirements with visual context.</DialogDescription>
                      </div>

                      <ScrollArea className="flex-1 min-h-0 bg-white/[0.01]">
                        <div className="p-10 space-y-10">
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Repair Classification</Label>
                            <select 
                              className="flex h-14 w-full rounded-2xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-accent outline-none font-bold text-foreground shadow-inner"
                              value={repairCategory}
                              onChange={(e) => setRepairCategory(e.target.value)}
                            >
                              <option value="plumbing">Plumbing (Leaks, Taps)</option>
                              <option value="electrical">Electrical (Lights, Sockets)</option>
                              <option value="hvac">Heating & Cooling</option>
                              <option value="appliance">Appliance Maintenance</option>
                              <option value="structural">Structural (Windows, Doors)</option>
                              <option value="cosmetic">Cosmetic / General</option>
                              <option value="other">Other Requirements</option>
                            </select>
                          </div>

                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Issue Identifier</Label>
                            <Input 
                              value={repairTitle} 
                              onChange={(e) => setRepairTitle(e.target.value)} 
                              required 
                              placeholder="e.g. Master Bedroom Radiator Leak" 
                              className="rounded-2xl h-14 bg-muted/40 border-none font-bold px-6 text-base shadow-inner" 
                            />
                          </div>

                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Operational Context</Label>
                            <Textarea 
                              value={repairDescription} 
                              onChange={(e) => setRepairDescription(e.target.value)} 
                              required 
                              placeholder="Provide details on discovery and urgency..." 
                              className="rounded-2xl min-h-[160px] bg-muted/40 border-none font-medium px-6 py-5 text-base leading-relaxed shadow-inner" 
                            />
                          </div>

                          <div className="space-y-4">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Visual Ledger (Photos)</Label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                               {imageLedger.map((item) => (
                                 <div key={item.id} className="relative aspect-square rounded-2xl overflow-hidden bg-muted group shadow-md border border-white/5">
                                    <Image src={item.cloudUrl || item.previewUrl} alt="Evidence" fill className="object-cover" unoptimized />
                                    {item.status === 'uploading' && (
                                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center">
                                        <Loader2 className="w-6 h-6 animate-spin text-white" />
                                      </div>
                                    )}
                                    <button 
                                      type="button" 
                                      onClick={() => removeImage(item.id)}
                                      className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                 </div>
                               ))}
                               <label className="aspect-square rounded-2xl border-2 border-dashed border-white/10 hover:border-accent/40 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer bg-muted/10">
                                  <Camera className="w-6 h-6 text-muted-foreground opacity-30" />
                                  <span className="text-[9px] font-bold uppercase text-muted-foreground opacity-40">Capture</span>
                                  <input type="file" multiple accept="image/*" className="hidden" onChange={handleImageUpload} />
                               </label>
                            </div>
                          </div>
                        </div>
                      </ScrollArea>

                      <DialogFooter className="p-10 bg-muted/5 border-t border-white/5 shrink-0">
                         <Button 
                            type="submit" 
                            disabled={isSaving || !repairTitle || imageLedger.some(i => i.status === 'uploading')}
                            className="w-full rounded-[1.75rem] h-16 font-bold bg-accent text-white shadow-2xl shadow-accent/20 font-headline text-[11px] uppercase tracking-[0.3em] hover:scale-[1.01] transition-transform border-none"
                         >
                            {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                            Synchronize & Notify Management
                         </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-10">
           <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-10 pb-4 border-b border-border bg-muted/5 text-left">
               <CardTitle className="text-xl font-headline font-bold flex items-center text-foreground">
                 <AlertCircle className="w-6 h-6 mr-4 text-accent" />
                 Real-Time Support
               </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-8 text-left">
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10 text-left">
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-red-600 mb-3">Primary SOS</p>
                    <p className="text-base font-bold text-foreground font-headline">Emergency Services</p>
                    <p className="text-lg font-bold mt-4 flex items-center text-red-600">
                      <Phone className="w-5 h-5 mr-3 opacity-40" /> 999
                    </p>
                </div>
                <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 text-left">
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-primary mb-3">Management</p>
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
    </div>
  );
}
