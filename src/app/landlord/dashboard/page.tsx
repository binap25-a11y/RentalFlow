
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, AlertTriangle, FileText, ArrowRight, ShieldAlert } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, isBefore, addDays, isValid, parseISO } from "date-fns";
import { useMemo, useState, useEffect } from "react";

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, "properties"),
      where("landlordId", "==", user.uid)
    );
  }, [db, user]);

  const { data: properties } = useCollection(propertiesQuery);

  const documentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // Standard security rules require a filter on the owner field
    return query(
      collection(db, "documents"),
      where("userId", "==", user.uid)
    );
  }, [db, user]);

  const { data: documents } = useCollection(documentsQuery);

  const stats = useMemo(() => {
    if (!isClient) {
      return [
        { label: 'Total Properties', value: 0, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'Occupied', value: 0, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
        { label: 'Expiring Soon', value: 0, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
      ];
    }

    const total = properties?.length || 0;
    const occupied = properties?.filter(p => p.isOccupied).length || 0;
    const today = new Date();
    const threshold = addDays(today, 30);
    
    const expiring = documents?.filter(d => {
      if (!d.expiryDate || typeof d.expiryDate !== 'string') return false;
      try {
        const expiry = parseISO(d.expiryDate);
        if (!isValid(expiry)) return false;
        return isBefore(expiry, threshold);
      } catch {
        return false;
      }
    }).length || 0;

    return [
      { label: 'Total Properties', value: total, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Occupied', value: occupied, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
      { label: 'Expiring Soon', value: expiring, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    ];
  }, [properties, documents, isClient]);

  const expiringDocs = useMemo(() => {
    if (!isClient || !documents) return [];
    const today = new Date();
    const threshold = addDays(today, 30);

    return documents
      .filter(d => {
        if (!d.expiryDate || typeof d.expiryDate !== 'string') return false;
        try {
          const expiry = parseISO(d.expiryDate);
          if (!isValid(expiry)) return false;
          return isBefore(expiry, threshold);
        } catch {
          return false;
        }
      })
      .sort((a, b) => {
        const dateA = a.expiryDate ? new Date(a.expiryDate).getTime() : 0;
        const dateB = b.expiryDate ? new Date(b.expiryDate).getTime() : 0;
        return dateA - dateB;
      });
  }, [documents, isClient]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Portfolio Overview</h1>
        <p className="text-muted-foreground font-medium font-body">Monitoring your properties and resident requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold font-headline">{stat.value}</p>
                <p className="text-sm text-muted-foreground font-medium font-body">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <ShieldAlert className="w-5 h-5 mr-2 text-amber-500" />
              Urgent Renewals
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {!isClient ? (
              <div className="flex justify-center py-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div></div>
            ) : expiringDocs.length > 0 ? (
              expiringDocs.map((doc) => {
                let expiryDate: Date | null = null;
                try {
                  expiryDate = parseISO(doc.expiryDate!);
                } catch {
                  expiryDate = null;
                }
                
                return (
                  <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <FileText className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm font-body">{doc.documentType}</h4>
                        <p className="text-xs text-muted-foreground font-body">
                          Expires: {expiryDate && isValid(expiryDate) ? format(expiryDate, 'PPP') : 'Invalid Date'}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/landlord/properties/${doc.propertyId}`}>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                );
              })
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <ShieldAlert className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold font-headline mb-1">All compliant</h3>
                <p className="text-sm text-muted-foreground font-body max-w-xs">No documents require immediate renewal.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button className="w-full justify-start h-12 bg-primary hover:bg-primary/90 rounded-xl font-headline font-bold" asChild>
              <Link href="/landlord/properties">
                <Building2 className="w-5 h-5 mr-3" />
                Add New Property
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl border-primary/20 hover:bg-primary/5 font-headline font-bold" asChild>
              <Link href="/landlord/tenants">
                <Users className="w-5 h-5 mr-3 text-primary" />
                Assign Resident
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl border-accent/20 hover:bg-accent/5 font-headline font-bold" asChild>
              <Link href="/landlord/maintenance">
                <AlertTriangle className="w-5 h-5 mr-3 text-accent" />
                Maintenance Dashboard
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
