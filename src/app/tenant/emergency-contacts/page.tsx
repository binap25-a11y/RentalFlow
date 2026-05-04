
"use client";

import { useState, useEffect } from 'react';
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
  Wrench, ShieldAlert, Loader2, AlertCircle 
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

  const downloadPDF = () => {
    if (!contacts) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    doc.setFillColor(199, 89, 48); // Accent color
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("EMERGENCY CONTACT LIST", 20, 25);
    doc.setFontSize(10);
    doc.text(`Official Resident Safety Record | Generated: ${format(new Date(), 'PPP')}`, 20, 32);
    
    doc.setTextColor(0, 0, 0);
    let y = 60;

    contacts.forEach((contact) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }

      doc.setDrawColor(229, 231, 235);
      doc.line(20, y - 5, pageWidth - 20, y - 5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(contact.role.toUpperCase(), 20, y);
      
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      doc.text(`${contact.name}`, 20, y + 7);
      doc.text(`Emergency Tel: ${contact.phone}`, 20, y + 13);
      if (contact.email) doc.text(`Email: ${contact.email}`, 20, y + 19);

      y += 35;
    });

    doc.save(`Emergency_Contacts_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (!isClient || isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Emergency Contacts</h1>
          <p className="text-muted-foreground font-medium font-body">Essential service providers authorized by your landlord for priority support.</p>
        </div>
        {contacts && contacts.length > 0 && (
          <Button variant="outline" onClick={downloadPDF} className="rounded-xl font-bold h-11 border-primary/20 bg-white">
            <Download className="w-4 h-4 mr-2" /> Download Safety Guide
          </Button>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-100 p-6 rounded-[2rem] flex gap-4 items-start mb-8 shadow-sm">
        <AlertCircle className="w-6 h-6 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <h3 className="font-bold text-amber-900 font-headline">Before calling an emergency provider</h3>
          <p className="text-sm text-amber-800 font-medium font-body mt-1">If there is immediate danger to life or fire, always call 999 first. For non-life-threatening emergencies, use the contacts below authorized for your property.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {!contacts || contacts.length === 0 ? (
          <Card className="col-span-full border-2 border-dashed py-24 flex flex-col items-center justify-center bg-muted/10 rounded-[2rem]">
            <PhoneCall className="w-12 h-12 text-primary/20 mb-4" />
            <h3 className="text-xl font-bold font-headline text-primary/40">No priority contacts listed</h3>
            <p className="text-sm text-muted-foreground font-medium mt-1">Your landlord has not shared emergency providers yet.</p>
          </Card>
        ) : (
          contacts.map((contact) => (
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
                <div className="flex items-center gap-3 text-lg font-bold text-primary">
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
  );
}
