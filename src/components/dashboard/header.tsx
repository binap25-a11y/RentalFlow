
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogOut, User, Bell, LayoutDashboard, Search, X, MessageSquare, AlertTriangle } from "lucide-react";
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
import { cn } from "@/lib/utils";

interface HeaderProps {
  role: 'landlord' | 'tenant';
}

type Notification = {
  id: string;
  title: string;
  description: string;
  time: string;
  type: 'grade' | 'message' | 'alert';
};

const INITIAL_NOTIFICATIONS: Notification[] = [
  { id: '1', title: 'Portfolio Grade Updated', description: 'Verification engine complete.', time: '15 mins ago', type: 'grade' },
  { id: '2', title: 'New Direct Message', description: 'Tenant has a question about rent.', time: '1 hour ago', type: 'message' },
  { id: '3', title: 'Inspection Reminder', description: 'Property Audit scheduled for tomorrow.', time: '2 hours ago', type: 'alert' }
];

export function Header({ role }: HeaderProps) {
  const { user } = useUser();
  const auth = useAuth();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [notifications, setNotifications] = useState<Notification[]>(INITIAL_NOTIFICATIONS);
  
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

  const deleteNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const clearAll = () => {
    setNotifications([]);
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
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-white animate-in zoom-in" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 rounded-2xl border-none shadow-2xl overflow-hidden mt-2" align="end">
             <div className="p-4 bg-primary text-white flex justify-between items-center">
                <p className="font-bold text-xs uppercase tracking-widest font-headline">Intelligence Hub</p>
                <Badge variant="outline" className="text-[9px] text-white border-white/20 font-bold">{notifications.length} New</Badge>
             </div>
             <div className="max-h-[400px] overflow-y-auto no-scrollbar">
               {notifications.length > 0 ? (
                 <div className="p-4 space-y-4 text-left">
                    {notifications.map((n) => (
                      <div key={n.id} className="flex gap-3 items-start group relative">
                         <div className={cn(
                           "p-2 rounded-lg shrink-0",
                           n.type === 'grade' ? "bg-emerald-100 text-emerald-700" :
                           n.type === 'message' ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                         )}>
                            {n.type === 'grade' ? <LayoutDashboard className="w-4 h-4" /> :
                             n.type === 'message' ? <MessageSquare className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                         </div>
                         <div className="flex-1 min-w-0 pr-6">
                            <p className="text-xs font-bold truncate text-primary">{n.title}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5">{n.description}</p>
                            <p className="text-[9px] text-muted-foreground mt-1 opacity-60 font-bold uppercase tracking-tight">{n.time}</p>
                         </div>
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-6 w-6 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity absolute top-0 right-0 text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteNotification(n.id);
                            }}
                          >
                            <X className="h-3 w-3" />
                         </Button>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="p-12 text-center flex flex-col items-center justify-center opacity-30">
                    <Bell className="w-8 h-8 mb-2 text-primary" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Clear Ledger</p>
                 </div>
               )}
             </div>
             {notifications.length > 0 && (
               <div className="p-3 bg-muted/50 border-t text-center">
                  <Button 
                    variant="ghost" 
                    className="text-[10px] font-bold uppercase tracking-widest text-primary/60 hover:text-primary h-8 w-full"
                    onClick={clearAll}
                  >
                    Clear Feed
                  </Button>
               </div>
             )}
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
