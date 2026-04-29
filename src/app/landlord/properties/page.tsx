
"use client";

import { useState } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase';
import { collection, doc, serverTimestamp } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Building2, MapPin, Plus, Trash2, Edit3, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";

export default function PropertiesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, 'users', user.uid, 'properties');
  }, [db, user]);

  const { data: properties, isLoading } = useCollection(propertiesQuery);

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');

  const handleAddProperty = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    const rentValue = Number(rentAmount);
    if (rentValue < 0) {
      toast({ variant: "destructive", title: "Invalid Rent", description: "Monthly rent cannot be negative." });
      return;
    }

    setIsSubmitting(true);
    const propertyId = doc(collection(db, 'dummy')).id;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);

    try {
      // Reverted to reliable placeholder storage for stability
      const mainImageUrl = `https://picsum.photos/seed/${propertyId}/800/600`;

      setDocumentNonBlocking(propertyRef, {
        id: propertyId,
        landlordId: user.uid,
        addressLine1: address,
        city: 'London',
        state: 'UK',
        zipCode: zipCode,
        description: description,
        numberOfBedrooms: 2,
        numberOfBathrooms: 1,
        rentAmount: rentValue,
        isOccupied: false,
        imageUrl: mainImageUrl,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }, { merge: true });

      toast({ title: "Property Added", description: "Successfully created in your portfolio." });
      setIsAddDialogOpen(false);
      setAddress('');
      setZipCode('');
      setRentAmount('');
      setDescription('');
    } catch (error) {
      toast({ variant: "destructive", title: "Save Failed", description: "Could not create property record." });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);
    deleteDocumentNonBlocking(propertyRef);
    toast({ title: "Property Deleted" });
  };

  if (isLoading) return <div className="flex flex-col items-center justify-center h-[60vh]"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Properties</h1>
          <p className="text-muted-foreground font-medium">Manage your rental assets and occupancy status.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Add New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <form onSubmit={handleAddProperty}>
              <DialogHeader>
                <DialogTitle>Add Property</DialogTitle>
                <DialogDescription>Enter the details of your new rental property.</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Postcode</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent">Monthly Rent (£)</Label>
                    <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="desc">Description</Label>
                  <Input id="desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Brief overview of the property" />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full h-12 rounded-xl font-bold" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : "Confirm Property Creation"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {properties?.map((property) => (
          <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-all duration-300">
            <div className="relative h-48 w-full">
              <Image 
                src={property.imageUrl} 
                alt={property.addressLine1} 
                fill 
                className="object-cover transition-transform group-hover:scale-105" 
                data-ai-hint="rental property"
              />
              <Badge className={`absolute top-4 right-4 ${property.isOccupied ? 'bg-green-500' : 'bg-amber-500'}`}>
                {property.isOccupied ? 'Occupied' : 'Vacant'}
              </Badge>
            </div>
            <CardHeader>
              <CardTitle className="text-lg font-bold font-headline">{property.addressLine1}</CardTitle>
              <p className="text-sm text-muted-foreground flex items-center"><MapPin className="w-3 h-3 mr-1" /> {property.zipCode}</p>
            </CardHeader>
            <CardFooter className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="rounded-lg h-9 text-xs font-bold" asChild>
                <Link href={`/landlord/properties/${property.id}`}><Edit3 className="w-3 h-3 mr-2" /> Manage</Link>
              </Button>
              <Button variant="ghost" className="rounded-lg h-9 text-xs text-destructive hover:bg-destructive/10" onClick={() => handleDeleteProperty(property.id)}>
                <Trash2 className="w-3 h-3 mr-2" /> Delete
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
