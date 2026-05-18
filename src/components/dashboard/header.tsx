
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LogOut, User, Bell, MessageSquare, Wrench, FileText, CheckCircle2 } from "lucide-react";
import Link from "next/link";
import { useAuth, useUser, useFirestore, useCollection, useMemoFirebase, updateDocumentNonBlocking } from "@/firebase";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { query, collection, where, orderBy, limit, doc, serverTimestamp } from "firebase/firestore";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface HeaderProps {
  role: 'landlord' | 'tenant';
}

export function Header({ role }: HeaderProps) {
  const { user } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const dashboardHref = role === 'landlord' ? '/landlord/dashboard' : '/tenant/hub';
  const userName = user?.displayName || user?.email?.split('@')[0] || 'User';

  const notificationsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'notifications'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
  }, [db, user]);

  const { data: notifications } = useCollection(notificationsQuery);
  const unreadCount = notifications?.filter(n => !n.isRead).length || 0;

  const handleLogout = () => {
    initiateSignOut(auth);
    router.push('/');
  };

  const markAsRead = (id: string) => {
    if (!db) return;
    updateDocumentNonBlocking(doc(db, 'notifications', id), {
      isRead: true,
      updatedAt: serverTimestamp()
    });
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'maintenance': return <Wrench className="w-4 h-4 text-blue-500" />;
      case 'message': return <MessageSquare className="w-4 h-4 text-violet-500" />;
      case 'vault': return <FileText className="w-4 h-4 text-emerald-500" />;
      default: return <Bell className="w-4 h-4 text-primary" />;
    }
  };

  const LOGO_URL = 'https://picsum.photos/seed/rentalflow-pro-identity/512/512';

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 bg-white/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Link href={dashboardHref} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
          <div className="relative h-8 w-8 rounded-lg overflow-hidden shadow-sm">
            <Image 
              src={LOGO_URL} 
              alt="RentalFlow Logo" 
              fill 
              className="object-cover" 
              unoptimized 
              data-ai-hint="real estate logo"
            />
          </div>
          <span className="font-headline font-bold text-lg tracking-tight text-primary">RentalFlow</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
        {/* Notification Bell */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative p-2 rounded-full hover:bg-muted transition-colors outline-none group">
              <Bell className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white animate-in zoom-in">
                  {unreadCount}
                </span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-0 rounded-2xl border-none shadow-2xl overflow-hidden mt-2">
            <div className="bg-primary p-4 text-white">
              <h3 className="font-headline font-bold text-sm">Notifications</h3>
              <p className="text-[10px] opacity-70 uppercase tracking-widest font-bold">Real-Time Activity Feed</p>
            </div>
            <ScrollArea className="h-[350px]">
              {notifications && notifications.length > 0 ? (
                <div className="divide-y divide-muted">
                  {notifications.map((n) => (
                    <div 
                      key={n.id} 
                      className={cn(
                        "p-4 hover:bg-muted/50 transition-colors cursor-pointer text-left",
                        !n.isRead && "bg-primary/[0.02]"
                      )}
                      onClick={() => markAsRead(n.id)}
                    >
                      <div className="flex gap-3">
                        <div className="mt-1 shrink-0 p-2 bg-white rounded-lg shadow-sm border border-muted">
                          {getIcon(n.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-xs leading-tight mb-1", !n.isRead ? "font-bold text-primary" : "font-medium text-muted-foreground")}>
                            {n.title}
                          </p>
                          <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                            {n.message}
                          </p>
                          <div className="flex items-center gap-2 mt-2">
                            <span className="text-[9px] font-bold text-muted-foreground/60 uppercase tracking-tighter">
                              {n.createdAt ? formatDistanceToNow(n.createdAt.seconds * 1000) + ' ago' : 'Just now'}
                            </span>
                            {!n.isRead && <Badge className="bg-primary text-[8px] h-3 px-1 rounded-full">New</Badge>}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center opacity-40">
                  <CheckCircle2 className="w-8 h-8 mb-2 text-primary" />
                  <p className="text-xs font-bold font-headline">All Caught Up</p>
                  <p className="text-[10px] font-medium">New alerts will appear here.</p>
                </div>
              )}
            </ScrollArea>
            <div className="p-2 border-t bg-muted/20">
               <Button variant="ghost" className="w-full h-8 text-[10px] font-bold text-muted-foreground hover:text-primary uppercase tracking-widest" asChild>
                 <Link href={dashboardHref}>View Dashboard</Link>
               </Button>
            </div>
          </PopoverContent>
        </Popover>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 hover:bg-muted p-1 rounded-full transition-colors outline-none">
              <Avatar className="h-8 w-8 border border-primary/10">
                <AvatarImage src={user?.photoURL || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {userName[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-2 rounded-xl border-none shadow-xl">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1 text-left">
                <p className="text-sm font-bold leading-none">{userName}</p>
                <p className="text-xs leading-none text-muted-foreground truncate">
                  {user?.email}
                </p>
                <p className="text-[10px] font-bold text-primary uppercase mt-1">
                  {role} Account
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer py-2 rounded-lg">
              <User className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              className="cursor-pointer py-2 rounded-lg text-destructive focus:text-destructive focus:bg-destructive/10"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
