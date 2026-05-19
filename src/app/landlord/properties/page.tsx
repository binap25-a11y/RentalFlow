"use client";

import { useState, useMemo, useEffect } from 'react';
import { useUser, useFirestore, useCollection, getLandlordCollectionQuery, deleteDocumentNonBlocking } from '@/firebase';
import { doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Building2, MapPin, Plus, Bed, Bath, Loader2, Trash2, Edit3 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { PlaceHolderImages } from "@/lib/placeholder-images";

const getMemoryAssets = (id: string): string[] | null => {
  if (typeof window === 'undefined') return null;
  return (window as any).__asset_bridge?.[id] || null;
};

export default function PropertiesPage() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

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

  if (!isClient) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-left">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Portfolio Inventory</h1>
          <p className="text-muted-foreground font-medium font-body">Monitoring and managing your property assets.</p>
        </div>
        
        <Button asChild className="rounded-xl bg-primary hover:bg-primary/90 font-bold h-11 px-6 shadow-lg shadow-primary/20 text-white">
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
            <p className="text-muted-foreground font-medium font-body">Syncing portfolio inventory...</p>
          </div>
        ) : !properties || properties.length === 0 ? (
          <div className="col-span-full py-24 text-center flex flex-col items-center justify-center bg-muted/10 rounded-[2rem] border-2 border-dashed border-primary/20">
            <Building2 className="w-16 h-16 text-primary/20 mb-6" />
            <h3 className="text-xl font-headline font-bold text-primary/40 mb-2">No Assets Found</h3>
            <p className="text-muted-foreground font-medium mb-6 font-body">Start by registering your first property asset.</p>
            <Button variant="outline" asChild className="rounded-xl font-bold border-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
              <Link href="/landlord/properties/new">Add First Asset</Link>
            </Button>
          </div>
        ) : (
          properties.map((property) => {
            // HARDEN: Prioritize Memory Bridge for instant feedback, then DB, then official placeholder
            const bridgeAssets = getMemoryAssets(property.id);
            const dbUrl = property.imageUrl;
            const officialPlaceholder = PlaceHolderImages.find(img => img.id === 'prop-1')?.imageUrl || `https://picsum.photos/seed/prop-fallback/800/600`;
            
            const displayImage = (bridgeAssets && bridgeAssets.length > 0) 
              ? bridgeAssets[0] 
              : (dbUrl && dbUrl.length > 5 ? dbUrl : officialPlaceholder);

            return (
              <Card key={property.id} className="border-none shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-300 rounded-2xl bg-card border border-transparent hover:border-primary/5">
                <div className="relative h-56 w-full overflow-hidden bg-muted">
                  <Image 
                    src={displayImage} 
                    alt={property.addressLine1} 
                    fill 
                    className="object-cover transition-transform duration-500 group-hover:scale-105" 
                    unoptimized={true}
                    data-ai-hint="real estate"
                  />
                  <Badge className={cn(
                    "absolute top-4 right-4 font-bold shadow-lg py-1 px-3 text-[10px] uppercase",
                    property.isOccupied ? 'bg-emerald-500' : 'bg-amber-500'
                  )}>
                    {property.isOccupied ? 'Occupied' : 'Vacant'}
                  </Badge>
                </div>
                
                <div className="px-6 pt-4 flex flex-wrap gap-2 items-center">
                  <div className="flex items-center gap-1.5 bg-primary/5 px-2 py-1 rounded-lg border border-primary/10 shadow-sm min-w-[65px] justify-center">
                    <Bed className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-bold text-primary uppercase">{property.numberOfBedrooms || 1} Bed</span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-primary/5 px-2 py-1 rounded-lg border border-primary/10 shadow-sm min-w-[65px] justify-center">
                    <Bath className="w-3 h-3 text-primary" />
                    <span className="text-[9px] font-bold text-primary uppercase">{property.numberOfBathrooms || 1} Bath</span>
                  </div>
                </div>

                <CardHeader className="pb-2 text-left space-y-1">
                  <div className="flex justify-between items-start">
                    <Badge variant="outline" className="text-[10px] uppercase font-bold text-primary/60 border-primary/10 bg-primary/[0.02]">{property.propertyType}</Badge>
                  </div>
                  <CardTitle className="text-lg font-bold font-headline truncate tracking-tight">{property.addressLine1}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center font-medium font-body"><MapPin className="w-3 h-3 mr-1 text-primary/30" /> {property.city}, {property.zipCode}</p>
                </CardHeader>
                <CardContent className="pb-4 text-left">
                  <p className="text-xl font-bold text-primary font-headline">£{property.rentAmount}<span className="text-xs text-muted-foreground font-medium font-body"> / month</span></p>
                </CardContent>
                <CardFooter className="flex gap-2 pt-4 border-t border-primary/5">
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10 hover:bg-primary hover:text-white transition-all font-headline" asChild>
                    <Link href={`/landlord/properties/${property.id}`}>Manage</Link>
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1 rounded-xl font-bold h-10 border-primary/10 hover:bg-primary/5 font-headline" asChild>
                    <Link href={`/landlord/properties/${property.id}/edit`}>Edit</Link>
                  </Button>
                  <Button variant="ghost" size="icon" className="rounded-xl h-10 text-destructive/40 hover:text-destructive hover:bg-destructive/5 transition-colors" onClick={() => handleDeleteProperty(property.id)}>
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
