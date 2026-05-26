"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MapPin, AlertCircle, Wrench, 
  Loader2, Home, Sparkles, Send, Bot, 
  ChevronRight, CheckCircle2, Clock, ReceiptText, Building2,
  PhoneCall, ShieldAlert,
  ShieldCheck,
  CloudSync
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState, useEffect, useRef } from "react";
import { tenantConcierge } from "@/ai/flows/tenant-concierge-flow";
import { cn, getResolvedImageUrl } from "@/lib/utils";
import { query, collection, where } from "firebase/firestore";

/**
 * 🆘 National SOS Protocols (UK Fallbacks)
 * Displayed in absolute real-time if landlord ledger is empty.
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

  const propertyQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "properties", userId: user.uid });
  }, [db, user]);
  const { data: properties, isLoading: isPropLoading } = useCollection(propertyQuery);
  const property = properties?.[0];

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    const now = new Date();
    return query(collection(db, 'rentPayments'), where('tenantId', '==', user.uid), where('month', '==', now.getMonth() + 1), where('year', '==', now.getFullYear()));
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
    
    // If no standard SOS contacts exist in DB, push fallbacks
    if (standards.length === 0) {
      list = [...SOS_FALLBACKS, ...list];
    }

    return list.sort((a, b) => {
      if (a.category === 'standard' && b.category !== 'standard') return -1;
      if (a.category !== 'standard' && b.category === 'standard') return 1;
      return 0;
    }).slice(0, 6);
  }, [contactsData]);

  useEffect(() => { if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [chatHistory]);

  const handleAskConcierge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim() || !property) return;
    const queryText = chatQuery.trim();
    setChatQuery(""); setChatHistory(prev => [...prev, { role: 'user', text: queryText }]); setIsChatting(true);
    try {
      const response = await tenantConcierge({ query: queryText, propertyContext: `Property: ${property.addressLine1}.` });
      setChatHistory(prev => [...prev, { role: 'bot', text: response.answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "Service temporarily unavailable." }]);
    } finally { setIsChatting(false); }
  };

  if (!isClient || isPropLoading || isRequestsLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  if (!property) return <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-8"><Home className="w-20 h-20 text-muted-foreground/20" /><h2 className="text-3xl font-bold font-headline text-foreground">Lease Registration Pending</h2><Button asChild className="rounded-2xl h-12 px-10 font-bold"><Link href="/tenant/messages">Contact Management</Link></Button></div>;

  const imageUrl = getResolvedImageUrl(property?.imageUrl, property?.imageUrls);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-left">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground mb-2 tracking-tight">Resident Portal</h1>
          <p className="text-muted-foreground font-medium font-body">Welcome home to {property.addressLine1.split(',')[0]}</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 text-white rounded-2xl shadow-xl shadow-accent/20 font-bold h-12 font-headline px-8 border-none" asChild><Link href="/tenant/maintenance"><AlertCircle className="w-4 h-4 mr-2" /> Report Repair</Link></Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden rounded-[2.5rem] bg-card group ring-1 ring-border">
            <div className="relative h-[450px] w-full bg-muted overflow-hidden">
              {imageUrl ? (
                <img 
                  src={imageUrl} 
                  alt={property.addressLine1} 
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-1000 group-hover:scale-105" 
                />
              ) : (
                <div className="absolute inset-0 bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
                  <Building2 className="w-24 h-24 text-muted-foreground/10" />
                </div>
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
              <div className="absolute bottom-10 left-10 text-foreground text-left space-y-4 max-w-2xl bg-background/40 backdrop-blur-md p-6 rounded-2xl border border-border">
                <Badge className="bg-emerald-500 text-white border-none font-bold uppercase tracking-[0.2em] text-[10px] py-1.5 px-4 rounded-full shadow-lg font-headline">Active Tenancy</Badge>
                <h2 className="text-4xl font-headline font-bold leading-tight tracking-tight text-foreground">{property.addressLine1}</h2>
                <p className="flex items-center text-lg opacity-80 font-medium font-body text-foreground"><MapPin className="w-5 h-5 mr-2 text-accent" /> {property.city}, {property.zipCode}</p>
              </div>
            </div>
            <CardContent className="pt-10 text-left p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <h3 className="font-bold font-headline text-xl text-foreground border-b border-border pb-3">Property Narrative</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-body font-medium">{property.description || "A premium managed property with professional maintenance and visual orchestration."}</p>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold font-headline text-xl text-foreground flex items-center border-b border-border pb-3"><ReceiptText className="w-5 h-5 mr-3 text-accent" /> Tenancy Status</h3>
                  <div className="p-6 bg-muted/20 rounded-[1.75rem] border border-border space-y-4 shadow-inner">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-headline opacity-60">Monthly Yield Commitment</p>
                    <p className="text-3xl font-bold font-headline text-foreground">£{property.rentAmount?.toLocaleString()}</p>
                    <Badge className={cn("w-full h-11 flex items-center justify-center font-bold text-xs rounded-2xl shadow-sm uppercase tracking-widest border-none", currentPayment?.status === 'paid' ? "bg-emerald-500 text-white" : "bg-amber-500 text-white")}>
                      {currentPayment?.status === 'paid' ? "Verified & Collected" : "Collection Pending"}
                    </Badge>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2.5rem] bg-card ring-1 ring-border overflow-hidden flex flex-col h-[550px]">
            <CardHeader className="bg-primary p-8 text-primary-foreground text-left">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-white/10 rounded-2xl flex items-center justify-center"><Sparkles className="w-6 h-6 text-white" /></div>
                <div className="text-left">
                  <CardTitle className="text-2xl font-headline font-bold">Property Assistant</CardTitle>
                  <CardDescription className="text-primary-foreground/70 font-medium">Instant guidance on property protocols.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar" ref={scrollRef}>
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-20">
                    <Bot className="w-12 h-12 text-foreground" />
                    <p className="text-sm font-bold font-headline text-foreground uppercase tracking-widest">Ask me about your home guides.</p>
                  </div>
                ) : chatHistory.map((msg, i) => (
                  <div key={i} className={cn("flex flex-col max-w-[85%]", msg.role === 'user' ? "ml-auto items-end" : "items-start")}>
                    <div className={cn("p-5 rounded-[1.75rem] text-sm font-bold leading-relaxed shadow-sm", msg.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none")}>{msg.text}</div>
                  </div>
                ))}
              </div>
              <div className="p-8 bg-muted/10 border-t border-border">
                <form onSubmit={handleAskConcierge} className="flex gap-4">
                  <Input value={chatQuery} onChange={(e) => setChatQuery(e.target.value)} placeholder="e.g. How do I reset the thermostat?" className="h-14 rounded-2xl bg-background border-none shadow-inner px-6 text-base text-foreground focus-visible:ring-accent" disabled={isChatting} />
                  <Button type="submit" size="icon" className="h-14 w-14 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-primary-foreground" disabled={isChatting || !chatQuery.trim()}><Send className="w-5 h-5" /></Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <Card className="border-none shadow-sm rounded-[2.5rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-8 pb-4 border-b border-border text-left bg-muted/5">
               <div className="flex justify-between items-center mb-2">
                 <CardTitle className="text-lg font-headline font-bold flex items-center text-foreground">
                   <ShieldAlert className="w-5 h-5 mr-3 text-accent" />
                   Real-Time Support
                 </CardTitle>
                 {isContactsLoading && <CloudSync className="w-4 h-4 animate-spin text-accent/40" />}
               </div>
               <CardDescription className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Authorized SOS protocols</CardDescription>
             </CardHeader>
             <CardContent className="p-8 space-y-6 text-left">
               <div className="space-y-4">
                 {sortedContacts.map(contact => (
                   <div key={contact.id} className={cn(
                     "p-5 rounded-2xl border transition-all group text-left",
                     contact.category === 'standard' 
                      ? "bg-red-500/5 border-red-500/20 hover:border-red-500/40" 
                      : "bg-muted/20 border-border hover:border-accent/30"
                   )}>
                      <div className="flex justify-between items-start mb-2">
                        <p className={cn(
                          "text-[9px] font-bold uppercase tracking-widest",
                          contact.category === 'standard' ? "text-red-600" : "text-muted-foreground opacity-60"
                        )}>{contact.role}</p>
                        {contact.category === 'standard' && (
                          <Badge className="bg-red-600 text-white text-[8px] font-bold uppercase py-0.5 px-3 rounded-full border-none shadow-sm animate-pulse">SOS PROTOCOL</Badge>
                        )}
                      </div>
                      <p className="text-sm font-bold text-foreground truncate font-headline">{contact.name}</p>
                      <p className={cn(
                        "text-base font-bold mt-3 flex items-center",
                        contact.category === 'standard' ? "text-red-600" : "text-accent"
                      )}>
                        <PhoneCall className="w-4 h-4 mr-2" /> {contact.phone}
                      </p>
                   </div>
                 ))}
                 <Button variant="ghost" asChild className="w-full text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-accent h-12 rounded-xl mt-2">
                   <Link href="/tenant/emergency-contacts">View All Authorized Contacts <ChevronRight className="w-3 h-3 ml-2" /></Link>
                 </Button>
               </div>
             </CardContent>
           </Card>

           <Card className="border-none shadow-sm rounded-[2.5rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-8 pb-4 border-b border-border text-left">
               <CardTitle className="text-lg font-headline font-bold flex items-center text-foreground"><Wrench className="w-5 h-5 mr-3 text-accent" /> Active Requests</CardTitle>
             </CardHeader>
             <CardContent className="p-8 space-y-4 text-left">
               {activeRequests.length > 0 ? activeRequests.map(req => (
                 <Link key={req.id} href="/tenant/maintenance" className="block group">
                   <div className="p-4 bg-muted/20 rounded-2xl border border-border hover:bg-muted/40 transition-all shadow-sm">
                     <div className="flex justify-between items-start mb-2">
                       <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground border-border px-2 py-0.5">{req.status}</Badge>
                       <Clock className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
                     </div>
                     <p className="text-sm font-bold font-headline text-foreground group-hover:text-accent transition-colors truncate">{req.title}</p>
                   </div>
                 </Link>
               )) : <div className="text-center py-10 opacity-30"><CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-foreground" /><p className="text-[10px] font-bold uppercase tracking-widest font-headline text-foreground">No active repairs</p></div>}
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}