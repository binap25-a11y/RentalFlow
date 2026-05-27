"use client";

import { useState, useEffect, useMemo } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  getTenantCollectionQuery 
} from '@/firebase';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Download, Phone, Mail, 
  Wrench, ShieldAlert, RefreshCcw, AlertCircle, ShieldCheck,
  Zap, MessageSquare
} from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * 🆘 National SOS Protocols (UK Fallbacks)
 * Optimized for Light/Dark mode consistency and bank-grade visibility.
 */
const SOS_FALLBACKS = [
  { id: 'f1', name: "Emergency Services", phone: "999 or 112", role: "Primary Emergency", category: 'standard' },
  { id: 'f2', name: "NHS Medical Advice", phone: "111", role: "Medical Advice (24/7)", category: 'standard' },
  { id: 'f3', name: "National Gas Emergency", phone: "0800 111 999", role: "Gas Leaks Only", category: 'standard' },
  { id: 'f4', name: "Police Non-Emergency", phone: "101", role: "Non-Urgent Records", category: 'standard' },
];

export default function TenantEmergencyContactsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const contactsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({
      db,
      collectionName: "emergencyContacts",
      userId: user.uid
    });
  }, [db, user]);

  const { data: contactsData, loading: isLoading } = useCollection(contactsQuery);

  const standardServices = useMemo(() => {
    const list = contactsData?.filter(c => c.category === 'standard') || [];
    return list.length > 0 ? list : SOS_FALLBACKS;
  }, [contactsData]);

  const professionalPartners = useMemo(() => 
    contactsData?.filter(c => !c.category || c.category === 'professional') || [], 
  [contactsData]);

  const downloadPDF = () => {
    if (!isClient) return;
    const pdfDoc = new jsPDF();
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const today = format(new Date(), 'PPP');
    
    pdfDoc.setFillColor(15, 23, 42); 
    pdfDoc.rect(0, 0, pageWidth, 55, 'F');
    pdfDoc.setTextColor(255, 255, 255);
    
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(24);
    pdfDoc.text("TENANCY SAFETY GUIDE", 20, 25);
    
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Official Portfolio Safety Record | Generated: ${today}`, 20, 35);
    
    pdfDoc.setTextColor(0, 0, 0);
    let y = 75;

    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(16);
    pdfDoc.text("1. PRIMARY SOS PROTOCOLS (UK)", 20, y);
    y += 12;
    
    standardServices.forEach(service => {
      if (y > 270) { pdfDoc.addPage(); y = 20; }
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(11);
      pdfDoc.text(service.name.toUpperCase(), 20, y);
      pdfDoc.setTextColor(185, 28, 28);
      pdfDoc.text(`TEL: ${service.phone}`, pageWidth - 20, y, { align: 'right' });
      y += 7;
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(9);
      pdfDoc.setTextColor(100, 100, 100);
      pdfDoc.text(service.role, 20, y);
      pdfDoc.setTextColor(0, 0, 0);
      y += 15;
    });

    y += 10;
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(16);
    pdfDoc.text("2. AUTHORIZED TRADE PARTNERS", 20, y);
    y += 12;

    if (professionalPartners.length > 0) {
      professionalPartners.forEach((contact) => {
        if (y > 250) { pdfDoc.addPage(); y = 20; }
        pdfDoc.setDrawColor(229, 231, 235);
        pdfDoc.line(20, y - 5, pageWidth - 20, y - 5);
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(12);
        pdfDoc.text(contact.name, 20, y);
        pdfDoc.setTextColor(30, 58, 138);
        pdfDoc.text(contact.role.toUpperCase(), pageWidth - 20, y, { align: 'right' });
        y += 8;
        pdfDoc.setTextColor(0, 0, 0);
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.text(`Direct Contact: ${contact.phone}`, 20, y);
        if (contact.email) {
          y += 6;
          pdfDoc.text(`Email Support: ${contact.email}`, 20, y);
        }
        y += 20;
      });
    } else {
       pdfDoc.setFont("helvetica", "italic");
       pdfDoc.setFontSize(10);
       pdfDoc.text("No specific property partners assigned yet. Standard UK protocols apply.", 20, y);
    }

    pdfDoc.save(`Safety_Guide_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (!isClient) return null;

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto text-left pb-24 bg-background">
      <div className="space-y-6 text-left">
        <div className="space-y-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-5 py-2 rounded-full font-bold uppercase tracking-[0.25em] text-[10px] mb-2">
             <ShieldCheck className="w-4 h-4 mr-2" /> Verified Support Network
          </Badge>
          <h1 className="text-4xl md:text-6xl font-headline font-bold text-foreground tracking-tighter">Support Directory</h1>
          <p className="text-muted-foreground font-medium font-body max-w-3xl leading-relaxed text-xl opacity-70">
            Authorized UK emergency services and property-specific professional partners assigned to your residency identity.
          </p>
        </div>
        
        <Button 
          onClick={downloadPDF} 
          className="rounded-[1.75rem] font-bold h-16 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/20 px-12 transition-all hover:scale-[1.02] border-none font-headline uppercase tracking-[0.3em] text-[11px]"
        >
          <Download className="w-5 h-5 mr-4" /> Download Official Safety Guide
        </Button>
      </div>

      <div className="bg-red-500/5 border border-red-500/10 dark:border-red-500/30 p-12 rounded-[3.5rem] flex flex-col md:flex-row gap-10 items-start md:items-center shadow-inner">
        <div className="p-6 bg-white dark:bg-red-950/40 rounded-[2.5rem] shadow-xl text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 shrink-0 transition-transform hover:scale-105">
           <AlertCircle className="w-12 h-12" />
        </div>
        <div className="space-y-2 text-left">
          <h3 className="font-bold text-3xl text-red-900 dark:text-red-100 font-headline tracking-tight leading-none">Immediate Life Danger</h3>
          <p className="text-lg text-red-800/80 dark:text-red-200/60 font-medium font-body leading-relaxed max-w-4xl">
            If there is immediate danger to life, fire, or evidence of a gas leak, always call <strong className="text-red-600 dark:text-red-400">999</strong> or <strong className="text-red-600 dark:text-red-400">112</strong> immediately. For non-life-threatening property issues, utilize the professional partners below.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
        <div className="lg:col-span-4 space-y-10">
           <Card className="border-none shadow-sm rounded-[3.5rem] overflow-hidden bg-card ring-1 ring-border">
             <CardHeader className="bg-muted/10 border-b border-border p-10 text-left">
               <CardTitle className="text-2xl font-headline font-bold flex items-center gap-5 text-foreground">
                 <ShieldAlert className="w-8 h-8 text-red-500" /> SOS Protocols
               </CardTitle>
               <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.4em] font-headline mt-2 opacity-50">National Emergency Lines</p>
             </CardHeader>
             <CardContent className="pt-12 px-10 pb-12 space-y-12">
                {isLoading ? (
                  <div className="py-20 flex flex-col items-center justify-center gap-6 opacity-40">
                    <RefreshCcw className="w-10 h-10 animate-spin text-primary" />
                    <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-muted-foreground font-headline">Synchronizing Safety Protocols...</span>
                  </div>
                ) : standardServices.map((service, i) => (
                  <div key={service.id || i} className="flex justify-between items-start gap-8 group text-left">
                    <div className="space-y-2 min-w-0">
                      <p className="text-[10px] font-bold text-red-500 dark:text-red-400 uppercase tracking-[0.3em] font-headline">{service.role}</p>
                      <p className="text-xl font-bold leading-tight text-foreground font-headline group-hover:text-accent transition-colors">{service.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                       <p className="text-2xl font-bold text-foreground bg-muted/30 dark:bg-white/5 px-6 py-3 rounded-2xl border border-border dark:border-white/10 shadow-sm font-headline tracking-tighter transition-all group-hover:bg-accent group-hover:text-white group-hover:border-transparent">
                         {service.phone}
                       </p>
                    </div>
                  </div>
                ))}
             </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
             {isLoading ? (
               <div className="col-span-full py-40 flex flex-col items-center justify-center gap-6 opacity-40">
                  <RefreshCcw className="w-16 h-16 animate-pulse text-primary" />
                  <p className="text-[11px] font-bold uppercase tracking-[0.5em] text-muted-foreground font-headline">Synchronizing Real-Time Ledger...</p>
               </div>
             ) : professionalPartners.length === 0 ? (
               <Card className="col-span-full border-2 border-dashed py-40 flex flex-col items-center justify-center bg-muted/5 rounded-[4rem] ring-1 ring-border/10 shadow-inner">
                 <div className="p-10 bg-muted rounded-[3rem] mb-10"><Zap className="w-20 h-20 text-primary/10 animate-pulse" /></div>
                 <h3 className="text-3xl font-bold font-headline text-primary/40 uppercase tracking-[0.4em] text-center">No assigned partners</h3>
                 <p className="text-lg text-muted-foreground font-medium mt-4 text-center max-w-sm mb-10 opacity-70">Authorized contractors for your asset will appear here the moment management verifies them.</p>
                 <Button variant="outline" asChild className="rounded-2xl font-bold h-16 px-12 border-primary/20 hover:bg-primary/5 transition-all text-primary uppercase tracking-[0.2em] text-[10px] font-headline">
                    <Link href="/tenant/messages"><MessageSquare className="w-5 h-5 mr-4" /> Inquire with Management</Link>
                 </Button>
               </Card>
             ) : (
               professionalPartners.map((contact) => (
                 <Card key={contact.id} className="border-none shadow-sm hover:shadow-2xl transition-all duration-700 rounded-[3.5rem] group overflow-hidden bg-card border border-transparent hover:border-accent/10 ring-1 ring-border">
                   <CardHeader className="pb-4 bg-accent/5 p-12 text-left">
                     <div className="flex justify-between items-start mb-8">
                       <div className="p-6 bg-white dark:bg-muted rounded-2xl shadow-xl text-accent border border-accent/10 transition-transform group-hover:scale-110 duration-700">
                         <Wrench className="w-10 h-10" />
                       </div>
                       <Badge variant="outline" className="border-accent/30 text-accent uppercase text-[10px] font-bold px-6 py-2 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-md font-headline tracking-widest">
                         Verified Pro
                       </Badge>
                     </div>
                     <CardTitle className="text-3xl font-bold font-headline text-foreground tracking-tighter group-hover:text-accent transition-colors">{contact.name}</CardTitle>
                     <p className="text-[11px] font-bold text-accent uppercase tracking-[0.4em] mt-3 font-headline opacity-80">
                       {contact.role}
                     </p>
                   </CardHeader>
                   <CardContent className="pt-12 px-12 pb-2 space-y-10 text-left">
                     <div className="space-y-2 text-left">
                        <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-[0.4em] font-headline opacity-40">Direct Support Line</p>
                        <div className="flex items-center gap-5 text-4xl font-bold text-foreground font-headline tracking-tighter">
                          {contact.phone}
                        </div>
                     </div>
                     {contact.email && (
                       <div className="flex items-center gap-5 text-base font-bold text-muted-foreground pt-8 border-t border-border/50 font-body">
                         <Mail className="w-6 h-6 text-accent/30" />
                         {contact.email}
                       </div>
                     )}
                   </CardContent>
                   <CardFooter className="bg-accent/5 border-t border-border/50 py-10 px-12">
                      <Button className="w-full h-20 rounded-[2rem] font-bold bg-accent hover:bg-accent/90 text-white shadow-2xl shadow-accent/20 transition-all hover:scale-[1.02] border-none font-headline uppercase tracking-[0.3em] text-[12px]" asChild>
                        <a href={`tel:${contact.phone}`}>Initiate Connection</a>
                      </Button>
                   </CardFooter>
                 </Card>
               ))
             )}
           </div>
        </div>
      </div>
    </div>
  );
}
