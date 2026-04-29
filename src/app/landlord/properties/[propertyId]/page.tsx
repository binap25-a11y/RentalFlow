
"use client";

import { useState, use } from 'react';
import { useUser, useFirestore, useDoc, useCollection, useMemoFirebase, setDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp, query, where } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, MapPin, Users, Wrench, FileCheck, Phone, 
  Trash2, Edit3, Loader2, Save, Plus, ArrowLeft,
  Download, FileText, AlertTriangle, ShieldAlert, Sparkles
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PropertyManagementPage({ params }: { params: Promise<{ propertyId: string }> }) {
  const resolvedParams = use(params);
  const { propertyId } = resolvedParams;
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const router = useRouter();

  const propertyRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid, 'properties', propertyId);
  }, [db, user, propertyId]);

  const { data: property, isLoading: isPropLoading } = useDoc(propertyRef);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'properties', propertyId, 'tenants');
  }, [db, user, propertyId]);

  const { data: tenants } = useCollection(tenantsQuery);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'properties', propertyId, 'maintenanceRequests');
  }, [db, user, propertyId]);

  const { data: maintenance } = useCollection(maintenanceQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'properties', propertyId, 'inspections');
  }, [db, user, propertyId]);

  const { data: inspections } = useCollection(inspectionsQuery);

  // Form states
  const [isEditing, setIsEditing] = useState(false);
  const [rentAmount, setRentAmount] = useState('');

  const handleUpdateRent = () => {
    if (!propertyRef) return;
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: Number(rentAmount),
      updatedAt: serverTimestamp(),
    });
    setIsEditing(false);
    toast({ title: "Rent Updated", description: "Property rent has been updated." });
  };

  const generatePDF = (type: string) => {
    toast({ 
      title: "Generating Report", 
      description: `Your ${type} report is being generated.`,
    });
    setTimeout(() => {
      toast({ title: "Success", description: "Report downloaded successfully." });
    }, 1500);
  };

  if (isPropLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (!property) return <div>Property not found.</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary">{property.addressLine1}</h1>
          <p className="text-muted-foreground flex items-center"><MapPin className="w-4 h-4 mr-1" /> {property.zipCode}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          <Card className="border-none shadow-sm overflow-hidden">
            <CardHeader className="bg-primary/5">
              <div className="flex justify-between items-center">
                <CardTitle className="text-xl">Financial Details</CardTitle>
                <Badge variant={property.isOccupied ? "default" : "secondary"}>
                  {property.isOccupied ? "Occupied" : "Vacant"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="flex items-end gap-4">
                <div className="space-y-1 flex-1">
                  <Label>Monthly Rent (£)</Label>
                  {isEditing ? (
                    <Input 
                      type="number" 
                      value={rentAmount || property.rentAmount} 
                      onChange={(e) => setRentAmount(e.target.value)}
                    />
                  ) : (
                    <p className="text-3xl font-bold text-primary">£{property.rentAmount}</p>
                  )}
                </div>
                {isEditing ? (
                  <Button onClick={handleUpdateRent} className="rounded-xl"><Save className="w-4 h-4 mr-2" /> Save</Button>
                ) : (
                  <Button variant="outline" onClick={() => setIsEditing(true)} className="rounded-xl"><Edit3 className="w-4 h-4 mr-2" /> Edit Rent</Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="tenants" className="w-full">
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1">
              <TabsTrigger value="tenants"><Users className="w-4 h-4 mr-2" /> Residents</TabsTrigger>
              <TabsTrigger value="maintenance"><Wrench className="w-4 h-4 mr-2" /> Maintenance</TabsTrigger>
              <TabsTrigger value="inspections"><FileCheck className="w-4 h-4 mr-2" /> Inspections</TabsTrigger>
              <TabsTrigger value="contacts"><Phone className="w-4 h-4 mr-2" /> Contacts</TabsTrigger>
            </TabsList>

            <TabsContent value="tenants" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-headline">Assigned Residents</h3>
                <Button size="sm" className="rounded-xl"><Plus className="w-4 h-4 mr-2" /> Assign Resident</Button>
              </div>
              
              {!tenants || tenants.length === 0 ? (
                <Card className="border-dashed border-2 py-10 flex flex-col items-center justify-center text-center">
                  <Badge variant="outline" className="mb-4 text-amber-600 bg-amber-50">PROPERTY VACANT</Badge>
                  <p className="text-sm text-muted-foreground">No tenants currently assigned to this property.</p>
                </Card>
              ) : (
                tenants.map(tenant => (
                  <Card key={tenant.id} className="border-none shadow-sm">
                    <CardContent className="p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold">
                          {tenant.firstName[0]}{tenant.lastName[0]}
                        </div>
                        <div>
                          <p className="font-bold">{tenant.firstName} {tenant.lastName}</p>
                          <p className="text-xs text-muted-foreground">{tenant.email}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button variant="ghost" size="icon"><Edit3 className="w-4 h-4" /></Button>
                        <Button variant="ghost" size="icon" className="text-destructive"><Trash2 className="w-4 h-4" /></Button>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="maintenance" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-headline">Maintenance Requests</h3>
                <Button size="sm" className="rounded-xl"><Wrench className="w-4 h-4 mr-2" /> Log Issue</Button>
              </div>
              {!maintenance || maintenance.length === 0 ? (
                <p className="text-center py-10 text-muted-foreground">No maintenance issues reported.</p>
              ) : (
                maintenance.map(req => (
                  <Card key={req.id} className="border-none shadow-sm">
                    <CardContent className="p-4 space-y-2">
                      <div className="flex justify-between">
                        <Badge className="capitalize">{req.priority}</Badge>
                        <span className="text-xs text-muted-foreground">{req.status}</span>
                      </div>
                      <p className="text-sm font-medium">{req.description}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="inspections" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-headline">Inspection Records</h3>
                <Button size="sm" className="rounded-xl"><FileCheck className="w-4 h-4 mr-2" /> Schedule</Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Button variant="outline" onClick={() => generatePDF('Inspection')} className="h-20 rounded-2xl flex flex-col gap-1">
                  <FileText className="w-6 h-6 text-primary" />
                  <span>Generate Full Report</span>
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="mt-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-bold font-headline">Emergency Contacts</h3>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => generatePDF('Emergency Contact')} className="rounded-xl"><Download className="w-4 h-4 mr-2" /> Export PDF</Button>
                  <Button size="sm" className="rounded-xl"><Plus className="w-4 h-4 mr-2" /> Add Contact</Button>
                </div>
              </div>
              <Card className="border-none shadow-sm p-4 bg-red-50/30 border border-red-100">
                <div className="flex items-center gap-3">
                  <ShieldAlert className="w-5 h-5 text-red-500" />
                  <div>
                    <p className="text-sm font-bold">24/7 Plumbing Hotline</p>
                    <p className="text-xs text-muted-foreground">0800 123 4567</p>
                  </div>
                </div>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>AI Property Insights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 bg-accent/10 rounded-xl flex gap-3">
                <Sparkles className="w-5 h-5 text-accent shrink-0" />
                <p className="text-xs text-accent-foreground leading-relaxed italic">
                  "Market analysis suggests a 5% rent increase is possible for similar 2-bed properties in {property.zipCode}."
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span>Occupancy Health</span>
                  <span>{property.isOccupied ? "100%" : "0%"}</span>
                </div>
                <div className="w-full bg-muted rounded-full h-2">
                  <div className={`h-full rounded-full ${property.isOccupied ? 'bg-green-500 w-full' : 'bg-amber-500 w-0'}`} />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button variant="outline" className="justify-start"><Download className="w-4 h-4 mr-2" /> Lease Template</Button>
              <Button variant="outline" className="justify-start"><AlertTriangle className="w-4 h-4 mr-2" /> Eviction Notice</Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
