"use client";

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  Building2, 
  Users, 
  Wrench, 
  FileCheck, 
  LayoutDashboard, 
  LogOut,
  Home,
  FileText,
  KeyRound
} from 'lucide-react';
import { cn } from "@/lib/utils";
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/firebase";
import { initiateSignOut } from "@/firebase/non-blocking-login";

interface SidebarNavProps {
  role: 'landlord' | 'tenant';
  userName: string;
  userAvatar?: string;
}

export function SidebarNav({ role, userName, userAvatar }: SidebarNavProps) {
  const pathname = usePathname();
  const auth = useAuth();
  const router = useRouter();
  const { setOpenMobile, isMobile } = useSidebar();

  const dashboardHref = role === 'landlord' ? '/landlord/dashboard' : '/tenant/hub';

  const landlordItems = [
    { label: 'Overview', icon: LayoutDashboard, href: '/landlord/dashboard' },
    { label: 'Properties', icon: Building2, href: '/landlord/properties' },
    { label: 'Tenants', icon: Users, href: '/landlord/tenants' },
    { label: 'Maintenance', icon: Wrench, href: '/landlord/maintenance' },
    { label: 'Inspections', icon: FileCheck, href: '/landlord/inspections' },
  ];

  const tenantItems = [
    { label: 'My Hub', icon: Home, href: '/tenant/hub' },
    { label: 'Maintenance', icon: Wrench, href: '/tenant/maintenance' },
    { label: 'Documents', icon: FileText, href: '/tenant/documents' },
  ];

  const items = role === 'landlord' ? landlordItems : tenantItems;

  const handleLogout = () => {
    initiateSignOut(auth);
    router.push('/');
  };

  const handleItemClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar className="border-r border-sidebar-border shadow-2xl">
      <SidebarHeader className="p-6">
        <Link 
          href={dashboardHref} 
          className="flex items-center gap-2 group" 
          onClick={handleItemClick}
        >
          <div className="p-2 bg-sidebar-primary rounded-xl transition-transform group-hover:scale-110">
            <KeyRound className="w-5 h-5 text-sidebar-primary-foreground" />
          </div>
          <span className="font-headline font-bold text-xl tracking-tight text-sidebar-foreground">RentalFlow</span>
        </Link>
      </SidebarHeader>
      <SidebarContent className="px-3">
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.label} className="mb-1">
              <SidebarMenuButton 
                asChild 
                isActive={pathname === item.href}
                className={cn(
                  "h-11 rounded-lg transition-all duration-200",
                  pathname === item.href 
                    ? "bg-sidebar-primary text-sidebar-primary-foreground shadow-lg shadow-primary/20" 
                    : "hover:bg-sidebar-accent text-sidebar-foreground/80 hover:text-sidebar-foreground"
                )}
              >
                <Link href={item.href} onClick={handleItemClick}>
                  <item.icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter className="p-6 border-t border-sidebar-border">
        <div className="flex items-center gap-3 mb-6">
          <Avatar className="h-10 w-10 border-2 border-sidebar-primary ring-2 ring-sidebar-background shadow-lg">
            <AvatarImage src={userAvatar} />
            <AvatarFallback className="bg-sidebar-primary/20 text-sidebar-foreground">{userName[0]}</AvatarFallback>
          </Avatar>
          <div className="flex flex-col min-w-0">
            <span className="text-sm font-semibold truncate text-sidebar-foreground">{userName}</span>
            <span className="text-xs text-sidebar-foreground/60 capitalize">{role} Account</span>
          </div>
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton 
              onClick={handleLogout}
              className="w-full justify-start h-10 rounded-lg hover:bg-destructive/10 hover:text-destructive text-sidebar-foreground/60 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span>Logout</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
