
"use client";

import { useState, useEffect, useMemo } from 'react';
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
  Phone, Mail, User, Building2, Wrench, ShieldAlert, AlertCircle, Info, Zap 
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { format } from "date-fns";

const DEFAULT_UK_SERVICES = [
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
  const [selectedExportPropertyId, setSelectedExportPropertyId] = useState<string>("");

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
  const [category, setCategory] = useState<'standard' | 'professional'>('professional');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const standardServices = useMemo(() => contacts?.filter(c => c.category === 'standard') || [], [contacts]);
  const professionalPartners = useMemo(() => contacts?.filter(c => !c.category || c.category === 'professional') || [], [contacts]);

  const resetForm = () => {
    setName('');
    setRole('');
    setPhone('');
    setEmail('');
    setCategory('professional');
    setSelectedPropertyId('');
    setEditingContact(null);
  };

  const handleEdit = (contact: any) => {
    setEditingContact(contact);
    setName(contact.name);
    setRole(contact.role);
    setPhone(contact.phone);
    setEmail(contact.email || '');
    setCategory(contact.category || 'professional');
    setSelectedPropertyId(contact.propertyId || '');
    setIsDialogOpen(true);
  };

  const handleSeedStandardServices = () => {
    if (!user || !db) return;
    DEFAULT_UK_SERVICES.forEach(service => {
      const contactId = doc(collection(db, 'emergencyContacts')).id;
      const contactRef = doc(db, 'emergencyContacts', contactId);
      setDocumentNonBlocking(contactRef, {
        id: contactId,
        ...service,
        category: 'standard',
        landlordId: user.uid,
        memberIds: [user.uid],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    toast({ title: "Standard Services Imported", description: "Default UK emergency contacts added." });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    const property = properties?.find(p => p.id === selectedPropertyId);
    const memberIds = property?.memberIds ? [...new Set([...property.memberIds, user.uid])] : [user.uid];

    if (editingContact) {
      const contactRef = doc(db, 'emergencyContacts', editingContact.id);
      updateDocumentNonBlocking(contactRef, {
        name,
        role,
        phone,
        email,
        category,
        propertyId: selectedPropertyId || null,
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
        category,
        landlordId: user.uid,
        propertyId: selectedPropertyId || null,
        memberIds: memberIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: "Contact Registered", description: "New provider added to directory." });
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
    const pdfDoc = new jsPDF();
    const pageWidth = pdfDoc.internal.pageSize.getWidth();
    const today = format(new Date(), 'PPp');
    
    // 1. Header Styling (Increased height to accommodate address)
    pdfDoc.setFillColor(31, 41, 55);
    pdfDoc.rect(0, 0, pageWidth, 60, 'F');
    pdfDoc.setTextColor(255, 255, 255);
    
    // 2. Title & Metadata
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(20);
    pdfDoc.text("TENANCY EMERGENCY CONTACTS", 20, 22);
    
    pdfDoc.setFont("helvetica", "normal");
    pdfDoc.setFontSize(10);
    pdfDoc.text(`Official Portfolio Safety Record | Generated: ${format(new Date(), 'PPP')}`, 20, 29);
    
    // 3. Property Address (Positioned clearly below metadata)
    let y = 75; // Starting Y for content
    if (selectedExportPropertyId) {
      const prop = properties?.find(p => p.id === selectedExportPropertyId);
      if (prop) {
        pdfDoc.setFont("helvetica", "bold");
        pdfDoc.setFontSize(12);
        const addrLines = pdfDoc.splitTextToSize(prop.addressLine1.toUpperCase(), pageWidth - 40);
        pdfDoc.text(addrLines, 20, 42);
        
        pdfDoc.setFont("helvetica", "normal");
        pdfDoc.setFontSize(9);
        pdfDoc.text(`${prop.city}, ${prop.zipCode}`, 20, 42 + (addrLines.length * 6));
      }
    } else {
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(11);
      pdfDoc.text("FULL PORTFOLIO DIRECTORY", 20, 42);
    }

    pdfDoc.setTextColor(0, 0, 0);

    // 4. Standard Services Section
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(14);
    pdfDoc.text("1. PRIMARY EMERGENCY SERVICES", 20, y);
    y += 10;
    
    standardServices.forEach(service => {
      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(10);
      pdfDoc.text(service.name, 20, y);
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.text(`Tel: ${service.phone}`, pageWidth - 20, y, { align: 'right' });
      y += 8;
    });

    y += 15;

    // 5. Professional Partners Section
    pdfDoc.setFont("helvetica", "bold");
    pdfDoc.setFontSize(14);
    pdfDoc.text("2. AUTHORIZED PROPERTY PARTNERS", 20, y);
    y += 10;

    const filteredProfessionals = professionalPartners.filter(contact => {
      if (!selectedExportPropertyId) return true;
      return contact.propertyId === selectedExportPropertyId || !contact.propertyId;
    });

    if (filteredProfessionals.length === 0) {
      pdfDoc.setFont("helvetica", "italic");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(107, 114, 128);
      pdfDoc.text("No property-specific professional partners assigned.", 20, y);
    }

    filteredProfessionals.forEach((contact) => {
      if (y > 250) {
        pdfDoc.addPage();
        y = 20;
      }

      pdfDoc.setDrawColor(229, 231, 235);
      pdfDoc.line(20, y - 5, pageWidth - 20, y - 5);

      pdfDoc.setFont("helvetica", "bold");
      pdfDoc.setFontSize(12);
      pdfDoc.setTextColor(31, 41, 55);
      pdfDoc.text(contact.role.toUpperCase(), 20, y);
      
      pdfDoc.setFont("helvetica", "normal");
      pdfDoc.setFontSize(10);
      pdfDoc.setTextColor(0, 0, 0);
      pdfDoc.text(`${contact.name}`, 20, y + 7);
      pdfDoc.text(`Tel: ${contact.phone}`, 20, y + 13);
      if (contact.email) pdfDoc.text(`Email: ${contact.email}`, 20, y + 19);

      if (!selectedExportPropertyId) {
        const propName = properties?.find(p => p.id === contact.propertyId)?.addressLine1 || "Portfolio-Wide";
        pdfDoc.setFontSize(8);
        pdfDoc.setTextColor(107, 114, 128);
        pdfDoc.text(`Assigned: ${propName}`, pageWidth - 20, y, { align: 'right' });
      }
      
      y += 35;
    });

    // 6. Footer Metadata
    const totalPages = pdfDoc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdfDoc.setPage(i);
      pdfDoc.setFontSize(8);
      pdfDoc.setTextColor(156, 163, 175);
      pdfDoc.text(`Generated ${today} | Page ${i} of ${totalPages} | RentalFlow Official Record`, pageWidth / 2, 290, { align: 'center' });
    }

    const fileName = selectedExportPropertyId 
      ? `Emergency_Directory_${properties?.find(p => p.id === selectedExportPropertyId)?.addressLine1.replace(/\s+/g, '_')}.pdf`
      : `Portfolio_Emergency_Directory_${format(new Date(), 'yyyy-MM-dd')}.pdf`;

    pdfDoc.save(fileName);
  };

  if (!isClient || isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto text-left pb-12">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Emergency Hub</h1>
          <p className="text-muted-foreground font-medium font-body">Manage UK standard services and property-specific professional partners.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-white rounded-xl border border-primary/10 px-3 h-11">
             <Label className="text-[10px] font-bold uppercase text-muted-foreground">PDF Export Context:</Label>
             <select 
               className="bg-transparent text-sm font-bold outline-none cursor-pointer"
               value={selectedExportPropertyId}
               onChange={(e) => setSelectedExportPropertyId(e.target.value)}
             >
               <option value="">Full Portfolio</option>
               {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
             </select>
          </div>
          <Button variant="outline" onClick={downloadPDF} className="rounded-xl font-bold h-11 border-primary/20 bg-white shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Export PDF Guide
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold shadow-lg shadow-primary/20 text-white px-6">
                <Plus className="w-4 h-4 mr-2" /> Add Contact
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden">
              <form onSubmit={handleSave}>
                <DialogHeader className="p-8 text-left bg-primary/5 border-b">
                  <DialogTitle className="text-xl font-bold font-headline text-primary">{editingContact ? "Modify Contact" : "New Portfolio Contact"}</DialogTitle>
                  <DialogDescription className="font-medium text-muted-foreground">Register an emergency service or professional partner.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 p-8">
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Contact Category</Label>
                    <div className="flex gap-2">
                      <Button type="button" variant={category === 'standard' ? 'default' : 'outline'} className="flex-1 rounded-xl h-10 font-bold" onClick={() => setCategory('standard')}>UK Standard</Button>
                      <Button type="button" variant={category === 'professional' ? 'default' : 'outline'} className="flex-1 rounded-xl h-10 font-bold" onClick={() => setCategory('professional')}>Professional Partner</Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Business / Service Name</Label>
                    <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl h-11 bg-muted/20 border-none" placeholder="e.g. Rapid Plumbing Ltd" />
                  </div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Designated Role</Label>
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
                  {category === 'professional' && (
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-primary/60 tracking-wider">Assign to Property</Label>
                      <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-body" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)}>
                        <option value="">General Portfolio</option>
                        {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                      </select>
                    </div>
                  )}
                </div>
                <DialogFooter className="p-8 bg-muted/10 border-t">
                  <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg shadow-primary/20 text-white font-headline">
                    {editingContact ? "Save Modifications" : "Register Contact"}
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
            <CardHeader className="pb-4 border-b border-white/10">
              <CardTitle className="text-lg font-headline flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" /> Standard Services
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {standardServices.length > 0 ? (
                standardServices.map((service) => (
                  <div key={service.id} className="group relative">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest">{service.role}</p>
                      <p className="text-sm font-bold">{service.name}</p>
                      <p className="text-base font-bold text-white/90">{service.phone}</p>
                    </div>
                    <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-white hover:bg-white/20" onClick={() => handleEdit(service)}>EDIT</Button>
                      <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] font-bold text-red-300 hover:bg-red-500/20" onClick={() => handleDelete(service.id)}>DEL</Button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 space-y-4">
                  <p className="text-xs opacity-60 font-medium">No standard services initialized.</p>
                  <Button variant="secondary" size="sm" className="w-full rounded-xl font-bold" onClick={handleSeedStandardServices}>
                    Import Defaults
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {!professionalPartners || professionalPartners.length === 0 ? (
              <Card className="col-span-full border-2 border-dashed py-24 flex flex-col items-center justify-center bg-muted/10 rounded-[2rem]">
                <PhoneCall className="w-12 h-12 text-primary/20 mb-4" />
                <h3 className="text-xl font-bold font-headline text-primary/40">No custom partners logged</h3>
                <p className="text-sm text-muted-foreground font-medium">Add professional partners for property-specific maintenance.</p>
              </Card>
            ) : (
              professionalPartners.map((contact) => (
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
                    <div className="flex items-center gap-3 text-lg font-bold text-primary">
                      <Phone className="w-5 h-5 text-primary/40" />
                      {contact.phone}
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-3 text-sm font-medium text-muted-foreground">
                        <Mail className="w-4 h-4 text-primary/40" />
                        {contact.email}
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-xs font-bold text-muted-foreground pt-4 border-t border-muted/50">
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
