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
import { RENTALFLOW_LOGO_URL } from "@/lib/utils";

/**
 * @fileOverview Resident Portfolio Layout.
 * Optimized for low-latency session validation.
 */

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();
  const [isClient, setIsClient] = useState(false);
  const [isFullyAuthorized, setIsFullyAuthorized] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (!isClient || isUserLoading) return;

    // ATOMIC REDIRECT: Zero-latency session check
    if (!user) {
      router.replace('/auth');
      return;
    }

    if (!isProfileLoading && profile) {
      if (profile.role !== 'tenant') {
        router.replace(profile.role === 'landlord' ? '/landlord/properties' : '/auth');
      } else {
        setIsFullyAuthorized(true);
      }
    }
  }, [user, isUserLoading, profile, isProfileLoading, router, isClient]);

  if (!isClient || !isFullyAuthorized) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-background z-[100] animate-in fade-in duration-300">
        <div className="relative flex flex-col items-center">
          <div className="relative w-24 h-24 mb-10 animate-in fade-in zoom-in duration-500">
            <div className="absolute inset-0 bg-primary/10 rounded-[2rem] blur-3xl animate-pulse" />
            <div className="relative z-10 w-full h-full rounded-[2rem] overflow-hidden shadow-2xl ring-1 ring-primary/5 bg-card">
              <Image 
                src={RENTALFLOW_LOGO_URL} 
                alt="RentalFlow" 
                fill 
                className="object-cover" 
                unoptimized 
                priority
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Loader2 className="w-4 h-4 animate-spin text-primary opacity-60" />
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.4em] font-headline">Orchestrating Portal</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background font-body animate-in fade-in duration-500">
        <SidebarNav 
          role="tenant" 
          userName={user?.displayName || user?.email?.split('@')[0] || 'Resident'} 
          userAvatar={user?.photoURL || undefined} 
        />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden bg-background">
          <Header role="tenant" />
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
