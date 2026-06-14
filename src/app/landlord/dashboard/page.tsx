
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
  Calculator,
  ArrowRight,
  History,
  Tag,
  Edit3,
  Trash2,
  FileText
} from "lucide-react";
import { 
  useUser, 
  useFirestore, 
  useCollection, 
  useDoc, 
  useMemoFirebase, 
  getLandlordCollectionQuery, 
  updateDocumentNonBlocking, 
  setDocumentNonBlocking,
  deleteDocumentNonBlocking
} from "@/firebase";
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
import { jsPDF } from "jspdf";
import Link from "next/link";

/**
 * @fileOverview Landlord Insight Hub & Tax Orchestrator.
 * Connected to Stripe Billing for Pro Plan Upgrades.
 * PDF ENGINE: Generates high-fidelity professional tax summaries.
 */

export default function LandlordDashboard() {
  const { user } = useUser();
  const db = useFirestore();
  const { toast } = useToast();
  const [isClient, setIsClient] = useState(false);
  const [isAdminEscalated, setIsAdminEscalated] = useState(false);
  const [isUpgrading, setIsUpgrading] = useState(false);

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  
  // Tax Reporting State
  const [taxPropertyId, setTaxPropertyId] = useState('');
  const [taxYear, setTaxYear] = useState<number>(new Date().getFullYear());
  const [isGeneratingTax, setIsGeneratingTax] = useState(false);

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

  const maintenanceQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "maintenanceRequests", user.uid);
  }, [db, user]);
  const { data: maintenance } = useCollection(maintenanceQuery);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "rentPayments", user.uid);
  }, [db, user]);
  const { data: allPayments } = useCollection(paymentsQuery);

  const properties = useMemo(() => 
    allProperties?.filter(p => !p.isDeleted) || [], 
  [allProperties]);

  const chartData = useMemo(() => {
    if (!isClient || !properties) return [];
    return properties.map(p => ({
      name: p.addressLine1 ? p.addressLine1.split(' ')[0] : 'Asset',
      rent: p.rentAmount || 0,
    })).slice(0, 8);
  }, [properties, isClient]);

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('other');
  const [expPropertyId, setExpPropertyId] = useState('');
  const [expTitle, setExpTitle] = useState('');
  const [expDate, setExpDate] = useState<Date | undefined>(new Date());

  const handleUpgrade = async () => {
    if (!user || !user.email) return;
    setIsUpgrading(true);
    try {
      const response = await fetch('/api/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.uid, email: user.email }),
      });
      const data = await response.json();
      if (data.url) window.location.href = data.url;
      else throw new Error(data.error || 'Billing Failure');
    } catch (error: any) {
      toast({ variant: "destructive", title: "Billing Unavailable", description: "Payments are not yet fully initialized." });
      setIsUpgrading(false);
    }
  };

  const handleLogManualExpense = () => {
    if (!user || !db || !expAmount || !expPropertyId || !expTitle || !expDate) return;
    setIsSavingExpense(true);
    const requestId = doc(collection(db, 'maintenanceRequests')).id;
    const requestRef = doc(db, 'maintenanceRequests', requestId);
    setDocumentNonBlocking(requestRef, {
      id: requestId, propertyId: expPropertyId, landlordId: user.uid, title: expTitle, status: 'completed', category: expCategory, cost: Number(expAmount), scheduledDate: expDate.toISOString(), createdAt: serverTimestamp(), updatedAt: serverTimestamp()
    }, { merge: true });
    toast({ title: "Expense Registered" });
    setIsExpenseDialogOpen(false); setIsSavingExpense(false); setExpAmount(''); setExpTitle('');
  };

  const handleDownloadTaxStatement = async () => {
    if (!taxPropertyId || !isClient) return;
    setIsGeneratingTax(true);

    try {
      const property = properties.find(p => p.id === taxPropertyId);
      const yearExpenses = maintenance?.filter(m => m.propertyId === taxPropertyId && m.status === 'completed' && new Date(m.scheduledDate || m.createdAt?.seconds * 1000).getFullYear() === taxYear) || [];
      const yearIncome = allPayments?.filter(p => p.propertyId === taxPropertyId && p.status === 'paid' && p.year === taxYear) || [];

      const totalIncome = yearIncome.reduce((acc, curr) => acc + (curr.amount || 0), 0);
      const totalExpenses = yearExpenses.reduce((acc, curr) => acc + (curr.cost || 0), 0);
      const netIncome = totalIncome - totalExpenses;

      const pdf = new jsPDF();
      const pageWidth = pdf.internal.pageSize.getWidth();

      // HEADER
      pdf.setFillColor(15, 23, 42);
      pdf.rect(0, 0, pageWidth, 50, 'F');
      pdf.setTextColor(255, 255, 255);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(22);
      pdf.text("ANNUAL TAX SUMMARY", 20, 25);
      pdf.setFontSize(9);
      pdf.setFont("helvetica", "normal");
      pdf.text(`OFFICIAL PORTFOLIO LEDGER | YEAR: ${taxYear}`, 20, 35);
      pdf.text(`GENERATED: ${format(new Date(), 'PPPP')}`, 20, 42);

      // ASSET INFO
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text("ASSET IDENTITY", 20, 65);
      pdf.setFontSize(11);
      pdf.setFont("helvetica", "normal");
      pdf.text(`${property?.addressLine1 || 'Property Asset'}`, 20, 73);
      pdf.text(`${property?.city || ''}, ${property?.zipCode || ''}`, 20, 79);

      // SUMMARY CARDS
      pdf.setFillColor(248, 250, 252);
      pdf.rect(20, 90, 170, 40, 'F');
      pdf.setDrawColor(226, 232, 240);
      pdf.rect(20, 90, 170, 40, 'D');

      pdf.setFont("helvetica", "bold");
      pdf.text("TOTAL INCOME:", 30, 105);
      pdf.text("TOTAL EXPENSES:", 30, 115);
      pdf.setFontSize(14);
      pdf.text("NET POSITION:", 30, 125);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(11);
      pdf.text(`£${totalIncome.toLocaleString()}`, 180, 105, { align: 'right' });
      pdf.setTextColor(185, 28, 28);
      pdf.text(`(£${totalExpenses.toLocaleString()})`, 180, 115, { align: 'right' });
      
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.setTextColor(netIncome >= 0 ? 22 : 185, netIncome >= 0 ? 101 : 28, netIncome >= 0 ? 52 : 28);
      pdf.text(`£${netIncome.toLocaleString()}`, 180, 125, { align: 'right' });

      // ITEMIZATION
      let y = 150;
      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(14);
      pdf.text("EXPENSE ITEMIZATION", 20, y);
      y += 10;
      pdf.setFontSize(8);
      pdf.setTextColor(100, 100, 100);
      pdf.text("DATE", 20, y);
      pdf.text("CATEGORY", 50, y);
      pdf.text("DESCRIPTION", 90, y);
      pdf.text("AMOUNT", 180, y, { align: 'right' });
      pdf.line(20, y + 2, 190, y + 2);
      y += 10;

      pdf.setTextColor(0, 0, 0);
      pdf.setFontSize(9);
      if (yearExpenses.length === 0) {
        pdf.text("No itemized expenses recorded for this period.", 20, y);
      } else {
        yearExpenses.forEach(exp => {
          if (y > 270) { pdf.addPage(); y = 20; }
          const date = exp.scheduledDate ? format(new Date(exp.scheduledDate), 'dd/MM/yy') : '--';
          pdf.text(date, 20, y);
          pdf.text(exp.category?.toUpperCase() || 'OTHER', 50, y);
          pdf.text(exp.title?.substring(0, 40) || 'Expense', 90, y);
          pdf.text(`£${(exp.cost || 0).toLocaleString()}`, 180, y, { align: 'right' });
          y += 7;
        });
      }

      pdf.save(`Tax_Summary_${property?.addressLine1.replace(/\s+/g, '_')}_${taxYear}.pdf`);
      toast({ title: "Statement Processed", description: "Your professional report is ready." });
    } catch (e) {
      toast({ variant: "destructive", title: "Orchestration Error" });
    } finally {
      setIsGeneratingTax(false);
    }
  };

  if (!isClient || propLoading) return <div className="flex h-[70vh] items-center justify-center opacity-40"><Loader2 className="animate-spin text-primary w-10 h-10" /></div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-1000 pb-12 text-left">
      <div className="flex flex-col gap-6 text-left border-b border-white/5 pb-6">
        <div className="space-y-1">
          <h1 className="text-3xl md:text-4xl font-headline font-bold text-foreground tracking-tight">Portfolio Insights</h1>
          <p className="text-muted-foreground font-medium font-body opacity-70 text-sm">Unified command and monthly collection analytics.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant="outline" className="bg-accent/5 text-accent border-accent/20 px-3 py-1.5 rounded-full font-bold uppercase tracking-[0.2em] text-[9px]"><Activity className="w-3.5 h-3.5 mr-2" /> Financial Pulse</Badge>
          {isPro ? (
            <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20 px-4 py-1.5 rounded-full font-bold uppercase tracking-[0.2em] text-[9px]"><Crown className="w-3.5 h-3.5 mr-2" /> Pro Portfolio Active</Badge>
          ) : (
            <Button onClick={handleUpgrade} disabled={isUpgrading} variant="outline" className="rounded-xl h-9 px-6 font-bold border-accent/30 text-accent bg-accent/5 hover:bg-accent/10 transition-all text-[9px] uppercase tracking-widest">{isUpgrading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <Crown className="w-3.5 h-3.5 mr-2" />} Upgrade to Pro</Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 space-y-6">
          <Card className="border-none shadow-2xl rounded-[2.5rem] overflow-hidden bg-card ring-1 ring-white/5">
            <CardHeader className="text-left px-8 pt-8 pb-4 border-b border-white/5 bg-white/[0.02]"><CardTitle className="text-xl font-headline flex items-center text-foreground"><BarChart3 className="w-6 h-6 mr-3 text-accent" /> Rent Distribution</CardTitle></CardHeader>
            <CardContent className="h-[380px] p-8">
               <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 700, fill: 'rgba(0,0,0,0.3)'}} dy={15} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: 'rgba(0,0,0,0.3)'}} />
                    <Tooltip cursor={{fill: 'rgba(0,0,0,0.03)', radius: 12}} contentStyle={{borderRadius: '16px', border: '1px solid rgba(0,0,0,0.05)', backgroundColor: 'hsl(var(--card))'}} />
                    <Bar dataKey="rent" radius={[12, 12, 0, 0]} barSize={45}>{chartData.map((_, i) => <Cell key={i} fill={i === 0 ? 'hsl(var(--accent))' : 'rgba(59, 130, 246, 0.4)'} />)}</Bar>
                  </BarChart>
               </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-4 space-y-6">
           <Card className="border-none shadow-2xl rounded-[2.5rem] bg-card ring-1 ring-border p-8 text-left relative group overflow-hidden">
            <div className="relative z-10 space-y-6">
               <div className="space-y-1.5">
                 <h3 className="font-bold font-headline text-xl tracking-tight text-foreground">Expense Hub</h3>
                 <p className="text-xs text-muted-foreground font-medium opacity-70">Orchestrate portfolio outlays.</p>
               </div>
               <Dialog open={isExpenseDialogOpen} onOpenChange={(o) => { setIsExpenseDialogOpen(o); if(!o) { setExpAmount(''); setExpTitle(''); } }}>
                <DialogTrigger asChild>
                  <Button className="w-full rounded-xl bg-accent text-white font-bold h-11 hover:bg-accent/90 transition-all text-[10px] uppercase tracking-widest border-none"><Plus className="w-4 h-4 mr-2" /> Register Expense</Button>
                </DialogTrigger>
                <DialogContent className="rounded-[3rem] border-none shadow-2xl p-0 overflow-hidden bg-card flex flex-col h-[750px] max-h-[90vh] max-w-[500px] ring-1 ring-white/10">
                  <div className="p-8 bg-primary/5 border-b border-white/5 text-left shrink-0"><DialogTitle className="text-xl font-bold font-headline text-foreground">Register Expense</DialogTitle></div>
                  <ScrollArea className="flex-1">
                    <div className="p-8 space-y-8 text-left pb-20">
                      <div className="space-y-3"><Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40">Identifier</Label><Input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Roof Repair" className="rounded-xl h-12 bg-muted/40 border-none font-bold px-6 shadow-inner ring-1 ring-white/5 text-foreground" /></div>
                      <div className="space-y-3"><Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40">Amount (£)</Label><Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="rounded-xl h-12 bg-muted/40 border-none font-bold px-6 shadow-inner ring-1 ring-white/5 text-foreground" /></div>
                      <div className="space-y-3">
                        <Label className="font-bold text-[10px] uppercase text-muted-foreground opacity-40">Property</Label>
                        <select className="flex h-12 w-full rounded-xl border-none bg-muted/40 px-5 py-2 text-sm focus:ring-2 focus:ring-accent outline-none font-bold text-foreground" value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)}>
                          <option value="">Choose asset...</option>
                          {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                        </select>
                      </div>
                    </div>
                  </ScrollArea>
                  <DialogFooter className="p-8 bg-muted/5 border-t border-white/5 shrink-0">
                    <Button onClick={handleLogManualExpense} disabled={isSavingExpense || !expAmount || !expPropertyId || !expTitle} type="button" className="w-full rounded-2xl h-14 font-bold bg-primary text-primary-foreground shadow-2xl shadow-primary/10 hover:opacity-90 font-headline uppercase tracking-widest text-[10px] border-none hover:scale-[1.01] transition-transform">{isSavingExpense ? <Loader2 className="w-5 h-5 animate-spin mr-3" /> : <Save className="w-5 h-5 mr-3" />} Commit Ledger</Button>
                  </DialogFooter>
                </DialogContent>
               </Dialog>
            </div>
          </Card>

          <Card className="border-none shadow-2xl rounded-[2.5rem] bg-card ring-1 ring-border p-8 text-left relative group overflow-hidden">
            <div className="relative z-10 space-y-6">
               <div className="space-y-1.5"><h3 className="font-bold font-headline text-xl tracking-tight text-foreground flex items-center gap-3"><Calculator className="w-6 h-6 text-emerald-500" /> Tax Reporting</h3></div>
               <div className="space-y-4">
                  <Select value={taxPropertyId} onValueChange={setTaxPropertyId}><SelectTrigger className="h-11 w-full rounded-xl bg-muted/40 border-none font-bold text-xs"><SelectValue placeholder="Select Asset..." /></SelectTrigger><SelectContent className="rounded-xl border-border bg-card">{properties?.map(p => <SelectItem key={p.id} value={p.id} className="font-bold text-xs">{p.addressLine1}</SelectItem>)}</SelectContent></Select>
                  <Select value={taxYear.toString()} onValueChange={(v) => setTaxYear(Number(v))}><SelectTrigger className="h-11 w-full rounded-xl bg-muted/40 border-none font-bold text-xs"><SelectValue placeholder="Tax Year" /></SelectTrigger><SelectContent className="rounded-xl border-border bg-card"><SelectItem value="2024" className="font-bold text-xs">2024 / 2025</SelectItem><SelectItem value="2025" className="font-bold text-xs">2025 / 2026</SelectItem></SelectContent></Select>
                  <Button onClick={handleDownloadTaxStatement} disabled={isGeneratingTax || !taxPropertyId} className="w-full rounded-xl bg-emerald-600 text-white font-bold h-11 hover:bg-emerald-700 transition-all text-[10px] uppercase tracking-widest border-none">{isGeneratingTax ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileDown className="w-4 h-4 mr-2" />} Generate Statement</Button>
               </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
