
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, TrendingUp, ArrowRight, 
  ShieldAlert, Loader2, CheckCircle2,
  Plus, Save, ReceiptText,
  Crown, ShieldCheck, PoundSterling, ArrowUpRight, ArrowDownRight,
  Activity, BarChart3, Settings2
} from "lucide-react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, getLandlordCollectionQuery, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, getResolvedImageUrl } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle 
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { collection, doc, serverTimestamp, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

/**
 * @fileOverview High-Fidelity Portfolio Insights Dashboard.
 * Optimized for real-time financial tracking and elite inline management.
 * Features a horizontally scrollable "Month Ledge" with direct entry textboxes.
 */

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isAdminEscalated, setIsAdminEscalated] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (user) {
      user.getIdTokenResult(true).then(result => {
        setIsAdminEscalated(!!result.claims.admin || !!result.claims.premium);
      });
    }
  }, [user]);

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);
  const { data: profile } = useDoc(userDocRef);

  const isPro = profile?.plan === 'pro' || isAdminEscalated;

  const propertiesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "properties", user.uid);
  }, [db, user]);
  const { data: allProperties, loading: propLoading } = useCollection(propertiesQuery);

  const properties = useMemo(() => 
    allProperties?.filter(p => !p.isDeleted) || [], 
  [allProperties]);

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "maintenanceRequests", user.uid);
  }, [db, user]);
  const { data: maintenance } = useCollection(maintenanceQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    const now = new Date();
    return query(
      collection(db, 'rentPayments'),
      where('landlordId', '==', user.uid),
      where('month', '==', now.getMonth() + 1),
      where('year', '==', now.getFullYear())
    );
  }, [db, user]);
  const { data: currentMonthPayments } = useCollection(paymentsQuery);

  const financialStats = useMemo(() => {
    if (!isClient || !properties || !maintenance) return { annualGross: 0, totalExpenses: 0, netAnnualForecast: 0, collectionRate: 0, actualCollectedThisMonth: 0 };
    const monthlyGrossPotential = properties.reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    const annualGross = monthlyGrossPotential * 12;
    const actualCollectedThisMonth = currentMonthPayments?.filter(p => p.status === 'paid').reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
    const totalExpenses = maintenance.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
    const netAnnualForecast = annualGross - totalExpenses;
    const collectionRate = monthlyGrossPotential > 0 ? (actualCollectedThisMonth / monthlyGrossPotential) * 100 : 0;
    return { annualGross, totalExpenses, netAnnualForecast, collectionRate, actualCollectedThisMonth };
  }, [properties, maintenance, currentMonthPayments, isClient]);

  const chartData = useMemo(() => {
    if (!isClient || !properties) return [];
    return properties.map(p => ({
      name: p.addressLine1 ? p.addressLine1.split(' ')[0] : 'Asset',
      rent: p.rentAmount || 0,
    })).slice(0, 8);
  }, [properties, isClient]);

  // INLINE LEDGER ACTIONS
  const handleQuickRentUpdate = (propertyId: string, amount: string) => {
    if (!db) return;
    const propertyRef = doc(db, 'properties', propertyId);
    updateDocumentNonBlocking(propertyRef, {
      rentAmount: Number(amount),
      updatedAt: serverTimestamp(),
    });
    toast({ title: "Rent Adjusted" });
  };

  const handleQuickStatusUpdate = (prop: any, status: string) => {
    if (!user || !db) return;
    const now = new Date();
    const paymentId = `${prop.id}-${now.getMonth() + 1}-${now.getFullYear()}`;
    const paymentRef = doc(db, 'rentPayments', paymentId);

    const payload = {
      id: paymentId,
      propertyId: prop.id,
      landlordId: user.uid,
      tenantId: prop.tenantIds?.[0] || 'landlord-direct',
      amount: prop.rentAmount || 0,
      status: status,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      memberIds: prop.memberIds || [user.uid],
      updatedAt: serverTimestamp(),
      paidAt: status === 'paid' ? new Date().toISOString() : null
    };

    setDocumentNonBlocking(paymentRef, payload, { merge: true });
    toast({ title: "Ledger Synchronized" });
  };

  const handleOpenLedgerEdit = (prop: any, payment: any) => {
    setActivePaymentEdit({ prop, payment });
    setEditAmount(payment?.amount?.toString() || prop.rentAmount?.toString() || '');
    setEditStatus(payment?.status || 'pending');
  };

  const handleSavePayment = async () => {
    if (!user || !db || !activePaymentEdit) return;
    setIsSavingPayment(true);
    const { prop, payment } = activePaymentEdit;
    const now = new Date();
    const paymentId = payment?.id || `${prop.id}-${now.getMonth() + 1}-${now.getFullYear()}`;
    const paymentRef = doc(db, 'rentPayments', paymentId);

    const payload = {
      id: paymentId,
      propertyId: prop.id,
      landlordId: user.uid,
      tenantId: prop.tenantIds?.[0] || 'landlord-direct',
      amount: Number(editAmount),
      status: editStatus,
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      memberIds: prop.memberIds || [user.uid],
      updatedAt: serverTimestamp(),
      paidAt: editStatus === 'paid' ? new Date().toISOString() : null
    };

    setDocumentNonBlocking(paymentRef, payload, { merge: true });
    toast({ title: "Ledger Updated" });
    setActivePaymentEdit(null);
    setIsSavingPayment(false);
  };

  const [activePaymentEdit, setActivePaymentEdit] = useState<any>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editStatus, setEditStatus] = useState<'paid' | 'pending'>('pending');
  const [isSavingPayment, setIsSavingPayment] = useState(false);

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('other');
  const [expPropertyId, setExpPropertyId] = useState('');
  const [expTitle, setExpTitle] = useState('');

  const handleLogManualExpense = () => {
    if (!user || !db || !expAmount || !expPropertyId || !expTitle) return;
    setIsSavingExpense(true);
    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    const property = properties?.find(p => p.id === expPropertyId);
    
    const payload = {
      id: requestId, 
      propertyId: expPropertyId, 
      landlordId: user.uid,
      tenantId: 'landlord-direct', 
      memberIds: property?.memberIds || [user.uid],
      title: expTitle, 
      description: `Manual Expense: ${expTitle}`,
      status: 'completed', 
      priority: 'routine', 
      category: expCategory,
      cost: Number(expAmount), 
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp(),
    };
    
    setDocumentNonBlocking(requestRef, payload, { merge: true });
    toast({ title: "Ledger Item Registered" });
    setIsExpenseDialogOpen(false);
    setIsSavingExpense(false);
    setExpAmount('');
    setExpTitle('');
    setExpPropertyId('');
  };

  if (!isClient || propLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center">
        <Loader2 className="animate-spin text-primary w-10 h-10 opacity-40" />
      </div>
    );
  }

  const statConfig = [
    { title: "Gross Annual Potential", val: `£${financialStats.annualGross.toLocaleString()}`, Icon: PoundSterling, color: "text-emerald-500", bg: "bg-emerald-500/5", Indicator: ArrowUpRight },
    { title: "Portfolio Expenses (Year To Date)", val: `£${financialStats.totalExpenses.toLocaleString()}`, Icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/5", Indicator: ArrowDownRight },
    { title: "Net Annual Forecast", val: `£${financialStats.netAnnualForecast.toLocaleString()}`, Icon: TrendingUp, color: "text-primary-foreground", bg: "bg-primary", isPrimary: true },
    { title: "Current Month Collected", val: `£${financialStats.actualCollectedThisMonth.toLocaleString()}`, Icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/5", progress: financialStats.collectionRate }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 text-left border-b border-white/5 pb-6">
        <div className="min-w-0 flex-1">
           <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 px-3 py-1 rounded-full font-bold uppercase tracking-[0.2em] text-[9px] mb-3">
              <Activity className="w-3.5 h-3.5 mr-2" /> Real-Time Command Hub
           </Badge>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground mb-1 tracking-tight">Portfolio Insights</h1>
          <p className="text-muted-foreground font-medium font-body max-w-xl opacity-70 text-sm">Unified financial command and operational analytics.</p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {!isPro && (
            <Button variant="outline" className="rounded-xl h-10 px-6 font-bold border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 transition-all shadow-xl shadow-accent/5 text-xs">
              <Crown className="w-3.5 h-3.5 mr-2" /> Upgrade to Premium
            </Button>
          )}
          {isPro && (
            <div className="flex items-center gap-2.5 px-5 py-2.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 shadow-2xl">
               {isAdminEscalated ? <ShieldCheck className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
               <span className="text-[10px] font-bold uppercase tracking-[0.15em] font-headline">Premium Plan Active</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statConfig.map((stat, i) => {
          const IconComp = stat.Icon;
          const IndicatorComp = stat.Indicator;
          return (
            <Card key={i} className={cn("border-none shadow-sm rounded-[2rem] overflow-hidden group hover:scale-[1.01] transition-all", stat.isPrimary ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/10" : "bg-card ring-1 ring-white/5")}>
              <CardContent className="pt-8 text-left px-6">
                <div className="flex items-center justify-between mb-6">
                  <div className={cn("p-3 rounded-xl shadow-inner border border-white/5 transition-transform group-hover:scale-110", stat.bg, !stat.isPrimary && stat.color)}>
                    <IconComp className="w-6 h-6" />
                  </div>
                  {IndicatorComp && <IndicatorComp className={cn("w-5 h-5", stat.color)} />}
                </div>
                <div className="space-y-2 min-w-0">
                  <p className="text-3xl font-bold font-headline tracking-tighter">
                     {stat.val}
                  </p>
                  {stat.progress !== undefined && <Progress value={stat.progress} className="h-1.5 bg-white/10" />}
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] font-headline opacity-50 whitespace-normal leading-tight">
                    {stat.title}
                  </p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-card ring-1 ring-white/5">
            <CardHeader className="text-left px-8 pt-8 pb-4 border-b border-white/5 bg-white/[0.02]">
              <div className="flex justify-between items-center">
                 <CardTitle className="text-xl font-headline flex items-center text-foreground tracking-tight">
                   <BarChart3 className="w-6 h-6 mr-3 text-accent" />
                   Rent Distribution
                 </CardTitle>
                 <Badge variant="outline" className="border-white/10 text-[8px] font-bold uppercase tracking-[0.15em] font-headline opacity-60 shrink-0">Asset Performance</Badge>
              </div>
            </CardHeader>
            <CardContent className="h-[380px] p-8">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: 'rgba(255,255,255,0.3)'}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'rgba(255,255,255,0.3)'}} />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.03)', radius: 12}}
                      contentStyle={{borderRadius: '16px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', padding: '12px'}}
                      itemStyle={{fontWeight: 800, color: 'hsl(var(--accent))', fontSize: '11px'}}
                      labelStyle={{fontWeight: 800, marginBottom: '6px', color: '#fff', fontSize: '12px'}}
                    />
                    <Bar dataKey="rent" radius={[12, 12, 0, 0]} barSize={45}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--accent))' : 'rgba(59, 130, 246, 0.4)'} />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-card overflow-hidden ring-1 ring-white/5">
            <CardHeader className="text-left px-8 pt-8 pb-4 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-white/[0.01]">
              <CardTitle className="text-xl font-headline flex items-center text-foreground tracking-tight">
                <ReceiptText className="w-6 h-6 mr-3 text-accent" />
                Monthly Rent Ledger
              </CardTitle>
              <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em] font-headline opacity-40 shrink-0">{format(new Date(), 'MMMM yyyy')} Registry</p>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse min-w-[1200px]">
                   <thead>
                     <tr className="bg-white/[0.02]">
                       <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground opacity-50 w-[35%]">Property Identity</th>
                       <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground opacity-50 w-[20%]">Rent Entry</th>
                       <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground opacity-50 w-[25%]">Collection State</th>
                       <th className="px-4 py-3 text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground w-[20%]">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {properties?.filter(p => p.isOccupied).map(prop => {
                       const payment = currentMonthPayments?.find(pm => pm.propertyId === prop.id);
                       const isPaid = payment?.status === 'paid';
                       const imageUrl = getResolvedImageUrl(prop.imageUrl, prop.imageUrls);
                       return (
                         <tr key={prop.id} className="hover:bg-white/[0.02] transition-colors group">
                           <td className="px-4 py-3 min-w-0">
                             <div className="flex items-center gap-4">
                               <div className="relative h-11 w-11 rounded-xl overflow-hidden shadow-xl ring-1 ring-white/5 group-hover:scale-105 transition-transform bg-muted shrink-0 flex items-center justify-center">
                                 {imageUrl ? (
                                   <img src={imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                                 ) : (
                                   <Building2 className="w-5 h-5 text-muted-foreground/30" />
                                 )}
                               </div>
                               <div className="min-w-0 flex-1">
                                 <span className="font-bold text-sm text-foreground truncate block">{prop.addressLine1}</span>
                                 <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 truncate block">{prop.city}</span>
                               </div>
                             </div>
                           </td>
                           <td className="px-4 py-3">
                              <div className="flex items-center gap-2 max-w-[120px]">
                                 <span className="text-muted-foreground opacity-40 font-bold text-xs">£</span>
                                 <Input 
                                    type="number" 
                                    defaultValue={prop.rentAmount} 
                                    className="h-9 rounded-lg bg-muted/30 border-none font-bold text-sm px-3 shadow-inner focus:ring-1 focus:ring-accent"
                                    onBlur={(e) => handleQuickRentUpdate(prop.id, e.target.value)}
                                 />
                              </div>
                           </td>
                           <td className="px-4 py-3">
                              <Select defaultValue={payment?.status || 'pending'} onValueChange={(v) => handleQuickStatusUpdate(prop, v)}>
                                <SelectTrigger className={cn(
                                  "h-9 w-[180px] rounded-lg border-none font-bold text-[9px] uppercase tracking-widest shadow-sm px-4",
                                  isPaid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500"
                                )}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="rounded-xl border-white/5 bg-card">
                                  <SelectItem value="pending" className="text-[9px] font-bold uppercase tracking-widest py-3">Pending</SelectItem>
                                  <SelectItem value="paid" className="text-[9px] font-bold uppercase tracking-widest py-3">Receipted</SelectItem>
                                </SelectContent>
                              </Select>
                           </td>
                           <td className="px-4 py-3 shrink-0">
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9 hover:bg-white/5 border border-white/5 shrink-0" onClick={() => handleOpenLedgerEdit(prop, payment)}>
                                  <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
                                </Button>
                                {!isPaid && (
                                  <Button size="sm" className="rounded-lg h-9 px-4 font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-xl shadow-primary/10 shrink-0 uppercase tracking-widest text-[9px]" onClick={() => handleOpenLedgerEdit(prop, payment)}>
                                    Process
                                  </Button>
                                )}
                              </div>
                           </td>
                         </tr>
                       );
                     })}
                   </tbody>
                 </table>
               </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-card overflow-hidden ring-1 ring-white/5">
            <CardHeader className="text-left px-6 pt-6 pb-3 border-b border-white/5 bg-white/[0.02]">
              <CardTitle className="text-lg font-headline flex items-center text-foreground tracking-tight">
                <ShieldAlert className="w-5 h-5 mr-3 text-accent" />
                Portfolio Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-6">
               <div className="space-y-3">
                  {maintenance?.filter(m => m.status !== 'completed').slice(0, 6).map(req => (
                    <div key={req.id} className="p-4 bg-white/[0.02] rounded-[1.5rem] border border-white/5 flex items-center justify-between text-left group hover:border-accent/30 transition-all min-w-0">
                       <div className="min-w-0 flex-1 pr-3">
                          <p className="font-bold text-xs text-foreground truncate group-hover:text-accent transition-colors block">{req.title}</p>
                          <div className="flex items-center gap-2 mt-1 overflow-hidden">
                             <Badge variant="outline" className="text-[7px] font-bold uppercase tracking-[0.1em] text-muted-foreground border-white/10 px-2 py-0.5 rounded-full shrink-0">{req.priority}</Badge>
                             <span className="text-[8px] font-bold text-muted-foreground opacity-30 uppercase tracking-widest truncate">{req.category}</span>
                          </div>
                       </div>
                       <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 hover:bg-white/5 border border-white/5 shrink-0" asChild>
                         <Link href="/landlord/maintenance"><ArrowRight className="w-4 h-4 text-foreground" /></Link>
                       </Button>
                    </div>
                  ))}
                  {maintenance?.filter(m => m.status !== 'completed').length === 0 && (
                    <div className="text-center py-8 opacity-20 flex flex-col items-center">
                       <CheckCircle2 className="w-10 h-10 mb-3" />
                       <p className="text-[9px] font-bold uppercase tracking-[0.2em] font-headline">Roadmap Clear</p>
                    </div>
                  )}
               </div>
               <Button variant="ghost" className="w-full rounded-xl h-10 font-bold text-[9px] uppercase tracking-[0.15em] text-muted-foreground hover:bg-white/5 mt-2" asChild>
                  <Link href="/landlord/maintenance">View All Repairs</Link>
               </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-accent text-white overflow-hidden p-8 text-left relative group">
             <div className="absolute -top-10 -right-10 w-32 h-32 bg-white/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10 space-y-6">
               <div className="space-y-1.5">
                 <h3 className="font-bold font-headline text-xl tracking-tight">Financial Hub</h3>
                 <p className="text-xs text-white/70 font-medium leading-relaxed">Orchestrate manual portfolio expenses and insurance records.</p>
               </div>
               
               <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                <Button className="w-full rounded-[1.25rem] bg-white text-accent font-bold h-12 hover:bg-white/90 transition-all shadow-2xl shadow-black/20 text-[10px] uppercase tracking-[0.15em] border-none" onClick={() => setIsExpenseDialogOpen(true)}>
                  <Plus className="w-4 h-4 mr-2" /> Log Ledger Entry
                </Button>
                <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col max-h-[85vh] max-w-[500px] ring-1 ring-white/10">
                  <form className="flex flex-col h-full overflow-hidden" onSubmit={(e) => { e.preventDefault(); handleLogManualExpense(); }}>
                    <div className="p-8 bg-primary/5 border-b border-white/5 text-left shrink-0">
                      <DialogTitle className="text-xl font-bold font-headline text-foreground tracking-tight">Register Expense</DialogTitle>
                      <DialogDescription className="text-xs font-medium text-muted-foreground mt-1.5">Record insurance, maintenance, or portfolio costs.</DialogDescription>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-8 space-y-6 text-left">
                        <div className="space-y-2">
                          <Label className="font-bold text-[9px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Expense Identifier</Label>
                          <Input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Landlord Insurance 2026" className="rounded-xl h-12 bg-muted/30 border-none font-bold px-5 text-sm" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="font-bold text-[9px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Capital Amount (£)</Label>
                            <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="rounded-xl h-12 bg-muted/30 border-none font-bold px-5 text-sm" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-bold text-[9px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Category</Label>
                            <select className="flex h-12 w-full rounded-xl border-none bg-muted/30 px-5 py-2 text-sm focus:ring-2 focus:ring-accent outline-none font-bold text-foreground" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                              <option value="insurance">Insurance</option>
                              <option value="maintenance">Maintenance</option>
                              <option value="tax">Tax/Compliance</option>
                              <option value="other">Other Capital</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold text-[9px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Target Inventory Asset</Label>
                          <select className="flex h-12 w-full rounded-xl border-none bg-muted/30 px-5 py-2 text-sm focus:ring-2 focus:ring-accent outline-none font-bold text-foreground" value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)} required>
                            <option value="">Select Asset...</option>
                            {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                          </select>
                        </div>
                      </div>
                    </ScrollArea>
                    <DialogFooter className="p-8 bg-muted/5 border-t border-white/5 shrink-0">
                      <Button type="submit" className="w-full rounded-[1.5rem] h-14 font-bold bg-primary text-primary-foreground shadow-2xl shadow-primary/10 hover:opacity-90 font-headline uppercase tracking-[0.2em] text-[10px] border-none" disabled={isSavingExpense || !expAmount || !expPropertyId || !expTitle}>
                        {isSavingExpense ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Commit to Ledger
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
               </Dialog>
            </div>
          </Card>
        </div>
      </div>

      <Dialog open={!!activePaymentEdit} onOpenChange={(o) => !o && setActivePaymentEdit(null)}>
        <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col max-h-[85vh] max-w-[450px] ring-1 ring-white/10">
           {/* THEME-CONSISTENT HEADING */}
           <div className="p-6 bg-secondary text-secondary-foreground border-b border-border text-left shrink-0 relative overflow-hidden">
             <div className="absolute top-0 right-0 p-6 opacity-5"><PoundSterling className="w-20 h-20" /></div>
             <DialogHeader>
                <DialogTitle className="text-2xl font-bold font-headline tracking-tighter">Manage Ledger</DialogTitle>
                <DialogDescription className="text-secondary-foreground/70 font-bold text-sm mt-1.5">Adjust monthly rent and collection state.</DialogDescription>
             </DialogHeader>
           </div>
           
           <ScrollArea className="flex-1">
             <div className="p-6 space-y-12 text-left pb-24">
                {/* RENT SECTION */}
                <div className="space-y-4 bg-muted/30 p-5 rounded-[2rem] border border-border/50 shadow-inner">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-accent/10 rounded-lg text-accent">
                            <PoundSterling className="w-4 h-4" />
                        </div>
                        <Label className="font-bold text-[10px] uppercase text-foreground tracking-[0.15em] font-headline">Monthly Rent Adjustment</Label>
                    </div>
                    <Input 
                        type="number" 
                        value={editAmount} 
                        onChange={(e) => setEditAmount(e.target.value)} 
                        className="rounded-xl h-16 bg-background border-none font-bold px-6 text-2xl shadow-2xl text-foreground focus:ring-accent" 
                        placeholder="e.g. 1500.00" 
                    />
                </div>

                {/* STATUS SECTION */}
                <div className="space-y-4 bg-muted/30 p-5 rounded-[2rem] border border-border/50 shadow-inner">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-accent/10 rounded-lg text-accent">
                            <Activity className="w-4 h-4" />
                        </div>
                        <Label className="font-bold text-[10px] uppercase text-foreground tracking-[0.15em] font-headline">Collection State</Label>
                    </div>
                    <Tabs value={editStatus} onValueChange={(v) => setEditStatus(v as any)}>
                        <TabsList className="grid grid-cols-2 h-14 bg-background/50 border-none p-1.5 gap-1.5 rounded-xl">
                            <TabsTrigger value="pending" className="rounded-lg font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-amber-500 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all h-full border-none">
                                Pending
                            </TabsTrigger>
                            <TabsTrigger value="paid" className="rounded-lg font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-emerald-500 data-[state=active]:text-white data-[state=active]:shadow-xl transition-all h-full border-none">
                                Receipted
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>
                </div>
             </div>
           </ScrollArea>

           <DialogFooter className="p-6 bg-muted/5 border-t border-white/5 shrink-0">
              <Button className="w-full rounded-[2rem] h-16 font-bold bg-primary text-primary-foreground shadow-2xl shadow-primary/20 hover:opacity-90 font-headline uppercase tracking-[0.2em] text-[11px] border-none transition-all hover:scale-[1.01]" onClick={handleSavePayment} disabled={isSavingPayment}>
                 {isSavingPayment ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                 Synchronize Ledger
              </Button>
           </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
