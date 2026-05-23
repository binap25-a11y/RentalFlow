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

export default function TenantLayout({
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
    if (!isUserLoading && !user && isClient) {
      router.replace('/auth');
    } else if (!isProfileLoading && profile && profile.role !== 'tenant' && isClient) {
      router.replace(profile.role === 'landlord' ? '/landlord/properties' : '/auth');
    }
  }, [user, isUserLoading, profile, isProfileLoading, router, isClient]);

  const BRAND_LOGO_URL = RENTALFLOW_NEUTRAL_FALLBACK;

  if (!isClient || isUserLoading || isProfileLoading || (user && !profile)) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-[100]">
        <div className="relative flex flex-col items-center">
          <div className="relative w-24 h-24 mb-10 animate-in fade-in zoom-in duration-1000">
            <div className="absolute inset-0 bg-primary/10 rounded-[2rem] blur-3xl animate-pulse" />
            <div className="relative z-10 w-full h-full rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-primary/5">
              <Image 
                src={BRAND_LOGO_URL} 
                alt="RentalFlow" 
                fill 
                className="object-cover" 
                unoptimized 
                priority
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary opacity-60" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] font-headline">Authorizing Access</p>
          </div>
        </div>
      </div>
    );
  }

  if (!profile || profile.role !== 'tenant') {
    return null;
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background font-body">
        <SidebarNav 
          role="tenant" 
          userName={user?.displayName || user?.email?.split('@')[0] || 'Resident'} 
          userAvatar={user?.photoURL || undefined} 
        />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header role="tenant" />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
