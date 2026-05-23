"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, Wallet, TrendingUp, FileText, ArrowRight, 
  ShieldAlert, Loader2, CheckCircle2,
  Calendar as CalendarIcon, Zap, ClipboardList, AlertTriangle,
  PoundSterling, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight,
  Target, Download, Plus, Save, Users, Wrench, Clock, ReceiptText, BellRing
} from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, getLandlordCollectionQuery, setDocumentNonBlocking, updateDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isBefore, addDays, isValid, parseISO, format, startOfMonth, endOfMonth } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, Cell, PieChart, Pie 
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
import { collection, doc, serverTimestamp, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { sendRentReminderEmail, sendRentReceiptEmail } from "@/lib/actions/email-actions";

const COLORS = ['hsl(var(--accent))', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
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
    
    const occupiedMonthly = properties
      .filter(p => p.isOccupied)
      .reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    
    const actualCollectedThisMonth = currentMonthPayments
      ?.filter(p => p.status === 'paid')
      .reduce((acc, p) => acc + (p.amount || 0), 0) || 0;

    const totalExpenses = maintenance.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
    const netAnnualForecast = annualGross - totalExpenses;
    
    const collectionRate = occupiedMonthly > 0 ? (actualCollectedThisMonth / occupiedMonthly) * 100 : 0;

    return {
      annualGross,
      totalExpenses,
      netAnnualForecast,
      collectionRate,
      monthlyGrossPotential,
      occupiedMonthly,
      actualCollectedThisMonth
    };
  }, [properties, maintenance, currentMonthPayments, isClient]);

  const handleMarkAsPaid = async (property: any) => {
    if (!user || !db) return;
    const now = new Date();
    const paymentId = `${property.id}_${now.getFullYear()}_${now.getMonth() + 1}`;
    const paymentRef = doc(db, 'rentPayments', paymentId);

    const paymentData = {
      id: paymentId,
      propertyId: property.id,
      landlordId: user.uid,
      tenantId: property.tenantIds?.[0] || 'manual-entry',
      amount: property.rentAmount || 0,
      status: 'paid',
      month: now.getMonth() + 1,
      year: now.getFullYear(),
      memberIds: property.memberIds || [user.uid],
      paidAt: now.toISOString(),
      updatedAt: serverTimestamp(),
    };

    setDocumentNonBlocking(paymentRef, paymentData, { merge: true });

    const tenant = tenants?.find(t => property.tenantIds?.includes(t.userId));
    if (tenant?.email) {
      await sendRentReceiptEmail({
        tenantEmail: tenant.email,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        propertyAddress: property.addressLine1,
        amount: property.rentAmount || 0,
        month: format(now, 'MMMM yyyy'),
        paymentDate: format(now, 'PPp')
      });
    }

    toast({ title: "Rent Verified", description: `Receipt dispatched for ${property.addressLine1}` });
  };

  const handleSendReminder = async (property: any) => {
    if (!user || !db) return;
    const tenant = tenants?.find(t => property.tenantIds?.includes(t.userId));
    
    if (!tenant?.email) {
      toast({ variant: "destructive", title: "Missing Contact", description: "No email on file for this asset's resident." });
      return;
    }

    setIsReminding(property.id);
    const now = new Date();

    try {
      await sendRentReminderEmail({
        tenantEmail: tenant.email,
        tenantName: `${tenant.firstName} ${tenant.lastName}`,
        propertyAddress: property.addressLine1,
        amount: property.rentAmount || 0,
        month: format(now, 'MMMM yyyy')
      });
      toast({ title: "Reminder Dispatched", description: `Professional notice sent to ${tenant.firstName}.` });
    } catch (e) {
      toast({ variant: "destructive", title: "Reminder Failed" });
    } finally {
      setIsReminding(null);
    }
  };

  const downloadStatement = async () => {
    if (!properties || !financialStats) return;
    
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const today = format(new Date(), 'PPP');
    const period = format(new Date(), 'MMMM yyyy');

    doc.setFillColor(30, 58, 138);
    doc.rect(0, 0, pageWidth, 50, 'F');
    doc.setTextColor(255, 255, 255);
    
    doc.setFontSize(22);
    doc.setFont("helvetica", "bold");
    doc.text("RENTAL LEDGER STATEMENT", 20, 25);
    
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Portfolio Period: ${period} | Generated: ${today}`, 20, 35);

    doc.setTextColor(0, 0, 0);
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Portfolio Summary", 20, 70);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Total Monthly Yield Potential: £${financialStats.monthlyGrossPotential.toLocaleString()}`, 20, 80);
    doc.text(`Current Month Collection: £${financialStats.actualCollectedThisMonth.toLocaleString()} (${financialStats.collectionRate.toFixed(1)}%)`, 20, 86);
    doc.text(`Annual Net Forecast: £${financialStats.netAnnualForecast.toLocaleString()}`, 20, 92);

    doc.setDrawColor(229, 231, 235);
    doc.line(20, 100, pageWidth - 20, 100);

    doc.setFont("helvetica", "bold");
    doc.text("Asset Collection Breakdown", 20, 115);

    let y = 125;
    doc.setFillColor(243, 244, 246);
    doc.rect(20, y - 5, pageWidth - 40, 8, 'F');
    doc.setFontSize(9);
    doc.text("Property Asset", 25, y);
    doc.text("Amount", 110, y);
    doc.text("Status", 160, y);
    y += 10;

    properties.filter(p => p.isOccupied).forEach(prop => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      
      const payment = currentMonthPayments?.find(pm => pm.propertyId === prop.id);
      const isPaid = payment?.status === 'paid';

      doc.setFont("helvetica", "normal");
      doc.text(prop.addressLine1, 25, y);
      doc.text(`£${prop.rentAmount?.toLocaleString()}`, 110, y);
      
      if (isPaid) doc.setTextColor(16, 185, 129);
      else doc.setTextColor(245, 158, 11);
      
      doc.setFont("helvetica", "bold");
      doc.text(isPaid ? "COLLECTED" : "PENDING", 160, y);
      doc.setTextColor(0, 0, 0);
      
      y += 8;
    });

    doc.save(`Statement_${period.replace(/\s+/g, '_')}.pdf`);
    toast({ title: "Statement Generated", description: "Your rental ledger has been downloaded." });
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
      id: requestId,
      propertyId: expPropertyId,
      landlordId: user.uid,
      tenantId: 'landlord-direct',
      memberIds: property?.memberIds || [user.uid],
      title: expTitle,
      description: `Manual Expense Entry: ${expTitle}`,
      status: 'completed',
      priority: 'routine',
      category: expCategory,
      cost: Number(expAmount),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    setDocumentNonBlocking(requestRef, payload, { merge: true });
    
    toast({ title: "Expense Recorded", description: "Ledger updated successfully." });
    setIsExpenseDialogOpen(false);
    setIsSavingExpense(false);
    setExpAmount('');
    setExpTitle('');
    setExpPropertyId('');
  };

  if (!isClient || propLoading) {
    return <div className="flex h-[70vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-6 duration-1000 pb-12">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div className="text-left">
          <h1 className="text-4xl font-headline font-bold text-primary mb-2 tracking-tight">Financial Overview</h1>
          <p className="text-muted-foreground font-medium font-body max-w-lg">Real-time portfolio command and high-yield operational analytics.</p>
        </div>
        <div className="flex items-center gap-4">
          <Button className="rounded-2xl h-11 px-6 font-bold bg-primary shadow-xl shadow-primary/20 hover:scale-[1.02] transition-all text-white" asChild>
            <Link href="/landlord/properties/new">Register New Asset</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm rounded-[2rem] bg-card overflow-hidden group">
          <CardContent className="pt-8 text-left px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 p-4 rounded-2xl shadow-inner">
                <PoundSterling className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-emerald-500 opacity-40" />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold font-headline tracking-tighter text-foreground">
                £{financialStats?.annualGross.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest font-headline opacity-60">Gross Annual Income</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-card overflow-hidden group">
          <CardContent className="pt-8 text-left px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-red-50 dark:bg-red-900/30 text-red-600 p-4 rounded-2xl shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <ArrowDownRight className="w-5 h-5 text-red-500 opacity-40" />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold font-headline tracking-tighter text-foreground">
                £{financialStats?.totalExpenses.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest font-headline opacity-60">Total Expenses (YTD)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-primary text-primary-foreground overflow-hidden group">
          <CardContent className="pt-8 text-left px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-white/10 text-primary-foreground p-4 rounded-2xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <Target className="w-5 h-5 text-primary-foreground/40" />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold font-headline tracking-tighter">
                £{financialStats?.netAnnualForecast.toLocaleString()}
              </p>
              <p className="text-[10px] text-primary-foreground/60 font-bold uppercase tracking-widest font-headline">Annual Net Forecast</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-card overflow-hidden group">
          <CardContent className="pt-8 text-left px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-blue-50 dark:bg-blue-900/30 text-blue-600 p-4 rounded-2xl shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-blue-600">{financialStats?.collectionRate.toFixed(0)}%</p>
            </div>
            <div className="space-y-3">
              <p className="text-3xl font-bold font-headline tracking-tighter text-foreground">
                £{financialStats?.actualCollectedThisMonth.toLocaleString()}
              </p>
              <Progress value={financialStats?.collectionRate} className="h-2 bg-blue-50 dark:bg-blue-900/10" />
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest font-headline opacity-60">Real-Time {format(new Date(), 'MMMM')} Collection</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-card">
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

          <Card className="border-none shadow-sm rounded-[2.5rem] bg-card overflow-hidden">
            <CardHeader className="text-left px-10 pt-10 pb-4 border-b border-border flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <CardTitle className="text-2xl font-headline flex items-center text-foreground">
                <ReceiptText className="w-6 h-6 mr-3 text-accent" />
                Real-Time Collection Suite
              </CardTitle>
              <Button variant="outline" size="sm" onClick={downloadStatement} className="rounded-xl border-accent/20 text-accent font-bold h-10 px-6">
                <Download className="w-4 h-4 mr-2" /> Export Portfolio Ledger
              </Button>
            </CardHeader>
            <CardContent className="p-0">
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                   <thead>
                     <tr className="bg-muted/20">
                       <th className="px-10 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Property Asset</th>
                       <th className="px-10 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Expected Amount</th>
                       <th className="px-10 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Status</th>
                       <th className="px-10 py-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-right">Actions</th>
                     </tr>
                   </thead>
                   <tbody className="divide-y divide-border">
                     {properties?.filter(p => p.isOccupied).map(prop => {
                       const payment = currentMonthPayments?.find(pm => pm.propertyId === prop.id);
                       const isPaid = payment?.status === 'paid';
                       
                       return (
                         <tr key={prop.id} className="hover:bg-muted/5 transition-colors group">
                           <td className="px-10 py-6">
                             <div className="flex items-center gap-4">
                               <div className="p-2.5 bg-primary/5 rounded-xl group-hover:scale-110 transition-transform">
                                 <Building2 className="w-5 h-5 text-primary/60" />
                               </div>
                               <span className="font-bold text-sm text-foreground">{prop.addressLine1}</span>
                             </div>
                           </td>
                           <td className="px-10 py-6 font-bold text-sm text-foreground">£{prop.rentAmount?.toLocaleString()}</td>
                           <td className="px-10 py-6">
                             <Badge className={cn(
                               "rounded-full px-3 py-1 font-bold text-[9px] uppercase",
                               isPaid ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                             )}>
                               {isPaid ? "Collected" : "Awaiting Receipt"}
                             </Badge>
                           </td>
                           <td className="px-10 py-6 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {!isPaid && (
                                  <>
                                    <Button 
                                      variant="ghost" 
                                      size="sm" 
                                      className="rounded-xl h-9 font-bold text-muted-foreground" 
                                      onClick={() => handleSendReminder(prop)}
                                      disabled={isReminding === prop.id}
                                    >
                                      {isReminding === prop.id ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <BellRing className="w-3.5 h-3.5 mr-2" />}
                                      Remind
                                    </Button>
                                    <Button size="sm" className="rounded-xl h-9 font-bold bg-primary text-white" onClick={() => handleMarkAsPaid(prop)}>
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
          <Card className="border-none shadow-sm rounded-[2.5rem] bg-card overflow-hidden">
            <CardHeader className="text-left px-8 pt-8 pb-4 border-b border-border bg-muted/20">
              <CardTitle className="text-lg font-headline flex items-center text-foreground">
                <ShieldAlert className="w-5 h-5 mr-3 text-accent" />
                Portfolio Roadmap
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 p-8">
               <div className="space-y-4">
                  {maintenance?.filter(m => m.status !== 'completed').slice(0, 5).map(req => (
                    <div key={req.id} className="p-4 bg-muted/20 rounded-2xl border border-primary/5 flex items-center justify-between text-left">
                       <div className="min-w-0">
                          <p className="font-bold text-sm text-primary truncate">{req.title}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase mt-1 tracking-widest">{req.priority}</p>
                       </div>
                       <Button variant="ghost" size="icon" className="rounded-xl h-9 w-9" asChild>
                         <Link href="/landlord/maintenance"><ArrowRight className="w-4 h-4" /></Link>
                       </Button>
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[2.5rem] bg-card overflow-hidden p-8 text-left">
            <h3 className="font-bold font-headline text-lg mb-4 text-foreground">Tax Season Readiness</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full rounded-xl border-border font-bold h-12">
                      <Plus className="w-4 h-4 mr-2" /> Log Portfolio Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden bg-card">
                    <div className="p-8 bg-muted/20 border-b text-left">
                      <DialogTitle className="text-xl font-bold font-headline text-foreground">Log Manual Expense</DialogTitle>
                      <DialogDescription className="font-medium text-muted-foreground">Record insurance, fees, or one-off costs for your tax ledger.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-6 text-left bg-card">
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-muted-foreground font-headline">Expense Title</Label>
                        <Input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Landlord Insurance 2025" className="rounded-xl h-11 bg-muted/20 border-none font-bold text-foreground" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-bold text-xs uppercase text-muted-foreground font-headline">Amount (£)</Label>
                          <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="rounded-xl h-11 bg-muted/20 border-none font-bold text-foreground" />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold text-xs uppercase text-muted-foreground font-headline">Category</Label>
                          <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-accent outline-none font-body text-foreground" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
                            <option value="insurance">Insurance</option>
                            <option value="legal">Legal/Professional</option>
                            <option value="management">Management Fees</option>
                            <option value="plumbing">Plumbing</option>
                            <option value="electrical">Electrical</option>
                            <option value="structural">Structural</option>
                            <option value="other">General Maintenance</option>
                          </select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-muted-foreground font-headline">Assign to Asset</Label>
                        <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-body text-foreground" value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)}>
                          <option value="">Choose a property...</option>
                          {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                        </select>
                      </div>
                    </div>
                    <DialogFooter className="p-8 bg-muted/10 border-t">
                      <Button className="w-full rounded-xl h-12 font-bold bg-primary text-primary-foreground shadow-lg" onClick={handleLogManualExpense} disabled={isSavingExpense || !expAmount || !expPropertyId || !expTitle}>
                        {isSavingExpense ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Commit to Ledger
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
