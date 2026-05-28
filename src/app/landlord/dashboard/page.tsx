"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, TrendingUp, 
  ShieldAlert, Loader2, CheckCircle2,
  Plus, Save, ReceiptText,
  Crown, ShieldCheck, PoundSterling,
  Activity, BarChart3, CalendarDays,
  Calendar as CalendarIcon,
  FileDown,
  Calculator
} from "lucide-react";
import { useUser, useFirestore, useCollection, useDoc, useMemoFirebase, getLandlordCollectionQuery, updateDocumentNonBlocking, setDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
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
import { format, isValid } from "date-fns";
import { collection, doc, serverTimestamp, query, where } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";
import { sendRentReceiptEmail } from "@/lib/actions/email-actions";
import { jsPDF } from "jspdf";

/**
 * @fileOverview Landlord Insight Hub.
 * Optimized for vertical fidelity: Period-based Rent Ledger refactored for mobile compatibility.
 * Persistence: Remembers user's last selected month and year.
 * Added: Tax Reporting Hub for HMRC self-assessment statements.
 */

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isAdminEscalated, setIsAdminEscalated] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Tax Reporting State
  const [taxPropertyId, setTaxPropertyId] = useState('');
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [isGeneratingTax, setIsGeneratingTax] = useState(false);

  useEffect(() => {
    setIsClient(true);
    
    // Load persisted ledger selection from local registry
    try {
      const savedMonth = localStorage.getItem('ledger_month');
      const savedYear = localStorage.getItem('ledger_year');
      if (savedMonth) setSelectedMonth(Number(savedMonth));
      if (savedYear) setSelectedYear(Number(savedYear));
    } catch (e) {
      console.warn("Registry access restricted.");
    }

    if (user) {
      user.getIdTokenResult(true).then(result => {
        setIsAdminEscalated(!!result.claims.admin || !!result.claims.premium);
      });
    }
  }, [user]);

  // Persist selection to local registry on change
  useEffect(() => {
    if (isClient) {
      localStorage.setItem('ledger_month', selectedMonth.toString());
      localStorage.setItem('ledger_year', selectedYear.toString());
    }
  }, [selectedMonth, selectedYear, isClient]);

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

  // Annual payments for tax reporting
  const annualPaymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'rentPayments'),
      where('landlordId', '==', user.uid),
      where('year', '==', taxYear)
    );
  }, [db, user, taxYear]);
  const { data: annualPayments } = useCollection(annualPaymentsQuery);

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

  const handleQuickStatusUpdate = async (prop: any, status: string) => {
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

    // 📧 RECEIPT ORCHESTRATION
    if ((status === 'paid' || status === 'late') && prop.tenantIds?.[0] && prop.tenantIds[0] !== 'landlord-direct') {
      try {
        await sendRentReceiptEmail({
          tenantEmail: prop.tenantIds[0],
          tenantName: 'Resident',
          propertyAddress: prop.addressLine1,
          amount: prop.rentAmount || 0,
          month: months[selectedMonth - 1],
          paymentDate: new Date().toLocaleDateString()
        });
      } catch (err) {}
    }

    toast({ title: "Ledger Synchronized" });
  };

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('other');
  const [expPropertyId, setExpPropertyId] = useState('');
  const [expTitle, setExpTitle] = useState('');
  const [expDate, setExpDate] = useState<Date | undefined>(new Date());

  const handleLogManualExpense = () => {
    if (!user || !db || !expAmount || !expPropertyId || !expTitle || !expDate) return;
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
      scheduledDate: expDate.toISOString(),
      createdAt: serverTimestamp(), 
      updatedAt: serverTimestamp(),
    };
    
    setDocumentNonBlocking(requestRef, payload, { merge: true });
    toast({ title: "Expense Registered" });
    setIsExpenseDialogOpen(false);
    setIsSavingExpense(false);
    setExpAmount('');
    setExpTitle('');
    setExpPropertyId('');
    setExpDate(new Date());
  };

  const handleDownloadTaxStatement = async () => {
    if (!taxPropertyId || !properties || !maintenance || !annualPayments) {
      toast({ variant: "destructive", title: "Missing Data", description: "Select property and ensure records are synced." });
      return;
    }

    setIsGeneratingTax(true);
    try {
      const property = properties.find(p => p.id === taxPropertyId);
      if (!property) throw new Error("Property not found");

      const propertyPayments = annualPayments.filter(p => p.propertyId === taxPropertyId && (p.status === 'paid' || p.status === 'late'));
      const propertyExpenses = maintenance.filter(m => {
        if (m.propertyId !== taxPropertyId || m.status !== 'completed' || !m.scheduledDate) return false;
        const d = new Date(m.scheduledDate);
        return isValid(d) && d.getFullYear() === taxYear;
      });

      const totalRent = propertyPayments.reduce((acc, p) => acc + (p.amount || 0), 0);
      const totalExpenses = propertyExpenses.reduce((acc, m) => acc + (Number(m.cost) || 0), 0);
      const netIncome = totalRent - totalExpenses;

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();

      // HEADER
      pdf.setFillColor(30, 58, 138); // primary
      pdf.rect(0, 0, pageWidth, 50, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(24);
      pdf.setFont("helvetica", "bold");
      pdf.text("ANNUAL RENTAL STATEMENT", 20, 25);
      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");
      pdf.text(`TAX COMPLIANCE RECORD | YEAR: ${taxYear}`, 20, 35);
      pdf.text(`Generated: ${format(new Date(), 'PPP')}`, 20, 42);

      // PROPERTY IDENTITY
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("PROPERTY IDENTITY", 20, 70);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${property.addressLine1}`, 20, 78);
      pdf.text(`${property.city}, ${property.zipCode}`, 20, 84);
      pdf.text(`Classification: ${property.propertyType}`, 20, 90);

      // SUMMARY GRID
      pdf.setFillColor(248, 250, 252);
      pdf.rect(20, 105, 170, 45, "F");
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(20, 105, 170, 45, "D");

      pdf.setFont("helvetica", "bold");
      pdf.text("FINANCIAL SUMMARY", 30, 115);
      pdf.setFont("helvetica", "normal");
      pdf.text("Gross Rental Income", 30, 125);
      pdf.text(`£${totalRent.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 150, 125, { align: 'right' });
      
      pdf.text("Allowable Portfolio Expenses", 30, 132);
      pdf.text(`(£${totalExpenses.toLocaleString(undefined, {minimumFractionDigits: 2})})`, 150, 132, { align: 'right' });
      
      pdf.setDrawColor(30, 58, 138);
      pdf.line(30, 136, 160, 136);
      
      pdf.setFont("helvetica", "bold");
      pdf.text("Net Rental Profit / (Loss)", 30, 144);
      pdf.text(`£${netIncome.toLocaleString(undefined, {minimumFractionDigits: 2})}`, 150, 144, { align: 'right' });

      // EXPENSE BREAKDOWN
      pdf.setFontSize(14);
      pdf.text("EXPENSE LEDGER BREAKDOWN", 20, 170);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "bold");
      pdf.text("DATE", 20, 180);
      pdf.text("IDENTIFIER", 50, 180);
      pdf.text("CATEGORY", 120, 180);
      pdf.text("AMOUNT (£)", 170, 180, { align: 'right' });
      
      pdf.setDrawColor(226, 232, 240);
      pdf.line(20, 182, 180, 182);

      let y = 190;
      pdf.setFont("helvetica", "normal");
      propertyExpenses.forEach((exp) => {
        if (y > 270) { pdf.addPage(); y = 20; }
        const d = new Date(exp.scheduledDate);
        pdf.text(format(d, 'dd/MM/yyyy'), 20, y);
        pdf.text(exp.title.substring(0, 30), 50, y);
        pdf.text(exp.category || 'Other', 120, y);
        pdf.text(Number(exp.cost).toFixed(2), 170, y, { align: 'right' });
        y += 8;
      });

      if (propertyExpenses.length === 0) {
        pdf.setFont("helvetica", "italic");
        pdf.text("No allowable expenses recorded for this period.", 20, 190);
      }

      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("Disclaimer: This statement is generated based on digital ledger entries and is intended for informational support during HMRC Self Assessment.", 20, 285);

      pdf.save(`Tax_Statement_${property.addressLine1.replace(/\s+/g, '_')}_${taxYear}.pdf`);
      toast({ title: "Tax Statement Generated", description: "Professional report downloaded." });
    } catch (err) {
      toast({ variant: "destructive", title: "Generation Failure" });
    } finally {
      setIsGeneratingTax(false);
    }
  };

  if (!isClient || propLoading) {
    return (
      <div className="flex h-[70vh] items-center justify-center opacity-40">
        <Loader2 className="animate-spin text-primary w-10 h-10" />
      </div>
    );
  }

  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const years = [2024, 2025, 2026, 2027];

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-500 pb-12">
      <div className="flex flex-col gap-6 text-left border-b border-white/5 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground tracking-tight">Portfolio Insights</h1>
          <p className="text-muted-foreground font-medium font-body opacity-70 text-sm">Unified command and monthly collection analytics.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 px-3 py-1.5 rounded-full font-bold uppercase tracking-[0.2em] text-[9px]">
             <Activity className="w-3.5 h-3.5 mr-2" /> Financial Pulse Hub
          </Badge>
          
          {isPro && (
            <div className="flex items-center gap-2.5 px-5 py-1.5 bg-emerald-500/10 text-emerald-500 rounded-full border border-emerald-500/20 shadow-sm">
               {isAdminEscalated ? <ShieldCheck className="w-3.5 h-3.5" /> : <Crown className="w-3.5 h-3.5" />}
               <span className="text-[9px] font-bold uppercase tracking-[0.15em] font-headline">Premium Plan Active</span>
            </div>
          )}

          {!isPro && (
            <Button variant="outline" className="rounded-xl h-9 px-6 font-bold border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 transition-all shadow-xl shadow-accent/5 text-[9px] uppercase tracking-widest">
              <Crown className="w-3.5 h-3.5 mr-2" /> Upgrade to Premium
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { title: "Gross Annual Potential", val: `£${financialStats.annualGross.toLocaleString()}`, Icon: PoundSterling, color: "text-emerald-500", bg: "bg-emerald-500/5" },
          { title: "Portfolio Expenses (YTD)", val: `£${financialStats.totalExpenses.toLocaleString()}`, Icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/5" },
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
            <CardHeader className="text-left px-8 pt-8 pb-4 border-b border-white/5 flex flex-col items-start gap-6 bg-white/[0.01]">
              <CardTitle className="text-xl font-headline flex items-center text-foreground tracking-tight">
                <ReceiptText className="w-6 h-6 mr-3 text-accent" />
                Monthly Rent Ledger
              </CardTitle>
              <div className="flex items-center gap-1 bg-background p-1.5 rounded-2xl border border-border shrink-0 transition-colors duration-300 shadow-sm">
                <Select value={selectedMonth.toString()} onValueChange={(v) => setSelectedMonth(Number(v))}>
                  <SelectTrigger className="h-9 w-[115px] border-none bg-transparent font-bold text-[10px] uppercase tracking-widest focus:ring-0">
                    <CalendarDays className="w-3.5 h-3.5 mr-2 opacity-40 text-accent" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card">
                    {months.map((m, i) => <SelectItem key={m} value={(i + 1).toString()} className="text-[10px] font-bold uppercase py-2">{m}</SelectItem>)}
                  </SelectContent>
                </Select>
                <div className="w-px h-4 bg-border mx-1 opacity-20" />
                <Select value={selectedYear.toString()} onValueChange={(v) => setSelectedYear(Number(v))}>
                  <SelectTrigger className="h-9 w-[80px] border-none bg-transparent font-bold text-[10px] uppercase tracking-widest focus:ring-0">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="rounded-xl border-border bg-card">
                    {years.map((y) => <SelectItem key={y} value={y.toString()} className="text-[10px] font-bold uppercase py-2">{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent className="p-0">
               <ScrollArea className="h-[600px] w-full">
                  <div className="flex flex-col divide-y divide-white/5">
                    {properties?.filter(p => p.isOccupied).map(prop => {
                      const payment = periodPayments?.find(pm => pm.propertyId === prop.id);
                      const status = payment?.status || 'not-paid';
                      return (
                        <div key={prop.id} className="p-8 flex flex-col gap-8 hover:bg-muted/5 transition-colors group">
                          <div className="flex items-center gap-6">
                            <div className="relative h-16 w-16 rounded-2xl overflow-hidden shadow-2xl ring-1 ring-white/5 bg-muted shrink-0 flex items-center justify-center">
                              {prop.imageUrl ? <img src={prop.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" /> : <Building2 className="w-8 h-8 text-muted-foreground/30" />}
                            </div>
                            <div className="min-w-0 flex-1 text-left">
                              <span className="font-bold text-xl text-foreground truncate block font-headline tracking-tight">{prop.addressLine1}</span>
                              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em] opacity-40 truncate block mt-1 font-headline">{prop.city}</span>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                             <div className="space-y-2 text-left">
                                <Label className="text-[9px] font-bold uppercase text-muted-foreground tracking-[0.2em] opacity-40 font-headline pl-1">Monthly Rent</Label>
                                <div className="flex items-center gap-3 bg-background/80 rounded-xl px-5 h-14 border border-white/10 shadow-inner">
                                   <span className="text-muted-foreground opacity-30 font-bold text-base font-headline">£</span>
                                   <Input type="number" defaultValue={prop.rentAmount} className="h-10 border-none bg-transparent font-bold text-lg focus:ring-0 text-foreground font-headline" onBlur={(e) => handleQuickRentUpdate(prop.id, e.target.value)} />
                                </div>
                             </div>
                             <div className="space-y-2 text-left">
                                <Label className="text-[9px] font-bold uppercase text-muted-foreground tracking-[0.2em] opacity-40 font-headline pl-1">Verification Status</Label>
                                <Select value={status} onValueChange={(v) => handleQuickStatusUpdate(prop, v)}>
                                  <SelectTrigger className={cn("h-14 w-full rounded-xl border-none font-bold text-[10px] uppercase tracking-[0.15em] shadow-inner px-6", status === 'paid' ? "bg-emerald-500/10 text-emerald-500" : status === 'late' ? "bg-sky-500/10 text-sky-500" : "bg-amber-500/10 text-amber-500")}>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent className="rounded-xl border-white/5 bg-card">
                                    <SelectItem value="not-paid" className="text-[10px] font-bold uppercase py-4">Not Paid</SelectItem>
                                    <SelectItem value="paid" className="text-[10px] font-bold uppercase py-4">Paid</SelectItem>
                                    <SelectItem value="late" className="text-[10px] font-bold uppercase py-4">Paid Late</SelectItem>
                                  </SelectContent>
                                </Select>
                             </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
               </ScrollArea>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-2xl rounded-[2.5rem] bg-card ring-1 ring-border text-card-foreground overflow-hidden p-8 text-left relative group">
            <div className="relative z-10 space-y-6">
               <div className="space-y-1.5">
                 <h3 className="font-bold font-headline text-xl tracking-tight text-foreground">Expense Hub</h3>
                 <p className="text-xs text-muted-foreground font-medium opacity-70 leading-relaxed">Orchestrate portfolio expenses and insurance records.</p>
               </div>
               <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="w-full rounded-xl bg-accent text-white font-bold h-12 hover:bg-accent/90 transition-all shadow-xl shadow-accent/10 text-[10px] uppercase tracking-[0.15em] border-none">
                    <Plus className="w-4 h-4 mr-2" /> Register Expense
                  </Button>
                </DialogTrigger>
                <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col h-[750px] max-h-[90vh] max-w-[500px] ring-1 ring-white/10">
                  <div className="p-8 bg-primary/5 border-b border-white/5 text-left shrink-0">
                    <DialogTitle className="text-xl font-bold font-headline text-foreground tracking-tight">Register Expense</DialogTitle>
                    <DialogDescription className="text-xs font-medium text-muted-foreground mt-1.5">Record insurance, maintenance, or portfolio costs.</DialogDescription>
                  </div>
                  <ScrollArea className="flex-1">
                    <div className="p-8 space-y-10 text-left pb-20">
                      <div className="space-y-3">
                        <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Expense Identifier</Label>
                        <Input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Portfolio Insurance 2026" className="rounded-xl h-14 bg-muted/40 border-none font-bold px-6 text-base shadow-inner ring-1 ring-white/5 text-foreground" />
                      </div>
                      <div className="space-y-3">
                        <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Target Asset</Label>
                        <select 
                          className="flex h-14 w-full rounded-xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-accent outline-none font-bold text-foreground shadow-inner ring-1 ring-white/5" 
                          value={expPropertyId} 
                          onChange={(e) => setExpPropertyId(e.target.value)} 
                          required
                        >
                          <option value="">Select Portfolio Asset...</option>
                          {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                        </select>
                      </div>

                      <div className="space-y-3">
                        <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Transaction Date</Label>
                        <div className="relative">
                          <CalendarIcon className="absolute left-4 top-4 h-5 w-5 text-accent opacity-60 z-10" />
                          <Input 
                            type="date"
                            value={expDate ? format(expDate, 'yyyy-MM-dd') : ''}
                            onChange={(e) => {
                              const d = e.target.value ? new Date(e.target.value) : undefined;
                              setExpDate(d);
                            }}
                            className="rounded-xl h-14 bg-muted/40 border-none font-bold px-12 text-base shadow-inner ring-1 ring-white/5 text-foreground focus:ring-2 focus:ring-accent"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-3">
                          <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Amount (£)</Label>
                          <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="rounded-xl h-14 bg-muted/40 border-none font-bold px-6 text-base shadow-inner ring-1 ring-white/5 text-foreground" />
                        </div>
                        <div className="space-y-3">
                          <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Category</Label>
                          <select 
                            className="flex h-14 w-full rounded-xl border-none bg-muted/40 px-6 py-2 text-base focus:ring-2 focus:ring-accent outline-none font-bold text-foreground shadow-inner ring-1 ring-white/5" 
                            value={expCategory} 
                            onChange={(e) => setExpCategory(e.target.value)}
                          >
                            <option value="insurance">Insurance Premium</option>
                            <option value="maintenance">Maintenance Cost</option>
                            <option value="tax">Tax/Compliance</option>
                            <option value="other">Other Capital Outlay</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter className="p-8 bg-muted/5 border-t border-white/5 shrink-0">
                    <Button onClick={handleLogManualExpense} type="button" className="w-full rounded-[1.75rem] h-16 font-bold bg-primary text-primary-foreground shadow-2xl shadow-primary/10 hover:opacity-90 font-headline uppercase tracking-[0.2em] text-[11px] border-none hover:scale-[1.01] transition-transform" disabled={isSavingExpense || !expAmount || !expPropertyId || !expTitle || !expDate}>
                      {isSavingExpense ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />}
                      Commit to Financial Ledger
                    </Button>
                  </DialogFooter>
                </DialogContent>
               </Dialog>
            </div>
          </Card>

          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-card ring-1 ring-border text-card-foreground overflow-hidden p-8 text-left relative group">
            <div className="relative z-10 space-y-6">
               <div className="space-y-1.5">
                 <h3 className="font-bold font-headline text-xl tracking-tight text-foreground flex items-center gap-3">
                    <Calculator className="w-6 h-6 text-emerald-500" /> Tax Reporting
                 </h3>
                 <p className="text-xs text-muted-foreground font-medium opacity-70 leading-relaxed">Generate annual statements for HMRC self-assessment records.</p>
               </div>

               <div className="space-y-4">
                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Select Asset</Label>
                    <Select value={taxPropertyId} onValueChange={setTaxPropertyId}>
                      <SelectTrigger className="h-12 w-full rounded-xl bg-muted/40 border-none font-bold text-xs">
                        <SelectValue placeholder="Select Property..." />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                         {properties?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.addressLine1}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="font-bold text-[10px] uppercase text-muted-foreground font-headline tracking-[0.15em] opacity-40">Tax Year</Label>
                    <Select value={taxYear.toString()} onValueChange={(v) => setTaxYear(Number(v))}>
                      <SelectTrigger className="h-12 w-full rounded-xl bg-muted/40 border-none font-bold text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="rounded-xl border-border bg-card">
                        {years.map(y => <SelectItem key={y} value={y.toString()} className="font-bold text-xs">{y}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <Button 
                    onClick={handleDownloadTaxStatement} 
                    disabled={isGeneratingTax || !taxPropertyId} 
                    className="w-full rounded-xl bg-emerald-600 text-white font-bold h-12 hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-500/10 text-[10px] uppercase tracking-[0.15em] border-none"
                  >
                    {isGeneratingTax ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />}
                    Generate Official Statement
                  </Button>
               </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
