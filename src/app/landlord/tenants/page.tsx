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
import { collection, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
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
import { Users, Plus, Mail, Phone, Trash2, Search, Loader2, UserX, Edit3, CalendarDays } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";

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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [leaseEndDate, setLeaseEndDate] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const resetForm = () => {
    setFirstName(''); setLastName(''); setEmail(''); setPhone(''); setLeaseEndDate(''); setSelectedPropertyId(''); setEditingTenant(null);
  };

  const handleEditClick = (tenant: any) => {
    setEditingTenant(tenant); setFirstName(tenant.firstName); setLastName(tenant.lastName); setEmail(tenant.email); setPhone(tenant.phoneNumber);
    setLeaseEndDate(tenant.leaseEndDate || ''); setSelectedPropertyId(tenant.propertyId); setIsDialogOpen(true);
  };

  const handleSaveTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedPropertyId) return;
    const tenantPayload = { firstName, lastName, email: email.toLowerCase().trim(), phoneNumber: phone, leaseEndDate: leaseEndDate || null, propertyId: selectedPropertyId, updatedAt: serverTimestamp() };
    if (editingTenant) {
      updateDocumentNonBlocking(doc(db, 'tenantProfiles', editingTenant.id), tenantPayload);
      toast({ title: "Resident Updated" });
    } else {
      const tenantId = doc(collection(db, 'tenantProfiles')).id;
      const placeholderUserId = email.toLowerCase().trim();
      setDocumentNonBlocking(doc(db, 'tenantProfiles', tenantId), { id: tenantId, ...tenantPayload, userId: placeholderUserId, tenantId: placeholderUserId, landlordId: user.uid, memberIds: [user.uid, placeholderUserId], leaseStartDate: new Date().toISOString().split('T')[0], createdAt: serverTimestamp() }, { merge: true });
      updateDocumentNonBlocking(doc(db, 'properties', selectedPropertyId), { isOccupied: true, tenantIds: arrayUnion(placeholderUserId), memberIds: arrayUnion(placeholderUserId), updatedAt: serverTimestamp() });
      toast({ title: "Resident Assigned" });
    }
    setIsDialogOpen(false); resetForm();
  };

  const handleDeleteTenant = (tenant: any) => {
    if (!user || !db) return;
    deleteDocumentNonBlocking(doc(db, 'tenantProfiles', tenant.id));
    toast({ title: "Resident Removed" });
  };

  const filteredTenants = tenants?.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) || t.email.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-foreground mb-2 tracking-tight">Residents</h1>
          <p className="text-muted-foreground font-medium font-body">Manage your tenant database and lease agreements.</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={(open) => { setIsDialogOpen(open); if (!open) resetForm(); }}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold shadow-lg shadow-primary/20 font-headline text-primary-foreground px-6 transition-all hover:scale-[1.02]">
              <Plus className="w-4 h-4 mr-2" />
              Assign New Resident
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden flex flex-col max-h-[90vh] bg-card">
            <form onSubmit={handleSaveTenant} className="flex flex-col h-full overflow-hidden">
              <DialogHeader className="p-8 text-left bg-primary/5 border-b shrink-0">
                <DialogTitle className="text-2xl font-bold font-headline text-foreground">{editingTenant ? "Update Resident" : "Assign Resident"}</DialogTitle>
                <DialogDescription className="font-medium text-muted-foreground mt-2">Link a resident profile to your property asset.</DialogDescription>
              </DialogHeader>
              <ScrollArea className="flex-1">
                <div className="p-8 space-y-6 text-left">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2"><Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 font-headline">First Name</Label><Input value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" /></div>
                    <div className="space-y-2"><Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 font-headline">Last Name</Label><Input value={lastName} onChange={(e) => setLastName(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" /></div>
                  </div>
                  <div className="space-y-2"><Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 font-headline">Email</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-12 bg-muted/20 border-none font-bold" /></div>
                  <div className="space-y-2">
                    <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 font-headline">Assign Asset</Label>
                    <select className="flex h-12 w-full rounded-xl border-none bg-muted/20 px-4 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-bold text-foreground" value={selectedPropertyId} onChange={(e) => setSelectedPropertyId(e.target.value)} required>
                      <option value="">Choose an asset...</option>
                      {properties?.map(prop => <option key={prop.id} value={prop.id}>{prop.addressLine1}</option>)}
                    </select>
                  </div>
                </div>
              </ScrollArea>
              <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
                <Button type="submit" className="w-full rounded-xl h-14 font-bold bg-primary shadow-lg text-primary-foreground font-headline text-xs uppercase tracking-widest hover:opacity-90">Confirm Assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-4 top-4 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search residents..." className="pl-12 h-14 rounded-xl bg-muted/20 border-none font-body shadow-sm text-foreground" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-[2rem] bg-card ring-1 ring-border">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4"><Loader2 className="w-10 h-10 animate-spin text-primary" /><p className="text-muted-foreground">Syncing resident directory...</p></div>
          ) : !filteredTenants || filteredTenants.length === 0 ? (
            <div className="px-6 py-24 text-center flex flex-col items-center justify-center"><UserX className="w-16 h-16 text-muted-foreground/10 mb-6" /><p className="text-muted-foreground font-bold text-lg font-headline">No residents found.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-muted-foreground font-headline">Resident</th>
                    <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-muted-foreground font-headline">Asset Assignment</th>
                    <th className="px-8 py-6 text-xs font-bold uppercase tracking-widest text-muted-foreground text-right font-headline">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredTenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-muted/10 transition-colors group">
                      <td className="px-8 py-6">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm font-headline text-lg">{tenant.firstName?.[0]}{tenant.lastName?.[0]}</div>
                          <div className="text-left">
                            <p className="font-bold text-base font-headline text-foreground leading-tight">{tenant.firstName} {tenant.lastName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-1">{tenant.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-8 py-6 text-left">
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-none text-[10px] font-bold px-4 py-1.5 font-headline tracking-widest">
                          {properties?.find(p => p.id === tenant.propertyId)?.addressLine1 || 'Pending Migration'}
                        </Badge>
                      </td>
                      <td className="px-8 py-6 text-right">
                        <div className="flex justify-end gap-3">
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-xl transition-all" onClick={() => handleEditClick(tenant)}><Edit3 className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-10 w-10 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all" onClick={() => handleDeleteTenant(tenant)}><Trash2 className="w-4 h-4" /></Button>
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