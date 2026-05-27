"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MapPin, AlertCircle, 
  Loader2, Building2, Sparkles, Send, Bot, 
  ChevronRight, ReceiptText,
  ShieldCheck, RefreshCcw, Download, 
  Info, MessageSquare, X, Wifi, Shield, Clock, PoundSterling, Phone
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { cn, getResolvedImageUrl } from "@/lib/utils";
import { query, collection, where } from "firebase/firestore";
import { format } from "date-fns";

/**
 * @fileOverview High-Fidelity Resident Hub.
 * Optimized for word-by-word streaming and professional vertical hierarchy.
 * Resolved ReferenceError: Phone is not defined.
 */

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
  
  const maintenanceContext = useMemo(() => {
    if (!requests) return "No maintenance records on file.";
    return requests.map(r => `${r.title}: ${r.description} (Status: ${r.status}, Priority: ${r.priority})`).join(' | ');
  }, [requests]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chatHistory, isChatOpen]);

  const handleAskConcierge = async (text?: string) => {
    if (isChatting) return;

    const queryText = text || chatQuery.trim();
    if (!queryText) return;
    
    setChatQuery(""); 
    const newUserMsg = { role: 'user' as const, text: queryText };
    setChatHistory(prev => [...prev, newUserMsg]); 
    setIsChatting(true);

    const paymentContext = currentPayment ? `Payment for ${format(new Date(), 'MMMM')} is ${currentPayment.status}.` : "No current payment record found.";
    const propertyInfo = property ? `Property: ${property.addressLine1}. Rent: £${property.rentAmount}. Connectivity: ${property.connectivityStatus || 'Ultra-Fast Fiber Enabled'}. Compliance: ${property.complianceStatus || 'EPC Grade B / Certified'}. Repairs: ${maintenanceContext}. ${paymentContext}` : "Property details are synchronizing.";

    try {
      const response = await fetch('/api/concierge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: queryText,
          residentName: user?.displayName || user?.email?.split('@')[0],
          propertyAddress: property?.addressLine1 || "your home",
          propertyContext: propertyInfo
        }),
      });

      if (!response.ok) {
        throw new Error('API route failed to respond.');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('Stream reader initialization failed.');

      let botText = "";
      setChatHistory(prev => [...prev, { role: 'bot', text: "" }]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        botText += chunk;
        
        setChatHistory(prev => {
          const newHistory = [...prev];
          newHistory[newHistory.length - 1] = { role: 'bot', text: botText };
          return newHistory;
        });
      }
    } catch (error: any) {
      console.error('AI STREAM ERROR:', error);
      setChatHistory(prev => {
        const newHistory = [...prev];
        const errorMessage = "[SYSTEM]: AI is temporarily busy. Please try again.";
        const lastMsg = newHistory[newHistory.length - 1];
        if (lastMsg && lastMsg.role === 'bot' && !lastMsg.text) {
           newHistory[newHistory.length - 1] = { role: 'bot', text: errorMessage };
        } else {
           newHistory.push({ role: 'bot', text: errorMessage });
        }
        return newHistory;
      });
    } finally { 
      setIsChatting(false); 
    }
  };

  const handleDownloadStatement = async () => {
    if (!property) return;
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.text(`RENTAL STATEMENT - ${property.addressLine1}`, 20, 20);
    doc.save(`Statement_${property.addressLine1.replace(/\s+/g, '_')}_${format(new Date(), 'MMM_yyyy')}.pdf`);
  };

  if (!isClient || isPropLoading || isRequestsLoading) return (
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
              {/* 3. MONTHLY RENT LEDGER */}
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold font-headline text-2xl text-foreground flex items-center tracking-tight"><ReceiptText className="w-6 h-6 mr-4 text-accent" /> Monthly Rent</h3>
                  <Button variant="ghost" asChild className="rounded-xl font-bold text-[10px] uppercase tracking-widest text-muted-foreground hover:text-accent">
                    <Link href="/tenant/payments">View history <ChevronRight className="w-3.5 h-3.5 ml-1" /></Link>
                  </Button>
                </div>
                <div className="p-10 bg-muted/20 rounded-[2.5rem] border border-border shadow-inner relative overflow-hidden group">
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
                <div className="p-8 bg-primary/5 rounded-[2rem] border border-border">
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

              <div className="pt-8 border-t border-border/50">
                <Button variant="outline" className="w-full h-16 rounded-[1.75rem] border-border bg-card hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all" onClick={handleDownloadStatement}>
                   <Download className="w-5 h-5 mr-3 text-accent" /> Download Rent Statement
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* SIDEBAR */}
        <div className="lg:col-span-4 space-y-10">
           <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-10 pb-4 border-b border-border bg-muted/5">
               <CardTitle className="text-xl font-headline font-bold flex items-center text-foreground">
                 <AlertCircle className="w-6 h-6 mr-4 text-accent" />
                 Real-Time Support
               </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-8">
                <div className="p-6 rounded-2xl bg-red-500/5 border border-red-500/10">
                    <p className="text-[9px] font-bold uppercase tracking-[0.25em] text-red-600 mb-3">Primary SOS</p>
                    <p className="text-base font-bold text-foreground font-headline">Emergency Services</p>
                    <p className="text-lg font-bold mt-4 flex items-center text-red-600">
                      <Phone className="w-5 h-5 mr-3 opacity-40" /> 999
                    </p>
                </div>
                <Button variant="ghost" asChild className="w-full text-[10px] font-bold uppercase tracking-[0.3em] text-muted-foreground hover:text-primary hover:bg-primary/5 h-12 rounded-xl transition-all">
                   <Link href="/tenant/emergency-contacts">View Support Network <ChevronRight className="w-4 h-4 ml-2" /></Link>
                </Button>
             </CardContent>
           </Card>

           <Card className="border-none shadow-sm rounded-[3rem] bg-accent text-white overflow-hidden text-left relative group">
              <CardHeader className="p-10 pb-4">
                 <CardTitle className="text-xl font-bold font-headline flex items-center gap-4">
                    <Bot className="w-8 h-8 text-white/90" /> Flow Concierge
                 </CardTitle>
              </CardHeader>
              <CardContent className="p-10 pt-0">
                 <div className="p-6 bg-white/10 rounded-[2rem] border border-white/10 shadow-inner">
                    <p className="text-sm font-medium leading-relaxed">Ask me anything about your residency, rent, or maintenance status.</p>
                 </div>
              </CardContent>
           </Card>
        </div>
      </div>

      {/* CHAT BOT */}
      <div className="fixed bottom-10 right-10 z-[100] flex flex-col items-end gap-6">
        {isChatOpen && (
          <Card className="w-[400px] h-[600px] border-none shadow-2xl rounded-[3rem] bg-card ring-1 ring-border overflow-hidden flex flex-col animate-in slide-in-from-bottom-10 fade-in duration-500">
            <CardHeader className="bg-primary p-8 text-primary-foreground">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div>
                  <div className="text-left">
                    <CardTitle className="text-xl font-headline font-bold">Flow Concierge</CardTitle>
                    <p className="text-xs opacity-70 font-bold uppercase tracking-widest">Real-Time Intelligence</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setIsChatOpen(false)} className="text-white/40 hover:text-white hover:bg-white/10 rounded-xl h-10 w-10">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </CardHeader>
            
            <div className="flex-1 overflow-y-auto p-8 space-y-6" ref={scrollRef}>
              {chatHistory.length === 0 ? (
                <div className="h-full flex flex-col justify-center items-center text-center space-y-4 opacity-40">
                  <Bot className="w-12 h-12 mx-auto text-foreground" />
                  <p className="text-[10px] font-bold font-headline uppercase tracking-[0.3em]">How can I assist your residency?</p>
                </div>
              ) : (
                <>
                  {chatHistory.map((msg, i) => (
                    <div key={i} className={cn("flex flex-col max-w-[85%] animate-in slide-in-from-bottom-2", msg.role === 'user' ? "ml-auto items-end" : "items-start")}>
                      <div className={cn(
                        "p-5 rounded-[1.75rem] text-sm font-bold leading-relaxed shadow-sm", 
                        msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none border border-border/50"
                      )}>
                        {msg.text || (isChatting && i === chatHistory.length - 1 ? "..." : "")}
                      </div>
                    </div>
                  ))}
                  {isChatting && (
                    <div className="flex items-center gap-3 p-4 bg-muted/30 rounded-2xl w-fit">
                      <div className="flex gap-1.5">
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="p-6 bg-muted/10 border-t border-border">
              <form onSubmit={(e) => { e.preventDefault(); handleAskConcierge(); }} className="flex gap-3 items-center">
                <Input value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} placeholder="Ask Flow..." className="h-12 rounded-2xl bg-background border-none shadow-inner px-5 text-sm text-foreground focus-visible:ring-primary flex-1" disabled={isChatting} />
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
          {isChatOpen ? <X className="w-8 h-8" /> : <MessageSquare className="w-10 h-10 group-hover:rotate-12 transition-transform" />}
        </button>
      </div>
    </div>
  );
}
