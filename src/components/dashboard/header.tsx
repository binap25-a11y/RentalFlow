"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { 
  LogOut, User, Bell, LayoutDashboard, Search, X, 
  MessageSquare, AlertTriangle, Moon, Sun, Clock,
  ShieldCheck, Settings, ChevronRight, Loader2
} from "lucide-react";
import Link from "next/link";
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, deleteDocumentNonBlocking } from "@/firebase";
import { initiateSignOut } from "@/firebase/non-blocking-login";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { collection, query, where, doc } from "firebase/firestore";

interface HeaderProps {
  role: 'landlord' | 'tenant';
}

export function Header({ role }: HeaderProps) {
  const { user } = useUser();
  const db = useFirestore();
  const auth = useAuth();
  const router = useRouter();
  
  const [search, setSearch] = useState("");
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [sessionTime, setSessionTime] = useState("60");
  const [mounted, setMounted] = useState(false);
  const [open, setOpen] = useState(false);
  
  const userName = user?.displayName || (user?.email ? String(user.email).split('@')[0] : 'User');

  // REAL-TIME NOTIFICATION LEDGER
  const notificationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(collection(db, 'notifications'), where('recipientId', '==', user.uid));
  }, [db, user]);

  const { data: notificationsData, loading: isNotifLoading } = useCollection(notificationsQuery);

  const notifications = useMemo(() => {
    return [...notificationsData].sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    });
  }, [notificationsData]);

  useEffect(() => {
    setMounted(true);
    const isDark = document.documentElement.classList.contains('dark');
    setIsDarkMode(isDark);
    
    const savedSession = localStorage.getItem('session_duration');
    if (savedSession) setSessionTime(savedSession);
  }, []);

  const toggleDarkMode = (checked: boolean) => {
    setIsDarkMode(checked);
    if (checked) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  const handleSessionChange = (value: string) => {
    setSessionTime(value);
    localStorage.setItem('session_duration', value);
  };

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

  const deleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!db) return;
    deleteDocumentNonBlocking(doc(db, 'notifications', id));
  };

  const handleNotificationClick = (href: string) => {
    router.push(href);
    setOpen(false);
  };

  const clearAll = () => {
    if (!db || !notifications.length) return;
    notifications.forEach(n => {
      deleteDocumentNonBlocking(doc(db, 'notifications', n.id));
    });
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 md:px-8 bg-background/80 backdrop-blur-md sticky top-0 z-40 transition-all text-left">
      <div className="flex items-center gap-4 flex-1">
        <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
        <Separator orientation="vertical" className="h-4 bg-border" />
        
        {role === 'landlord' && (
          <form onSubmit={handleSearch} className="hidden md:flex items-center relative max-w-sm w-full ml-4">
            <Search className="absolute left-3 h-4 w-4 text-muted-foreground/50" />
            <Input 
              placeholder="Search portfolio..." 
              className="pl-9 h-10 rounded-xl bg-muted/30 border-none font-medium text-sm focus-visible:ring-ring w-full text-foreground"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </form>
        )}
      </div>

      <div className="flex items-center gap-3">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-xl text-muted-foreground hover:text-foreground relative">
              <Bell className="h-5 w-5" />
              {notifications.length > 0 && (
                <span className="absolute top-2 right-2 w-2 h-2 bg-accent rounded-full border-2 border-background animate-in zoom-in" />
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 rounded-2xl border-border shadow-2xl overflow-hidden mt-2 bg-card" align="end">
             <div className="p-4 bg-primary text-primary-foreground flex justify-between items-center">
                <p className="font-bold text-xs uppercase tracking-widest font-headline">Intelligence Hub</p>
                <Badge variant="outline" className="text-[9px] text-primary-foreground border-primary-foreground/20 font-bold">{notifications.length} New</Badge>
             </div>
             <div className="max-h-[400px] overflow-y-auto no-scrollbar bg-card">
               {isNotifLoading ? (
                 <div className="p-12 flex flex-col items-center justify-center opacity-30 gap-3">
                    <Loader2 className="w-6 h-6 animate-spin" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Synchronizing...</p>
                 </div>
               ) : notifications.length > 0 ? (
                 <div className="p-2 space-y-1 text-left">
                    {notifications.map((n) => (
                      <div 
                        key={n.id} 
                        onClick={() => handleNotificationClick(n.href)}
                        className={cn(
                          "flex gap-3 items-start p-3 rounded-xl transition-all cursor-pointer group relative active:scale-[0.98]",
                          "hover:bg-primary/5"
                        )}
                      >
                         <div className={cn(
                           "p-2 rounded-lg shrink-0",
                           n.type === 'grade' ? "bg-emerald-500/10 text-emerald-500" :
                           n.type === 'message' ? "bg-accent/10 text-accent" : "bg-amber-500/10 text-amber-500"
                         )}>
                            {n.type === 'grade' ? <LayoutDashboard className="w-4 h-4" /> :
                             n.type === 'message' ? <MessageSquare className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
                         </div>
                         <div className="flex-1 min-w-0 pr-6">
                            <p className="text-xs font-bold truncate text-foreground group-hover:text-accent transition-colors">{n.title}</p>
                            <p className="text-[10px] text-muted-foreground line-clamp-2 mt-0.5 font-medium">{n.description}</p>
                            <p className="text-[9px] text-muted-foreground mt-1 opacity-60 font-bold uppercase tracking-tight">
                              {n.createdAt ? new Date(n.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now'}
                            </p>
                         </div>
                         <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-7 w-7 rounded-lg opacity-40 group-hover:opacity-100 transition-opacity absolute top-2 right-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => deleteNotification(n.id, e)}
                          >
                            <X className="h-3 w-3" />
                         </Button>
                      </div>
                    ))}
                 </div>
               ) : (
                 <div className="p-12 text-center flex flex-col items-center justify-center opacity-30">
                    <Bell className="w-8 h-8 mb-2 text-foreground" />
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground">Ledger Clear</p>
                 </div>
               )}
             </div>
             {notifications.length > 0 && (
               <div className="p-3 bg-muted/50 border-t border-border text-center">
                  <Button 
                    variant="ghost" 
                    className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground h-8 w-full"
                    onClick={clearAll}
                  >
                    Clear Ledger Feed
                  </Button>
               </div>
             )}
          </PopoverContent>
        </Popover>
        
        {mounted ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 hover:bg-muted p-1 rounded-full transition-all outline-none group border-2 border-accent/20">
                <Avatar className="h-9 w-9 border-2 border-accent shadow-xl transition-transform group-hover:scale-105">
                  <AvatarImage src={user?.photoURL || undefined} />
                  <AvatarFallback className="bg-accent text-accent-foreground text-xs font-bold font-headline">
                    {userName[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72 mt-2 rounded-[1.5rem] border-border shadow-2xl p-2 bg-card animate-in fade-in zoom-in-95">
              <DropdownMenuLabel className="font-normal px-4 py-4 text-left">
                <div className="flex flex-col space-y-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-bold leading-none font-headline text-foreground">{userName}</p>
                    <p className="text-[10px] leading-none text-muted-foreground font-bold truncate mt-1">
                      {user?.email}
                    </p>
                  </div>
                  <div>
                    <Badge className="bg-accent text-accent-foreground border-none text-[9px] font-bold uppercase tracking-[0.1em] px-3 py-1 rounded-full shadow-md">
                      {role} account
                    </Badge>
                  </div>
                </div>
              </DropdownMenuLabel>
              
              <DropdownMenuSeparator className="mx-2 bg-border" />
              
              <div className="p-1 space-y-1">
                <DropdownMenuItem className="cursor-pointer py-2.5 rounded-xl font-bold font-headline focus:bg-accent focus:text-accent-foreground text-muted-foreground" asChild>
                  <Link href="/profile">
                    <User className="mr-3 h-4 w-4" />
                    <span>Account Specs</span>
                  </Link>
                </DropdownMenuItem>
              </div>

              <DropdownMenuSeparator className="mx-2 bg-border" />

              <div className="p-2 space-y-3">
                <div className="flex items-center justify-between px-2">
                  <div className="flex items-center gap-2">
                    {isDarkMode ? <Moon className="h-4 w-4 text-accent" /> : <Sun className="h-4 w-4 text-amber-500" />}
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Dark Mode</span>
                  </div>
                  <Switch 
                    checked={isDarkMode} 
                    onCheckedChange={toggleDarkMode}
                    className="data-[state=checked]:bg-accent"
                  />
                </div>

                <div className="px-2 space-y-2">
                  <div className="flex items-center gap-2 text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                    <Clock className="h-4 w-4 text-accent" />
                    <span>Session Security</span>
                  </div>
                  <Select value={sessionTime} onValueChange={handleSessionChange}>
                    <SelectTrigger className="h-9 w-full bg-muted/50 border-none rounded-lg text-[10px] font-bold font-headline text-foreground">
                      <SelectValue placeholder="Session limit" />
                    </SelectTrigger>
                    <SelectContent className="rounded-xl border-border shadow-xl bg-card">
                      <SelectItem value="15" className="text-[10px] font-bold">15 Minutes</SelectItem>
                      <SelectItem value="30" className="text-[10px] font-bold">30 Minutes</SelectItem>
                      <SelectItem value="60" className="text-[10px] font-bold">60 Minutes</SelectItem>
                      <SelectItem value="720" className="text-[10px] font-bold">12 Hours</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DropdownMenuSeparator className="mx-2 bg-border" />
              
              <div className="p-1">
                <DropdownMenuItem 
                  className="cursor-pointer py-2.5 rounded-xl text-destructive font-bold font-headline focus:bg-destructive/10 focus:text-destructive"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-3 h-4 w-4" />
                  <span>Deactivate Session</span>
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
        )}
      </div>
    </header>
  );
}
