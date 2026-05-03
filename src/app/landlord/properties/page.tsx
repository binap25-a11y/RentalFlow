"use client";

import { useState, useMemo } from 'react';
import { useUser, useFirestore, useCollection, getLandlordCollectionQuery, setDocumentNonBlocking, deleteDocumentNonBlocking, useStorage } from '@/firebase';
import { doc, serverTimestamp, collection } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Plus, Bed, Bath, Loader2, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

export default function PropertiesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();

  const propertiesQuery = useMemo(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: properties, loading } = useCollection(propertiesQuery);

  const handleDeleteProperty = (propertyId: string) => {
    if (!user || !db) return;
    const propertyRef = doc(db, 'properties', propertyId);
    deleteDocumentNonBlocking(propertyRef);
    toast({ title: "Asset Decommissioned" });
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Portfolio Inventory</h1>
          <p className="text-muted-foreground font-medium">Monitoring and managing your property assets.</p>
        </div>
        
        <Button asChild className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg shadow-primary/20">
          <Link href="/landlord/properties/new">
            <Plus className="w-4 h-4 mr-2" />
            Register New Asset
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {loading ? (
          <div className="col-span-full py-24 text-center flex flex-col items-center justify-center">
            <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground font-medium">Syncing portfolio inventory...</p>
          </div>
        ) : !properties || properties.length === 0 ? (
          <div className="col-span-full py-24 text-center flex flex-col items-center justify-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-primary/20">
            <Building2 className="w-16 h-16 text-primary/20 mb-6" />
            <h3 className="text-xl font-headline font-bold text-primary/40 mb-2">No Assets Found</h3>
            <p className="text-muted-foreground font-medium mb-6">Start by registering your first property asset.</p>
            <Button variant="outline" asChild className="rounded-xl font-bold border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
              <Link href="/landlord/properties/new">Add First Asset</Link>
            </Button>
          </div>
        ) : (
          properties.map((property) => {
            const displayImage = property.imageUrl || `https://picsum.photos/seed/${property.id}/800/600`;

            return (
              <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300 rounded-2xl bg-card">
                <div className="relative h-56 w-full overflow-hidden bg-muted">
                  <Image 
                    src={displayImage} 
                    alt={property.addressLine1} 
                    fill 
                    className="object-cover transition-transform duration-500 group-hover:scale-105" 
                    unoptimized={true}
                    data-ai-hint="property exterior"
                  />
                  <Badge className={cn(
                    "absolute top-4 right-4 font-bold shadow-lg py-1 px-3",
                    property.isOccupied ? 'bg-emerald-500' : 'bg-amber-500'
                  )}>
                    {property.isOccupied ? 'Occupied' : 'Vacant'}
                  </Badge>
                </div>
                <CardHeader className="pb-2 text-left space-y-1">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary/60 border-primary/10">{property.propertyType}</Badge>
                    <div className="flex gap-2 text-muted-foreground text-xs font-bold">
                      <span className="flex items-center gap-1"><Bed className="w-3 h-3" /> {property.numberOfBedrooms}</span>
                      <span className="flex items-center gap-1"><Bath className="w-3 h-3" /> {property.numberOfBathrooms}</span>
                    </div>
                  </div>
                  <CardTitle className="text-lg font-bold font-headline truncate">{property.addressLine1}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center font-medium"><MapPin className="w-3 h-3 mr-1 text-primary/30" /> {property.city}, {property.zipCode}</p>
                </CardHeader>
                <CardContent className="pb-4 text-left">
                  <p className="text-xl font-bold text-primary">£{property.rentAmount}<span className="text-xs text-muted-foreground font-medium"> / mo</span></p>
                </CardContent>
                <CardFooter className="flex gap-2 pt-4 border-t border-primary/5">
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10 hover:bg-primary hover:text-white transition-all" asChild>
                    <Link href={`/landlord/properties/${property.id}`}>Manage</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10 hover:bg-primary/5" asChild>
                    <Link href={`/landlord/properties/${property.id}/edit`}>Edit</Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-xl h-10 text-destructive/40 hover:text-destructive hover:bg-destructive/5" onClick={() => handleDeleteProperty(property.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}