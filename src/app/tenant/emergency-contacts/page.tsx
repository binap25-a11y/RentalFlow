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
  PhoneCall, Download, Phone, Mail, Building2, 
  Wrench, ShieldAlert, Loader2, AlertCircle, ShieldCheck, Zap 
} from "lucide-react";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

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

  const { data: contacts, loading: isLoading } = useCollection(contactsQuery);

  const standardServices = useMemo(() => contacts?.filter(c => c.category === 'standard') || [], [contacts]);
  const professionalPartners = useMemo(() => contacts?.filter(c => !c.category || c.category === 'professional') || [], [contacts]);

  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = format(new Date(), 'PPP');
    
    // Header Style
    doc.setFillColor(30, 58, 138); // Primary Navy
    doc.rect(0, 0, pageWidth, 45, 'F');
    doc.setTextColor(255, 255, 255);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(22);
    doc.text("TENANCY SAFETY GUIDE", 20, 25);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.text(`Official Support Directory | Generated: ${today}`, 20, 35);
    
    doc.setTextColor(0, 0, 0);
    let y = 65;

    // 1. SOS Protocols
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("1. EMERGENCY SOS PROTOCOLS", 20, y);
    y += 12;
    
    standardServices.forEach(service => {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.text(service.name.toUpperCase(), 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(`TEL: ${service.phone}`, pageWidth - 20, y, { align: 'right' });
      y += 8;
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(service.role, 20, y);
      doc.setTextColor(0, 0, 0);
      y += 12;
    });

    y += 10;

    // 2. Property Specific Partners
    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.text("2. AUTHORIZED PROPERTY PARTNERS", 20, y);
    y += 12;

    if (professionalPartners.length > 0) {
      professionalPartners.forEach((contact) => {
        if (y > 250) { doc.addPage(); y = 20; }
        
        doc.setDrawColor(229, 231, 235);
        doc.line(20, y - 5, pageWidth - 20, y - 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(contact.name, 20, y);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(contact.role.toUpperCase(), pageWidth - 20, y, { align: 'right' });
        
        y += 8;
        doc.text(`Emergency Number: ${contact.phone}`, 20, y);
        if (contact.email) {
          y += 6;
          doc.text(`Direct Mail: ${contact.email}`, 20, y);
        }
        y += 15;
      });
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text("No specific property partners have been assigned to this registry.", 20, y);
    }

    doc.save(`Safety_Guide_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (!isClient || isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto text-left pb-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Support Directory</h1>
          <p className="text-muted-foreground font-medium font-body">Authorized UK services and property-specific support provided by your landlord.</p>
        </div>
        
        <Button 
          variant="outline" 
          onClick={downloadPDF} 
          className="rounded-xl font-bold h-12 border-primary/20 bg-background shadow-lg shadow-primary/5 px-8 hover:bg-primary/5 transition-all"
        >
          <Download className="w-4 h-4 mr-2 text-primary" /> Download Safety Guide
        </Button>
      </div>

      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-100 dark:border-amber-900/20 p-8 rounded-[2.5rem] flex gap-5 items-start shadow-inner">
        <div className="p-3 bg-white dark:bg-amber-950 rounded-2xl shadow-sm border border-amber-100">
           <AlertCircle className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h3 className="font-bold text-lg text-amber-900 dark:text-amber-100 font-headline">Immediate Life Danger</h3>
          <p className="text-sm text-amber-800 dark:text-amber-200 font-medium font-body mt-1 leading-relaxed">
            If there is immediate danger to life, fire, or gas leaks, always call <strong>999</strong> or <strong>112</strong> immediately. For non-life-threatening property issues, utilize the authorized directory below.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="space-y-6">
           <Card className="border-none shadow-sm rounded-3xl overflow-hidden bg-card ring-1 ring-border">
             <CardHeader className="bg-primary text-primary-foreground p-6">
               <CardTitle className="text-lg font-headline flex items-center gap-3">
                 <ShieldCheck className="w-6 h-6 text-accent" /> SOS Protocols
               </CardTitle>
             </CardHeader>
             <CardContent className="pt-8 space-y-6">
                {standardServices.length > 0 ? (
                  standardServices.map((service, i) => (
                    <div key={i} className="flex justify-between items-start gap-4 border-b border-muted pb-4 last:border-0">
                      <div className="space-y-1 min-w-0">
                        <p className="text-[10px] font-bold text-red-600 uppercase tracking-widest">{service.role}</p>
                        <p className="text-sm font-bold leading-tight break-words text-foreground font-headline">{service.name}</p>
                      </div>
                      <p className="text-sm font-bold text-primary whitespace-nowrap bg-primary/5 px-3 py-1 rounded-lg border border-primary/10">{service.phone}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-10 opacity-30">
                    <PhoneCall className="w-10 h-10 mx-auto mb-3" />
                    <p className="text-[10px] font-bold uppercase tracking-widest font-headline">Protocol Pending</p>
                  </div>
                )}
             </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-2">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {professionalPartners.length === 0 ? (
               <Card className="col-span-full border-2 border-dashed py-24 flex flex-col items-center justify-center bg-muted/10 rounded-[3rem]">
                 <PhoneCall className="w-16 h-16 text-primary/10 mb-6" />
                 <h3 className="text-xl font-bold font-headline text-primary/40">No Trade Partners Found</h3>
                 <p className="text-sm text-muted-foreground font-medium mt-2">Authorized professionals assigned to your property will appear here.</p>
               </Card>
             ) : (
               professionalPartners.map((contact) => (
                 <Card key={contact.id} className="border-none shadow-md hover:shadow-xl transition-all rounded-[2.5rem] group overflow-hidden bg-card border border-transparent hover:border-accent/10">
                   <CardHeader className="pb-4 bg-accent/5 p-8">
                     <div className="flex justify-between items-start">
                       <div className="p-4 bg-white rounded-2xl shadow-sm text-accent border border-accent/10">
                         <ShieldAlert className="w-6 h-6" />
                       </div>
                       <Badge variant="outline" className="border-accent/30 text-accent uppercase text-[10px] font-bold px-4 py-1 rounded-full">
                         Verified Pro
                       </Badge>
                     </div>
                     <CardTitle className="text-xl font-bold font-headline mt-6 text-foreground tracking-tight">{contact.name}</CardTitle>
                     <p className="text-xs font-bold text-accent uppercase tracking-[0.2em] mt-1.5 font-headline">
                       {contact.role}
                     </p>
                   </CardHeader>
                   <CardContent className="pt-8 px-8 space-y-6">
                     <div className="flex items-center gap-4 text-2xl font-bold text-primary font-headline">
                       <Phone className="w-6 h-6 text-accent/30" />
                       {contact.phone}
                     </div>
                     {contact.email && (
                       <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground pt-4 border-t border-muted">
                         <Mail className="w-5 h-5 text-accent/30" />
                         {contact.email}
                       </div>
                     )}
                   </CardContent>
                   <CardFooter className="bg-accent/5 border-t py-6 px-8">
                      <Button className="w-full rounded-2xl font-bold h-14 bg-accent hover:bg-accent/90 text-white shadow-xl shadow-accent/20 transition-all hover:scale-[1.02]" asChild>
                        <a href={`tel:${contact.phone}`}>Initiate Professional Line</a>
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
