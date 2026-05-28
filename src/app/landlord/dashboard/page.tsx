"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, TrendingUp, 
  ShieldAlert, Loader2, CheckCircle2,
  Plus, Save, ReceiptText,
  Crown, ShieldCheck, PoundSterling, ArrowUpRight, ArrowDownRight,
  Activity, BarChart3, CalendarDays
} from "lucide-react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, getLandlordCollectionQuery, updateDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useMemo, useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell
} from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { 
  Dialog, 
  DialogContent, 
  DialogDescription, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger
} from "@/components/ui/dialog";
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
 * @fileOverview Landlord Insight Hub.
 * Optimized for active-asset financials and structural stability.
 * Thematic update: Selectors follow light/dark mode protocols (bg-background).
 */

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isAdminEscalated, setIsAdminEscalated] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

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
    return query(
      collection(db, 'rentPayments'),
      where('landlordId', '==', user.uid),
      where('month', '==', selectedMonth),
      where('year', '==', selectedYear)
    );
  }, [db, user, selectedMonth, selectedYear]);
  const { data: periodPayments } = useCollection(paymentsQuery);

  const financialStats = useMemo(() => {
    if (!isClient || !properties || !maintenance) return { annualGross: 0, totalExpenses: 0, netAnnualForecast: 0, collectionRate: 0, actualCollectedThisPeriod: 0 };
    
    const activePropertyIds = new Set(properties.map(p => p.id));
    
    const monthlyGrossPotential = properties.reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    const annualGross = monthlyGrossPotential * 12;
    
    const totalExpenses = maintenance
      .filter(m => activePropertyIds.has(m.propertyId))
      .reduce((acc, r) => acc + (Number(r.cost) || 0), 0);

    const actualCollectedThisPeriod = periodPayments
      ?.filter(p => activePropertyIds.has(p.propertyId) && (p.status === 'paid' || p.status === 'late'))
      .reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
    
    const netAnnualForecast = annualGross - totalExpenses;
    const collectionRate = monthlyGrossPotential > 0 ? (actualCollectedThisPeriod / monthlyGrossPotential) * 100 : 0;
    
    return { annualGross, totalExpenses, netAnnualForecast, collectionRate, actualCollectedThisPeriod };
  }, [properties, maintenance, periodPayments, isClient, selectedMonth, selectedYear]);

  const chartData = useMemo(() => {
    if (!isClient || !properties) return [];
    return properties.map(p => ({
      name: p.addressLine1 ? p.addressLine1.split(' ')[0] : 'Asset',
      rent: p.rentAmount || 0,
    })).slice(0, 8);
  }, [properties, isClient]);

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
    const paymentId = `${prop.id}-${selectedMonth}-${selectedYear}`;
    const paymentRef = doc(db, 'rentPayments', paymentId);

    const payload = {
      id: paymentId,
      propertyId: prop.id,
      landlordId: user.uid,
      tenantId: prop.tenantIds?.[0] || 'landlord-direct',
      amount: prop.rentAmount || 0,
      status: status,
      month: selectedMonth,
      year: selectedYear,
      memberIds: prop.memberIds || [user.uid],
      updatedAt: serverTimestamp(),
      paidAt: (status === 'paid' || status === 'late') ? new Date().toISOString() : null
    };

    setDocumentNonBlocking(paymentRef, payload, { merge: true });
    toast({ title: "Ledger Synchronized" });
  };

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
      <div className="flex h-[70vh] items-center justify-center opacity-40">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
      </div>
    );
  }

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-4 text-left border-b border-white/5 pb-6">
        <div className="min-w-0 flex-1">
           <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 px-3 py-1 rounded-full font-bold uppercase tracking-[0.2em] text-[9px] mb-3">
              <Activity className="w-3.5 h-3.5 mr-2" /> Financial Pulse Hub
           </Badge>
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground mb-1 tracking-tight">Portfolio Insights</h1>
          <p className="text-muted-foreground font-medium font-body opacity-70 text-sm">Unified command and monthly collection analytics.</p>
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
        {[
          { title: "Gross Annual Potential", val: `£${financialStats.annualGross.toLocaleString()}`, Icon: PoundSterling, color: "text-emerald-500", bg: "bg-emerald-500/5", Indicator: ArrowUpRight },
          { title: "Portfolio Expenses (YTD)", val: `£${financialStats.totalExpenses.toLocaleString()}`, Icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/5", Indicator: ArrowDownRight },
          { title: "Net Annual Forecast", val: `£${financialStats.netAnnualForecast.toLocaleString()}`, Icon: TrendingUp, color: "text-accent", bg: "bg-accent/5" },
          { title: `${months[selectedMonth - 1].substring(0, 3)} Collected`, val: `£${financialStats.actualCollectedThisPeriod.toLocaleString()}`, Icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/5", progress: financialStats.collectionRate }
        ].map((stat, i) => {
          const IconComp = stat.Icon;
          return (
            <Card key={i} className="border-none shadow-sm rounded-[2rem] overflow-hidden group hover:scale-[1.01] transition-all bg-card ring-1 ring-white/5">
              <CardContent className="pt-8 text-left px-6">
                <div className="flex items-center justify-between mb-6">
                  <div className={cn("p-3 rounded-xl shadow-inner border border-white/5 transition-transform group-hover:scale-110", stat.bg, stat.color)}>
                    <IconComp className="w-6 h-6" />
                  </div>
                </div>
                <div className="space-y-2 min-w-0">
                  <p className="text-3xl font-bold font-headline tracking-tighter text-foreground">{stat.val}</p>
                  {stat.progress !== undefined && <Progress value={stat.progress} className="h-1.5 bg-muted" />}
                  <p className="text-[9px] font-bold uppercase tracking-[0.1em] font-headline opacity-50 text-muted-foreground">{stat.title}</p>
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
              <CardTitle className="text-xl font-headline flex items-center text-foreground tracking-tight">
                <BarChart3 className="w-6 h-6 mr-3 text-accent" />
                Rent Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[380px] p-8">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: 'rgba(0,0,0,0.3)'}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'rgba(0,0,0,0.3)'}} />
                    <Tooltip 
                      cursor={{fill: 'rgba(0,0,0,0.03)', radius: 12}}
                      contentStyle={{borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', backgroundColor: 'hsl(var(--card))', backdropFilter: 'blur(12px)', padding: '12px'}}
                      itemStyle={{fontWeight: 800, color: 'hsl(var(--accent))', fontSize: '11px'}}
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
            <CardHeader className="text-left px-8 pt-8 pb-4 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 bg-white/[0.01]">
              <CardTitle className="text-xl font-headline flex items-center text-foreground tracking-tight">
                <ReceiptText className="w-6 h-6 mr-3 text-accent" />
                Monthly Rent Ledger
              </CardTitle>
              {/* THEMED MONTH SELECTOR: Light on Light / Dark on Dark */}
              <div className="flex items-center gap-2 bg-background p-1.5 rounded-2xl border border-border shrink-0 transition-colors duration-300 shadow-sm">
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-9 w-[130px] border-none bg-transparent font-bold text-[10px] uppercase tracking-widest focus:ring-0">
                    <CalendarDays className="w-3.5 h-3.5 mr-2 opacity-40" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card">
                    {months.map((m, i) => <SelectItem key={m} value={(i + 1).toString()} className="text-[10px] font-bold uppercase py-2">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <ScrollArea className="h-[600px] w-full overflow-auto">
                  <table className="w-full text-left border-collapse table-fixed min-w-[1000px]">
                    <thead>
                      <tr className="bg-muted/10 sticky top-0 z-10">
                        <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50 w-[40%] bg-card">Asset Identity</th>
                        <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50 w-[25%] bg-card text-center">Monthly Rent</th>
                        <th className="px-8 py-5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50 w-[35%] bg-card">Verification Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {properties?.filter(p => p.isOccupied).map(prop => {
                        const payment = periodPayments?.find(pm => pm.propertyId === prop.id);
                        const status = payment?.status || 'not-paid';
                        return (
                          <tr key={prop.id} className="hover:bg-muted/5 transition-colors group">
                            <td className="px-8 py-6">
                              <div className="flex items-center gap-5">
                                <div className="relative h-14 w-14 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/5 bg-muted shrink-0 flex items-center justify-center">
                                  {prop.imageUrl ? <img src={prop.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Building2 className="w-6 h-6 text-muted-foreground/30" />}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <span className="font-bold text-base text-foreground truncate block">{prop.addressLine1}</span>
                                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 truncate block mt-0.5">{prop.city}</span>
                                </div>
                              </div>
                            </td>
                            <td className="px-8 py-6">
                               <div className="flex items-center justify-center gap-3 max-w-[160px] mx-auto bg-background/80 rounded-xl px-4 h-12 border border-white/10 shadow-inner">
                                  <span className="text-muted-foreground opacity-30 font-bold text-sm">£</span>
                                  <Input type="number" defaultValue={prop.rentAmount} className="h-10 border-none bg-transparent font-bold text-base focus:ring-0 text-center text-foreground" onBlur={(e) => handleQuickRentUpdate(prop.id, e.target.value)} />
                               </div>
                            </td>
                            <td className="px-8 py-6">
                               <Select value={status} onValueChange={(v) => handleQuickStatusUpdate(prop, v)}>
                                 <SelectTrigger className={cn("h-12 w-full rounded-xl border-none font-bold text-[10px] uppercase tracking-[0.15em] shadow-inner px-5", status === 'paid' ? "bg-emerald-500/10 text-emerald-500" : status === 'late' ? "bg-sky-500/10 text-sky-500" : "bg-amber-500/10 text-amber-500")}>
                                   <SelectValue />
                                 </SelectTrigger>
                                 <SelectContent className="rounded-xl border-white/5 bg-card">
                                   <SelectItem value="not-paid" className="text-[10px] font-bold uppercase py-3">Not Paid</SelectItem>
                                   <SelectItem value="paid" className="text-[10px] font-bold uppercase py-3">Paid</SelectItem>
                                   <SelectItem value="late" className="text-[10px] font-bold uppercase py-3">Paid Late</SelectItem>
                                 </SelectContent>
                               </Select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
               </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-2xl rounded-[2.5rem] bg-card ring-1 ring-border text-card-foreground overflow-hidden p-8 text-left relative group">
            <div className="relative z-10 space-y-6">
               <div className="space-y-1.5">
                 <h3 className="font-bold font-headline text-xl tracking-tight text-foreground">Financial Hub</h3>
                 <p className="text-xs text-muted-foreground font-medium opacity-70 leading-relaxed">Orchestrate portfolio expenses and insurance records.</p>
               </div>
               <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full rounded-xl bg-accent text-white font-bold h-12 hover:bg-accent/90 transition-all shadow-xl shadow-accent/10 text-[10px] uppercase tracking-[0.15em] border-none">
                    <Plus className="w-4 h-4 mr-2" /> Register Ledger Item
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col max-h-[85vh] max-w-[500px] ring-1 ring-white/10">
                  <div className="p-8 bg-primary/5 border-b border-white/5 text-left shrink-0">
                    <DialogTitle className="text-xl font-bold font-headline text-foreground tracking-tight">Register Expense</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1.5">Record insurance, maintenance, or portfolio costs.</DialogDescription>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-8 space-y-6 text-left">
                      <div className="space-y-2">
                        <Label className="font-bold text-[9px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Expense Identifier</Label>
                        <Input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Portfolio Insurance 2026" className="rounded-xl h-12 bg-muted/30 border-none font-bold px-5 text-sm text-foreground" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-[9px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Target Asset</Label>
                        <select className="flex h-12 w-full rounded-xl border-none bg-muted/30 px-5 py-2 text-sm focus:ring-2 focus:ring-accent outline-none font-bold text-foreground" value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)} required>
                          <option value="">Select Asset...</option>
                          {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                        </select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-bold text-[9px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Amount (£)</Label>
                          <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="rounded-xl h-12 bg-muted/30 border-none font-bold px-5 text-sm text-foreground" />
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
                    </div>
                  </ScrollArea>
                  <DialogFooter className="p-8 bg-muted/5 border-t border-white/5 shrink-0">
                    <Button onClick={handleLogManualExpense} type="button" className="w-full rounded-xl h-12 font-bold bg-primary text-primary-foreground shadow-2xl shadow-primary/10 hover:opacity-90 font-headline uppercase tracking-[0.2em] text-[10px] border-none" disabled={isSavingExpense || !expAmount || !expPropertyId || !expTitle}>
                      {isSavingExpense ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                      Commit to Ledger
                    </Button>
                  </DialogFooter>
                </DialogContent>
               </Dialog>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
