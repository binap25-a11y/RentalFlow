"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MapPin, AlertCircle, Wrench, 
  Loader2, Building2, Sparkles, Send, Bot, 
  ChevronRight, CheckCircle2, Clock, ReceiptText,
  ShieldCheck, ShieldAlert, RefreshCcw, Zap, Bed, Bath, Download, 
  Home, Info, BookOpen, CreditCard, RotateCcw, Phone,
  MessageCircle, X, Wifi, Shield
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { tenantConcierge } from "@/ai/flows/tenant-concierge-flow";
import { cn, getResolvedImageUrl } from "@/lib/utils";
import { query, collection, where } from "firebase/firestore";
import { format } from "date-fns";
import { ScrollArea } from "@/components/ui/scroll-area";

/**
 * 🆘 National SOS Protocols (UK Fallbacks)
 */
const SOS_FALLBACKS = [
  { id: 'f1', name: "Emergency Services", phone: "999", role: "Primary SOS", category: 'standard' },
  { id: 'f2', name: "NHS Advice", phone: "111", role: "Medical SOS", category: 'standard' },
  { id: 'f3', name: "Gas Emergency", phone: "0800 111 999", role: "Leak SOS", category: 'standard' },
];

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();
  const [chatQuery, setChatQuery] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'bot', text: string}[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "properties", userId: user.uid });
  }, [db, user]);
  
  const { data: properties, isLoading: isPropLoading } = useCollection(propertiesQuery);
  const property = properties?.[0];

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

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "maintenanceRequests", userId: user.uid });
  }, [db, user]);
  const { data: requests, isLoading: isRequestsLoading } = useCollection(requestsQuery);
  
  const activeRequests = useMemo(() => requests?.filter(r => r.status !== 'completed').slice(0, 3) || [], [requests]);

  const contactsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "emergencyContacts", userId: user.uid });
  }, [db, user]);
  const { data: contactsData, loading: isContactsLoading } = useCollection(contactsQuery);

  const sortedContacts = useMemo(() => {
    let list = contactsData ? [...contactsData] : [];
    const standards = list.filter(c => c.category === 'standard');
    if (standards.length === 0) list = [...SOS_FALLBACKS, ...list];
    return list.sort((a, b) => {
      if (a.category === 'standard' && b.category !== 'standard') return -1;
      if (a.category !== 'standard' && b.category === 'standard') return 1;
      return 0;
    }).slice(0, 5);
  }, [contactsData]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chatHistory, isChatOpen]);

  const handleAskConcierge = async (text?: string) => {
    const queryText = text || chatQuery.trim();
    if (!queryText) return;
    
    setChatQuery(""); 
    setChatHistory(prev => [...prev, { role: 'user', text: queryText }]); 
    setIsChatting(true);

    const activeRequestsContext = activeRequests.map(r => `${r.title} (${r.status})`).join(', ');
    const paymentContext = currentPayment ? `Payment for ${format(new Date(), 'MMMM')} is ${currentPayment.status}.` : "No current payment record found.";
    const propertyInfo = property ? `Property: ${property.addressLine1}. Specs: ${property.numberOfBedrooms} bedrooms, ${property.numberOfBathrooms} bathrooms. Narrative: ${property.description || 'N/A'}. Rent: £${property.rentAmount}. Financials: ${paymentContext} Repairs: ${activeRequestsContext}` : "Property details are currently synchronizing.";

    try {
      const response = await tenantConcierge({ 
        query: queryText, 
        residentName: user?.displayName || user?.email?.split('@')[0],
        propertyAddress: property?.addressLine1 || "your home",
        propertyContext: propertyInfo 
      });
      setChatHistory(prev => [...prev, { role: 'bot', text: response.answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "I'm currently recalibrating my property intelligence. Please try again in a moment." }]);
    } finally { setIsChatting(false); }
  };

  const handleClearChat = () => setChatHistory([]);

  const handleDownloadStatement = async () => {
    if (!property) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const today = format(new Date(), 'PPP');
    const period = format(new Date(), 'MMMM yyyy');

    doc.setFillColor(15, 23, 42); 
    doc.rect(0, 0, 210, 55, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(24);
    doc.text("RENTAL STATEMENT", 20, 25);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Official Residency Record | Generated: ${today}`, 20, 35);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Property Identity", 20, 75);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    doc.text(property.addressLine1, 20, 85);
    doc.text(`${property.city}, ${property.zipCode}`, 20, 91);

    doc.setFont("helvetica", "bold");
    doc.text("Statement Period", 140, 75);
    doc.setFont("helvetica", "normal");
    doc.text(period, 140, 85);

    doc.setDrawColor(229, 231, 235);
    doc.line(20, 105, 190, 105);

    doc.setFont("helvetica", "bold");
    doc.text("Ledger Item", 20, 120);
    doc.text("Amount", 140, 120);
    doc.text("Status", 170, 120);

    doc.setFont("helvetica", "normal");
    doc.text(`Monthly Rent - ${period}`, 20, 130);
    doc.text(`£${property.rentAmount?.toLocaleString()}`, 140, 130);
    doc.text(currentPayment?.status === 'paid' ? "COLLECTED" : "PENDING", 170, 130);

    doc.save(`Statement_${property.addressLine1.replace(/\s+/g, '_')}_${period.replace(/\s+/g, '_')}.pdf`);
  };

  if (!isClient || isPropLoading || isRequestsLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary w-12 h-12 opacity-60" /></div>;

  /**
   * 💎 PREMIUM SYSTEM ORCHESTRATION VIEW (Loading State)
   */
  if (!property) return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in duration-1000 pb-32 text-left bg-background">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-foreground tracking-tighter">System Orchestration</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70">Verifying official residency records...</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-10">
          <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-card ring-1 ring-border">
            <div className="relative h-[400px] w-full bg-muted/40 animate-pulse flex items-center justify-center">
              <Building2 className="w-20 h-20 text-foreground/10" />
            </div>
            
            <CardContent className="p-12 space-y-12">
              {/* RESIZED MONTHLY RENT PLACEHOLDER */}
              <div className="space-y-6">
                <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight opacity-20"><ReceiptText className="w-6 h-6 mr-4 text-accent" /> Monthly Rent</h3>
                <div className="p-10 bg-muted/10 rounded-[2.5rem] border border-border/50 shadow-inner space-y-6">
                  <div className="h-2 w-20 bg-muted rounded animate-pulse opacity-40" />
                  <div className="h-10 w-48 bg-muted rounded-xl animate-pulse" />
                  <div className="h-12 w-full bg-muted/30 rounded-xl animate-pulse" />
                </div>
              </div>

              {/* YOUR RESIDENCE PLACEHOLDER (BELOW RENT) */}
              <div className="space-y-6">
                <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight opacity-20"><Info className="w-6 h-6 mr-4 text-accent" /> Your Residence</h3>
                <div className="p-10 bg-primary/5 rounded-[2.5rem] border border-border/50 space-y-4">
                  <div className="h-3 w-full bg-muted rounded animate-pulse opacity-30" />
                  <div className="h-3 w-5/6 bg-muted rounded animate-pulse opacity-30" />
                  <div className="h-3 w-4/6 bg-muted rounded animate-pulse opacity-30" />
                </div>
              </div>

              {/* FITTED DOWNLOAD ACTION (BELOW RESIDENCE) */}
              <div className="pt-6 border-t border-border/50">
                <div className="h-16 w-full bg-muted rounded-2xl animate-pulse opacity-20" />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-12">
          <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden opacity-50 grayscale">
            <div className="p-10 h-[400px] flex flex-col items-center justify-center gap-6">
              <RefreshCcw className="w-12 h-12 text-primary/20 animate-spin" />
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-center">Syncing Hub...</p>
            </div>
          </Card>
        </div>
      </div>
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
          <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-card group ring-1 ring-border">
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

            <div className="p-10 border-b border-border bg-white/[0.01] space-y-4">
               <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground tracking-tight leading-tight">
                 {property.addressLine1}, {property.city}, {property.zipCode}
               </h2>
               <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold uppercase tracking-[0.2em] text-[10px] py-2.5 px-6 rounded-full shadow-sm font-headline shrink-0 h-fit w-fit">
                 <ShieldCheck className="w-4 h-4 mr-2" /> Active Tenancy
               </Badge>
               
               <div className="flex flex-wrap gap-6 items-center pt-6 border-t border-border/50">
                <div className="flex items-center gap-4 bg-primary/5 px-6 py-3 rounded-2xl border border-border shadow-inner">
                   <Bed className="w-6 h-6 text-accent" />
                   <span className="text-base font-bold text-foreground font-headline uppercase tracking-widest">
                     {property.numberOfBedrooms || 1} {property.numberOfBedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
                   </span>
                </div>
                <div className="flex items-center gap-4 bg-primary/5 px-6 py-3 rounded-2xl border border-border shadow-inner">
                   <Bath className="w-6 h-6 text-accent" />
                   <span className="text-base font-bold text-foreground font-headline uppercase tracking-widest">
                     {property.numberOfBathrooms || 1} {property.numberOfBathrooms === 1 ? 'Bathroom' : 'Bathrooms'}
                   </span>
                </div>
                <div className="flex items-center gap-4 bg-primary/5 px-6 py-3 rounded-2xl border border-border shadow-inner">
                   <Home className="w-6 h-6 text-accent" />
                   <span className="text-base font-bold text-foreground font-headline uppercase tracking-widest">
                     {property.propertyType || "Residential Home"}
                   </span>
                </div>
              </div>
            </div>

            <CardContent className="p-10 md:p-12 space-y-12">
              <div className="space-y-12">
                <div className="space-y-6">
                  <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><ReceiptText className="w-6 h-6 mr-4 text-accent" /> Monthly Rent</h3>
                  <div className="p-10 bg-muted/20 rounded-[2.5rem] border border-border shadow-inner">
                     <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.3em] font-headline opacity-50 mb-3">Verified Ledger</p>
                     <p className="text-6xl font-bold font-headline text-foreground tracking-tighter mb-6">£{property.rentAmount?.toLocaleString()}</p>
                     <Badge className={cn("w-full h-12 flex items-center justify-center font-bold text-[11px] rounded-2xl shadow-sm uppercase tracking-[0.2em] border shadow-inner", currentPayment?.status === 'paid' ? "bg-emerald-500 text-white border-transparent" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                       {currentPayment?.status === 'paid' ? "Receipted & Collected" : "Collection Pending"}
                     </Badge>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><Info className="w-6 h-6 mr-4 text-accent" /> Your Residence</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-8 bg-primary/5 rounded-[2rem] border border-border col-span-1 md:col-span-2">
                       <p className="text-[9px] font-bold uppercase text-accent tracking-[0.3em] mb-4">Official Narrative</p>
                       <p className="text-base text-muted-foreground leading-relaxed font-body font-medium">
                         {property.description || "A premium managed property with high-fidelity visual orchestration and automated maintenance support."}
                       </p>
                    </div>
                    
                    <div className="p-6 bg-muted/10 rounded-2xl border border-border/50 flex items-center gap-4">
                       <div className="p-3 bg-white rounded-xl shadow-sm text-accent"><Wifi className="w-5 h-5" /></div>
                       <div>
                          <p className="text-[10px] font-bold uppercase opacity-40">Connectivity</p>
                          <p className="text-sm font-bold">Ultra-Fast Fiber Enabled</p>
                       </div>
                    </div>
                    <div className="p-6 bg-muted/10 rounded-2xl border border-border/50 flex items-center gap-4">
                       <div className="p-3 bg-white rounded-xl shadow-sm text-accent"><Shield className="w-5 h-5" /></div>
                       <div>
                          <p className="text-[10px] font-bold uppercase opacity-40">Compliance</p>
                          <p className="text-sm font-bold">EPC Grade B / Certified</p>
                       </div>
                    </div>
                  </div>
                </div>

                <div className="pt-8 border-t border-border/50">
                  <Button variant="outline" className="w-full h-16 rounded-[1.75rem] border-border bg-card hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all" onClick={handleDownloadStatement}>
                     <Download className="w-5 h-5 mr-3 text-accent" /> Download Rent Statement
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-10">
           <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-10 pb-4 border-b border-border bg-muted/5">
               <div className="flex justify-between items-center mb-2">
                 <CardTitle className="text-xl font-headline font-bold flex items-center text-foreground">
                   <ShieldAlert className="w-6 h-6 mr-4 text-accent" />
                   Real-Time Support
                 </CardTitle>
                 {isContactsLoading && <RefreshCcw className="w-4 h-4 animate-spin text-accent/40" />}
               </div>
               <CardDescription className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground opacity-50">Authorized SOS protocols</CardDescription>
             </CardHeader>
             <CardContent className="p-10 space-y-8">
               <div className="space-y-4">
                 {sortedContacts.map((contact, idx) => (
                   <div key={contact.id || idx} className={cn(
                     "p-6 rounded-2xl border transition-all group",
                     contact.category === 'standard' 
                      ? "bg-red-500/5 border-red-500/10 hover:border-red-500/30" 
                      : "bg-muted/20 border-border hover:border-accent/30"
                   )}>
                      <div className="flex justify-between items-start mb-3">
                        <p className={cn(
                          "text-[9px] font-bold uppercase tracking-[0.25em]",
                          contact.category === 'standard' ? "text-red-600" : "text-muted-foreground opacity-60"
                        )}>{contact.role}</p>
                        {contact.category === 'standard' && (
                          <Badge className="bg-red-600 text-white text-[8px] font-bold uppercase py-0.5 px-3 rounded-full border-none shadow-sm animate-pulse">SOS PROTOCOL</Badge>
                        )}
                      </div>
                      <p className="text-base font-bold text-foreground truncate font-headline">{contact.name}</p>
                      <p className={cn(
                        "text-lg font-bold mt-4 flex items-center",
                        contact.category === 'standard' ? "text-red-600" : "text-accent"
                      )}>
                        <Phone className="w-5 h-5 mr-3 opacity-40" /> {contact.phone}
                      </p>
                   </div>
                 ))}
                 <Button variant="ghost" asChild className="w-full text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-primary hover:bg-primary/5 h-12 rounded-xl mt-4 transition-all border border-transparent hover:border-primary/20">
                   <Link href="/tenant/emergency-contacts">View All Authorized Contacts <ChevronRight className="w-4 h-4 ml-2" /></Link>
                 </Button>
               </div>
             </CardContent>
           </Card>

           <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-10 pb-4 border-b border-border">
               <CardTitle className="text-xl font-headline font-bold flex items-center text-foreground"><Wrench className="w-6 h-6 mr-4 text-accent" /> Active Requests</CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-6">
               {activeRequests.length > 0 ? activeRequests.map(req => (
                 <Link key={req.id} href="/tenant/maintenance" className="block group">
                   <div className="p-6 bg-muted/20 rounded-2xl border border-border hover:bg-muted/40 transition-all shadow-sm">
                     <div className="flex justify-between items-start mb-3">
                       <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-border px-3 py-1">{req.status}</Badge>
                       <Clock className="w-4 h-4 text-muted-foreground opacity-40" />
                     </div>
                     <p className="text-base font-bold font-headline text-foreground group-hover:text-accent transition-colors truncate">{req.title}</p>
                   </div>
                 </Link>
               )) : (
                 <div className="text-center py-16 opacity-30 flex flex-col items-center justify-center space-y-4">
                    <div className="p-6 bg-muted rounded-full animate-pulse shadow-inner"><CheckCircle2 className="w-10 h-10 text-foreground opacity-20" /></div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.3em] font-headline text-foreground text-center">Monitoring ledger in real-time</p>
                 </div>
               )}
             </CardContent>
           </Card>
        </div>
      </div>

      <div className="pt-24 flex justify-center">
        <Button size="lg" className="bg-primary hover:bg-primary/90 text-white rounded-[2rem] shadow-2xl shadow-primary/20 font-bold h-20 font-headline px-24 border-none transition-all hover:scale-[1.05] active:scale-95 text-lg uppercase tracking-[0.2em]" asChild>
          <Link href="/tenant/maintenance"><AlertCircle className="w-6 h-6 mr-4" /> Report Repair</Link>
        </Button>
      </div>

      {/* 🤖 ELITE AI CONCIERGE FLOATING INTERFACE */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col items-end gap-6">
        {isChatOpen && (
          <Card className="w-[400px] h-[600px] border-none shadow-2xl rounded-[3rem] bg-card ring-1 ring-border overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-500">
            <CardHeader className="bg-primary p-8 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner"><Sparkles className="w-6 h-6 text-white" /></div>
                  <div className="text-left">
                    <CardTitle className="text-xl font-headline font-bold tracking-tight">Flow Concierge</CardTitle>
                    <p className="text-xs opacity-70 font-bold uppercase tracking-widest">Digital Assistant</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="icon" onClick={handleClearChat} title="Clear Chat" className="text-white/40 hover:text-white hover:bg-white/10 rounded-xl h-10 w-10">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} className="text-white/40 hover:text-white hover:bg-white/10 rounded-xl h-10 w-10">
                    <X className="w-5 h-5" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar" ref={scrollRef}>
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col gap-8">
                  <div className="text-center space-y-4 opacity-40 py-6">
                    <Bot className="w-12 h-12 mx-auto text-foreground" />
                    <p className="text-[10px] font-bold font-headline uppercase tracking-[0.3em]">How can I assist your residency?</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { title: "Property Rules", icon: BookOpen, query: "What are the property rules?" },
                      { title: "Rent Status", icon: CreditCard, query: "What is my rent status?" },
                      { title: "Report Repair", icon: Wrench, query: "How do I report a repair?" },
                      { title: "Home Guides", icon: Info, query: "Tell me about my home specs." }
                    ].map((topic, i) => (
                      <button key={i} onClick={() => handleAskConcierge(topic.query)} className="p-5 bg-primary/5 rounded-[1.5rem] border border-border flex items-center gap-4 hover:bg-primary/10 transition-all text-left group">
                        <topic.icon className="w-4 h-4 text-accent" />
                        <span className="font-bold text-xs text-foreground">{topic.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <>
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn("flex flex-col max-w-[85%] animate-in slide-in-from-bottom-2", msg.role === 'user' ? "ml-auto items-end" : "items-start")}>
                      <div className={cn("p-5 rounded-[1.75rem] text-sm font-bold leading-relaxed shadow-sm", msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none")}>{msg.text}</div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl w-fit">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-primary/40">Orchestrating</span>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 bg-muted/10 border-t border-border">
              <form onSubmit={(e) => { e.preventDefault(); handleAskConcierge(); }} className="flex gap-3 items-center">
                <Input value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} placeholder="Ask Flow..." className="h-12 rounded-2xl bg-background border-none shadow-inner px-5 text-sm text-foreground focus-visible:ring-accent flex-1" disabled={isChatting} />
                <button type="submit" className="h-12 w-12 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-primary-foreground transition-all active:scale-95 shrink-0 flex items-center justify-center disabled:opacity-50" disabled={isChatting || !chatQuery.trim()}>
                  {isChatting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </button>
              </form>
            </div>
          </Card>
        )}

        <button 
          onClick={() => setIsChatOpen(!isChatOpen)}
          className={cn(
            "h-20 w-20 rounded-[2.5rem] shadow-2xl flex items-center justify-center transition-all duration-500 hover:scale-110 active:scale-95 group",
            isChatOpen ? "bg-card text-foreground ring-1 ring-border" : "bg-primary text-primary-foreground"
          )}
        >
          {isChatOpen ? <X className="w-8 h-8" /> : <MessageCircle className="w-10 h-10 group-hover:rotate-12 transition-transform" />}
          {!isChatOpen && (
            <div className="absolute -top-1 -right-1 h-6 w-6 bg-accent rounded-full border-4 border-background animate-pulse shadow-lg" />
          )}
        </button>
      </div>
    </div>
  );
}
