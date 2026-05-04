
"use client";

import { useState, useEffect } from 'react';
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useMemoFirebase, 
  setDocumentNonBlocking, 
  updateDocumentNonBlocking, 
  deleteDocumentNonBlocking, 
  getLandlordCollectionQuery 
} from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { 
  PhoneCall, Plus, Trash2, Edit3, Loader2, Download, 
  Phone, Mail, User, Building2, Wrench, ShieldAlert, AlertCircle, Info 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

const UK_STANDARD_SERVICES = [
  { name: "Emergency Services (Police, Fire, Ambulance)", phone: "999 or 112", role: "Primary Emergency" },
  { name: "Police Non-Emergency", phone: "101", role: "Non-Urgent Police" },
  { name: "NHS Medical Advice (24/7)", phone: "111", role: "Medical Advice" },
  { name: "National Gas Emergency", phone: "0800 111 999", role: "Gas Leaks" },
  { name: "Electricity Emergency", phone: "Contact local DNO", role: "Power Cuts" },
  { name: "Water Emergency", phone: "Contact supplier", role: "Major Leaks" },
];

export default function LandlordEmergencyContactsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: properties } = useCollection(propertiesQuery);

  const contactsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "emergencyContacts", user.uid);
  }, [db, user]);

  const { data: contacts, loading: isLoading } = useCollection(contactsQuery);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const resetForm = () => {
    setName('');
    setRole('');
    setPhone('');
    setEmail('');
    setSelectedPropertyId('');
    setEditingContact(null);
  };

  const handleEdit = (contact: any) => {
    setEditingContact(contact);
    setName(contact.name);
    setRole(contact.role);
    setPhone(contact.phone);
    setEmail(contact.email || '');
    setSelectedPropertyId(contact.propertyId || '');
    setIsDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    const property = properties?.find(p => p.id === selectedPropertyId);
    const memberIds = property?.memberIds || [user.uid];

    if (editingContact) {
      const contactRef = doc(db, 'emergencyContacts', editingContact.id);
      updateDocumentNonBlocking(contactRef, {
        name,
        role,
        phone,
        email,
        propertyId: selectedPropertyId,
        memberIds: memberIds,
        updatedAt: serverTimestamp(),
      });
      toast({ title: "Contact Updated", description: "Portfolio records synchronized." });
    } else {
      const contactId = doc(collection(db, 'emergencyContacts')).id;
      const contactRef = doc(db, 'emergencyContacts', contactId);
      
      setDocumentNonBlocking(contactRef, {
        id: contactId,
        name,
        role,
        phone,
        email,
        landlordId: user.uid,
        propertyId: selectedPropertyId,
        memberIds: memberIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: "Contact Registered", description: "New provider added." });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!db) return;
    const contactRef = doc(db, 'emergencyContacts', id);
    deleteDocumentNonBlocking(contactRef);
    toast({ title: "Contact Removed" });
  };

  const downloadPDF = () => {
    if (!contacts) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Header
    doc.setFillColor(31, 41, 55);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(22);
    doc.text("TENANCY EMERGENCY CONTACTS", 20, 25);
    doc.setFontSize(10);
    doc.text(`Official Portfolio Safety Record | Generated: ${format(new Date(), 'PPP')}`, 20, 32);
    
    doc.setTextColor(0, 0, 0);
    let y = 60;

    // Standard UK Services Section
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("1. STANDARD UK EMERGENCY SERVICES", 20, y);
    y += 10;
    
    UK_STANDARD_SERVICES.forEach(service => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.text(service.name, 20, y);
      doc.setFont("helvetica", "normal");
      doc.text(`Tel: ${service.phone}`, pageWidth - 80, y);
      y += 8;
    });

    y += 15;

    // Custom Professional Contacts
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.text("2. PROPERTY-SPECIFIC CONTACTS", 20, y);
    y += 10;

    contacts.forEach((contact) => {
      const propName = properties?.find(p => p.id === contact.propertyId)?.addressLine1 || "General Portfolio";
      
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
      doc.text(`Tel: ${contact.phone}`, 20, y + 13);
      if (contact.email) doc.text(`Email: ${contact.email}`, 20, y + 19);

      doc.setFontSize(9);
      doc.setTextColor(107, 114, 128);
      doc.text(`Property: ${propName}`, pageWidth - 80, y);
      
      doc.setTextColor(0, 0, 0);
      y += 30;
    });

    doc.save(`Emergency_Contacts_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

  if (!isClient || isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Emergency Contacts</h1>
          <p className="text-muted-foreground font-medium font-body">Manage standard UK services and professional property partners.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={downloadPDF} className="rounded-xl font-bold h-11 border-primary/20">
            <Download className="w-4 h-4 mr-2" /> Export Portfolio List
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold shadow-lg shadow-primary/20 text-white">
                <Plus className="w-4 h-4 mr-2" /> Add Partner
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl">
              <form onSubmit={handleSave}>
                <DialogHeader className="text-left">
                  <DialogTitle className="text-xl font-bold font-headline text-primary">{editingContact ? "Edit Partner" : "New Professional Partner"}</DialogTitle>
                  <DialogDescription className="font-medium text-muted-foreground">Register a professional for priority property maintenance.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-6">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Business Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl h-11 bg-muted/20 border-none" placeholder="e.g. Rapid Plumbing Ltd" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Professional Role</Label>
                    <Input value={role} onChange={(e) => setRole(e.target.value)} required className="rounded-xl h-11 bg-muted/20 border-none" placeholder="e.g. Master Plumber" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Phone</Label>
                      <Input value={phone} onChange={(e) => setPhone(e.target.value)} required className="rounded-xl h-11 bg-muted/20 border-none" placeholder="0800..." />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Email (Optional)</Label>
                      <Input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-11 bg-muted/20 border-none" placeholder="office@..." />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Assign to Property</Label>
                    <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-body" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
                      <option value="">General Portfolio</option>
                      {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                    </select>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg shadow-primary/20 text-white font-headline">
                    {editingContact ? "Save Changes" : "Register Partner"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card className="border-none shadow-sm bg-primary text-white rounded-2xl overflow-hidden">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> UK Standard Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {UK_STANDARD_SERVICES.map((service, i) => (
                <div key={i} className="space-y-1">
                  <p className="text-[10px] font-bold uppercase opacity-60">{service.name}</p>
                  <p className="text-sm font-bold">{service.phone}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!contacts || contacts.length === 0 ? (
              <Card className="col-span-full border-2 border-dashed py-24 flex flex-col items-center justify-center bg-muted/10 rounded-[2rem]">
                <PhoneCall className="w-12 h-12 text-primary/20 mb-4" />
                <h3 className="text-xl font-bold font-headline text-primary/40">No custom partners logged</h3>
              </Card>
            ) : (
              contacts.map((contact) => (
                <Card key={contact.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-2xl group overflow-hidden bg-white border border-transparent hover:border-primary/10">
                  <CardHeader className="pb-4 bg-primary/5">
                    <div className="flex justify-between items-start">
                      <div className="p-3 bg-white rounded-xl shadow-sm text-primary">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-primary/40 hover:text-primary hover:bg-primary/5" onClick={() => handleEdit(contact)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-destructive/40 hover:text-destructive hover:bg-destructive/5" onClick={() => handleDelete(contact.id)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                    <CardTitle className="text-lg font-bold font-headline mt-4">{contact.name}</CardTitle>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-none uppercase text-[10px] font-bold mt-1">
                      {contact.role}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center gap-3 text-sm font-bold text-primary">
                      <Phone className="w-4 h-4 text-primary/40" />
                      {contact.phone}
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                        <Mail className="w-4 h-4 text-primary/40" />
                        {contact.email}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground pt-2 border-t border-muted/50">
                      <Building2 className="w-4 h-4 text-primary/40" />
                      {properties?.find(p => p.id === contact.propertyId)?.addressLine1 || "Portfolio General"}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
