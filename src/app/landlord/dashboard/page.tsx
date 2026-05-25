
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, Wallet, TrendingUp, ArrowRight, 
  ShieldAlert, Loader2, CheckCircle2,
  Zap, Target, Download, Plus, Save, ReceiptText, BellRing,
  Crown, Sparkles, ShieldCheck, PoundSterling, ArrowUpRight, ArrowDownRight,
  CalendarDays, Archive
} from "lucide-react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, getLandlordCollectionQuery, setDocumentNonBlocking } from "@/firebase";
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

  // Operational Filter: Only include active properties for financial stats
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
    toast({ title: "Rent Verified", description: `Receipt dispatched for ${property.addressLine1}` });
  };

  const handleSendReminder = async (property: any) => {
    if (!user || !db) return;
    const tenant = tenants?.find(t => property.tenantIds?.includes(t.userId));
    if (!tenant?.email) {
      toast({ variant: "destructive", title: "Missing Contact", description: "No email on file." });
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
      toast({ variant: "destructive", title: "Reminder Failed" });
    } finally {
      setIsReminding(null);
    }
  };

  const chartData = useMemo(() => {
    if (!isClient || !properties) return [];
    return properties.map(p => ({
      name: p.addressLine1 ? p.addressLine1.split(' ')[0] : 'Prop',
      rent: p.rentAmount || 0,
    })).slice(0, 6);
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
      title: expTitle, description: `Manual Expense Entry: ${expTitle}`,
      status: 'completed', priority: 'routine', category: expCategory,
      cost: Number(expAmount), createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
    };
    setDocumentNonBlocking(requestRef, payload, { merge: true });
    toast({ title: "Expense Recorded" });
    setIsExpenseDialogOpen(false);
    setIsSavingExpense(false);
    setExpAmount('');
    setExpTitle('');
    setExpPropertyId('');
  };

  if (!isClient || propLoading) return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 text-left">
        <div>
          <h1 className="text-4xl font-headline font-bold text-foreground mb-2 tracking-tight">Financial Overview</h1>
          <p className="text-muted-foreground font-medium font-body max-w-lg">Real-time portfolio command and high-yield operational analytics.</p>
        </div>
        <div className="flex items-center gap-4">
          {!isPro ? (
            <Button variant="outline" className="rounded-2xl h-11 px-6 font-bold border-accent/20 text-accent bg-accent/5 hover:bg-accent/10" onClick={upgradeToPro} disabled={isUpgrading}>
              {isUpgrading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Crown className="w-4 h-4 mr-2" />}
              Upgrade to Premium
            </Button>
          ) : (
            <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 shadow-sm">
               {isAdminEscalated ? <ShieldCheck className="w-4 h-4" /> : <Crown className="w-4 h-4" />}
               <span className="text-[10px] font-bold uppercase tracking-widest font-headline">Premium Plan Active</span>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { title: "Gross Annual Income", val: `£${financialStats?.annualGross.toLocaleString()}`, icon: PoundSterling, color: "text-emerald-500", bg: "bg-emerald-500/10", indicator: ArrowUpRight },
          { title: "Total Expenses (YTD)", val: `£${financialStats?.totalExpenses.toLocaleString()}`, icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10", indicator: ArrowDownRight },
          { title: "Annual Net Forecast", val: `£${financialStats?.netAnnualForecast.toLocaleString()}`, icon: TrendingUp, color: "text-primary-foreground", bg: "bg-primary", isPrimary: true },
          { title: "Real-Time Collection", val: `£${financialStats?.actualCollectedThisMonth.toLocaleString()}`, icon: CheckCircle2, color: "text-blue-500", bg: "bg-blue-500/10", progress: financialStats?.collectionRate }
        ].map((stat, i) => (
          <Card key={i} className={cn("border-none shadow-sm rounded-[2rem] overflow-hidden", stat.isPrimary ? "bg-primary text-primary-foreground" : "bg-card ring-1 ring-border")}>
            <CardContent className="pt-8 text-left px-8">
              <div className="flex items-center justify-between mb-6">
                <div className={cn("p-4 rounded-2xl shadow-inner", stat.bg, !stat.isPrimary && stat.color)}>
                  <stat.icon className="w-6 h-6" />
                </div>
                {stat.indicator && <stat.indicator className={cn("w-5 h-5 opacity-40", stat.color)} />}
              </div>
              <div className="space-y-2">
                <p className="text-3xl font-bold font-headline tracking-tighter">{stat.val}</p>
                {stat.progress !== undefined && <Progress value={stat.progress} className="h-2 bg-muted/20" />}
                <p className="text-[10px] font-bold uppercase tracking-widest font-headline opacity-60">{stat.title}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-card ring-1 ring-border">
            <CardHeader className="text-left px-10 pt-10 pb-4 border-b border-border">
              <CardTitle className="text-2xl font-headline flex items-center text-foreground">
                <TrendingUp className="w-6 h-6 mr-3 text-accent" />
                Portfolio Yield Distribution
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[400px] p-10">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fontWeight: 700, fill: 'hsl(var(--muted-foreground))'}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 12, fill: 'hsl(var(--muted-foreground))'}} />
                    <Tooltip 
                      cursor={{fill: 'hsl(var(--muted)/0.1)', radius: 12}}
                      contentStyle={{borderRadius: '24px', border: 'none', backgroundColor: 'hsl(var(--card))', boxShadow: '0 25px 50px -12px rgb(0 0 0 / 0.15)', padding: '16px'}}
                      itemStyle={{fontWeight: 800, color: 'hsl(var(--accent))'}}
                    />
                    <Bar dataKey="rent" radius={[12, 12, 0, 0]} barSize={50}>
                      {chartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={index === 0 ? 'hsl(var(--accent))' : 'hsl(var(--accent) / 0.4)'} />
                      ))}
                    </Bar>
                  </BarChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2.5rem] bg-card overflow-hidden ring-1 ring-border">
            <CardHeader className="text-left px-10 pt-10 pb-4 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle className="text-2xl font-headline flex items-center text-foreground">
                <ReceiptText className="w-6 h-6 mr-3 text-accent" />
                Collection Suite
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="bg-muted/30">
                       <th className="px-10 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Property Asset</th>
                       <th className="px-10 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount</th>
                       <th className="px-10 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                       <th className="px-10 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border">
                     {properties?.filter(p => p.isOccupied).map(prop => {
                       const isPaid = currentMonthPayments?.find(pm => pm.propertyId === prop.id)?.status === 'paid';
                       return (
                         <tr key={prop.id} className="hover:bg-muted/10 transition-colors group">
                           <td className="px-10 py-6">
                             <div className="flex items-center gap-4">
                               <div className="p-2.5 bg-primary/5 rounded-xl group-hover:scale-110 transition-transform">
                                 <Building2 className="w-5 h-5 text-muted-foreground" />
                               </div>
                               <span className="font-bold text-sm text-foreground">{prop.addressLine1}</span>
                             </div>
                           </td>
                           <td className="px-10 py-6 font-bold text-sm text-foreground">£{prop.rentAmount?.toLocaleString()}</td>
                           <td className="px-10 py-6">
                             <Badge className={cn("rounded-full px-3 py-1 font-bold text-[9px] uppercase", isPaid ? "bg-emerald-500/10 text-emerald-500" : "bg-amber-500/10 text-amber-500")}>
                               {isPaid ? "Collected" : "Pending"}
                             </Badge>
                           </td>
                           <td className="px-10 py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!isPaid && (
                                  <>
                                    <Button variant="ghost" size="sm" className="rounded-xl h-9 font-bold text-muted-foreground hover:bg-primary/5 hover:text-foreground" onClick={() => handleSendReminder(prop)} disabled={isReminding === prop.id}>
                                      {isReminding === prop.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <BellRing className="w-3.5 h-3.5 mr-2" />}
                                      Remind
                                    </Button>
                                    <Button size="sm" className="rounded-xl h-9 font-bold bg-primary text-primary-foreground hover:opacity-90" onClick={() => handleMarkAsPaid(prop)}>
                                      Confirm Receipt
                                    </Button>
                                  </>
                                )}
                                {isPaid && <CheckCircle2 className="w-5 h-5 text-emerald-500" />}
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

        <div className="lg:col-span-4 space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-card overflow-hidden ring-1 ring-border">
            <CardHeader className="text-left px-8 pt-8 pb-4 border-b border-border bg-muted/20">
              <CardTitle className="text-lg font-headline flex items-center text-foreground">
                <ShieldAlert className="w-5 h-5 mr-3 text-accent" />
                Portfolio Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-8">
               <div className="space-y-4">
                  {maintenance?.filter(m => m.status !== 'completed').slice(0, 5).map(req => (
                    <div key={req.id} className="p-4 bg-muted/30 rounded-2xl border border-border flex items-center justify-between text-left">
                       <div className="min-w-0">
                          <p className="font-bold text-sm text-foreground truncate">{req.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                             <Badge variant="outline" className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground border-border">{req.priority}</Badge>
                          </div>
                       </div>
                       <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9 hover:bg-primary/5" asChild>
                         <Link href="/landlord/maintenance"><ArrowRight className="w-4 h-4 text-foreground" /></Link>
                       </Button>
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2.5rem] bg-card overflow-hidden p-8 text-left ring-1 ring-border">
            <h3 className="font-bold font-headline text-lg mb-4 text-foreground">Financial Ledger Tool</h3>
            <div className="space-y-4">
              <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" className="w-full rounded-xl border-border text-foreground font-bold h-12 hover:bg-primary/5 transition-all">
                    <Plus className="w-4 h-4 mr-2" /> Log Portfolio Expense
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[2.5rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col max-h-[90vh] max-w-[500px]">
                  <form className="flex flex-col h-full overflow-hidden" onSubmit={(e) => e.preventDefault()}>
                    <div className="p-8 bg-primary/5 border-b text-left shrink-0">
                      <DialogTitle className="text-xl font-bold font-headline text-foreground">Log Portfolio Expense</DialogTitle>
                      <DialogDescription className="font-medium text-muted-foreground mt-1">Record insurance or one-off costs.</DialogDescription>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-8 space-y-6 text-left">
                        <div className="space-y-2">
                          <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 font-headline">Expense Title</Label>
                          <Input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Landlord Insurance" className="rounded-xl h-11 bg-muted/20 border-none font-bold" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 font-headline">Amount (£)</Label>
                            <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="rounded-xl h-11 bg-muted/20 border-none font-bold" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold text-xs uppercase text-muted-foreground opacity-60 font-headline">Assign to Asset</Label>
                          <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-4 py-2 text-sm font-bold" value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)} required>
                            <option value="">Select Asset...</option>
                            {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                          </select>
                        </div>
                      </div>
                    </ScrollArea>
                    <DialogFooter className="p-8 bg-muted/5 border-t shrink-0">
                      <Button type="button" className="w-full rounded-xl h-12 font-bold bg-primary text-primary-foreground shadow-lg hover:opacity-90 font-headline uppercase tracking-widest text-xs" onClick={handleLogManualExpense} disabled={isSavingExpense || !expAmount || !expPropertyId || !expTitle}>
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
    </div>
  );
}
