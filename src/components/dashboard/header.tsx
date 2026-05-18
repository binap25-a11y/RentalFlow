"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogOut, User, Bell, LayoutDashboard } from "lucide-react";
import Link from "next/link";
import { useAuth, useUser } from "@/firebase";
import { initiateSignOut } from "@/firebase/non-blocking-login";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";
import Image from "next/image";

interface HeaderProps {
  role: 'landlord' | 'tenant';
}

export function Header({ role }: HeaderProps) {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const dashboardHref = role === 'landlord' ? '/landlord/dashboard' : '/tenant/hub';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'User';

  const handleLogout = () => {
    initiateSignOut(auth);
    router.push('/');
  };

  const BRAND_LOGO_URL = 'https://picsum.photos/seed/rentalflow-pro-identity/512/512';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-8 bg-white/80 backdrop-blur-md sticky top-0 z-40 transition-all">
      <div className="flex items-center gap-4">
        <SidebarTrigger className="-ml-1 text-primary/60 hover:text-primary" />
        <Separator orientation="vertical" className="h-4 bg-primary/10" />
        <Link href={dashboardHref} className="flex items-center gap-3 group">
          <div className="relative h-9 w-9 rounded-xl overflow-hidden shadow-sm ring-1 ring-primary/5 transition-transform group-hover:scale-105">
            <Image 
              src={BRAND_LOGO_URL} 
              alt="RentalFlow Logo" 
              fill 
              className="object-cover" 
              unoptimized 
              data-ai-hint="real estate logo"
            />
          </div>
          <span className="font-headline font-bold text-xl tracking-tight text-primary hidden sm:block">RentalFlow</span>
        </Link>
      </div>

      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="rounded-full text-primary/40 hover:text-primary hover:bg-primary/5 hidden sm:flex">
          <Bell className="h-5 w-5" />
        </Button>
        
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-primary/5 p-1 rounded-full transition-all outline-none border border-transparent hover:border-primary/10">
              <Avatar className="h-9 w-9 border-2 border-white shadow-sm ring-1 ring-primary/5">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback className="bg-primary text-white text-xs font-bold font-headline">
                  {userName[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64 mt-2 rounded-[1.25rem] border-none shadow-2xl p-2 animate-in fade-in zoom-in-95">
            <DropdownMenuLabel className="font-normal px-4 py-3">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-bold leading-none font-headline text-primary">{userName}</p>
                <p className="text-[10px] leading-none text-muted-foreground truncate opacity-70">
                  {user?.email}
                </p>
                <div className="pt-2">
                  <span className="text-[9px] font-bold text-accent-foreground bg-accent/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                    {role} account
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator className="mx-2 bg-primary/5" />
            <div className="p-1 space-y-1">
              <DropdownMenuItem className="cursor-pointer py-2.5 rounded-xl font-bold font-headline focus:bg-primary/5 text-primary/70 focus:text-primary" asChild>
                 <Link href={dashboardHref}>
                  <LayoutDashboard className="mr-2 h-4 w-4" />
                  <span>My Hub</span>
                 </Link>
              </DropdownMenuItem>
              <DropdownMenuItem className="cursor-pointer py-2.5 rounded-xl font-bold font-headline focus:bg-primary/5 text-primary/70 focus:text-primary" asChild>
                 <Link href="/profile">
                  <User className="mr-2 h-4 w-4" />
                  <span>Account Specs</span>
                 </Link>
              </DropdownMenuItem>
            </div>
            <DropdownMenuSeparator className="mx-2 bg-primary/5" />
            <div className="p-1">
              <DropdownMenuItem 
                className="cursor-pointer py-2.5 rounded-xl text-destructive font-bold font-headline focus:bg-destructive/10 focus:text-destructive"
                onClick={handleLogout}
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Deactivate Session</span>
              </DropdownMenuItem>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}