
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
    
    doc.setFillColor(139, 114, 218); // Accent color (Violet)
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("TENANCY SAFETY RECORD", 20, 25);
    doc.setFontSize(10);
    doc.text(`Official Resident Emergency Directory | Generated: ${format(new Date(), 'PPP')}`, 20, 32);
    
    doc.setTextColor(0, 0, 0);
    let y = 60;

    // 1. Standard UK Services
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("1. EMERGENCY SERVICES", 20, y);
    y += 10;
    
    standardServices.forEach(service => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(service.name, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(`Tel: ${service.phone}`, pageWidth - 80, y);
      y += 8;
    });

    y += 15;

    // 2. Authorized Property Partners
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("2. AUTHORIZED PROPERTY PARTNERS", 20, y);
    y += 10;

    if (professionalPartners.length > 0) {
      professionalPartners.forEach((contact) => {
        if (y > 260) {
          doc.addPage();
          y = 20;
        }

        doc.setDrawColor(229, 231, 235);
        doc.line(20, y - 5, pageWidth - 20, y - 5);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text(contact.role.toUpperCase(), 20, y);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(10);
        doc.text(`${contact.name}`, 20, y + 7);
        doc.text(`Emergency Tel: ${contact.phone}`, 20, y + 13);
        if (contact.email) doc.text(`Email: ${contact.email}`, 20, y + 19);

        y += 30;
      });
    } else {
      doc.setFont("helvetica", "italic");
      doc.setFontSize(10);
      doc.text("No specific property partners have been assigned yet. Contact your landlord.", 20, y);
    }

    doc.save(`Resident_Safety_Record_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (!isClient || isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto text-left pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Support Directory</h1>
          <p className="text-muted-foreground font-medium font-body">Authorized UK services and property-specific support provided by your landlord.</p>
        </div>
        <Button variant="outline" onClick={downloadPDF} className="rounded-xl font-bold h-11 border-primary/20 bg-white shadow-sm">
          <Download className="w-4 h-4 mr-2" /> Download Safety Guide
        </Button>
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex gap-4 items-start shadow-sm">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-900 font-headline">Immediate Life Danger</h3>
          <p className="text-sm text-amber-800 font-medium font-body mt-1">If there is immediate danger to life or fire, always call 999 first. For non-life-threatening property issues, use the authorized contacts below.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="space-y-6">
           <Card className="border-none shadow-sm rounded-2xl overflow-hidden">
             <CardHeader className="bg-primary text-white">
               <CardTitle className="text-lg font-headline flex items-center gap-2">
                 <ShieldCheck className="w-5 h-5" /> Authorized Services
               </CardTitle>
             </CardHeader>
             <CardContent className="pt-6 space-y-4">
                {standardServices.length > 0 ? (
                  standardServices.map((service, i) => (
                    <div key={i} className="flex justify-between items-start gap-4 border-b border-muted pb-3 last:border-0">
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase truncate">{service.role}</p>
                        <p className="text-sm font-bold leading-tight break-words">{service.name}</p>
                      </div>
                      <p className="text-sm font-bold text-primary whitespace-nowrap">{service.phone}</p>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground text-xs font-medium">
                    No authorized services listed by management.
                  </div>
                )}
             </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-2">
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             {professionalPartners.length === 0 ? (
               <Card className="col-span-full border-2 border-dashed py-24 flex flex-col items-center justify-center bg-muted/10 rounded-[2rem]">
                 <PhoneCall className="w-12 h-12 text-primary/20 mb-4" />
                 <h3 className="text-xl font-bold font-headline text-primary/40">No property partners assigned</h3>
                 <p className="text-sm text-muted-foreground font-medium mt-1">Authorized professionals will appear here.</p>
               </Card>
             ) : (
               professionalPartners.map((contact) => (
                 <Card key={contact.id} className="border-none shadow-md hover:shadow-lg transition-all rounded-2xl group overflow-hidden bg-white border border-transparent hover:border-accent/10">
                   <CardHeader className="pb-4 bg-accent/5">
                     <div className="flex justify-between items-start">
                       <div className="p-3 bg-white rounded-xl shadow-sm text-accent">
                         <ShieldAlert className="w-5 h-5" />
                       </div>
                       <Badge variant="outline" className="border-accent/20 text-accent uppercase text-[10px] font-bold">
                         Authorized
                       </Badge>
                     </div>
                     <CardTitle className="text-lg font-bold font-headline mt-4">{contact.name}</CardTitle>
                     <p className="text-xs font-bold text-accent uppercase tracking-widest mt-1 font-headline">
                       {contact.role}
                     </p>
                   </CardHeader>
                   <CardContent className="pt-6 space-y-4">
                     <div className="flex items-center gap-3 text-xl font-bold text-primary">
                       <Phone className="w-5 h-5 text-accent/40" />
                       {contact.phone}
                     </div>
                     {contact.email && (
                       <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                         <Mail className="w-4 h-4 text-accent/40" />
                         {contact.email}
                       </div>
                     )}
                   </CardContent>
                   <CardFooter className="bg-accent/5 border-t py-4">
                      <Button className="w-full rounded-xl font-bold h-12 bg-accent hover:bg-accent/90 text-white shadow-lg shadow-accent/10" asChild>
                        <a href={`tel:${contact.phone}`}>Call Professional Now</a>
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
