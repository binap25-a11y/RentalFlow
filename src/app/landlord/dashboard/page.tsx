
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, AlertTriangle, FileText, ArrowRight, ShieldAlert } from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { collection, query, where } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format, isBefore, addDays, isValid } from "date-fns";
import { useMemo } from "react";

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return collection(db, "users", user.uid, "properties");
  }, [db, user]);

  const { data: properties } = useCollection(propertiesQuery);

  const documentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // Security rules require an explicit filter on landlordId for list operations on the documents collection
    return query(
      collection(db, "documents"),
      where("landlordId", "==", user.uid)
    );
  }, [db, user]);

  const { data: documents } = useCollection(documentsQuery);

  const stats = useMemo(() => {
    const total = properties?.length || 0;
    const occupied = properties?.filter(p => p.isOccupied).length || 0;
    const expiring = documents?.filter(d => {
      if (!d.expiryDate) return false;
      const expiry = new Date(d.expiryDate);
      if (!isValid(expiry)) return false;
      return isBefore(expiry, addDays(new Date(), 30));
    }).length || 0;

    return [
      { label: 'Total Properties', value: total, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Occupied', value: occupied, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
      { label: 'Expiring Soon', value: expiring, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
    ];
  }, [properties, documents]);

  const expiringDocs = useMemo(() => {
    if (!documents) return [];
    return documents
      .filter(d => {
        if (!d.expiryDate) return false;
        const expiry = new Date(d.expiryDate);
        if (!isValid(expiry)) return false;
        return isBefore(expiry, addDays(new Date(), 30));
      })
      .sort((a, b) => {
        const dateA = new Date(a.expiryDate!).getTime();
        const dateB = new Date(b.expiryDate!).getTime();
        return dateA - dateB;
      });
  }, [documents]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Portfolio Overview</h1>
        <p className="text-muted-foreground font-medium">Monitoring your properties and resident requests.</p>
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
                <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
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
            {expiringDocs.length > 0 ? (
              expiringDocs.map((doc) => {
                const expiryDate = new Date(doc.expiryDate!);
                return (
                  <div key={doc.id} className="flex items-center justify-between p-4 rounded-xl bg-amber-50 border border-amber-100">
                    <div className="flex items-center gap-4">
                      <div className="p-2 bg-white rounded-lg shadow-sm">
                        <FileText className="w-5 h-5 text-amber-500" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{doc.documentType}</h4>
                        <p className="text-xs text-muted-foreground">
                          Expires: {isValid(expiryDate) ? format(expiryDate, 'PPP') : 'Invalid Date'}
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
                <h3 className="text-lg font-semibold mb-1">All compliant</h3>
                <p className="text-sm text-muted-foreground max-w-xs">No documents require immediate renewal.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm h-fit">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button className="w-full justify-start h-12 bg-primary hover:bg-primary/90 rounded-xl" asChild>
              <Link href="/landlord/properties">
                <Building2 className="w-5 h-5 mr-3" />
                Add New Property
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl border-primary/20 hover:bg-primary/5" asChild>
              <Link href="/landlord/tenants">
                <Users className="w-5 h-5 mr-3 text-primary" />
                Assign Resident
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl border-accent/20 hover:bg-accent/5" asChild>
              <Link href="/landlord/inspections">
                <AlertTriangle className="w-5 h-5 mr-3 text-accent" />
                Schedule Inspection
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
