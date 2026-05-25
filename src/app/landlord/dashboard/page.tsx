"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, Wallet, TrendingUp, ArrowRight, 
  ShieldAlert, Loader2, CheckCircle2,
  Zap, Target, Download, Plus, Save, ReceiptText, BellRing,
  Crown, Sparkles, ShieldCheck, PoundSterling, ArrowUpRight, ArrowDownRight,
  CalendarDays, Archive, Activity, BarChart3, PieChart
} from "lucide-react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, getLandlordCollectionQuery, setDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { format } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, AreaChart, Area
} from 'recharts';
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn, getResolvedImageUrl, RENTALFLOW_NEUTRAL_FALLBACK } from "@/lib/utils";
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
import { collection, doc, serverTimestamp, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { sendRentReminderEmail, sendRentReceiptEmail } from "@/lib/actions/email-actions";

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);
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

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "tenantProfiles", user.uid);
  }, [db, user]);
  const { data: tenants } = useCollection(tenantsQuery);

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

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('other');
  const [expPropertyId, setExpPropertyId] = useState('');
  const [expTitle, setExpTitle] = useState('');
  const [isReminding, setIsReminding] = useState<string | null>(null);

  const financialStats = useMemo(() => {
    if (!isClient || !properties || !maintenance) return null;
    const monthlyGrossPotential = properties.reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    const annualGross = monthlyGrossPotential * 12;
    const occupiedMonthly = properties.filter(p => p.isOccupied).reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    const actualCollectedThisMonth = currentMonthPayments?.filter(p => p.status === 'paid').reduce((acc, p) => acc + (p.amount || 0), 0) || 0;
    const totalExpenses = maintenance.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
    const netAnnualForecast = annualGross - totalExpenses;
    const collectionRate = occupiedMonthly > 0 ? (actualCollectedThisMonth / occupiedMonthly) * 100 : 0;
    return { annualGross, totalExpenses, netAnnualForecast, collectionRate, monthlyGrossPotential, occupiedMonthly, actualCollectedThisMonth };
  }, [properties, maintenance, currentMonthPayments, isClient]);

  const upgradeToPro = async () => {
    if (!user) return;
    setIsUpgrading(true);
    try {
      const res = await fetch("/api/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.uid, email: user.email }),
      });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error);
    } catch (e: any) {
      toast({ variant: "destructive", title: "Checkout Error", description: e.message });
      setIsUpgrading(false);
    }
  };

  const handleMarkAsPaid = async (property: any) => {
    if (!user || !db) return;
    const now = new Date();
    const paymentId = `${property.id}_${now.getFullYear()}_${now.getMonth() + 1}`;
    const paymentRef = doc(db, 'rentPayments', paymentId);
    const paymentData = {
      id: paymentId, propertyId: property.id, landlordId: user.uid,
      tenantId: property.tenantIds?.[0] || 'manual-entry', amount: property.rentAmount || 0,
      status: 'paid', month: now.getMonth() + 1, year: now.getFullYear(),
      memberIds: property.memberIds || [user.uid], paidAt: now.toISOString(), updatedAt: serverTimestamp(),
    };
    setDocumentNonBlocking(paymentRef, paymentData, { merge: true });
    toast({ title: "Receipt Verified", description: `Financial record updated for ${property.addressLine1}` });
  };

  const handleSendReminder = async (property: any) => {
    if (!user || !db) return;
    const tenant = tenants?.find(t => property.tenantIds?.includes(t.userId));
    if (!tenant?.email) {
      toast({ variant: "destructive", title: "Missing Identity", description: "No contact electronic mail on file." });
      return;
    }
    setIsReminding(property.id);
    try {
      await sendRentReminderEmail({
        tenantEmail: tenant.email, tenantName: `${tenant.firstName} ${tenant.lastName}`,
        propertyAddress: property.addressLine1, amount: property.rentAmount || 0,
        month: format(new Date(), 'MMMM yyyy')
      });
      toast({ title: "Reminder Dispatched" });
    } catch (e) {
      toast({ variant: "destructive", title: "Reminder Error" });
    } finally {
      setIsReminding(null);
    }
  };

  const chartData = useMemo(() => {
    if (!isClient || !properties) return [];
    return properties.map(p => ({
      name: p.addressLine1 ? p.addressLine1.split(' ')[0] : 'Asset',
      rent: p.rentAmount || 0,
    })).slice(0, 8);
  }, [properties, isClient]);

  const handleLogManualExpense = () => {
    if (!user || !db || !expAmount || !expPropertyId || !expTitle) return;
    setIsSavingExpense(true);
    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    const property = properties?.find(p => p.id === expPropertyId);
    const payload = {
      id: requestId, propertyId: expPropertyId, landlordId: user.uid,
      tenantId: 'landlord-direct', memberIds: property?.memberIds || [user.uid],
      title: expTitle, description: `High-Fidelity Expense Record: ${expTitle}`,
      status: 'completed', priority: 'routine', category: expCategory,
      cost: Number(expAmount), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    setDocumentNonBlocking(requestRef, payload, { merge: true });
    toast({ title: "Ledger Item Registered" });
    setIsExpenseDialogOpen(false);
    setIsSavingExpense(false);
    setExpAmount('');
    setExpTitle('');
    setExpPropertyId('');
  };

  if (!isClient || propLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-16">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 text-left border-b border-white/5 pb-8">
        <div>
           <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 px-4 py-1.5 rounded-full font-bold uppercase tracking-[0.25em] text-[9px] mb-4">
              <Activity className="w-3.5 h-3.5 mr-2" /> Real-Time Command Hub
           </Badge>
          <h1 className="text-4xl md:text-5xl font-headline font-bold text-foreground mb-2 tracking-tight">Portfolio Insights</h1>
          <p className="text-muted-foreground font-medium font-body max-w-xl opacity-70">Unified financial command and high-fidelity operational analytics.</p>
        </div>
        <div className="flex items-center gap-4">
          {!isPro ? (
            <Button variant="outline" className="rounded-2xl h-12 px-8 font-bold border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 transition-all shadow-xl shadow-accent/5" onClick={upgradeToPro} disabled={isUpgrading}>
              {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Crown className="w-4 h-4 mr-2" />}
              Upgrade to Premium
            </Button>
          ) : (
            <div className="flex items-center gap-3 px-6 py-3 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 shadow-2xl">
               {isAdminEscalated ? <ShieldCheck className="w-5 h-5" /> : <Crown className="w-5 h-5" />}
               <span className="text-[11px] font-bold uppercase tracking-[0.2em] font-headline">Premium Plan Active</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Gross Annual Potential", val: `£${financialStats?.annualGross.toLocaleString()}`, icon: PoundSterling, color: "text-emerald-500", bg: "bg-emerald-500/5", indicator: ArrowUpRight },
          { title: "Portfolio Expenses (YTD)", val: `£${financialStats?.totalExpenses.toLocaleString()}`, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/5", indicator: ArrowDownRight },
          { title: "Net Annual Forecast", val: `£${financialStats?.netAnnualForecast.toLocaleString()}`, icon: TrendingUp, color: "text-primary-foreground", bg: "bg-primary", isPrimary: true },
          { title: "Current Month Receipt", val: `£${financialStats?.actualCollectedThisMonth.toLocaleString()}`, icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/5", progress: financialStats?.collectionRate }
        ].map((stat, i) => (
          <Card key={i} className={cn("border-none shadow-sm rounded-[2.5rem] overflow-hidden group hover:scale-[1.02] transition-all", stat.isPrimary ? "bg-primary text-primary-foreground shadow-2xl shadow-primary/10" : "bg-card ring-1 ring-white/5 hover:ring-white/10")}>
            <CardContent className="pt-10 text-left px-10">
              <div className="flex items-center justify-between mb-8">
                <div className={cn("p-4 rounded-2xl shadow-inner border border-white/5 transition-transform group-hover:scale-110", stat.bg, !stat.isPrimary && stat.color)}>
                  <stat.icon className="w-7 h-7" />
                </div>
                {stat.indicator && <stat.indicator className={cn("w-6 h-6 opacity-30", stat.color)} />}
              </div>
              <div className="space-y-3">
                <p className="text-4xl font-bold font-headline tracking-tighter">{stat.val}</p>
                {stat.progress !== undefined && <Progress value={stat.progress} className="h-2 bg-white/10" />}
                <p className="text-[10px] font-bold uppercase tracking-[0.3em] font-headline opacity-50">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        <div className="lg:col-span-8 space-y-10">
          <Card className="border-none shadow-2xl rounded-[3rem] overflow-hidden bg-card ring-1 ring-white/5">
            <CardHeader className="text-left px-12 pt-12 pb-6 border-b border-white/5 bg-white/[0.02]">
              <div className="flex justify-between items-center">
                 <CardTitle className="text-2xl font-headline flex items-center text-foreground tracking-tight">
                   <BarChart3 className="w-7 h-7 mr-4 text-accent" />
                   Yield Distribution
                 </CardTitle>
                 <Badge variant="outline" className="border-white/10 text-[9px] font-bold uppercase tracking-[0.2em] font-headline opacity-60">Asset Performance</Badge>
              </div>
            </CardHeader>
            <CardContent className="h-[450px] p-12">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fontWeight: 700, fill: 'rgba(255,255,255,0.3)'}} dy={20} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: 'rgba(255,255,255,0.3)'}} />
                    <Tooltip 
                      cursor={{fill: 'rgba(255,255,255,0.03)', radius: 16}}
                      contentStyle={{borderRadius: '24px', border: '1px solid rgba(255,255,255,0.1)', backgroundColor: 'rgba(10,10,10,0.95)', backdropBlur: '12px', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.5)', padding: '20px'}}
                      itemStyle={{fontWeight: 800, color: 'hsl(var(--accent))'}}
                      labelStyle={{fontWeight: 800, marginBottom: '8px', color: '#fff'}}
                    />
                    <Bar dataKey="rent" radius={[16, 16, 0, 0]} barSize={60}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--accent))' : 'rgba(59, 130, 246, 0.4)'} />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl rounded-[3rem] bg-card overflow-hidden ring-1 ring-white/5">
            <CardHeader className="text-left px-12 pt-12 pb-6 border-b border-white/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white/[0.01]">
              <CardTitle className="text-2xl font-headline flex items-center text-foreground tracking-tight">
                <ReceiptText className="w-7 h-7 mr-4 text-accent" />
                Collection Suite
              </CardTitle>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] font-headline opacity-40">{format(new Date(), 'MMMM yyyy')} Ledger</p>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="bg-white/[0.02]">
                       <th className="px-12 py-7 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50">Property Identity</th>
                       <th className="px-12 py-7 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50">Monthly Yield</th>
                       <th className="px-12 py-7 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50">Ledger Status</th>
                       <th className="px-12 py-7 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground opacity-50 text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-white/5">
                     {properties?.filter(p => p.isOccupied).map(prop => {
                       const isPaid = currentMonthPayments?.find(pm => pm.propertyId === prop.id)?.status === 'paid';
                       return (
                         <tr key={prop.id} className="hover:bg-white/[0.02] transition-colors group">
                           <td className="px-12 py-8">
                             <div className="flex items-center gap-5">
                               <div className="relative h-14 w-14 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5 group-hover:scale-110 transition-transform bg-muted shrink-0">
                                 <img 
                                   src={getResolvedImageUrl(prop.imageUrl, prop.imageUrls)} 
                                   alt="" 
                                   className="absolute inset-0 h-full w-full object-cover"
                                   onError={(e) => {
                                      const target = e.target as HTMLImageElement;
                                      target.src = RENTALFLOW_NEUTRAL_FALLBACK;
                                   }}
                                 />
                               </div>
                               <div className="min-w-0">
                                 <span className="font-bold text-base text-foreground truncate block">{prop.addressLine1}</span>
                                 <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40">{prop.city}</span>
                               </div>
                             </div>
                           </td>
                           <td className="px-12 py-8 font-bold text-base text-foreground tracking-tight">£{prop.rentAmount?.toLocaleString()}</td>
                           <td className="px-12 py-8">
                             <Badge className={cn("rounded-full px-5 py-1.5 font-bold text-[9px] uppercase tracking-[0.1em] border-none shadow-sm", isPaid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                               {isPaid ? "Receipted" : "Collection Pending"}
                             </Badge>
                           </td>
                           <td className="px-12 py-8 text-right">
                              <div className="flex items-center justify-end gap-3">
                                {!isPaid && (
                                  <>
                                    <Button variant="ghost" size="sm" className="rounded-xl h-11 px-5 font-bold text-muted-foreground hover:bg-white/5 hover:text-foreground border border-white/5" onClick={() => handleSendReminder(prop)} disabled={isReminding === prop.id}>
                                      {isReminding === prop.id ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BellRing className="w-4 h-4 mr-2" />}
                                      Remind
                                    </Button>
                                    <Button size="sm" className="rounded-xl h-11 px-5 font-bold bg-primary text-primary-foreground hover:opacity-90 shadow-xl shadow-primary/10" onClick={() => handleMarkAsPaid(prop)}>
                                      Confirm Receipt
                                    </Button>
                                  </>
                                )}
                                {isPaid && <div className="p-2.5 bg-emerald-500/10 rounded-full"><CheckCircle2 className="w-6 h-6 text-emerald-500 shadow-emerald-500/20" /></div>}
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

        <div className="lg:col-span-4 space-y-10">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-card overflow-hidden ring-1 ring-white/5">
            <CardHeader className="text-left px-10 pt-10 pb-6 border-b border-white/5 bg-white/[0.02]">
              <CardTitle className="text-xl font-headline flex items-center text-foreground tracking-tight">
                <ShieldAlert className="w-6 h-6 mr-4 text-accent" />
                Portfolio Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-10">
               <div className="space-y-4">
                  {maintenance?.filter(m => m.status !== 'completed').slice(0, 6).map(req => (
                    <div key={req.id} className="p-5 bg-white/[0.02] rounded-[2rem] border border-white/5 flex items-center justify-between text-left group hover:border-accent/30 transition-all">
                       <div className="min-w-0 pr-4">
                          <p className="font-bold text-sm text-foreground truncate group-hover:text-accent transition-colors">{req.title}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                             <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-[0.2em] text-muted-foreground border-white/10 px-3 py-0.5 rounded-full">{req.priority}</Badge>
                             <span className="text-[9px] font-bold text-muted-foreground opacity-30 uppercase tracking-widest">{req.category}</span>
                          </div>
                       </div>
                       <Button variant="ghost" size="icon" className="rounded-2xl h-11 w-11 hover:bg-white/5 border border-white/5 shrink-0" asChild>
                         <Link href="/landlord/maintenance"><ArrowRight className="w-5 h-5 text-foreground" /></Link>
                       </Button>
                    </div>
                  ))}
                  {maintenance?.filter(m => m.status !== 'completed').length === 0 && (
                    <div className="text-center py-12 opacity-20 flex flex-col items-center">
                       <CheckCircle2 className="w-12 h-12 mb-4" />
                       <p className="text-[10px] font-bold uppercase tracking-[0.3em] font-headline">Roadmap Clear</p>
                    </div>
                  )}
               </div>
               <Button variant="ghost" className="w-full rounded-2xl h-12 font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground hover:bg-white/5 mt-4" asChild>
                  <Link href="/landlord/maintenance">View All Repairs</Link>
               </Button>
            </CardContent>
          </Card>

          <Card className="border-none shadow-2xl rounded-[3rem] bg-accent text-white overflow-hidden p-10 text-left relative group">
             <div className="absolute -top-10 -right-10 w-40 h-40 bg-white/10 rounded-full blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            <div className="relative z-10 space-y-8">
               <div className="space-y-2">
                 <h3 className="font-bold font-headline text-2xl tracking-tight">Financial Hub</h3>
                 <p className="text-sm text-white/70 font-medium leading-relaxed">Orchestrate manual portfolio expenses and insurance records.</p>
               </div>
               
               <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full rounded-[1.5rem] bg-white text-accent font-bold h-14 hover:bg-white/90 transition-all shadow-2xl shadow-black/20 text-xs uppercase tracking-[0.2em]">
                    <Plus className="w-5 h-5 mr-3" /> Log Ledger Entry
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[3.5rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col max-h-[90vh] max-w-[550px] ring-1 ring-white/10">
                  <form className="flex flex-col h-full overflow-hidden" onSubmit={(e) => e.preventDefault()}>
                    <div className="p-10 bg-primary/5 border-b border-white/5 text-left shrink-0">
                      <DialogTitle className="text-2xl font-bold font-headline text-foreground tracking-tight">Register Expense</DialogTitle>
                      <DialogDescription className="text-sm font-medium text-muted-foreground mt-2">Record insurance, maintenance, or high-value portfolio costs.</DialogDescription>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-10 space-y-8 text-left">
                        <div className="space-y-3">
                          <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Expense Identifier</Label>
                          <Input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Landlord Insurance 2026" className="rounded-2xl h-14 bg-muted/30 border-none font-bold px-6 text-base" />
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Capital Amount (£)</Label>
                            <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="rounded-2xl h-14 bg-muted/30 border-none font-bold px-6 text-base" />
                          </div>
                          <div className="space-y-3">
                            <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Category</Label>
                            <select className="flex h-14 w-full rounded-2xl border-none bg-muted/30 px-6 py-2 text-base focus:ring-2 focus:ring-accent outline-none font-bold text-foreground" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                              <option value="insurance">Insurance</option>
                              <option value="maintenance">Maintenance</option>
                              <option value="tax">Tax/Compliance</option>
                              <option value="other">Other Capital</option>
                            </select>
                          </div>
                        </div>
                        <div className="space-y-3">
                          <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.3em] opacity-40">Target Inventory Asset</Label>
                          <select className="flex h-14 w-full rounded-2xl border-none bg-muted/30 px-6 py-2 text-base focus:ring-2 focus:ring-accent outline-none font-bold text-foreground" value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)} required>
                            <option value="">Select Asset Registry Item...</option>
                            {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                          </select>
                        </div>
                      </div>
                    </ScrollArea>
                    <DialogFooter className="p-10 bg-muted/5 border-t border-white/5 shrink-0">
                      <Button type="button" className="w-full rounded-[1.75rem] h-16 font-bold bg-primary text-primary-foreground shadow-2xl shadow-primary/10 hover:opacity-90 font-headline uppercase tracking-[0.3em] text-[11px]" onClick={handleLogManualExpense} disabled={isSavingExpense || !expAmount || !expPropertyId || !expTitle}>
                        {isSavingExpense ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                        Commit to Portfolio Ledger
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}