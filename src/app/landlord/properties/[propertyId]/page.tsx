"use client";

import { useState, use } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, updateDocumentNonBlocking, setDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, MapPin, Users, Wrench, FileCheck, Phone, 
  Trash2, Edit3, Loader2, Save, Plus, ArrowLeft,
  Download, FileText, Info, Camera, ShieldAlert
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";

export default function PropertyManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const propertyId = resolvedParams.propertyId;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const propertyRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'properties', propertyId);
  }, [db, user, propertyId]);

  const { data: property, isLoading: isPropLoading } = useDoc(propertyRef);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'tenants'), where('propertyId', '==', propertyId));
  }, [db, user, propertyId]);

  const { data: tenants } = useCollection(tenantsQuery);

  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // Updated to match security rules: query must include where("userId", "==", user.uid)
    return query(
      collection(db, 'documents'), 
      where('propertyId', '==', propertyId),
      where('userId', '==', user.uid)
    );
  }, [db, user, propertyId]);

  const { data: documents } = useCollection(docsQuery);

  const contactsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'emergencyContacts'), where('propertyId', '==', propertyId));
  }, [db, user, propertyId]);

  const { data: contacts } = useCollection(contactsQuery);

  const [isEditing, setIsEditing] = useState(false);
  const [rentAmount, setRentAmount] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactRole, setContactRole] = useState('');
  const [contactPhone, setContactPhone] = useState('');

  const handleUpdateRent = () => {
    if (!propertyRef) return;
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: Number(rentAmount),
      updatedAt: serverTimestamp(),
    });
    setIsEditing(false);
    toast({ title: "Rent Updated" });
  };

  const handleAddContact = () => {
    if (!user || !db) return;
    const contactId = doc(collection(db, 'dummy')).id;
    const contactRef = doc(db, 'emergencyContacts', contactId);

    setDocumentNonBlocking(contactRef, {
      id: contactId,
      name: contactName,
      role: contactRole,
      phone: contactPhone,
      propertyId: propertyId,
      createdAt: serverTimestamp(),
    }, { merge: true });

    setContactName(''); setContactRole(''); setContactPhone('');
    toast({ title: "Contact Added" });
  };

  if (isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!property) return <div className="p-8 text-center">Property not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full"><ArrowLeft className="w-5 h-5" /></Button>
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary tracking-tight">{property.addressLine1}</h1>
          <p className="text-muted-foreground flex items-center font-medium font-body"><MapPin className="w-4 h-4 mr-1 text-primary/60" /> {property.zipCode}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5 pb-4">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl font-headline font-bold text-primary">Financial Details</CardTitle>
                <Badge variant={property.isOccupied ? "default" : "secondary"} className="font-bold">{property.isOccupied ? "Occupied" : "Vacant"}</Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="space-y-1 flex-1">
                  <Label className="text-muted-foreground font-bold text-xs uppercase tracking-wider font-headline">Monthly Rent (£)</Label>
                  {isEditing ? (
                    <Input type="number" value={rentAmount || property.rentAmount} onChange={(e) => setRentAmount(e.target.value)} className="rounded-xl" />
                  ) : (
                    <p className="text-3xl font-bold text-primary font-headline">£{property.rentAmount}</p>
                  )}
                </div>
                <Button variant={isEditing ? "default" : "outline"} onClick={isEditing ? handleUpdateRent : () => setIsEditing(true)} className="rounded-xl font-bold">
                  {isEditing ? <><Save className="w-4 h-4 mr-2" /> Save</> : <><Edit3 className="w-4 h-4 mr-2" /> Edit Rent</>}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants">
            <TabsList className="grid w-full grid-cols-5 bg-muted/50 p-1 rounded-xl h-auto">
              <TabsTrigger value="tenants" className="rounded-lg py-2 font-bold"><Users className="w-4 h-4 mr-2" /> Residents</TabsTrigger>
              <TabsTrigger value="docs" className="rounded-lg py-2 font-bold"><FileText className="w-4 h-4 mr-2" /> Vault</TabsTrigger>
              <TabsTrigger value="maintenance" className="rounded-lg py-2 font-bold"><Wrench className="w-4 h-4 mr-2" /> Issues</TabsTrigger>
              <TabsTrigger value="inspections" className="rounded-lg py-2 font-bold"><FileCheck className="w-4 h-4 mr-2" /> Health</TabsTrigger>
              <TabsTrigger value="contacts" className="rounded-lg py-2 font-bold"><Phone className="w-4 h-4 mr-2" /> Help</TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="mt-6 space-y-4">
               <h3 className="text-lg font-bold font-headline text-primary">Assigned Residents</h3>
               {tenants && tenants.length > 0 ? (
                 tenants.map(tenant => (
                    <div key={tenant.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-primary/5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                          {tenant.firstName[0]}{tenant.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold font-body">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-xs text-muted-foreground font-body">{tenant.email}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="font-bold border-primary/20 text-primary">Active Lease</Badge>
                    </div>
                 ))
               ) : (
                 <p className="text-sm text-muted-foreground italic font-body">No residents assigned yet.</p>
               )}
            </TabsContent>

            <TabsContent value="contacts" className="mt-6 space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-headline text-primary">Help & Support Contacts</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-none shadow-sm bg-muted/30">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-bold font-headline">Add Support Contact</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-1">
                      <Label className="text-xs font-bold font-headline uppercase tracking-wider">Name</Label>
                      <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="John Electric" className="h-8 text-xs font-body" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold font-headline uppercase tracking-wider">Role</Label>
                      <Input value={contactRole} onChange={(e) => setContactRole(e.target.value)} placeholder="Electrician" className="h-8 text-xs font-body" />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-bold font-headline uppercase tracking-wider">Phone</Label>
                      <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="07700 900000" className="h-8 text-xs font-body" />
                    </div>
                    <Button onClick={handleAddContact} className="w-full h-8 text-xs font-bold rounded-lg font-headline" disabled={!contactName || !contactPhone}>Add Contact</Button>
                  </CardContent>
                </Card>
                
                <div className="space-y-3">
                  {contacts?.map(contact => (
                    <div key={contact.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-primary/5 shadow-sm">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/5 rounded-lg">
                          <Phone className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold font-body">{contact.name}</p>
                          <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-tight font-headline">{contact.role}</p>
                        </div>
                      </div>
                      <a href={`tel:${contact.phone}`} className="p-2 hover:bg-primary/5 rounded-full transition-colors">
                        <Phone className="w-4 h-4 text-primary" />
                      </a>
                    </div>
                  ))}
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm overflow-hidden bg-white">
            <CardHeader className="bg-primary pb-4">
              <CardTitle className="text-xl font-headline font-bold text-primary-foreground flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2" />
                Portfolio Status
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6 space-y-4">
              <div className="p-4 bg-primary/5 rounded-xl flex gap-3 border border-primary/10 transition-all hover:bg-primary/10">
                <Info className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                <p className="text-sm text-foreground font-body font-medium leading-relaxed">
                  Keep compliance certificates up to date to ensure resident safety and legal alignment.
                </p>
              </div>
              <div className="flex items-center justify-between px-2">
                <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest font-headline">Compliance Level</span>
                <Badge variant="outline" className="text-primary font-bold border-primary/30 bg-primary/10 font-headline uppercase">Tier 1 Secure</Badge>
              </div>
              <Button className="w-full rounded-xl font-bold bg-primary text-primary-foreground hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 font-headline h-11">
                <Download className="w-4 h-4 mr-2" /> Save PDF Guide
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}