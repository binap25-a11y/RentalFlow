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
  Home, Info, BookOpen, CreditCard, RotateCcw, Phone
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { tenantConcierge } from "@/ai/flows/tenant-concierge-flow";
import { cn, getResolvedImageUrl } from "@/lib/utils";
import { query, collection, where } from "firebase/firestore";
import { format } from "date-fns";

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

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chatHistory]);

  const handleAskConcierge = async (text?: string) => {
    const queryText = text || chatQuery.trim();
    if (!queryText || !property) return;
    
    setChatQuery(""); 
    setChatHistory(prev => [...prev, { role: 'user', text: queryText }]); 
    setIsChatting(true);

    const activeRequestsContext = activeRequests.map(r => `${r.title} (${r.status})`).join(', ');
    const paymentContext = currentPayment ? `Payment for ${format(new Date(), 'MMMM')} is ${currentPayment.status}.` : "No current payment record found.";

    try {
      const response = await tenantConcierge({ 
        query: queryText, 
        residentName: user?.displayName || user?.email?.split('@')[0],
        propertyAddress: property.addressLine1,
        propertyContext: `Property: ${property.addressLine1}. Specs: ${property.numberOfBedrooms} bedrooms, ${property.numberOfBathrooms} bathrooms. Narrative: ${property.description || 'N/A'}. Rent: £${property.rentAmount}. Financials: ${paymentContext} Repairs: ${activeRequestsContext}` 
      });
      setChatHistory(prev => [...prev, { role: 'bot', text: response.answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "Service temporarily unavailable. Please try again shortly." }]);
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

  if (!property) return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-6 animate-in fade-in duration-1000 text-left">
      <div className="relative w-full max-w-2xl">
        <div className="absolute -inset-4 bg-primary/5 rounded-[4rem] blur-3xl opacity-50 animate-pulse" />
        <Card className="relative border-none shadow-2xl rounded-[3.5rem] overflow-hidden bg-card/80 backdrop-blur-xl ring-1 ring-white/10">
          <CardContent className="p-12 md:p-20 text-center flex flex-col items-center">
            <div className="relative mb-12">
              <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150 opacity-20 animate-pulse" />
              <div className="relative h-32 w-32 rounded-[2.5rem] bg-gradient-to-br from-primary/10 to-accent/5 flex items-center justify-center shadow-inner border border-white/10">
                <Building2 className="w-16 h-16 text-primary opacity-40" />
              </div>
              <div className="absolute -bottom-2 -right-2 p-3 bg-accent rounded-2xl shadow-2xl border-4 border-card">
                 <RefreshCcw className="w-5 h-5 text-white animate-spin" style={{ animationDuration: '3s' }} />
              </div>
            </div>
            
            <Badge variant="outline" className="mb-6 py-2 px-6 rounded-full border-primary/10 bg-primary/5 text-primary font-bold uppercase tracking-[0.3em] text-[10px] font-headline">
               System Orchestration Active
            </Badge>
            
            <h3 className="text-4xl md:text-5xl font-headline font-bold text-foreground mb-10 tracking-tighter leading-tight text-center">
              Residency Record <br/><span className="text-accent">Synchronizing.</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-lg mb-12">
               <div className="flex items-center gap-3 bg-primary/5 px-4 py-3 rounded-xl border border-white/5 shadow-inner min-w-0">
                  <Bed className="w-4 h-4 text-accent shrink-0" />
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-widest truncate">2 Bedrooms</p>
               </div>
               <div className="flex items-center gap-3 bg-primary/5 px-4 py-3 rounded-xl border border-white/5 shadow-inner min-w-0">
                  <Bath className="w-4 h-4 text-accent shrink-0" />
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-widest truncate">1 Bathroom</p>
               </div>
               <div className="flex items-center gap-3 bg-primary/5 px-4 py-3 rounded-xl border border-white/5 shadow-inner min-w-0">
                  <Home className="w-4 h-4 text-accent shrink-0" />
                  <p className="text-[10px] font-bold text-foreground uppercase tracking-widest truncate">Residential Home</p>
               </div>
            </div>
            
            <p className="text-lg text-muted-foreground font-medium mb-12 max-w-md leading-relaxed opacity-70 text-center">
              We are currently verifying your official occupancy assets. Access to your high-fidelity portal will be granted instantly upon management verification.
            </p>
            
            <Button asChild size="lg" className="rounded-[1.75rem] font-bold bg-primary hover:bg-primary/90 text-primary-foreground h-16 px-16 shadow-2xl shadow-primary/20 border-none transition-all hover:scale-[1.05] active:scale-95 text-lg">
              <Link href="/tenant/messages">Inquire with Management</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );

  const primaryImageUrl = getResolvedImageUrl(property?.imageUrl, property?.imageUrls);

  return (
    <div className="max-w-7xl mx-auto space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-32 text-left bg-background">
      <div className="space-y-4">
        <h1 className="text-4xl md:text-5xl font-headline font-bold text-foreground tracking-tighter">Resident Portal</h1>
        <p className="text-muted-foreground font-medium font-body text-xl opacity-70">Welcome home.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-8 space-y-12">
          <Card className="border-none shadow-2xl overflow-hidden rounded-[3rem] bg-card group ring-1 ring-border">
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

            <div className="p-10 border-b border-border bg-white/[0.01] flex flex-col gap-4">
               <div className="space-y-4 min-w-0 flex-1">
                  <h2 className="text-3xl md:text-4xl font-headline font-bold text-foreground tracking-tight leading-tight">
                    {property.addressLine1}, {property.city}, {property.zipCode}
                  </h2>
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 font-bold uppercase tracking-[0.2em] text-[10px] py-2.5 px-6 rounded-full shadow-sm font-headline shrink-0 h-fit w-fit">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Active Tenancy
                  </Badge>
               </div>
            </div>

            <CardContent className="p-10 md:p-12 space-y-12">
              <div className="flex flex-wrap gap-6 items-center">
                <div className="flex items-center gap-4 bg-primary/5 px-6 py-3 rounded-2xl border border-border shadow-inner">
                   <Bed className="w-6 h-6 text-accent" />
                   <span className="text-base font-bold text-foreground font-headline uppercase tracking-widest">
                     {property.numberOfBedrooms || 2} {property.numberOfBedrooms === 1 ? 'Bedroom' : 'Bedrooms'}
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

              <div className="grid grid-cols-1 gap-12 pt-6 border-t border-border">
                <div className="space-y-6">
                  <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><ReceiptText className="w-6 h-6 mr-4 text-accent" /> Monthly Rent</h3>
                  <div className="p-8 bg-muted/20 rounded-[2.5rem] border border-border shadow-inner flex flex-col min-h-[350px]">
                    <div className="flex-1 space-y-4">
                       <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-[0.3em] font-headline opacity-50">Verified Ledger</p>
                       <p className="text-5xl font-bold font-headline text-foreground tracking-tighter">£{property.rentAmount?.toLocaleString()}</p>
                       <Badge className={cn("w-full h-12 flex items-center justify-center font-bold text-[11px] rounded-2xl shadow-sm uppercase tracking-[0.2em] border shadow-inner", currentPayment?.status === 'paid' ? "bg-emerald-500 text-white border-transparent" : "bg-amber-500/10 text-amber-600 border-amber-500/20")}>
                         {currentPayment?.status === 'paid' ? "Receipted & Collected" : "Collection Pending"}
                       </Badge>
                    </div>
                    <Button variant="outline" className="w-full h-14 rounded-2xl border-border bg-card hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all mt-auto" onClick={handleDownloadStatement}>
                       <Download className="w-4 h-4 mr-2 text-accent" /> Download Rent Statement
                    </Button>
                  </div>
                </div>

                <div className="space-y-6">
                  <h3 className="font-bold font-headline text-2xl text-foreground tracking-tight">Your Residence</h3>
                  <div className="p-8 bg-primary/5 rounded-[2.5rem] border border-border">
                     <p className="text-base text-muted-foreground leading-relaxed font-body font-medium">
                       {property.description || "A premium managed property with high-fidelity visual orchestration and automated maintenance support."}
                     </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl rounded-[3rem] bg-card ring-1 ring-border overflow-hidden flex flex-col min-h-[650px]">
            <CardHeader className="bg-primary p-10 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div className="h-14 w-14 bg-white/10 rounded-2xl flex items-center justify-center shadow-inner"><Sparkles className="w-8 h-8 text-white" /></div>
                  <div className="text-left">
                    <CardTitle className="text-3xl font-headline font-bold tracking-tight">Property Assistant</CardTitle>
                    <CardDescription className="text-primary-foreground/70 font-medium text-base">Instant intelligence on your residency protocols.</CardDescription>
                  </div>
                </div>
                <Button variant="ghost" onClick={handleClearChat} className="text-white/60 hover:text-white hover:bg-white/10 rounded-xl font-bold font-headline text-xs uppercase tracking-widest">
                  <RotateCcw className="w-4 h-4 mr-2" /> Clear Chat
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="flex-1 overflow-y-auto p-10 space-y-8 no-scrollbar" ref={scrollRef}>
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col gap-10">
                    <div className="flex flex-col items-center justify-center text-center space-y-6 opacity-30 py-10">
                      <Bot className="w-16 h-16 text-foreground" />
                      <p className="text-base font-bold font-headline text-foreground uppercase tracking-[0.3em]">How can I assist your residency today?</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       {[
                         { title: "Property Rules", desc: "Pets, smoking, and noise protocols.", icon: BookOpen, query: "What are the property rules and protocols?" },
                         { title: "Repairs", desc: "How to report and track maintenance.", icon: Wrench, query: "How do I report a repair or track status?" },
                         { title: "Financials", desc: "Rent amounts and payment status.", icon: CreditCard, query: "What is my current rent and payment status?" },
                         { title: "Guides", desc: "Asset specs and room information.", icon: Info, query: "Tell me about my property specifications and guides." }
                       ].map((topic, i) => (
                         <button 
                            key={i} 
                            onClick={() => handleAskConcierge(topic.query)}
                            className="p-6 bg-primary/5 rounded-[2rem] border border-border flex items-start gap-4 hover:bg-primary/10 transition-all text-left group"
                          >
                            <div className="p-3 bg-white rounded-xl shadow-sm text-accent group-hover:scale-110 transition-transform"><topic.icon className="w-5 h-5" /></div>
                            <div className="text-left">
                               <p className="font-bold text-sm text-foreground">{topic.title}</p>
                               <p className="text-xs text-muted-foreground font-medium leading-relaxed">{topic.desc}</p>
                            </div>
                         </button>
                       ))}
                    </div>
                  </div>
                ) : (
                  <>
                    {chatHistory.map((msg, i) => (
                      <div key={i} className={cn("flex flex-col max-w-[85%] animate-in slide-in-from-bottom-2", msg.role === 'user' ? "ml-auto items-end" : "items-start")}>
                        <div className={cn("p-6 rounded-[2rem] text-sm md:text-base font-bold leading-relaxed shadow-sm", msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none")}>{msg.text}</div>
                      </div>
                    ))}
                    {isChatting && (
                      <div className="flex items-center gap-2 p-6 bg-muted/30 rounded-2xl w-fit animate-pulse">
                         <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                         <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                         <div className="w-1.5 h-1.5 bg-primary/40 rounded-full" />
                         <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest ml-2">Orchestrating...</span>
                      </div>
                    )}
                  </>
                )}
              </div>
              <div className="p-6 bg-muted/10 border-t border-border">
                <form onSubmit={(e) => { e.preventDefault(); handleAskConcierge(); }} className="flex gap-4 items-center">
                  <Input 
                    value={chatQuery} 
                    onChange={(e) => setChatQuery(e.target.value)} 
                    placeholder="Ask about your property..." 
                    className="h-14 rounded-2xl bg-background border-none shadow-inner px-6 text-base text-foreground focus-visible:ring-accent flex-1" 
                    disabled={isChatting} 
                  />
                  <button 
                    type="submit" 
                    className="h-14 w-14 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-primary-foreground transition-all active:scale-95 shrink-0 flex items-center justify-center hover:opacity-90 disabled:opacity-50" 
                    disabled={isChatting || !chatQuery.trim()}
                  >
                    {isChatting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-12">
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
    </div>
  );
}
