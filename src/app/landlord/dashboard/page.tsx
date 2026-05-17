
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, Users, AlertTriangle, FileText, ArrowRight, 
  ShieldAlert, Loader2, TrendingUp, Wallet, CheckCircle2,
  Calendar as CalendarIcon, Zap, ClipboardList
} from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, getLandlordCollectionQuery, getMemberCollectionQuery } from "@/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isBefore, addDays, isValid, parseISO, format } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);

  const { data: properties, loading: propLoading } = useCollection(propertiesQuery);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "maintenanceRequests", user.uid);
  }, [db, user]);

  const { data: maintenance } = useCollection(maintenanceQuery);

  const documentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getMemberCollectionQuery(db, "documents", user.uid);
  }, [db, user]);

  const { data: documents, loading: docsLoading } = useCollection(documentsQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "inspections", user.uid);
  }, [db, user]);

  const { data: inspections } = useCollection(inspectionsQuery);

  const complianceItems = useMemo(() => {
    if (!isClient || !documents || !inspections) return [];
    const today = new Date();
    const threshold = addDays(today, 60);

    const docItems = documents
      .filter(d => {
        if (!d.expiryDate) return false;
        try {
          const expiry = parseISO(d.expiryDate);
          return isValid(expiry) && isBefore(expiry, threshold);
        } catch { return false; }
      })
      .map(d => ({
        id: d.id,
        title: d.fileName,
        date: d.expiryDate!,
        type: 'Document',
        icon: FileText,
        propertyId: d.propertyId,
        urgent: isBefore(parseISO(d.expiryDate!), addDays(today, 14))
      }));

    const inspectionItems = inspections
      .filter(i => {
        if (i.status === 'completed' || !i.scheduledDate) return false;
        try {
          const scheduled = parseISO(i.scheduledDate);
          return isValid(scheduled) && isBefore(scheduled, threshold);
        } catch { return false; }
      })
      .map(i => ({
        id: i.id,
        title: `${properties?.find(p => p.id === i.propertyId)?.addressLine1 || 'Property'} Audit`,
        date: i.scheduledDate!,
        type: 'Audit',
        icon: ClipboardList,
        propertyId: i.propertyId,
        urgent: isBefore(parseISO(i.scheduledDate!), addDays(today, 7))
      }));

    return [...docItems, ...inspectionItems].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [documents, inspections, properties, isClient]);

  const healthScore = useMemo(() => {
    if (!isClient) return { grade: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' };
    const urgentCount = complianceItems.filter(i => i.urgent).length;
    if (urgentCount > 2) return { grade: 'C', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' };
    if (urgentCount > 0) return { grade: 'B', color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200' };
    return { grade: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' };
  }, [complianceItems, isClient]);

  const stats = useMemo(() => {
    if (!isClient || !properties || !maintenance) return null;

    const total = properties.length || 0;
    const occupied = properties.filter(p => p.isOccupied).length || 0;
    const grossRent = properties.reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    const totalExpenses = maintenance.reduce((acc, r) => acc + (r.cost || 0), 0);
    const netRevenue = grossRent - (totalExpenses / 12); 
    const avgYield = total > 0 ? (occupied / total) * 100 : 0;

    return [
      { label: 'Portfolio Assets', value: total.toString(), icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
      { label: 'Est. Net Monthly', value: `£${Math.ceil(Math.max(0, netRevenue)).toLocaleString()}`, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Occupancy Rate', value: `${avgYield.toFixed(0)}%`, icon: TrendingUp, color: 'text-violet-600', bg: 'bg-violet-50' },
    ];
  }, [properties, maintenance, isClient]);

  const chartData = useMemo(() => {
    if (!isClient || !properties) return [];
    return properties.map(p => ({
      name: p.addressLine1.split(' ')[0],
      rent: p.rentAmount || 0,
    })).slice(0, 5);
  }, [properties, isClient]);

  if (!isClient || propLoading || docsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-muted-foreground font-medium font-body">Syncing portfolio data...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="text-left flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2 tracking-tight">Portfolio Performance</h1>
          <p className="text-muted-foreground font-medium font-body">Financial yield and real-time compliance roadmap.</p>
        </div>
        <Badge className={cn("font-bold py-1 px-4 rounded-full border", healthScore.bg, healthScore.color, healthScore.border)}>
          <Zap className="w-3 h-3 mr-2" /> Portfolio Health: {healthScore.grade}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats?.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden">
            <CardContent className="pt-6 text-left">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xl md:text-2xl font-bold font-headline break-words">
                  {stat.value}
                </p>
                <p className="text-sm text-muted-foreground font-medium font-body break-words">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm rounded-2xl overflow-hidden">
          <CardHeader className="text-left pb-2">
            <CardTitle className="text-xl font-headline flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-primary" />
              Revenue by Asset
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[300px] pt-4">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 600}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}}
                  />
                  <Bar dataKey="rent" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} barSize={40} />
                </BarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="text-left">
              <CardTitle className="text-lg font-headline flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-primary" />
                Compliance Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {complianceItems.length > 0 ? (
                complianceItems.slice(0, 5).map((item) => (
                  <div 
                    key={`${item.type}-${item.id}`} 
                    className={cn(
                      "flex items-center justify-between p-3 rounded-xl border transition-colors",
                      item.urgent ? "bg-amber-50 border-amber-100" : "bg-muted/30 border-transparent"
                    )}
                  >
                    <div className="text-left min-w-0 flex gap-3 items-center">
                      <div className={cn("p-2 rounded-lg", item.urgent ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary")}>
                        <item.icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-xs font-body truncate">{item.title}</h4>
                        <p className={cn("text-[10px] font-bold flex items-center", item.urgent ? "text-amber-600" : "text-muted-foreground")}>
                          <CalendarIcon className="w-3 h-3 mr-1" /> {format(parseISO(item.date), 'PP')}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" asChild className="h-8 w-8 p-0 rounded-full shrink-0">
                      <Link href={`/landlord/properties/${item.propertyId}`}>
                        <ArrowRight className="w-4 h-4" />
                      </Link>
                    </Button>
                  </div>
                ))
              ) : (
                <div className="py-8 text-center bg-muted/20 rounded-xl">
                  <CheckCircle2 className="w-8 h-8 mx-auto text-emerald-500 mb-2" />
                  <p className="text-xs text-muted-foreground font-bold uppercase tracking-wider">All Compliant</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-2xl">
            <CardHeader className="text-left">
              <CardTitle className="text-lg font-headline">Quick Navigation</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <Button className="w-full justify-start h-11 bg-primary rounded-xl font-headline font-bold shadow-lg shadow-primary/20" asChild>
                <Link href="/landlord/properties/new">
                  <Building2 className="w-4 h-4 mr-3" />
                  Add Property
                </Link>
              </Button>
              <Button variant="outline" className="w-full justify-start h-11 rounded-xl font-headline font-bold border-primary/20" asChild>
                <Link href="/landlord/messages">
                  <Users className="w-4 h-4 mr-3" />
                  Messaging Hub
                </Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
