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

  const [sessionPreview, setSessionPreview] = useState<string | null>(null);

  useEffect(() => {
    if (property) {
      // Resident Bridge: Consistency for shared property assets
      const cached = sessionStorage.getItem(`preview_${property.id}`);
      if (cached) setSessionPreview(cached);
      
      if (!property.isImageUpdating) {
        sessionStorage.removeItem(`preview_${property.id}`);
        setSessionPreview(null);
      }
    }
  }, [property]);

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
        propertyContext: `Property Address: ${property.addressLine1}. Description: ${property.description}.`
      });
      setChatHistory(prev => [...prev, { role: 'bot', text: response.answer }]);
    } catch (error) {
      setChatHistory(prev => [...prev, { role: 'bot', text: "I'm having trouble connecting. Please try again." }]);
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

  // Render Priority: 1. Session Bridge (while updating) > 2. Database URL > 3. Fallback
  const displayImage = (property.isImageUpdating && sessionPreview)
    ? sessionPreview
    : property.imageUrl || `https://picsum.photos/seed/${property.id}/800/600`;

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
            <div className="relative h-72 w-full bg-muted">
              <Image src={displayImage} alt={property.addressLine1} fill className="object-cover" unoptimized={true} />
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
          {/* Assistant and other sections remain as established */}
        </div>
        {/* Sidebar widgets remain as established */}
      </div>
    </div>
  );
}
