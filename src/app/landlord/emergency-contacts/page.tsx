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
import { collection, doc, serverTimestamp, getDocs, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Plus, Trash2, Edit3, Loader2, Download, 
  Phone, Mail, Building2, Wrench, ShieldAlert, Save,
  Filter, HardHat
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { jsPDF } from "jspdf";
import { format } from "date-fns";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

/**
 * @fileOverview Premium Contractor & SOS Directory.
 * Optimized for high-fidelity Light/Dark mode consistency.
 */

const DEFAULT_UK_SERVICES = [
  { name: "Emergency Services (Police, Fire, Ambulance)", phone: "999 or 112", role: "Primary Emergency" },
  { name: "Police Non-Emergency", phone: "101", role: "Non-Urgent Police" },
  { name: "NHS Medical Advice (24/7)", phone: "111", role: "Medical Advice" },
  { name: "National Gas Emergency", phone: "0800 111 999", role: "Gas Leaks" },
];

export default function LandlordEmergencyContactsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>("");

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
  const [website, setWebsite] = useState('');
  const [category, setCategory] = useState<'standard' | 'professional'>('professional');
  const [assignToPropertyId, setAssignToPropertyId] = useState('');

  const selectedProperty = useMemo(() => properties?.find(p => p.id === selectedPropertyId), [properties, selectedPropertyId]);

  const standardServices = useMemo(() => contacts?.filter(c => c.category === 'standard') || [], [contacts]);
  const professionalPartners = useMemo(() => {
    const allProfessionals = contacts?.filter(c => !c.category || c.category === 'professional') || [];
    if (!selectedPropertyId) return allProfessionals;
    return allProfessionals.filter(c => c.propertyId === selectedPropertyId || !c.propertyId);
  }, [contacts, selectedPropertyId]);

  const resetForm = () => {
    setName('');
    setRole('');
    setPhone('');
    setEmail('');
    setWebsite('');
    setCategory('professional');
    setAssignToPropertyId('');
    setEditingContact(null);
  };

  const handleEdit = (contact: any) => {
    setEditingContact(contact);
    setName(contact.name);
    setRole(contact.role);
    setPhone(contact.phone);
    setEmail(contact.email || '');
    setWebsite(contact.website || '');
    setCategory(contact.category || 'professional');
    setAssignToPropertyId(contact.propertyId || '');
    setIsDialogOpen(true);
  };

  const handleSeedStandardServices = async () => {
    if (!user || !db) return;
    
    const tenantsQuery = query(collection(db, 'tenantProfiles'), where('landlordId', '==', user.uid));
    const tenantSnaps = await getDocs(tenantsQuery);
    const tenantUserIds = tenantSnaps.docs.map(d => d.data().userId).filter(Boolean);
    const memberIds = [user.uid, ...tenantUserIds];

    DEFAULT_UK_SERVICES.forEach(service => {
      const contactId = doc(collection(db, 'emergencyContacts')).id;
      const contactRef = doc(db, 'emergencyContacts', contactId);
      setDocumentNonBlocking(contactRef, {
        id: contactId,
        ...service,
        category: 'standard',
        landlordId: user.uid,
        memberIds: memberIds,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
    toast({ title: "SOS Protocols Initialized" });
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    let memberIds = [user.uid];
    
    if (category === 'standard' || !assignToPropertyId) {
      const tenantsQuery = query(collection(db, 'tenantProfiles'), where('landlordId', '==', user.uid));
      const tenantSnaps = await getDocs(tenantsQuery);
      memberIds = [user.uid, ...tenantSnaps.docs.map(d => d.data().userId).filter(Boolean)];
    } else if (assignToPropertyId) {
      const property = properties?.find(p => p.id === assignToPropertyId);
      if (property?.memberIds) {
        memberIds = [...new Set([...property.memberIds, user.uid])];
      }
    }

    const payload = {
      name,
      role,
      phone,
      email,
      website,
      category,
      propertyId: assignToPropertyId || null,
      memberIds: memberIds,
      updatedAt: serverTimestamp(),
    };

    if (editingContact) {
      const contactRef = doc(db, 'emergencyContacts', editingContact.id);
      updateDocumentNonBlocking(contactRef, payload);
      toast({ title: "Database Record Updated" });
    } else {
      const contactId = doc(collection(db, 'emergencyContacts')).id;
      const contactRef = doc(db, 'emergencyContacts', contactId);
      
      setDocumentNonBlocking(contactRef, {
        id: contactId,
        ...payload,
        landlordId: user.uid,
        createdAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: "Trade Partner Registered" });
    }

    setIsDialogOpen(false);
    resetForm();
  };

  const handleDelete = (id: string) => {
    if (!db) return;
    const contactRef = doc(db, 'emergencyContacts', id);
    deleteDocumentNonBlocking(contactRef);
    toast({ title: "Record Removed" });
  };

  const downloadPDF = () => {
    if (!contacts) return;
    const pdfDoc = new jsPDF();
    pdfDoc.text(`CONTRACTOR DIRECTORY - ${format(new Date(), 'PPP')}`, 20, 20);
    pdfDoc.save(`Contractor_Directory.pdf`);
  };

  if (!isClient || isLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto text-left pb-12">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground mb-2 tracking-tight">Contractors & SOS</h1>
          <p className="text-muted-foreground font-medium font-body max-w-2xl">
            {selectedProperty 
              ? `Authorized professionals and emergency protocols for ${selectedProperty.addressLine1}` 
              : "Manage your professional contractor database and UK standard emergency protocols."}
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <div className="flex items-center gap-2 bg-card rounded-xl border border-border px-3 h-11 shadow-sm">
             <Filter className="w-4 h-4 text-primary/60" />
             <Label className="text-[10px] font-bold uppercase text-muted-foreground">Context:</Label>
             <select 
               className="bg-transparent text-sm font-bold outline-none cursor-pointer text-foreground"
               value={selectedPropertyId}
               onChange={(e) => setSelectedPropertyId(e.target.value)}
             >
               <option value="">Full Portfolio</option>
               {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
             </select>
          </div>
          <Button variant="outline" onClick={downloadPDF} className="rounded-xl font-bold h-11 border-border bg-card shadow-sm">
            <Download className="w-4 h-4 mr-2" /> Export PDF
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
            <DialogTrigger asChild>
              <Button variant="outline" className="rounded-xl h-11 font-bold shadow-sm bg-card hover:bg-muted text-foreground px-6 border-border transition-all">
                <Plus className="w-4 h-4 mr-2" /> Add Partner
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl p-0 overflow-hidden flex flex-col h-[700px] max-h-[90vh] bg-card">
              <form onSubmit={handleSave} className="flex flex-col h-full overflow-hidden">
                <DialogHeader className="p-8 text-left bg-primary/5 border-b shrink-0">
                  <DialogTitle className="text-xl font-bold font-headline text-foreground">{editingContact ? "Modify Record" : "New Trade Partner"}</DialogTitle>
                  <DialogDescription className="font-medium text-muted-foreground">Register a professional contractor or emergency contact.</DialogDescription>
                </DialogHeader>
                <div className="flex-1 overflow-y-auto min-h-0">
                  <div className="grid gap-6 p-8 text-left">
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 tracking-wider font-headline">Classification</Label>
                      <div className="flex gap-2">
                        <Button type="button" variant={category === 'standard' ? 'default' : 'outline'} className="flex-1 rounded-xl h-10 font-bold" onClick={() => setCategory('standard')}>UK SOS</Button>
                        <Button type="button" variant={category === 'professional' ? 'default' : 'outline'} className="flex-1 rounded-xl h-10 font-bold" onClick={() => setCategory('professional')}>Trade Pro</Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 tracking-wider font-headline">Organization Name</Label>
                      <Input value={name} onChange={(e) => setName(e.target.value)} required className="rounded-xl h-11 bg-muted/20 border-none font-bold text-foreground" />
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 tracking-wider font-headline">Service Role</Label>
                      <Input value={role} onChange={(e) => setRole(e.target.value)} required className="rounded-xl h-11 bg-muted/20 border-none font-bold text-foreground" placeholder="e.g. Electrician" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 tracking-wider font-headline">Phone</Label>
                        <Input value={phone} onChange={(e) => setPhone(e.target.value)} required className="rounded-xl h-11 bg-muted/20 border-none font-bold text-foreground" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 tracking-wider font-headline">Support Mail</Label>
                        <Input value={email} onChange={(e) => setEmail(e.target.value)} className="rounded-xl h-11 bg-muted/20 border-none font-bold text-foreground" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 tracking-wider font-headline">Web Portal</Label>
                      <Input value={website} onChange={(e) => setWebsite(e.target.value)} className="rounded-xl h-11 bg-muted/20 border-none font-bold text-foreground" placeholder="https://..." />
                    </div>
                    {category === 'professional' && (
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 tracking-wider font-headline">Asset Assignment</Label>
                        <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-foreground" value={assignToPropertyId} onChange={(e) => setAssignToPropertyId(e.target.value)}>
                          <option value="">General Portfolio Trusted</option>
                          {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
                <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
                  <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg shadow-primary/20 text-primary-foreground font-headline">
                    <Save className="w-4 h-4 mr-2" />
                    {editingContact ? "Update Record" : "Commit to Database"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-1">
          <Card className="border-none shadow-sm bg-card ring-1 ring-border rounded-3xl overflow-hidden">
            <CardHeader className="pb-4 border-b border-border bg-muted/10 p-8 text-left">
              <CardTitle className="text-xl font-headline font-bold flex items-center gap-3 text-foreground">
                <ShieldAlert className="w-7 h-7 text-red-500" /> SOS Protocols
              </CardTitle>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground font-headline mt-1">UK Safety Systems</p>
            </CardHeader>
            <CardContent className="p-8 space-y-10 text-left">
              {standardServices.length > 0 ? (
                standardServices.map((service) => (
                  <div key={service.id} className="group relative">
                    <div className="space-y-1">
                      <p className="text-[10px] font-bold uppercase text-red-500 tracking-[0.2em] font-headline">{service.role}</p>
                      <p className="text-base font-bold font-headline leading-tight text-foreground">{service.name}</p>
                      <p className="text-xl font-bold text-foreground font-headline tracking-tight mt-1">{service.phone}</p>
                    </div>
                    <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] font-bold text-muted-foreground hover:bg-primary/5 rounded-lg" onClick={() => handleEdit(service)}>EDIT</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 px-3 text-[10px] font-bold text-red-500 hover:bg-red-500/10 rounded-lg">DELETE</Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="rounded-3xl border-none shadow-2xl bg-card">
                          <AlertDialogHeader className="text-left">
                            <AlertDialogTitle className="font-headline font-bold text-xl text-foreground">Remove Emergency Protocol?</AlertDialogTitle>
                            <AlertDialogDescription className="text-muted-foreground font-medium mt-2">This will remove this SOS line from all resident directories. Are you sure?</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter className="mt-6 gap-3">
                            <AlertDialogCancel className="rounded-xl h-12 font-bold uppercase tracking-widest text-[10px] border-border">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              onClick={() => handleDelete(service.id)}
                              className="rounded-xl h-12 font-bold bg-red-600 text-white uppercase tracking-widest text-[10px] hover:bg-red-700 border-none"
                            >
                              Purge Protocol
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                ))
              ) : (
                <Button variant="secondary" size="sm" className="w-full rounded-xl font-bold h-12 uppercase tracking-widest text-[10px] font-headline" onClick={handleSeedStandardServices}>Initialize UK SOS Ledger</Button>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {professionalPartners.length === 0 ? (
              <Card className="col-span-full border-2 border-dashed py-24 flex flex-col items-center justify-center bg-muted/10 rounded-[2rem]">
                <HardHat className="w-12 h-12 text-primary/20 mb-4" />
                <h3 className="text-xl font-bold font-headline text-primary/40">No Trade Partners Initialized</h3>
                <p className="text-sm text-muted-foreground font-medium font-body mt-2 text-center max-w-xs">Assign authorized contractors to your portfolio assets.</p>
              </Card>
            ) : (
              professionalPartners.map((contact) => (
                <Card key={contact.id} className="border-none shadow-sm hover:shadow-md transition-all rounded-[2rem] group overflow-hidden bg-card border border-transparent hover:border-accent/10 ring-1 ring-border">
                  <CardHeader className="pb-4 bg-muted/5 p-8 text-left">
                    <div className="flex justify-between items-start">
                      <div className="p-3 bg-card rounded-xl shadow-sm text-primary ring-1 ring-border">
                        <Wrench className="w-5 h-5" />
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5" onClick={() => handleEdit(contact)}>
                          <Edit3 className="w-4 h-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl text-destructive/40 hover:text-destructive hover:bg-destructive/5"><Trash2 className="w-4 h-4" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="rounded-3xl border-none shadow-2xl bg-card">
                            <AlertDialogHeader className="text-left">
                              <AlertDialogTitle className="font-headline font-bold text-xl text-foreground">Remove Trade Partner?</AlertDialogTitle>
                              <AlertDialogDescription className="text-muted-foreground font-medium mt-2">
                                This will remove <strong>{contact.name}</strong> from your authorized contractor database and revoke their visibility for assigned residents.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter className="mt-6 gap-3">
                              <AlertDialogCancel className="rounded-xl h-12 font-bold uppercase tracking-widest text-[10px] border-border">Cancel</AlertDialogCancel>
                              <AlertDialogAction 
                                onClick={() => handleDelete(contact.id)}
                                className="rounded-xl h-12 font-bold bg-red-600 text-white uppercase tracking-widest text-[10px] hover:bg-red-700 border-none"
                              >
                                Purge Partner
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                    <CardTitle className="text-xl font-bold font-headline mt-6 text-foreground tracking-tight">{contact.name}</CardTitle>
                    <Badge variant="secondary" className="bg-accent/10 text-accent border-none uppercase text-[9px] font-bold mt-2 tracking-widest font-headline px-4 py-1 rounded-full shadow-inner">
                      {contact.role}
                    </Badge>
                  </CardHeader>
                  <CardContent className="pt-8 px-8 pb-8 space-y-6 text-left">
                    <div className="space-y-1">
                       <p className="text-[10px] font-bold text-muted-foreground uppercase opacity-40 font-headline tracking-widest">Support Line</p>
                       <div className="flex items-center gap-3 text-2xl font-bold text-foreground tracking-tight font-headline">
                         <Phone className="w-6 h-6 text-accent/20" />
                         {contact.phone}
                       </div>
                    </div>
                    {contact.email && (
                      <div className="flex items-center gap-4 text-sm font-medium text-muted-foreground pt-4 border-t border-border">
                        <Mail className="w-5 h-5 text-accent/30" />
                        {contact.email}
                      </div>
                    )}
                    <div className="flex items-center gap-4 text-[10px] font-bold text-muted-foreground pt-6 border-t border-border uppercase tracking-widest opacity-60">
                      <Building2 className="w-4 h-4 text-accent/30" />
                      {properties?.find(p => p.id === contact.propertyId)?.addressLine1 || "Full Portfolio Trusted"}
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

