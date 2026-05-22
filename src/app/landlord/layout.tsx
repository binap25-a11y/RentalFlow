"use client";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { Header } from "@/components/dashboard/header";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useUser, useFirestore, useDoc, useMemoFirebase } from "@/firebase";
import { Loader2 } from "lucide-react";
import { doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import Image from "next/image";

export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();
  const db = useFirestore();
  const router = useRouter();

  const userDocRef = useMemoFirebase(() => {
    if (!db || !user) return null;
    return doc(db, 'users', user.uid);
  }, [db, user]);

  const { data: profile, isLoading: isProfileLoading } = useDoc(userDocRef);

  useEffect(() => {
    if (!isUserLoading && !user) {
      router.replace('/');
    } else if (!isProfileLoading && profile && profile.role !== 'landlord') {
      router.replace(profile.role === 'tenant' ? '/tenant/hub' : '/');
    }
  }, [user, isUserLoading, profile, isProfileLoading, router]);

  const BRAND_LOGO_URL = `https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=512&auto=format&fit=crop`;

  if (isUserLoading || isProfileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="relative flex flex-col items-center">
          <div className="relative w-24 h-24 mb-6">
            <div className="absolute inset-0 bg-primary/10 rounded-3xl blur-xl animate-pulse" />
            <Image 
              src={BRAND_LOGO_URL} 
              alt="Loading" 
              fill 
              className="object-cover rounded-3xl relative z-10" 
              unoptimized 
            />
          </div>
          <div className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Resolving Profile</p>
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
