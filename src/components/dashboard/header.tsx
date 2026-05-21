"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogOut, User, Bell, LayoutDashboard, Search } from "lucide-react";
import Link from "next/link";
import { useAuth, useUser } from "@/firebase";
import { initiateSignOut } from "@/firebase/non-blocking-login";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState } from "react";

interface HeaderProps {
  role: 'landlord' | 'tenant';
}

export function Header({ role }: HeaderProps) {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  
  const dashboardHref = role === 'landlord' ? '/landlord/dashboard' : '/tenant/hub';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'User';

  const handleLogout = () => {
    initiateSignOut(auth);
    router.push('/');
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      router.push(`/${role}/${role === 'landlord' ? 'properties' : 'documents'}?q=${encodeURIComponent(search)}`);
    }
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-8 bg-white/80 backdrop-blur-md sticky top-0 z-40 transition-all text-left">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger className="-ml-1 text-primary/60 hover:text-primary" />
        <Separator orientation="vertical" className="h-4 bg-primary/10" />
        
        <form onSubmit={handleSearch} className="hidden md:flex items-center relative max-w-sm w-full ml-4">
          <Search className="absolute left-3 h-4 w-4 text-primary/30" />
          <Input 
            placeholder="Search portfolio..." 
            className="pl-9 h-10 rounded-xl bg-primary/5 border-none font-medium text-sm focus-visible:ring-primary/20 w-full"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      <div className="flex items-center gap-3">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl text-primary/40 hover:text-primary hover:bg-primary/5 relative">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-white" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 rounded-2xl border-none shadow-2xl overflow-hidden mt-2" align="end">
             <div className="p-4 bg-primary text-white flex justify-between items-center">
                <p className="font-bold text-xs uppercase tracking-widest font-headline">Intelligence Hub</p>
                <Badge variant="outline" className="text-[9px] text-white border-white/20 font-bold">3 New</Badge>
             </div>
             <div className="p-4 space-y-4 text-left">
                <div className="flex gap-3 items-start">
                   <div className="p-2 bg-emerald-100 text-emerald-700 rounded-lg"><LayoutDashboard className="w-4 h-4" /></div>
                   <div>
                      <p className="text-xs font-bold">Portfolio Grade Updated</p>
                      <p className="text-[10px] text-muted-foreground">Verification engine complete.</p>
                   </div>
                </div>
                <div className="flex gap-3 items-start">
                   <div className="p-2 bg-blue-100 text-blue-700 rounded-lg"><Bell className="w-4 h-4" /></div>
                   <div>
                      <p className="text-xs font-bold">New Direct Message</p>
                      <p className="text-[10px] text-muted-foreground">15 mins ago</p>
                   </div>
                </div>
             </div>
             <div className="p-3 bg-muted/50 border-t text-center">
                <Button variant="ghost" className="text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary h-8">Clear Feed</Button>
             </div>
          </PopoverContent>
        </Popover>
        
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
            <DropdownMenuLabel className="font-normal px-4 py-3 text-left">
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
