"use client";

import { useState } from 'react';
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
import { collection, doc, serverTimestamp, arrayUnion, query, where, getDocs } from 'firebase/firestore';
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
import { Users, Plus, Mail, Phone, Trash2, Search, Loader2, UserX, Edit3, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export default function TenantsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: properties } = useCollection(propertiesQuery);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "tenantProfiles", user.uid);
  }, [db, user]);

  const { data: tenants, loading: isLoading } = useCollection(tenantsQuery);

  const [searchQuery, setSearchQuery] = useState('');
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTenant, setEditingTenant] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const resetForm = () => {
    setFirstName(''); 
    setLastName(''); 
    setEmail(''); 
    setPhone(''); 
    setLeaseEndDate(''); 
    setSelectedPropertyId(''); 
    setEditingTenant(null);
  };

  const handleEditClick = (tenant: any) => {
    setEditingTenant(tenant); 
    setFirstName(tenant.firstName); 
    setLastName(tenant.lastName); 
    setEmail(tenant.email); 
    setPhone(tenant.phoneNumber || '');
    setLeaseEndDate(tenant.leaseEndDate || ''); 
    setSelectedPropertyId(tenant.propertyId); 
    setIsDialogOpen(true);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedPropertyId) return;

    setIsSubmitting(true);
    try {
      const emailLower = email.toLowerCase().trim();
      const tenantPayload = { 
        firstName, 
        lastName, 
        email: emailLower, 
        phoneNumber: phone, 
        leaseEndDate: leaseEndDate || null, 
        propertyId: selectedPropertyId, 
        updatedAt: serverTimestamp() 
      };

      let targetTenantId = '';

      if (editingTenant) {
        targetTenantId = editingTenant.userId || emailLower;
        updateDocumentNonBlocking(doc(db, 'tenantProfiles', editingTenant.id), tenantPayload);
        toast({ title: "Resident Record Updated" });
      } else {
        const tenantId = doc(collection(db, 'tenantProfiles')).id;
        const placeholderUserId = emailLower;
        targetTenantId = placeholderUserId;
        
        setDocumentNonBlocking(doc(db, 'tenantProfiles', tenantId), { 
          id: tenantId, 
          ...tenantPayload, 
          userId: placeholderUserId, 
          tenantId: placeholderUserId, 
          landlordId: user.uid, 
          memberIds: [user.uid, placeholderUserId], 
          leaseStartDate: new Date().toISOString().split('T')[0], 
          createdAt: serverTimestamp() 
        }, { merge: true });

        // Update Property Membership
        updateDocumentNonBlocking(doc(db, 'properties', selectedPropertyId), { 
          isOccupied: true, 
          tenantIds: arrayUnion(placeholderUserId), 
          memberIds: arrayUnion(placeholderUserId), 
          updatedAt: serverTimestamp() 
        });
      }

      // 🏠 SOS & PARTNER SYNC: Proactively grant visibility to relevant contacts
      const contactsRef = collection(db, 'emergencyContacts');
      
      // 1. Property Specific Contacts
      const pq = query(contactsRef, where('propertyId', '==', selectedPropertyId));
      const pSnaps = await getDocs(pq);
      pSnaps.docs.forEach(cDoc => {
        updateDocumentNonBlocking(cDoc.ref, { memberIds: arrayUnion(targetTenantId) });
      });

      // 2. Landlord Standard SOS Services
      const sq = query(contactsRef, where('landlordId', '==', user.uid), where('category', '==', 'standard'));
      const sSnaps = await getDocs(sq);
      sSnaps.docs.forEach(sDoc => {
        updateDocumentNonBlocking(sDoc.ref, { memberIds: arrayUnion(targetTenantId) });
      });

      toast({ title: "Resident Permissions Synchronized", description: "Support directory access granted." });
      
      setIsDialogOpen(false); 
      resetForm();
    } catch (e: any) {
      toast({ variant: "destructive", title: "Sync Failed", description: e.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTenant = (tenant: any) => {
    if (!user || !db) return;
    deleteDocumentNonBlocking(doc(db, 'tenantProfiles', tenant.id));
    toast({ title: "Resident Identity Removed" });
  };

  const filteredTenants = tenants?.filter(t => 
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || 
    t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-7xl mx-auto pb-12 text-left">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-headline font-bold text-foreground mb-2 tracking-tight">Portfolio Residents</h1>
          <p className="text-muted-foreground font-medium font-body text-sm truncate opacity-70">Managing tenant identities and high-fidelity lease assignments.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold shadow-lg shadow-primary/20 font-headline text-primary-foreground px-6 transition-all hover:scale-[1.02] shrink-0 text-xs uppercase tracking-widest">
              <Plus className="w-4 h-4 mr-2" />
              Assign New Resident
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[550px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col h-[750px] max-h-[90vh] bg-card ring-1 ring-white/10">
            <form onSubmit={handleSaveTenant} className="flex flex-col h-full overflow-hidden">
              <DialogHeader className="p-10 text-left bg-primary/5 border-b border-white/5 shrink-0">
                <DialogTitle className="text-3xl font-bold font-headline text-foreground tracking-tight">{editingTenant ? "Update Resident" : "Assign Resident"}</DialogTitle>
                <DialogDescription className="font-medium text-muted-foreground mt-2 text-base">Initialize a resident profile for your professional portfolio.</DialogDescription>
              </DialogHeader>
              
              <ScrollArea className="flex-1 min-h-0 bg-white/[0.01]">
                <div className="p-10 space-y-10 pb-20">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">First Name</Label>
                      <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-base px-6 shadow-inner ring-1 ring-white/10 text-foreground" placeholder="e.g. John" />
                    </div>
                    <div className="space-y-3">
                      <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Last Name</Label>
                      <Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-base px-6 shadow-inner ring-1 ring-white/10 text-foreground" placeholder="e.g. Doe" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Contact Electronic Mail</Label>
                    <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-base px-6 shadow-inner ring-1 ring-white/10 text-foreground" placeholder="tenant@example.com" />
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Mobile Number</Label>
                    <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="rounded-2xl h-14 bg-muted/40 border-none font-bold text-base px-6 shadow-inner ring-1 ring-white/10 text-foreground" placeholder="+44 ..." />
                  </div>

                  <div className="space-y-3">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-60 tracking-widest font-headline">Target Inventory Asset</Label>
                    <select 
                      className="flex h-14 w-full rounded-2xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-primary outline-none font-bold text-foreground shadow-inner ring-1 ring-white/10" 
                      value={selectedPropertyId} 
                      onChange={(e) => setSelectedPropertyId(e.target.value)} 
                      required
                    >
                      <option value="">Select Portfolio Asset...</option>
                      {properties?.map(prop => <option key={prop.id} value={prop.id}>{prop.addressLine1}</option>)}
                    </select>
                  </div>
                </div>
              </ScrollArea>

              <DialogFooter className="p-10 bg-muted/5 border-t border-white/5 shrink-0">
                <Button type="submit" disabled={isSubmitting || !selectedPropertyId} className="w-full rounded-[1.75rem] h-16 font-bold bg-primary text-primary-foreground shadow-2xl shadow-primary/10 font-headline text-sm uppercase tracking-widest hover:opacity-90 hover:scale-[1.01] transition-transform">
                  {isSubmitting ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                  {editingTenant ? "Update Resident Record" : "Confirm Assignment"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-4 h-6 w-6 text-muted-foreground opacity-30" />
        <Input 
          placeholder="Search resident directory..." 
          className="pl-14 h-16 rounded-2xl bg-muted/20 border-none font-body shadow-sm text-lg text-foreground focus:ring-accent" 
          value={searchQuery} 
          onChange={(e) => setSearchQuery(e.target.value)} 
        />
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-[2.5rem] bg-card ring-1 ring-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-6">
              <Loader2 className="w-12 h-12 animate-spin text-primary opacity-40" />
              <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-muted-foreground font-headline">Synchronizing Directory</p>
            </div>
          ) : !filteredTenants || filteredTenants.length === 0 ? (
            <div className="px-6 py-32 text-center flex flex-col items-center justify-center">
              <UserX className="w-20 h-20 text-muted-foreground/10 mb-8" />
              <p className="text-muted-foreground font-bold text-xl font-headline opacity-40 uppercase tracking-widest">No Residents Found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse table-fixed min-w-[800px]">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-10 py-7 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-headline w-1/2">Identity</th>
                    <th className="px-10 py-7 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground font-headline w-1/3">Asset Assignment</th>
                    <th className="px-10 py-7 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground text-right font-headline w-1/6">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-10 py-8 min-w-0">
                        <div className="flex items-center gap-5">
                          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-inner font-headline text-xl border border-primary/5 shrink-0">
                            {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                          </div>
                          <div className="text-left min-w-0 flex-1">
                            <p className="font-bold text-lg font-headline text-foreground leading-tight truncate block">{tenant.firstName} {tenant.lastName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1 opacity-60 truncate block">{tenant.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-10 py-8 text-left min-w-0">
                        <Badge variant="secondary" className="bg-accent/10 text-accent border-none text-[10px] font-bold px-5 py-2 font-headline tracking-widest rounded-full shadow-inner truncate max-w-full block text-center">
                          {properties?.find(p => p.id === tenant.propertyId)?.addressLine1 || 'Pending Migration'}
                        </Badge>
                      </td>
                      <td className="px-10 py-8 text-right shrink-0">
                        <div className="flex justify-end gap-3">
                          <Button variant="ghost" size="icon" className="h-11 w-11 text-muted-foreground hover:text-accent hover:bg-accent/10 rounded-xl transition-all" onClick={() => handleEditClick(tenant)}><Edit3 className="w-5 h-5" /></Button>
                          <Button variant="ghost" size="icon" className="h-11 w-11 text-destructive/40 hover:text-white hover:bg-red-500 rounded-xl transition-all" onClick={() => handleDeleteTenant(tenant)}><Trash2 className="w-5 h-5" /></Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
