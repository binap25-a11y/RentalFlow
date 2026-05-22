"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, Wallet, TrendingUp, FileText, ArrowRight, 
  ShieldAlert, Loader2, CheckCircle2,
  Calendar as CalendarIcon, Zap, ClipboardList, AlertTriangle
} from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, getLandlordCollectionQuery } from "@/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isBefore, addDays, isValid, parseISO, format } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
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
    return getLandlordCollectionQuery(db, "documents", user.uid);
  }, [db, user]);

  const { data: documents, loading: docsLoading } = useCollection(documentsQuery);

  const inspectionsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "inspections", user.uid);
  }, [db, user]);

  const { data: inspections } = useCollection(inspectionsQuery);

  const parseFlexDate = (dateVal: any) => {
    if (!dateVal) return null;
    if (typeof dateVal === 'string') return parseISO(dateVal);
    if (dateVal.toDate && typeof dateVal.toDate === 'function') return dateVal.toDate();
    if (dateVal.seconds) return new Date(dateVal.seconds * 1000);
    return null;
  };

  const formatSafeDate = (dateVal: any) => {
    const d = parseFlexDate(dateVal);
    return d && isValid(d) ? format(d, 'PP') : 'TBC';
  };

  const complianceItems = useMemo(() => {
    if (!isClient || !properties) return [];
    const today = new Date();
    const threshold = addDays(today, 30); 

    const docItems = (documents || [])
      .filter(d => {
        const expiry = parseFlexDate(d.expiryDate);
        return expiry && isValid(expiry) && isBefore(expiry, addDays(today, 365));
      })
      .map(d => ({
        id: d.id,
        title: `${properties?.find(p => p.id === d.propertyId)?.addressLine1 || d.fileName || 'Portfolio Document'}`,
        subtitle: 'Certificate Expiry',
        date: d.expiryDate,
        type: 'Document',
        icon: FileText,
        propertyId: d.propertyId,
        urgent: isBefore(parseFlexDate(d.expiryDate)!, threshold)
      }));

    const inspectionItems = (inspections || [])
      .filter(i => {
        if (i.status === 'completed') return false;
        const scheduled = parseFlexDate(i.scheduledDate);
        return scheduled && isValid(scheduled);
      })
      .map(i => ({
        id: i.id,
        title: `${properties?.find(p => p.id === i.propertyId)?.addressLine1 || 'Property Asset'} Audit`,
        subtitle: 'Scheduled Audit',
        date: i.scheduledDate,
        type: 'Audit',
        icon: ClipboardList,
        propertyId: i.propertyId,
        urgent: isBefore(parseFlexDate(i.scheduledDate)!, addDays(today, 14))
      }));

    const propertyStatusItems = properties.map(p => {
      const allPropDocs = (documents || []).filter(d => d.propertyId === p.id);
      const docCount = allPropDocs.length;
      
      if (docCount === 0) {
        return {
          id: `missing-${p.id}`,
          title: p.addressLine1 || 'Property Asset',
          subtitle: 'Missing Essential Records',
          date: null,
          type: 'Missing',
          icon: AlertTriangle,
          propertyId: p.id,
          urgent: true
        };
      }

      const isAlreadyListed = [...docItems, ...inspectionItems].some(item => item.propertyId === p.id);
      if (isAlreadyListed) return null;

      return {
        id: `status-${p.id}`,
        title: p.addressLine1 || 'Property Asset',
        subtitle: `Compliant & Verified (${docCount} Docs)`,
        date: null,
        type: 'Status',
        icon: CheckCircle2,
        propertyId: p.id,
        urgent: false
      };
    }).filter(Boolean) as any[];

    return [...docItems, ...inspectionItems, ...propertyStatusItems].sort((a, b) => {
      if (a.type === 'Missing' && b.type !== 'Missing') return -1;
      if (b.type === 'Missing' && a.type !== 'Missing') return 1;
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      return 0;
    });
  }, [documents, inspections, properties, isClient]);

  const healthScore = useMemo(() => {
    if (!isClient) return { grade: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' };
    const missingCount = complianceItems.filter(i => i.type === 'Missing').length;
    const urgentCount = complianceItems.filter(i => i.urgent && i.type !== 'Missing').length;

    if (missingCount > 0) return { grade: 'D', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' };
    if (urgentCount > 3) return { grade: 'C', color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' };
    if (urgentCount > 0) return { grade: 'B', color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200' };
    return { grade: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' };
  }, [complianceItems, isClient]);

  const stats = useMemo(() => {
    if (!isClient || !properties || !maintenance) return null;
    const total = properties.length || 0;
    const occupied = properties.filter(p => p.isOccupied).length || 0;
    const grossRent = properties.reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    const totalExpenses = maintenance.reduce((acc, r) => acc + (r.cost || 0), 0);
    const netRevenue = Math.ceil(grossRent - (totalExpenses / 12)); 
    const occupancyRate = total > 0 ? (occupied / total) * 100 : 0;

    return [
      { label: 'Portfolio Assets', value: total.toString(), icon: Building2, color: 'text-primary', bg: 'bg-primary/5' },
      { label: 'Est. Net Monthly', value: `£${netRevenue.toLocaleString()}`, icon: Wallet, color: 'text-emerald-600', bg: 'bg-emerald-50' },
      { label: 'Occupancy Rate', value: `${occupancyRate.toFixed(0)}%`, icon: TrendingUp, color: 'text-accent', bg: 'bg-accent/5' },
    ];
  }, [properties, maintenance, isClient]);

  const chartData = useMemo(() => {
    if (!isClient || !properties) return [];
    return properties.map(p => ({
      name: p.addressLine1 ? p.addressLine1.split(' ')[0] : 'Prop',
      rent: p.rentAmount || 0,
    })).slice(0, 6);
  }, [properties, isClient]);

  if (!isClient || propLoading || docsLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] space-y-6">
        <div className="relative">
          <div className="absolute inset-0 bg-primary/20 rounded-full blur-2xl animate-pulse" />
          <Loader2 className="w-12 h-12 animate-spin text-primary relative z-10" />
        </div>
        <p className="text-muted-foreground font-bold font-headline uppercase tracking-[0.3em] text-[10px]">Establishing Secure Ledger</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="text-left">
          <h1 className="text-4xl font-headline font-bold text-primary mb-2 tracking-tight">Executive Dashboard</h1>
          <p className="text-muted-foreground font-medium font-body max-w-lg">Redundant compliance monitoring and high-yield portfolio analytics.</p>
        </div>
        <div className="flex items-center gap-4">
          <Badge className={cn("font-bold py-2 px-6 rounded-2xl border shadow-sm transition-all text-xs", healthScore.bg, healthScore.color, healthScore.border)}>
            <Zap className="w-3.5 h-3.5 mr-2 animate-pulse" /> Portfolio Grade: {healthScore.grade}
          </Badge>
          <Button className="rounded-2xl h-11 px-6 font-bold bg-primary shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all" asChild>
            <Link href="/landlord/properties/new">Register New Asset</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {stats?.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm hover:shadow-xl transition-all rounded-[2rem] overflow-hidden group bg-white border border-transparent hover:border-primary/5">
            <CardContent className="pt-8 text-left px-8">
              <div className="flex items-center justify-between mb-6">
                <div className={`${stat.bg} ${stat.color} p-4 rounded-2xl shadow-inner transition-transform group-hover:scale-110`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-3xl font-bold font-headline tracking-tighter text-primary">
                  {stat.value}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest font-headline opacity-60 group-hover:opacity-100 transition-opacity">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-8 border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
          <CardHeader className="text-left px-10 pt-10 pb-4 border-b border-primary/5">
            <CardTitle className="text-2xl font-headline flex items-center text-primary">
              <TrendingUp className="w-6 h-6 mr-3 text-accent" />
              Yield Distribution
            </CardTitle>
          </CardHeader>
          <CardContent className="h-[400px] p-10">
             <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: '#64748b'}} dy={15} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#94a3b8'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc', radius: 12}}
                    contentStyle={{borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px'}}
                    itemStyle={{fontWeight: 800, color: 'hsl(var(--primary))'}}
                  />
                  <Bar dataKey="rent" radius={[12, 12, 0, 0]} barSize={50}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--primary))' : 'hsl(var(--primary) / 0.4)'} />
                    ))}
                  </Bar>
                </BarChart>
             </ResponsiveContainer>
          </CardContent>
        </Card>

        <div className="lg:col-span-4 space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden">
            <CardHeader className="text-left px-8 pt-8 pb-4 border-b border-primary/5 bg-primary/[0.02]">
              <CardTitle className="text-lg font-headline flex items-center text-primary">
                <ShieldAlert className="w-5 h-5 mr-3 text-accent" />
                Portfolio Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-8">
              {complianceItems.length > 0 ? (
                <div className="space-y-4 max-h-[450px] overflow-y-auto no-scrollbar pr-1">
                  {complianceItems.map((item) => (
                    <div 
                      key={`${item.type}-${item.id}`} 
                      className={cn(
                        "group flex items-center justify-between p-4 rounded-3xl border transition-all hover:scale-[1.03] shadow-sm hover:shadow-md",
                        item.type === 'Missing' ? "bg-red-50/50 border-red-100" :
                        item.urgent ? "bg-amber-50/50 border-amber-100" : "bg-white border-primary/5"
                      )}
                    >
                      <div className="text-left min-w-0 flex gap-4 items-center">
                        <div className={cn(
                          "p-3 rounded-2xl shadow-sm transition-transform group-hover:rotate-6", 
                          item.type === 'Missing' ? "bg-red-100 text-red-600" :
                          item.urgent ? "bg-amber-100 text-amber-600" : 
                          item.type === 'Status' ? "bg-emerald-100 text-emerald-600" : "bg-primary/5 text-primary"
                        )}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[13px] font-headline text-primary leading-tight truncate pr-4">{item.title}</h4>
                          <div className="flex items-center gap-3 mt-1.5">
                            <p className={cn(
                              "text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full",
                              item.type === 'Status' ? "bg-emerald-100 text-emerald-700" : 
                              item.type === 'Missing' ? "bg-red-100 text-red-700" : "bg-primary/5 text-muted-foreground"
                            )}>{item.subtitle}</p>
                            {item.date && (
                              <p className={cn("text-[10px] font-bold flex items-center opacity-60", item.urgent ? "text-amber-700" : "text-primary/60")}>
                                <CalendarIcon className="w-3 h-3 mr-1" /> {formatSafeDate(item.date)}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-2xl shrink-0 bg-primary/5 text-primary opacity-0 group-hover:opacity-100 transition-all">
                        <Link href={`/landlord/properties/${item.propertyId}`}>
                          <ArrowRight className="w-4 h-4" />
                        </Link>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-12 text-center bg-emerald-50/30 rounded-[2rem] border-2 border-dashed border-emerald-100">
                  <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400 mb-4 animate-bounce" />
                  <p className="text-[10px] text-emerald-700 font-bold uppercase tracking-[0.3em]">All Specs Verified</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
