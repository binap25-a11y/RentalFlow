"use client";

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking, buildSecureCollectionGroupQuery, getLandlordPropertiesQuery } from '@/firebase';
import { collection, doc, serverTimestamp, query, where, getDoc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Users, Plus, Mail, Phone, Building2, Trash2, Edit3, Search, Loader2, UserX } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function TenantsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const propertiesQuery = useMemo(() => {
    if (!db || !user) return null;
    return getLandlordPropertiesQuery(db, user.uid);
  }, [db, user]);

  const { data: properties } = useCollection(propertiesQuery);

  const tenantsQuery = useMemo(() => {
    if (!db || !user) return null;
    return buildSecureCollectionGroupQuery({
      db,
      collectionName: "tenantProfiles",
      userId: user.uid,
      role: "landlord"
    });
  }, [db, user]);

  const { data: tenants, isLoading } = useCollection(tenantsQuery);

  const [searchQuery, setSearchQuery] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedPropertyId, setSelectedPropertyId] = useState('');

  const handleAddTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedPropertyId) return;

    const tenantId = doc(collection(db, 'dummy')).id;
    const tenantRef = doc(db, 'users', user.uid, 'properties', selectedPropertyId, 'tenantProfiles', tenantId);
    const propertyRef = doc(db, 'users', user.uid, 'properties', selectedPropertyId);

    // Fetch the property to maintain the memberIds array
    const propertySnap = await getDoc(propertyRef);
    const propertyData = propertySnap.data();
    const currentMemberIds = propertyData?.memberIds || [user.uid];
    
    // In a real invite system, we'd add the tenant's real UID here.
    // For now, we update the profile with the landlord's link.
    setDocumentNonBlocking(tenantRef, {
      id: tenantId,
      firstName,
      lastName,
      email,
      phoneNumber: phone,
      propertyId: selectedPropertyId,
      landlordId: user.uid,
      leaseStartDate: new Date().toISOString().split('T')[0],
      leaseEndDate: new Date(Date.now() + 31536000000).toISOString().split('T')[0],
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    // Update property status
    updateDocumentNonBlocking(propertyRef, {
      isOccupied: true,
      updatedAt: serverTimestamp(),
      memberIds: currentMemberIds // Should be updated with real UID in production
    });

    setIsAddDialogOpen(false);
    setFirstName('');
    setLastName('');
    setEmail('');
    setPhone('');
    setSelectedPropertyId('');
    toast({ title: "Resident Assigned", description: `${firstName} has been added to the records.` });
  };

  const handleDeleteTenant = (tenant: any) => {
    if (!user || !db) return;
    const tenantRef = doc(db, 'users', user.uid, 'properties', tenant.propertyId, 'tenantProfiles', tenant.id);
    deleteDocumentNonBlocking(tenantRef);
    toast({ title: "Resident Removed", description: "Tenant record has been deleted." });
  };

  const filteredTenants = tenants?.filter(t => 
    `${t.firstName} ${t.lastName}`.toLowerCase().includes(searchQuery.toLowerCase()) ||
    t.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Residents</h1>
          <p className="text-muted-foreground font-medium">Manage your tenant database and lease agreements.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Assign New Resident
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <form onSubmit={handleAddTenant}>
              <DialogHeader>
                <DialogTitle>Assign Resident</DialogTitle>
                <DialogDescription>
                  Enter the details of the resident and select their assigned property.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First Name</Label>
                    <Input id="firstName" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last Name</Label>
                    <Input id="lastName" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="property">Assign to Property</Label>
                  <select 
                    id="property" 
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background"
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
                <Button type="submit" className="w-full rounded-xl">Confirm Assignment</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search residents by name or email..." 
          className="pl-10 h-12 rounded-xl"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <Card className="border-none shadow-sm overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-12"><Loader2 className="animate-spin" /></div>
          ) : !filteredTenants || filteredTenants.length === 0 ? (
            <div className="px-6 py-20 text-center flex flex-col items-center justify-center">
              <UserX className="w-12 h-12 text-muted-foreground mb-4 opacity-20" />
              <p className="text-muted-foreground font-medium">No residents found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-muted/50 border-b">
                  <tr>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground">Resident</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground">Contact</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-xs font-bold uppercase text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredTenants.map(tenant => (
                    <tr key={tenant.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                            {tenant.firstName?.[0] || 'T'}{tenant.lastName?.[0] || ''}
                          </div>
                          <div>
                            <p className="font-bold text-sm">{tenant.firstName} {tenant.lastName}</p>
                            <p className="text-xs text-muted-foreground">Lease ends: {tenant.leaseEndDate}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="space-y-1">
                          <p className="text-xs flex items-center"><Mail className="w-3 h-3 mr-2" /> {tenant.email}</p>
                          <p className="text-xs flex items-center"><Phone className="w-3 h-3 mr-2" /> {tenant.phoneNumber}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">ACTIVE</Badge>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDeleteTenant(tenant)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
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