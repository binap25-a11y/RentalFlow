
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
import { Building2, MapPin, Plus, Trash2, Edit3, Loader2, Home, Wrench, FileCheck, Phone, DollarSign } from "lucide-react";
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
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form State
  const [address, setAddress] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [rentAmount, setRentAmount] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('https://picsum.photos/seed/rental/800/600');

  const handleAddProperty = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db) return;

    const propertyId = doc(collection(db, 'dummy')).id;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);

    setDocumentNonBlocking(propertyRef, {
      id: propertyId,
      landlordId: user.uid,
      addressLine1: address,
      city: 'London', // Default for now
      state: 'UK',
      zipCode: zipCode,
      description: description,
      numberOfBedrooms: 2,
      numberOfBathrooms: 1,
      rentAmount: Number(rentAmount),
      isOccupied: false,
      imageUrl: imageUrl,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }, { merge: true });

    setIsAddDialogOpen(false);
    setAddress('');
    setZipCode('');
    setRentAmount('');
    setDescription('');
    toast({ title: "Property Added", description: "The property has been added to your portfolio." });
  };

  const handleDeleteProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'users', user.uid, 'properties', propertyId);
    deleteDocumentNonBlocking(propertyRef);
    toast({ title: "Property Deleted", description: "The property has been removed from your portfolio." });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-medium">Loading your portfolio...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Properties</h1>
          <p className="text-muted-foreground font-medium">Manage your rental assets and occupancy status.</p>
        </div>
        
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20">
              <Plus className="w-4 h-4 mr-2" />
              Add New Property
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] rounded-2xl">
            <form onSubmit={handleAddProperty}>
              <DialogHeader>
                <DialogTitle>Add Property</DialogTitle>
                <DialogDescription>
                  Enter the details of your new rental property.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Full Address</Label>
                  <Input id="address" value={address} onChange={(e) => setAddress(e.target.value)} placeholder="123 Lease St, London" required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="zipCode">Postcode</Label>
                    <Input id="zipCode" value={zipCode} onChange={(e) => setZipCode(e.target.value)} placeholder="E1 6AN" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rent">Monthly Rent (£)</Label>
                    <Input id="rent" type="number" value={rentAmount} onChange={(e) => setRentAmount(e.target.value)} placeholder="1500" required />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Short Description</Label>
                  <Input id="description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Modern 2-bed apartment..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="image">Image URL (Optional)</Label>
                  <Input id="image" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://..." />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" className="w-full">Save Property</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {!properties || properties.length === 0 ? (
        <Card className="border-dashed border-2 flex flex-col items-center justify-center py-20 text-center">
          <div className="p-4 bg-primary/5 rounded-full mb-4">
            <Building2 className="w-12 h-12 text-primary/40" />
          </div>
          <h3 className="text-xl font-bold font-headline mb-2">No Properties Found</h3>
          <p className="text-muted-foreground max-w-sm mb-6">Start building your portfolio by adding your first rental property.</p>
          <Button variant="outline" onClick={() => setIsAddDialogOpen(true)}>
            Add Property Now
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((property) => (
            <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-md transition-shadow">
              <div className="relative h-48 w-full">
                <Image 
                  src={property.imageUrl || 'https://picsum.photos/seed/prop/800/600'} 
                  alt={property.addressLine1} 
                  fill 
                  className="object-cover transition-transform group-hover:scale-105"
                  data-ai-hint="rental property"
                />
                <Badge className={`absolute top-4 right-4 ${property.isOccupied ? 'bg-green-500' : 'bg-amber-500'}`}>
                  {property.isOccupied ? 'Occupied' : 'Vacant'}
                </Badge>
              </div>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg font-bold font-headline line-clamp-1">{property.addressLine1}</CardTitle>
                <p className="text-sm text-muted-foreground flex items-center">
                  <MapPin className="w-3 h-3 mr-1" /> {property.zipCode}
                </p>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4 h-10">{property.description}</p>
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold text-primary">
                    £{property.rentAmount}<span className="text-xs font-normal text-muted-foreground">/mo</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="grid grid-cols-2 gap-2 pt-0">
                <Button variant="outline" className="rounded-lg h-9 text-xs" asChild>
                  <Link href={`/landlord/properties/${property.id}`}>
                    <Edit3 className="w-3 h-3 mr-2" />
                    Manage
                  </Link>
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" className="rounded-lg h-9 text-xs text-destructive hover:text-destructive hover:bg-destructive/10">
                      <Trash2 className="w-3 h-3 mr-2" />
                      Delete
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Are you absolutely sure?</DialogTitle>
                      <DialogDescription>
                        This will permanently delete the property "{property.addressLine1}" and all associated data. This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <Button variant="destructive" onClick={() => handleDeleteProperty(property.id)}>Confirm Delete</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
