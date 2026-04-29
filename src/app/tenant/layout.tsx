
"use client";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useUser } from "@/firebase";
import { Loader2 } from "lucide-react";

export default function TenantLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isUserLoading } = useUser();

  if (isUserLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
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
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
