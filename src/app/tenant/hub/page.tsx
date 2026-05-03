
"use client";

import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, getTenantCollectionQuery, addDocumentNonBlocking } from "@/firebase";
import { doc, collection, serverTimestamp, query, where, orderBy, limit } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  MapPin, Phone, FileText, Download, AlertCircle, Wrench, 
  ShieldAlert, Loader2, Home, Sparkles, Send, User, Bot
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { format, isValid } from "date-fns";
import { useMemo, useState, useEffect, useRef } from "react";
import { tenantConcierge } from "@/ai/flows/tenant-concierge-flow";

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
        propertyContext: `Property Address: ${property.addressLine1}. Description: ${property.description}. Asset Type: ${property.propertyType}. Bedrooms: ${property.numberOfBedrooms}.`
      });
      setChatHistory(prev => [...prev, { role: 'bot', text: response.answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "I'm having trouble connecting. Please try again or contact your landlord." }]);
    } finally {
      setIsChatting(false);
    }
  };

  if (isPropLoading || isRequestsLoading) {
    return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center space-y-4">
        <div className="p-6 bg-muted rounded-full"><Home className="w-12 h-12 text-muted-foreground" /></div>
        <h2 className="text-2xl font-bold font-headline">Account Activation Pending</h2>
        <p className="text-muted-foreground max-w-md font-medium font-body">Contact your landlord to link your account to your new home.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-1 tracking-tight">Resident Dashboard</h1>
          <p className="text-muted-foreground font-medium font-body">Welcome to {property.addressLine1.split(',')[0]}</p>
        </div>
        <div className="flex gap-3">
           <Button variant="outline" className="rounded-xl font-bold" asChild>
             <Link href="/tenant/messages">Message Landlord</Link>
           </Button>
           <Button className="bg-accent hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/20 font-bold" asChild>
             <Link href="/tenant/maintenance"><AlertCircle className="w-4 h-4 mr-2" /> Maintenance</Link>
           </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden rounded-3xl">
            <div className="relative h-72 w-full">
              <Image src={property.imageUrl || "https://picsum.photos/seed/home/800/600"} alt={property.addressLine1} fill className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
              <div className="absolute bottom-6 left-6 text-white text-left">
                <Badge className="bg-emerald-500 mb-3 font-bold uppercase tracking-widest text-[10px]">Active Lease</Badge>
                <h2 className="text-3xl font-headline font-bold mb-1">{property.addressLine1}</h2>
                <p className="flex items-center text-sm opacity-90"><MapPin className="w-4 h-4 mr-1" /> {property.city}, {property.zipCode}</p>
              </div>
            </div>
            <CardContent className="pt-8 text-left space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="space-y-4">
                  <h3 className="font-bold font-headline text-lg">Property Details</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed font-body">{property.description}</p>
                </div>
                <div className="space-y-4">
                  <h3 className="font-bold font-headline text-lg flex items-center"><ShieldAlert className="w-5 h-5 mr-2 text-primary" /> Management Hub</h3>
                  <div className="p-4 bg-muted/40 rounded-2xl border border-muted space-y-3">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Emergency Services</p>
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-bold font-body">24/7 Support Line</span>
                       <Button size="sm" variant="outline" className="rounded-xl h-8 text-[10px]" asChild><a href="tel:0800000000"><Phone className="w-3 h-3 mr-2" /> CALL</a></Button>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-lg rounded-3xl overflow-hidden flex flex-col h-[500px]">
             <CardHeader className="bg-primary text-white text-left py-4">
                <CardTitle className="text-xl font-headline flex items-center"><Sparkles className="w-5 h-5 mr-2" /> Flow Assistant</CardTitle>
                <CardDescription className="text-white/70 text-xs">Ask me anything about your property or tenancy.</CardDescription>
             </CardHeader>
             <CardContent className="flex-1 flex flex-col p-0">
                <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
                   {chatHistory.length === 0 ? (
                      <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-40">
                         <Bot className="w-12 h-12" />
                         <p className="text-sm font-medium max-w-[200px]">I'm here to help. Ask about bin collection, heating, or local amenities.</p>
                      </div>
                   ) : (
                      chatHistory.map((chat, i) => (
                        <div key={i} className={cn("flex gap-3 max-w-[85%]", chat.role === 'user' ? "ml-auto flex-row-reverse" : "")}>
                           <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0", chat.role === 'user' ? "bg-primary text-white" : "bg-accent text-white")}>
                              {chat.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                           </div>
                           <div className={cn("p-4 rounded-2xl text-sm font-bold leading-relaxed shadow-sm", chat.role === 'user' ? "bg-primary/5 text-primary text-right" : "bg-muted/50 text-left")}>
                              {chat.text}
                           </div>
                        </div>
                      ))
                   )}
                   {isChatting && <div className="flex gap-2 p-2"><Loader2 className="w-4 h-4 animate-spin text-accent" /><span className="text-[10px] font-bold uppercase text-accent">Flow is thinking...</span></div>}
                </div>
                <div className="p-4 border-t bg-white">
                   <form onSubmit={handleAskConcierge} className="flex gap-2">
                      <Input 
                        placeholder="Ask Flow Assistant..." 
                        className="rounded-xl h-12 border-none bg-muted/30 focus-visible:ring-primary shadow-inner"
                        value={chatQuery}
                        onChange={(e) => setChatQuery(e.target.value)}
                        disabled={isChatting}
                      />
                      <Button size="icon" className="h-12 w-12 rounded-xl shadow-lg shadow-primary/20" disabled={isChatting || !chatQuery.trim()}>
                        <Send className="w-5 h-5" />
                      </Button>
                   </form>
                </div>
             </CardContent>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="text-left pb-4 bg-accent/5 border-b border-accent/10">
              <CardTitle className="text-xl font-headline flex items-center justify-between">
                Live Requests
                <Badge className="bg-accent text-white font-bold">{activeRequests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              {activeRequests.length > 0 ? (
                activeRequests.map(req => (
                  <div key={req.id} className="p-4 rounded-2xl bg-muted/30 border border-muted text-left hover:bg-muted/50 transition-colors cursor-pointer group">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="capitalize text-[10px] font-bold border-accent/20 text-accent">
                        {req.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground font-bold">{req.createdAt ? format(new Date(req.createdAt.seconds * 1000), 'PP') : 'Recently'}</span>
                    </div>
                    <p className="text-sm font-bold text-primary group-hover:underline underline-offset-4">{req.title || req.description}</p>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center bg-emerald-50 rounded-2xl border border-emerald-100">
                   <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                   <p className="text-xs font-bold text-emerald-600 uppercase">Home is Optimized</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
            <CardHeader className="text-left pb-4 bg-primary/5 border-b border-primary/10">
              <CardTitle className="text-xl font-headline">Resident Vault</CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-3">
              {documents?.slice(0, 4).map(docItem => (
                <div key={docItem.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-xl group cursor-pointer border border-transparent hover:border-muted">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mr-3 group-hover:bg-blue-100 transition-colors">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-bold truncate max-w-[140px] font-body">{docItem.fileName}</p>
                      <p className="text-[10px] text-muted-foreground font-headline font-bold">{docItem.documentType}</p>
                    </div>
                  </div>
                  <a href={docItem.fileUrl} target="_blank" rel="noopener noreferrer">
                    <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </a>
                </div>
              ))}
              <Button variant="ghost" className="w-full text-xs text-primary font-bold hover:bg-primary/5 mt-2" asChild>
                <Link href="/tenant/documents">View Full Vault</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
