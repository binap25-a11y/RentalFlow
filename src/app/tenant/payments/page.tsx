"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery } from "@/firebase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  CreditCard, 
  History, 
  Loader2, 
  ArrowLeft,
  Download,
  PoundSterling,
  ShieldCheck
} from "lucide-react";
import { format } from "date-fns";
import { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * @fileOverview High-Fidelity Resident Rent & Finance Ledger.
 * Sequence: Header -> Tenancy Total Paid (Summary Card) -> Audit Trail.
 */

export default function TenantPaymentsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => { setIsClient(true); }, []);

  const paymentsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({
      db,
      collectionName: "rentPayments",
      userId: user.uid
    });
  }, [db, user]);

  const { data: allPayments, isLoading } = useCollection(paymentsQuery);

  const sortedPayments = useMemo(() => {
    if (!allPayments) return [];
    return [...allPayments].sort((a, b) => {
      if (a.year !== b.year) return b.year - a.year;
      return b.month - a.month;
    });
  }, [allPayments]);

  const financialSummary = useMemo(() => {
    if (!allPayments) return { totalPaid: 0, pendingCount: 0 };
    const paid = allPayments.filter(p => p.status === 'paid').reduce((acc, p) => acc + (p.amount || 0), 0);
    const pending = allPayments.filter(p => p.status !== 'paid').length;
    return { totalPaid: paid, pendingCount: pending };
  }, [allPayments]);

  if (!isClient) return null;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-6 duration-1000 max-w-7xl mx-auto pb-24 text-left">
      {/* 1. HEADER SECTION */}
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-2xl hover:bg-primary/5 transition-colors h-10 w-10 border border-white/5 shrink-0 shadow-sm">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 px-4 py-1.5 rounded-full font-bold uppercase tracking-[0.2em] text-[9px]">
             <PoundSterling className="w-3.5 h-3.5 mr-2" /> Verified Financial Ledger
          </Badge>
        </div>
        <h1 className="text-4xl font-headline font-bold text-foreground tracking-tight">Rent & Finance</h1>
        <p className="text-muted-foreground font-medium font-body text-lg opacity-70 max-w-2xl leading-relaxed">
          Review your historical rent receipts and monitor active collection cycles for your residency.
        </p>
      </div>

      {/* 2. FINANCIAL SUMMARY (STRATEGICALLY BELOW HEADER) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="p-8 bg-card rounded-[2.5rem] border border-border shadow-sm flex flex-col gap-1 relative overflow-hidden group text-left">
            <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                <ShieldCheck className="w-16 h-16 text-emerald-500" />
            </div>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.3em] opacity-60 font-headline">Tenancy Total Paid</p>
            <p className="text-4xl font-bold font-headline text-foreground tracking-tighter">£{financialSummary.totalPaid.toLocaleString()}</p>
            <div className="flex items-center gap-2 mt-4">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[8px] font-bold uppercase tracking-widest text-emerald-600">Audit Pulse Active</span>
            </div>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* 3. AUDIT TRAIL */}
        <div className="lg:col-span-8 space-y-10">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-2xl font-bold font-headline flex items-center text-foreground tracking-tight">
              <History className="w-7 h-7 mr-4 text-accent" />
              Payment History
            </h3>
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] opacity-40 font-headline hidden sm:block">Audit Trail</p>
          </div>

          <div className="grid gap-6">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-32 gap-4 opacity-40">
                 <Loader2 className="w-12 h-12 animate-spin text-primary" />
                 <p className="text-[10px] font-bold uppercase tracking-[0.4em] font-headline">Synchronizing Ledger...</p>
              </div>
            ) : !sortedPayments || sortedPayments.length === 0 ? (
              <Card className="py-32 text-center bg-muted/5 rounded-[3rem] border-2 border-dashed border-border opacity-50 shadow-inner flex flex-col items-center justify-center">
                <div className="p-8 bg-muted rounded-[2.5rem] mb-6"><CreditCard className="w-16 h-16 text-foreground/20" /></div>
                <p className="text-foreground font-bold font-headline uppercase tracking-[0.3em] text-xs">No payment records found</p>
              </Card>
            ) : (
              sortedPayments.map(payment => {
                const isPaid = payment.status === 'paid';
                return (
                  <Card key={payment.id} className="border-none shadow-sm group bg-card rounded-[2.5rem] overflow-hidden ring-1 ring-border transition-all hover:shadow-2xl hover:ring-accent/10">
                    <CardContent className="p-10">
                      <div className="flex flex-col md:flex-row justify-between items-center gap-8">
                        <div className="flex items-center gap-8 flex-1 min-w-0">
                          <div className={cn(
                            "w-16 h-16 rounded-2xl flex flex-col items-center justify-center font-headline shadow-inner border transition-all",
                            isPaid ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-600" : "bg-amber-500/10 border-amber-500/20 text-amber-600"
                          )}>
                             <span className="text-[9px] font-bold uppercase tracking-widest opacity-60">
                               {format(new Date(payment.year, payment.month - 1), 'MMM')}
                             </span>
                             <span className="text-xl font-bold leading-none">{payment.year}</span>
                          </div>
                          
                          <div className="space-y-2 flex-1 min-w-0 text-left">
                            <h4 className="text-2xl font-bold font-headline text-foreground tracking-tight">Monthly Rent Receipt</h4>
                            <Badge className={cn(
                              "uppercase text-[9px] font-bold px-4 py-1 tracking-[0.2em] rounded-full border-none shadow-sm font-headline",
                              isPaid ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'
                            )}>
                              {isPaid ? 'Receipted' : 'Pending Verification'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="text-right shrink-0">
                          <p className="text-3xl font-bold font-headline text-foreground tracking-tighter">£{payment.amount?.toLocaleString()}</p>
                          <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest opacity-40 mt-1">Official Yield</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>

        <div className="lg:col-span-4 space-y-10">
          <Card className="border-none shadow-2xl rounded-[3rem] bg-accent text-white overflow-hidden text-left relative group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full transition-transform duration-1000 group-hover:scale-150" />
             <CardHeader className="pb-6 p-10">
                <CardTitle className="text-2xl font-bold font-headline flex items-center gap-4">
                   <ShieldCheck className="w-8 h-8 text-white/90" /> Ledger Protocol
                </CardTitle>
             </CardHeader>
             <CardContent className="space-y-6 px-10 pb-12">
                <div className="p-6 bg-white/10 rounded-[2rem] border border-white/10 shadow-inner space-y-3">
                   <p className="text-[10px] font-bold uppercase opacity-60 tracking-[0.3em] font-headline">Real-Time Verification</p>
                   <p className="text-sm font-medium leading-relaxed opacity-90">
                     This ledger is synchronized in real-time. Status transitions occur the moment your management verifies fund receipt in their vault.
                   </p>
                </div>
             </CardContent>
          </Card>

          <Card className="border-none shadow-sm rounded-[3rem] bg-card ring-1 ring-border overflow-hidden">
             <CardHeader className="p-10 pb-4 border-b border-border bg-muted/5 text-left">
                <CardTitle className="text-xl font-headline font-bold flex items-center text-foreground">
                   <Download className="w-6 h-6 mr-4 text-accent" />
                   Reporting Suite
                </CardTitle>
             </CardHeader>
             <CardContent className="p-10 space-y-4">
                <Button variant="outline" className="w-full h-14 rounded-2xl border-border bg-background hover:bg-primary/5 font-bold text-[10px] uppercase tracking-widest font-headline transition-all shadow-sm" onClick={handleDownloadStatement}>
                   Download Annual Statement (PDF)
                </Button>
             </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );

  async function handleDownloadStatement() {
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();
    doc.text(`RENTAL STATEMENT - PORTFOLIO HISTORY`, 20, 20);
    doc.save(`Statement_Portfolio_Summary.pdf`);
  }
}