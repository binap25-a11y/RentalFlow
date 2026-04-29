
"use client";

import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { LayoutDashboard, LogOut, User } from "lucide-react";
import Link from "next/link";
import { useAuth, useUser } from "@/firebase";
import { initiateSignOut } from "@/firebase/non-blocking-login";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useRouter } from "next/navigation";

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

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-4 bg-white/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Link href={dashboardHref} className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <div className="p-1.5 bg-primary rounded-lg">
            <LayoutDashboard className="w-4 h-4 text-primary-foreground" />
          </div>
          <span className="font-headline font-bold text-lg tracking-tight text-primary">RentalFlow</span>
        </Link>
      </div>

      <div className="flex items-center gap-4">
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
              <div className="flex flex-col space-y-1">
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
