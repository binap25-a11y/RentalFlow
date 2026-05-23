"use client";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Header } from "@/components/dashboard/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Loader2 } from "lucide-react";
import { doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
import { RENTALFLOW_NEUTRAL_FALLBACK } from "@/lib/utils";

export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (isClient && !isUserLoading && !user) {
      router.replace('/auth');
    } else if (isClient && !isProfileLoading && profile && profile.role !== 'landlord') {
      router.replace(profile.role === 'tenant' ? '/tenant/hub' : '/auth');
    }
  }, [user, isUserLoading, profile, isProfileLoading, router, isClient]);

  const BRAND_LOGO_URL = RENTALFLOW_NEUTRAL_FALLBACK;

  // Consistent full-screen loader to prevent flicker
  if (!isClient || isUserLoading || isProfileLoading || (user && !profile)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="relative flex flex-col items-center">
          <div className="relative w-24 h-24 mb-10 animate-in fade-in zoom-in duration-700">
            <div className="absolute inset-0 bg-primary/10 rounded-[2rem] blur-2xl animate-pulse" />
            <div className="relative z-10 w-full h-full rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-primary/5">
              <Image 
                src={BRAND_LOGO_URL} 
                alt="Loading" 
                fill 
                className="object-cover" 
                unoptimized 
                priority
              />
            </div>
          </div>
          <div className="flex flex-col items-center gap-3">
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-primary opacity-60" />
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] font-headline">Synchronizing Ledger</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'landlord') {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background font-body">
        <SidebarNav 
          role="landlord" 
          userName={user?.displayName || user?.email?.split('@')[0] || 'Landlord'} 
          userAvatar={user?.photoURL || undefined} 
        />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header role="landlord" />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
