
"use client";

import { SidebarNav } from "@/components/dashboard/sidebar-nav";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { MOCK_USERS } from "@/lib/mock-data";

export default function LandlordLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = MOCK_USERS[0];

  return (
    <SidebarProvider defaultOpen={true}>
      <div className="flex min-h-screen w-full bg-background font-body">
        <SidebarNav role="landlord" userName={user.name} userAvatar={user.avatar} />
        <SidebarInset className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <main className="flex-1 overflow-y-auto p-4 md:p-8">
            {children}
          </main>
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
