"use client";

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, getLandlordCollectionQuery } from '@/firebase';
import { collection, doc, serverTimestamp, arrayUnion } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, Mail, Phone, Trash2, Search, Loader2, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    // Standardize to landlordId query to perfectly satisfy Option A security rules
    return getLandlordCollectionQuery(db, "tenantProfiles", user.uid);
  }, [db, user]);

  const { data: tenants, loading: isLoading } = useCollection(tenantsQuery);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedPropertyId) return;

    const tenantId = doc(collection(db, 'tenantProfiles')).id;
    const tenantRef = doc(db, 'tenantProfiles', tenantId);
    const propertyRef = doc(db, 'properties', selectedPropertyId);

    const placeholderUserId = email.toLowerCase().trim();

    setDocumentNonBlocking(tenantRef, {
      id: tenantId,
      firstName,
      lastName,
      email: email.toLowerCase().trim(),
      phoneNumber: phone,
      userId: placeholderUserId,
      tenantId: placeholderUserId,
      propertyId: selectedPropertyId,
      landlordId: user.uid,
      memberIds: [user.uid, placeholderUserId],
      leaseStartDate: new Date().toISOString().split('T')[0],
      leaseEndDate: new Date(Date.now() + 31536000000).toISOString().split('T')[0],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    updateDocumentNonBlocking(propertyRef, {
      isOccupied: true,
      tenantIds: arrayUnion(placeholderUserId),
      memberIds: arrayUnion(placeholderUserId),
      updatedAt: serverTimestamp(),
    });

    setIsAddDialogOpen(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setSelectedPropertyId('');
    toast({ title: "Resident Assigned", description: "The resident can now join using their email." });
  };

  const handleDeleteTenant = (tenant: any) => {
    if (!user || !db) return;
    const tenantRef = doc(db, 'tenantProfiles', tenant.id);
    deleteDocumentNonBlocking(tenantRef);
    toast({ title: "Resident Removed" });
  };

  const filteredTenants = tenants?.filter(t => 
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Residents</h1>
          <p className="text-muted-foreground font-medium font-body">Manage your tenant database and lease agreements.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl h-11 font-bold shadow-lg shadow-primary/20 font-headline">
              <Plus className="w-4 h-4 mr-2" />
              Assign New Resident
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl border-none shadow-2xl">
            <form onSubmit={handleAddTenant}>
              <DialogHeader className="text-left">
                <DialogTitle className="text-xl font-bold font-headline text-primary">Assign Resident</DialogTitle>
                <DialogDescription className="font-medium text-muted-foreground">Enter the resident's details. They will be linked automatically when they join with this email.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-6 text-left">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="font-bold text-xs uppercase text-primary/60 tracking-wider font-headline">First Name</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required className="rounded-xl h-11 font-body" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="font-bold text-xs uppercase text-primary/60 tracking-wider font-headline">Last Name</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required className="rounded-xl h-11 font-body" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email" className="font-bold text-xs uppercase text-primary/60 tracking-wider font-headline">Email Address</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="rounded-xl h-11 font-body" placeholder="resident@example.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone" className="font-bold text-xs uppercase text-primary/60 tracking-wider font-headline">Phone Number</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required className="rounded-xl h-11 font-body" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property" className="font-bold text-xs uppercase text-primary/60 tracking-wider font-headline">Assign to Property</Label>
                  <select 
                    id="property" 
                    className="flex h-11 w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none transition-shadow font-body"
                    value={selectedPropertyId}
                    onChange={(e) => setSelectedPropertyId(e.target.value)}
                    required
                  >
                    <option value="">Select a property...</option>
                    {properties?.map(prop => (
                      <option key={prop.id} value={prop.id}>{prop.addressLine1}</option>
                    ))}
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full rounded-xl h-12 font-bold bg-primary shadow-lg shadow-primary/20 font-headline">Confirm Assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search residents by name or email..." 
          className="pl-10 h-12 rounded-xl bg-white/50 border-primary/10 font-body"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card className="border-none shadow-sm overflow-hidden rounded-2xl bg-white">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-4">
              <Loader2 className="w-10 h-10 animate-spin text-primary" />
              <p className="text-muted-foreground font-medium font-body">Syncing resident directory...</p>
            </div>
          ) : !filteredTenants || filteredTenants.length === 0 ? (
            <div className="px-6 py-24 text-center flex flex-col items-center justify-center">
              <UserX className="w-16 h-16 text-primary/10 mb-6" />
              <p className="text-muted-foreground font-bold text-lg font-headline">No residents found.</p>
              <p className="text-sm text-muted-foreground mt-1 font-medium font-body">Add a resident to your property assets to see them here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-primary/5 border-b border-primary/10">
                  <tr>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-primary/60 font-headline">Resident</th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-primary/60 font-headline">Contact Info</th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-primary/60 font-headline">Asset Assignment</th>
                    <th className="px-6 py-5 text-xs font-bold uppercase tracking-widest text-primary/60 text-right font-headline">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/5">
                  {filteredTenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-primary/[0.02] transition-colors group">
                      <td className="px-6 py-5">
                        <div className="flex items-center gap-4">
                          <div className="w-11 h-11 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-bold shadow-sm font-headline">
                            {tenant.firstName?.[0]}{tenant.lastName?.[0]}
                          </div>
                          <div className="text-left">
                            <p className="font-bold text-sm font-headline text-primary">{tenant.firstName} {tenant.lastName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-tighter font-headline">Lease Expires: {tenant.leaseEndDate}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-left">
                        <div className="space-y-1">
                          <p className="text-xs flex items-center font-bold text-muted-foreground font-body"><Mail className="w-3.5 h-3.5 mr-2 text-primary/40" /> {tenant.email}</p>
                          <p className="text-xs flex items-center font-bold text-muted-foreground font-body"><Phone className="w-3.5 h-3.5 mr-2 text-primary/40" /> {tenant.phoneNumber}</p>
                        </div>
                      </td>
                      <td className="px-6 py-5 text-left">
                        <Badge variant="secondary" className="bg-primary/5 text-primary border-none text-[10px] font-bold px-3 py-1 font-headline">
                          {properties?.find(p => p.id === tenant.propertyId)?.addressLine1 || 'Pending Migration'}
                        </Badge>
                      </td>
                      <td className="px-6 py-5 text-right">
                        <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive/40 hover:text-destructive hover:bg-destructive/5 rounded-xl transition-all" onClick={() => handleDeleteTenant(tenant)}>
                          <Trash2 className="w-4 h-4" />
                        </Button>
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