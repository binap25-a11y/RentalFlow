"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MapPin, Phone, FileText, Download, AlertCircle, Wrench, 
  ShieldAlert, Loader2, Home, Sparkles, Send, Bot, 
  Calendar as CalendarIcon, User, ChevronRight, ShieldCheck,
  CheckCircle2, Clock
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format, isValid } from "date-fns";
import { useMemo, useState, useEffect, useRef } from "react";
import { tenantConcierge } from "@/ai/flows/tenant-concierge-flow";
import { cn } from "@/lib/utils";

const getMemoryAsset = (id: string) => {
  if (typeof window === 'undefined') return null;
  return (window as any).__asset_bridge?.[id] || null;
};

export default function TenantHub() {
  const { user } = useUser();
  const db = useFirestore();
  const [chatQuery, setChatQuery] = useState("");
  const [isChatting, setIsChatting] = useState(false);
  const [chatHistory, setChatHistory] = useState<{role: 'user' | 'bot', text: string}[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const propertyQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "properties", userId: user.uid });
  }, [db, user]);

  const { data: properties, isLoading: isPropLoading } = useCollection(propertyQuery);
  const property = properties?.[0];

  const requestsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "maintenanceRequests", userId: user.uid });
  }, [db, user]);

  const { data: requests, isLoading: isRequestsLoading } = useCollection(requestsQuery);
  
  const activeRequests = useMemo(() => {
    if (!requests) return [];
    return requests.filter(r => r.status !== 'completed').slice(0, 3);
  }, [requests]);

  const documentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "documents", userId: user.uid });
  }, [db, user]);

  const { data: documents } = useCollection(documentsQuery);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatHistory]);

  const handleAskConcierge = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatQuery.trim() || !property) return;

    const queryText = chatQuery.trim();
    setChatQuery("");
    setChatHistory(prev => [...prev, { role: 'user', text: queryText }]);
    setIsChatting(true);

    try {
      const response = await tenantConcierge({
        query: queryText,
        propertyContext: `Property: ${property.addressLine1}. Specs: ${property.numberOfBedrooms} Bed, ${property.numberOfBathrooms} Bath. Description: ${property.description}.`
      });
      setChatHistory(prev => [...prev, { role: 'bot', text: response.answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "I'm having trouble connecting to the property engine. Please try again." }]);
    } finally {
      setIsChatting(false);
    }
  };

  if (isPropLoading || isRequestsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
        </div>
        <p className="text-muted-foreground font-bold font-headline uppercase tracking-[0.3em] text-[10px]">Authorizing Access</p>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-center space-y-8 animate-in fade-in zoom-in duration-700">
        <div className="p-10 bg-primary/5 rounded-[3rem] shadow-inner relative">
          <div className="absolute inset-0 bg-primary/5 rounded-[3rem] blur-2xl animate-pulse" />
          <Home className="w-20 h-20 text-primary/20 relative z-10" />
        </div>
        <div className="space-y-3">
          <h2 className="text-3xl font-bold font-headline text-primary">Lease Registration Pending</h2>
          <p className="text-muted-foreground max-w-sm mx-auto font-medium font-body leading-relaxed">Your professional resident account is active. Please contact your landlord to link your current tenancy.</p>
        </div>
        <Button variant="outline" className="rounded-2xl h-12 px-10 font-bold border-primary/20" asChild>
          <Link href="/tenant/messages">Contact Management</Link>
        </Button>
      </div>
    );
  }

  const bridgeUrl = getMemoryAsset(property.id);
  const dbUrl = property.imageUrl;
  const isDbUrlValid = dbUrl && !dbUrl.startsWith('blob:');
  const activeImageUrl = bridgeUrl || (isDbUrlValid ? dbUrl : `https://picsum.photos/seed/rentalflow-pro-identity/800/600`);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-12">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 text-left">
        <div>
          <h1 className="text-4xl font-headline font-bold text-primary mb-2 tracking-tight">Resident Portal</h1>
          <p className="text-muted-foreground font-medium font-body">Welcome home to {property.addressLine1.split(',')[0]}</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
           <Button variant="outline" className="rounded-2xl font-bold h-12 border-primary/10 hover:bg-white shadow-sm flex-1 md:flex-none" asChild>
             <Link href="/tenant/messages">Direct Message</Link>
           </Button>
           <Button className="bg-accent hover:bg-accent/90 rounded-2xl shadow-xl shadow-accent/20 font-bold h-12 flex-1 md:flex-none" asChild>
             <Link href="/tenant/maintenance"><AlertCircle className="w-4 h-4 mr-2" /> Report Repair</Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden rounded-[2.5rem] bg-white group">
            <div className="relative h-[450px] w-full bg-muted overflow-hidden">
              <Image src={activeImageUrl} alt={property.addressLine1} fill className="object-cover transition-transform duration-1000 group-hover:scale-105" unoptimized={true} />
              <div className="absolute inset-0 bg-gradient-to-t from-primary via-primary/20 to-transparent opacity-90" />
              <div className="absolute bottom-10 left-10 text-white text-left space-y-4 max-w-2xl">
                <div className="flex items-center gap-3">
                  <Badge className="bg-emerald-500 text-white border-none font-bold uppercase tracking-[0.2em] text-[10px] py-1.5 px-4 rounded-full shadow-lg">Active Tenancy</Badge>
                  <Badge variant="outline" className="text-white border-white/40 font-bold text-[10px] py-1.5 px-4 rounded-full backdrop-blur-md uppercase tracking-[0.1em]">{property.numberOfBedrooms} BED / {property.numberOfBathrooms} BATH</Badge>
                </div>
                <div className="space-y-1">
                  <h2 className="text-5xl font-headline font-bold leading-tight">{property.addressLine1}</h2>
                  <p className="flex items-center text-lg opacity-80 font-medium"><MapPin className="w-5 h-5 mr-2 text-accent" /> {property.city}, {property.zipCode}</p>
                </div>
              </div>
            </div>
            <CardContent className="pt-10 text-left p-10 space-y-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                <div className="space-y-4">
                  <h3 className="font-bold font-headline text-xl text-primary border-b border-primary/5 pb-3">Property Narrative</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-body font-medium">{property.description || "A premium managed property under RentalFlow professional guidelines."}</p>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold font-headline text-xl text-primary flex items-center border-b border-primary/5 pb-3">
                    <ShieldCheck className="w-5 h-5 mr-3 text-accent" /> 
                    Resident Safety
                  </h3>
                  <div className="p-6 bg-primary/[0.02] rounded-[1.75rem] border border-primary/5 space-y-4 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 transition-opacity group-hover:opacity-20">
                      <ShieldAlert className="w-12 h-12" />
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-1">Authorized Support</p>
                      <p className="text-sm font-bold font-headline text-primary">24/7 Professional Line</p>
                    </div>
                    <Button variant="accent" className="w-full rounded-2xl h-11 font-bold shadow-lg shadow-accent/10" asChild>
                      <Link href="/tenant/emergency-contacts">Access Safety Directory</Link>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden flex flex-col h-[550px]">
            <CardHeader className="bg-primary p-8 text-white relative">
              <div className="absolute top-0 right-0 p-10 opacity-10 rotate-12">
                <Bot className="w-24 h-24" />
              </div>
              <div className="relative z-10 flex items-center gap-4">
                <div className="h-12 w-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                  <Sparkles className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <CardTitle className="text-2xl font-headline font-bold">Property Assistant</CardTitle>
                  <CardDescription className="text-white/70 font-medium">Instant guidance on your home and local area.</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0">
              <div className="flex-1 overflow-y-auto p-8 space-y-6 no-scrollbar" ref={scrollRef}>
                {chatHistory.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40 py-20">
                    <Bot className="w-12 h-12 text-primary" />
                    <p className="text-sm font-bold font-headline text-primary">Ask me about your boiler, appliance guides, or parking rules.</p>
                  </div>
                ) : (
                  chatHistory.map((msg, i) => (
                    <div key={i} className={cn("flex flex-col max-w-[85%]", msg.role === 'user' ? "ml-auto items-end" : "items-start")}>
                      <div className={cn(
                        "p-5 rounded-[1.75rem] text-sm font-bold leading-relaxed shadow-sm",
                        msg.role === 'user' ? "bg-primary text-white rounded-tr-none" : "bg-muted text-primary rounded-tl-none"
                      )}>
                        {msg.text}
                      </div>
                    </div>
                  ))
                )}
                {isChatting && (
                  <div className="flex gap-2 items-center text-primary/40 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Assistant Thinking...</span>
                  </div>
                )}
              </div>
              <div className="p-8 bg-muted/30 border-t border-primary/5">
                <form onSubmit={handleAskConcierge} className="flex gap-4">
                  <Input 
                    value={chatQuery}
                    onChange={(e) => setChatQuery(e.target.value)}
                    placeholder="e.g. How do I reset the thermostat?"
                    className="h-14 rounded-2xl bg-white border-none shadow-inner px-6 text-base"
                    disabled={isChatting}
                  />
                  <Button type="submit" size="icon" className="h-14 w-14 rounded-2xl shadow-xl shadow-primary/20 bg-primary" disabled={isChatting || !chatQuery.trim()}>
                    <Send className="w-5 h-5 text-white" />
                  </Button>
                </form>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-8">
           <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
             <CardHeader className="p-8 pb-4 border-b border-primary/5 text-left">
               <CardTitle className="text-lg font-headline flex items-center text-primary">
                 <Wrench className="w-5 h-5 mr-3 text-accent" />
                 Active Requests
               </CardTitle>
             </CardHeader>
             <CardContent className="p-8 space-y-4">
               {activeRequests.length > 0 ? (
                 activeRequests.map(req => (
                   <Link key={req.id} href="/tenant/maintenance" className="block group">
                     <div className="p-4 bg-muted/20 rounded-2xl border border-primary/5 hover:bg-white hover:shadow-md transition-all">
                       <div className="flex justify-between items-start mb-2">
                         <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-widest text-primary border-primary/10">{req.status}</Badge>
                         <Clock className="w-3.5 h-3.5 text-muted-foreground opacity-50" />
                       </div>
                       <p className="text-sm font-bold font-headline text-primary group-hover:text-accent transition-colors">{req.title}</p>
                     </div>
                   </Link>
                 ))
               ) : (
                 <div className="text-center py-10 opacity-30">
                   <CheckCircle2 className="w-10 h-10 mx-auto mb-3" />
                   <p className="text-[10px] font-bold uppercase tracking-widest">No repairs logged</p>
                 </div>
               )}
               <Button variant="ghost" className="w-full rounded-xl text-xs font-bold text-muted-foreground hover:text-primary transition-all" asChild>
                 <Link href="/tenant/maintenance">View All History <ChevronRight className="w-3 h-3 ml-2" /></Link>
               </Button>
             </CardContent>
           </Card>

           <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden">
             <CardHeader className="p-8 pb-4 border-b border-primary/5 text-left">
               <CardTitle className="text-lg font-headline flex items-center text-primary">
                 <FileText className="w-5 h-5 mr-3 text-accent" />
                 Property Vault
               </CardTitle>
             </CardHeader>
             <CardContent className="p-8 space-y-4">
                {documents && documents.length > 0 ? (
                  documents.slice(0, 3).map(doc => (
                    <div key={doc.id} className="flex items-center justify-between p-3 bg-muted/10 rounded-xl gap-3">
                       <div className="flex items-center gap-3 min-w-0 flex-1">
                         <FileText className="w-4 h-4 text-primary/40 shrink-0" />
                         <span className="text-xs font-bold text-primary truncate">{doc.fileName}</span>
                       </div>
                       <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-white shrink-0" asChild>
                         <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"><Download className="w-3.5 h-3.5" /></a>
                       </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-6">Your shared property documents will appear here.</p>
                )}
                <Button variant="outline" className="w-full rounded-xl border-primary/10 h-11 font-bold text-primary text-xs" asChild>
                  <Link href="/tenant/documents">Full Vault Inventory</Link>
                </Button>
             </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}