"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Building2, Wallet, TrendingUp, FileText, ArrowRight, 
  ShieldAlert, Loader2, CheckCircle2,
  Calendar as CalendarIcon, Zap, ClipboardList, AlertTriangle,
  PoundSterling, PieChart as PieChartIcon, ArrowUpRight, ArrowDownRight,
  Target, Download, Plus, Save, Users, Wrench
} from "lucide-react";
import { useUser, useFirestore, useCollection, useMemoFirebase, getLandlordCollectionQuery, setDocumentNonBlocking } from "@/firebase";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { isBefore, addDays, isValid, parseISO, format } from "date-fns";
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
import { collection, doc, serverTimestamp } from "firebase/firestore";
import { useToast } from "@/hooks/use-toast";

const COLORS = ['hsl(var(--primary))', '#10b981', '#f59e0b', '#3b82f6', '#ef4444', '#8b5cf6'];

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

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "tenantProfiles", user.uid);
  }, [db, user]);

  const { data: tenants } = useCollection(tenantsQuery);

  const [isExpenseDialogOpen, setIsExpenseDialogOpen] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [expAmount, setExpAmount] = useState('');
  const [expCategory, setExpCategory] = useState('other');
  const [expPropertyId, setExpPropertyId] = useState('');
  const [expTitle, setExpTitle] = useState('');

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

  const financialStats = useMemo(() => {
    if (!isClient || !properties || !maintenance) return null;

    const monthlyGross = properties.reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    const annualGross = monthlyGross * 12;
    
    const occupiedMonthly = properties
      .filter(p => p.isOccupied)
      .reduce((acc, p) => acc + (p.rentAmount || 0), 0);
    
    const totalExpenses = maintenance.reduce((acc, r) => acc + (Number(r.cost) || 0), 0);
    const netAnnualForecast = annualGross - totalExpenses;
    const collectionRate = monthlyGross > 0 ? (occupiedMonthly / monthlyGross) * 100 : 0;

    return {
      annualGross,
      totalExpenses,
      netAnnualForecast,
      collectionRate,
      monthlyGross,
      occupiedMonthly
    };
  }, [properties, maintenance, isClient]);

  const expenseBreakdown = useMemo(() => {
    if (!isClient || !maintenance) return [];
    const categories: Record<string, number> = {};
    maintenance.forEach(req => {
      const cat = req.category || 'other';
      const cost = Number(req.cost) || 0;
      if (cost > 0) {
        categories[cat] = (categories[cat] || 0) + cost;
      }
    });
    return Object.entries(categories).map(([name, value]) => ({ name, value }));
  }, [maintenance, isClient]);

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

    const maintenanceItems = (maintenance || [])
      .filter(m => {
        const scheduled = parseFlexDate(m.scheduledDate);
        return scheduled && isValid(scheduled) && m.status !== 'completed';
      })
      .map(m => ({
        id: m.id,
        title: m.title,
        subtitle: 'Scheduled Repair',
        date: m.scheduledDate,
        type: 'Repair',
        icon: Wrench,
        propertyId: m.propertyId,
        urgent: isBefore(parseFlexDate(m.scheduledDate)!, addDays(today, 7))
      }));

    const leaseItems = (tenants || [])
      .filter(t => {
        const expiry = parseFlexDate(t.leaseEndDate);
        return expiry && isValid(expiry) && isBefore(expiry, addDays(today, 90));
      })
      .map(t => ({
        id: t.id,
        title: `${t.firstName} ${t.lastName}`,
        subtitle: 'Lease Expiry',
        date: t.leaseEndDate,
        type: 'Lease',
        icon: Users,
        propertyId: t.propertyId,
        urgent: isBefore(parseFlexDate(t.leaseEndDate)!, addDays(today, 30))
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

      const isAlreadyListed = [...docItems, ...inspectionItems, ...leaseItems, ...maintenanceItems].some(item => item.propertyId === p.id);
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

    return [...docItems, ...inspectionItems, ...leaseItems, ...maintenanceItems, ...propertyStatusItems].sort((a, b) => {
      if (a.type === 'Missing' && b.type !== 'Missing') return -1;
      if (b.type === 'Missing' && a.type !== 'Missing') return 1;
      if (a.urgent && !b.urgent) return -1;
      if (!a.urgent && b.urgent) return 1;
      return 0;
    });
  }, [documents, inspections, properties, tenants, maintenance, isClient]);

  const healthScore = useMemo(() => {
    if (!isClient) return { grade: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' };
    const missingCount = complianceItems.filter(i => i.type === 'Missing').length;
    const urgentCount = complianceItems.filter(i => i.urgent && i.type !== 'Missing').length;

    if (missingCount > 0) return { grade: 'D', color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200' };
    if (urgentCount > 3) return { grade: 'C', color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-200' };
    if (urgentCount > 0) return { grade: 'B', color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200' };
    return { grade: 'A+', color: 'text-emerald-700', bg: 'bg-emerald-100', border: 'border-emerald-200' };
  }, [complianceItems, isClient]);

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

  const downloadExpenseLedger = async () => {
    if (!maintenance || !isClient) return;

    const { jsPDF } = await import("jspdf");
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const today = format(new Date(), 'PPP');

    pdf.setFillColor(31, 41, 55);
    pdf.rect(0, 0, pageWidth, 50, 'F');
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(22);
    pdf.setFont("helvetica", "bold");
    pdf.text("OFFICIAL EXPENSE LEDGER", 20, 25);
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    pdf.text(`RentalFlow Executive Portfolio | Generated: ${today}`, 20, 35);

    pdf.setTextColor(0, 0, 0);
    pdf.setFontSize(14);
    pdf.setFont("helvetica", "bold");
    pdf.text("Portfolio Expenditure Summary", 20, 70);
    
    pdf.setFontSize(10);
    pdf.setFont("helvetica", "normal");
    const totalExp = financialStats?.totalExpenses || 0;
    pdf.text(`Total Year-to-Date Maintenance Expenditure: £${totalExp.toLocaleString()}`, 20, 80);

    pdf.setDrawColor(229, 231, 235);
    pdf.line(20, 90, pageWidth - 20, 90);

    let y = 105;
    pdf.setFont("helvetica", "bold");
    pdf.text("Date", 20, y);
    pdf.text("Property Asset", 50, y);
    pdf.text("Category", 130, y);
    pdf.text("Amount", pageWidth - 20, y, { align: 'right' });
    
    y += 8;
    pdf.line(20, y, pageWidth - 20, y);
    y += 10;

    const validExpenses = maintenance
      .filter(m => Number(m.cost) > 0)
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(9);

    validExpenses.forEach(exp => {
      if (y > 270) {
        pdf.addPage();
        y = 20;
      }

      const date = exp.createdAt ? format(new Date(exp.createdAt.seconds * 1000), 'dd/MM/yyyy') : 'N/A';
      const property = properties?.find(p => p.id === exp.propertyId)?.addressLine1 || 'Unknown Asset';
      const category = exp.category || 'General';
      const cost = Number(exp.cost).toLocaleString();

      pdf.text(date, 20, y);
      
      const propLines = pdf.splitTextToSize(property, 75);
      pdf.text(propLines, 50, y);
      
      pdf.text(category.toUpperCase(), 130, y);
      pdf.text(`£${cost}`, pageWidth - 20, y, { align: 'right' });

      y += (propLines.length * 5) + 5;
      pdf.setDrawColor(243, 244, 246);
      pdf.line(20, y - 4, pageWidth - 20, y - 4);
    });

    const totalPages = pdf.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(156, 163, 175);
      pdf.text(`Page ${i} of ${totalPages} | Confidential Relational Ledger`, pageWidth / 2, 290, { align: "center" });
    }

    pdf.save(`Expense_Ledger_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
  };

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
          <h1 className="text-4xl font-headline font-bold text-primary mb-2 tracking-tight">Financial Overview</h1>
          <p className="text-muted-foreground font-medium font-body max-w-lg">Real-time portfolio command and high-yield operational analytics.</p>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group">
          <CardContent className="pt-8 text-left px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-emerald-50 text-emerald-600 p-4 rounded-2xl shadow-inner">
                <PoundSterling className="w-6 h-6" />
              </div>
              <ArrowUpRight className="w-5 h-5 text-emerald-500 opacity-40" />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold font-headline tracking-tighter text-primary">
                £{financialStats?.annualGross.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest font-headline opacity-60">Gross Annual Income</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group">
          <CardContent className="pt-8 text-left px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-red-50 text-red-600 p-4 rounded-2xl shadow-inner">
                <ShieldAlert className="w-6 h-6" />
              </div>
              <ArrowDownRight className="w-5 h-5 text-red-500 opacity-40" />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold font-headline tracking-tighter text-primary">
                £{financialStats?.totalExpenses.toLocaleString()}
              </p>
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest font-headline opacity-60">Total Expenses (YTD)</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-primary text-white overflow-hidden group">
          <CardContent className="pt-8 text-left px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-white/10 text-white p-4 rounded-2xl">
                <TrendingUp className="w-6 h-6" />
              </div>
              <Target className="w-5 h-5 text-white/40" />
            </div>
            <div className="space-y-1">
              <p className="text-3xl font-bold font-headline tracking-tighter">
                £{financialStats?.netAnnualForecast.toLocaleString()}
              </p>
              <p className="text-[10px] text-white/60 font-bold uppercase tracking-widest font-headline">Annual Net Forecast</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm rounded-[2rem] bg-white overflow-hidden group">
          <CardContent className="pt-8 text-left px-8">
            <div className="flex items-center justify-between mb-6">
              <div className="bg-blue-50 text-blue-600 p-4 rounded-2xl shadow-inner">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <p className="text-xs font-bold text-blue-600">{financialStats?.collectionRate.toFixed(0)}%</p>
            </div>
            <div className="space-y-3">
              <p className="text-3xl font-bold font-headline tracking-tighter text-primary">
                £{financialStats?.occupiedMonthly.toLocaleString()}
              </p>
              <Progress value={financialStats?.collectionRate} className="h-2 bg-blue-50" />
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest font-headline opacity-60">Rent Collection Progress</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
            <CardHeader className="text-left px-10 pt-10 pb-4 border-b border-primary/5">
              <CardTitle className="text-2xl font-headline flex items-center text-primary">
                <TrendingUp className="w-6 h-6 mr-3 text-accent" />
                Portfolio Yield Distribution
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

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="text-left px-10 pt-8 pb-4">
                <CardTitle className="text-lg font-headline flex items-center text-primary">
                  <PieChartIcon className="w-5 h-5 mr-3 text-accent" />
                  Tax Categorized Expenses
                </CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                {expenseBreakdown.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={expenseBreakdown}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {expenseBreakdown.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip 
                        contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 10px 20px rgba(0,0,0,0.1)'}}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-full opacity-20">
                    <p className="font-bold text-xs uppercase tracking-widest">No Expenses Logged</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden bg-white">
              <CardHeader className="text-left px-10 pt-8 pb-4">
                <CardTitle className="text-lg font-headline flex items-center text-primary">
                  <PoundSterling className="w-5 h-5 mr-3 text-accent" />
                  Yield Breakdown
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 px-10">
                {expenseBreakdown.map((item, index) => (
                  <div key={item.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                      <span className="text-xs font-bold capitalize text-muted-foreground">{item.name}</span>
                    </div>
                    <span className="text-xs font-bold">£{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>

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
                          item.type === 'Status' ? "bg-emerald-100 text-emerald-600" : 
                          item.type === 'Lease' ? "bg-purple-100 text-purple-600" : 
                          item.type === 'Repair' ? "bg-sky-100 text-sky-600" : "bg-primary/5 text-primary"
                        )}>
                          <item.icon className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-[13px] font-headline text-primary leading-tight truncate pr-4">{item.title}</h4>
                          <div className="flex items-center gap-3 mt-1.5">
                            <p className={cn(
                              "text-[9px] font-bold uppercase tracking-[0.1em] px-2 py-0.5 rounded-full",
                              item.type === 'Status' ? "bg-emerald-100 text-emerald-700" : 
                              item.type === 'Missing' ? "bg-red-100 text-red-700" : 
                              item.type === 'Lease' ? "bg-purple-100 text-purple-700" : 
                              item.type === 'Repair' ? "bg-sky-100 text-sky-700" : "bg-primary/5 text-muted-foreground"
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
                        <Link href={item.type === 'Repair' ? '/landlord/maintenance' : `/landlord/properties/${item.propertyId}`}>
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

          <Card className="border-none shadow-sm rounded-[2.5rem] bg-white overflow-hidden p-8 text-left">
            <h3 className="font-bold font-headline text-lg mb-4">Tax Season Readiness</h3>
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3">
                <Dialog open={isExpenseDialogOpen} onOpenChange={setIsExpenseDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" className="w-full rounded-xl border-primary/20 font-bold h-12">
                      <Plus className="w-4 h-4 mr-2" /> Log Portfolio Expense
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="rounded-3xl border-none shadow-2xl p-0 overflow-hidden">
                    <div className="p-8 bg-primary/5 border-b text-left">
                      <DialogTitle className="text-xl font-bold font-headline text-primary">Log Manual Expense</DialogTitle>
                      <DialogDescription className="font-medium text-muted-foreground">Record insurance, fees, or one-off costs for your tax ledger.</DialogDescription>
                    </div>
                    <div className="p-8 space-y-6 text-left bg-white">
                      <div className="space-y-2">
                        <Label className="font-bold text-xs uppercase text-primary/60 font-headline">Expense Title</Label>
                        <Input value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="e.g. Landlord Insurance 2025" className="rounded-xl h-11 bg-muted/20 border-none font-bold" />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="font-bold text-xs uppercase text-primary/60 font-headline">Amount (£)</Label>
                          <Input type="number" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="0.00" className="rounded-xl h-11 bg-muted/20 border-none font-bold" />
                        </div>
                        <div className="space-y-2">
                          <Label className="font-bold text-xs uppercase text-primary/60 font-headline">Category</Label>
                          <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-body" value={expCategory} onChange={(e) => setExpCategory(e.target.value)}>
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
                        <Label className="font-bold text-xs uppercase text-primary/60 font-headline">Assign to Asset</Label>
                        <select className="flex h-11 w-full rounded-xl border-none bg-muted/20 px-3 py-2 text-sm focus:ring-2 focus:ring-primary outline-none font-body" value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)}>
                          <option value="">Choose a property...</option>
                          {properties?.map(p => <option key={p.id} value={p.id}>{p.addressLine1}</option>)}
                        </select>
                      </div>
                    </div>
                    <DialogFooter className="p-8 bg-muted/5 border-t">
                      <Button className="w-full rounded-xl h-12 font-bold bg-primary text-white shadow-lg" onClick={handleLogManualExpense} disabled={isSavingExpense || !expAmount || !expPropertyId || !expTitle}>
                        {isSavingExpense ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Commit to Ledger
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>

                <Button 
                  className="w-full rounded-xl bg-primary text-white font-bold h-12 shadow-lg shadow-primary/10" 
                  onClick={downloadExpenseLedger}
                >
                  <Download className="w-4 h-4 mr-2" />
                  Download Expense Ledger
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
