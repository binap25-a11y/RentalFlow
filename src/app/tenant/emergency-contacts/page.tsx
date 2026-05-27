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
  PhoneCall, Download, Phone, Mail, 
  Wrench, ShieldAlert, Loader2, AlertCircle, ShieldCheck,
  Zap, RefreshCcw, ChevronRight, MessageSquare
} from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import Link from "next/link";

/**
 * 🆘 National SOS Protocols (UK Fallbacks)
 * Proactively displayed by default if landlord ledger is empty.
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
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto text-left pb-16">
      <div className="space-y-6 text-left">
        <div className="space-y-2">
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1.5 rounded-full font-bold uppercase tracking-[0.2em] text-[9px] mb-2">
             <ShieldCheck className="w-3.5 h-3.5 mr-2" /> Verified Support Network
          </Badge>
          <h1 className="text-4xl font-headline font-bold text-foreground tracking-tight">Support Directory</h1>
          <p className="text-muted-foreground font-medium font-body max-w-3xl leading-relaxed text-lg">
            Authorized UK services and property-specific professional partners assigned to your residency.
          </p>
        </div>
        
        <Button 
          onClick={downloadPDF} 
          className="rounded-2xl font-bold h-14 bg-primary hover:bg-primary/90 text-primary-foreground shadow-2xl shadow-primary/20 px-10 transition-all hover:scale-[1.02] border-none font-headline uppercase tracking-widest text-xs"
        >
          <Download className="w-5 h-5 mr-3" /> Download Official Safety Guide
        </Button>
      </div>

      {/* EMERGENCY ALERT - Optimised for high readability in both modes */}
      <div className="bg-red-500/5 border border-red-500/10 p-10 rounded-[3rem] flex flex-col md:flex-row gap-8 items-start md:items-center shadow-inner">
        <div className="p-5 bg-white dark:bg-red-950/40 rounded-[2rem] shadow-xl text-red-600 dark:text-red-400 border border-red-100 dark:border-red-900/40 shrink-0">
           <AlertCircle className="w-10 h-10" />
        </div>
        <div className="space-y-2 text-left">
          <h3 className="font-bold text-2xl text-red-900 dark:text-red-100 font-headline tracking-tight">Immediate Life Danger</h3>
          <p className="text-base text-red-800/80 dark:text-red-200/60 font-medium font-body leading-relaxed max-w-4xl">
            If there is immediate danger to life, fire, or evidence of a gas leak, always call <strong>999</strong> or <strong>112</strong> immediately. For non-life-threatening property issues, utilize the professional partners listed below.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 space-y-8">
           <Card className="border-none shadow-sm rounded-[3rem] overflow-hidden bg-card ring-1 ring-border">
             <CardHeader className="bg-primary p-8 text-primary-foreground text-left">
               <CardTitle className="text-xl font-headline font-bold flex items-center gap-4">
                 <ShieldAlert className="w-8 h-8 text-accent" /> SOS Protocols
               </CardTitle>
               <p className="text-xs opacity-70 font-bold uppercase tracking-widest font-headline">National Emergency Lines</p>
             </CardHeader>
             <CardContent className="pt-10 px-8 pb-10 space-y-10">
                {isLoading ? (
                  <div className="py-12 flex flex-col items-center justify-center gap-4">
                    <RefreshCcw className="w-8 h-8 animate-spin text-primary opacity-20" />
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-headline">Synchronizing Safety Protocols...</span>
                  </div>
                ) : standardServices.map((service, i) => (
                  <div key={service.id || i} className="flex justify-between items-start gap-6 group">
                    <div className="space-y-2 min-w-0 text-left">
                      <p className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-widest font-headline">{service.role}</p>
                      <p className="text-lg font-bold leading-tight text-foreground font-headline group-hover:text-accent transition-colors">{service.name}</p>
                    </div>
                    <div className="text-right shrink-0">
                       <p className="text-xl font-bold text-foreground bg-muted/40 dark:bg-white/5 px-5 py-2.5 rounded-2xl border border-border dark:border-white/10 shadow-sm font-headline tracking-tight">
                         {service.phone}
                       </p>
                    </div>
                  </div>
                ))}
             </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-8">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
             {isLoading ? (
               <div className="col-span-full py-32 flex flex-col items-center justify-center gap-4 opacity-40">
                  <RefreshCcw className="w-12 h-12 animate-pulse text-primary" />
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] font-headline">Synchronizing Real-Time Ledger...</p>
               </div>
             ) : professionalPartners.length === 0 ? (
               <Card className="col-span-full border-2 border-dashed py-32 flex flex-col items-center justify-center bg-muted/5 rounded-[3rem] ring-1 ring-border/10">
                 <div className="p-8 bg-muted rounded-[2.5rem] mb-8"><Zap className="w-16 h-16 text-primary/10" /></div>
                 <h3 className="text-2xl font-bold font-headline text-primary/40 uppercase tracking-widest text-center">No property partners assigned</h3>
                 <p className="text-sm text-muted-foreground font-medium mt-3 text-center max-w-sm mb-8">Authorized contractors for your asset will appear here in real-time as management confirms them.</p>
                 <Button variant="outline" asChild className="rounded-xl font-bold h-12 border-primary/20 hover:bg-primary/5 transition-all text-primary">
                    <Link href="/tenant/messages"><MessageSquare className="w-4 h-4 mr-2" /> Inquire with Management</Link>
                 </Button>
               </Card>
             ) : (
               professionalPartners.map((contact) => (
                 <Card key={contact.id} className="border-none shadow-sm hover:shadow-2xl transition-all duration-500 rounded-[3rem] group overflow-hidden bg-card border border-transparent hover:border-accent/10 ring-1 ring-border">
                   <CardHeader className="pb-4 bg-accent/5 p-10 text-left">
                     <div className="flex justify-between items-start mb-6">
                       <div className="p-5 bg-white dark:bg-muted rounded-2xl shadow-xl text-accent border border-accent/10 transition-transform group-hover:scale-110 duration-500">
                         <Wrench className="w-8 h-8" />
                       </div>
                       <Badge variant="outline" className="border-accent/30 text-accent uppercase text-[10px] font-bold px-5 py-1.5 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-sm">
                         Verified Pro
                       </Badge>
                     </div>
                     <CardTitle className="text-2xl font-bold font-headline text-foreground tracking-tight group-hover:text-accent transition-colors">{contact.name}</CardTitle>
                     <p className="text-xs font-bold text-accent uppercase tracking-[0.25em] mt-2 font-headline opacity-70">
                       {contact.role}
                     </p>
                   </CardHeader>
                   <CardContent className="pt-10 px-10 pb-2 space-y-8 text-left">
                     <div className="space-y-1 text-left">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest font-headline opacity-40">Direct Support Line</p>
                        <div className="flex items-center gap-4 text-3xl font-bold text-foreground font-headline tracking-tighter">
                          <Phone className="w-8 h-8 text-accent/20" />
                          {contact.phone}
                        </div>
                     </div>
                     {contact.email && (
                       <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground pt-6 border-t border-border">
                         <Mail className="w-5 h-5 text-accent/30" />
                         {contact.email}
                       </div>
                     )}
                   </CardContent>
                   <CardFooter className="bg-accent/5 border-t border-border/50 py-8 px-10">
                      <Button className="w-full rounded-2xl font-bold h-16 bg-accent hover:bg-accent/90 text-white shadow-2xl shadow-accent/20 transition-all hover:scale-[1.02] border-none font-headline uppercase tracking-widest text-[11px]" asChild>
                        <a href={`tel:${contact.phone}`}>Initiate Professional Connection</a>
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
