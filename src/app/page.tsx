
"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Building2, Home, KeyRound, LayoutDashboard } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = (role: 'landlord' | 'tenant') => {
    setIsLoading(true);
    // Simulate auth
    setTimeout(() => {
      if (role === 'landlord') {
        router.push('/landlord/dashboard');
      } else {
        router.push('/tenant/hub');
      }
    }, 800);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="mb-8 text-center">
        <div className="inline-flex items-center justify-center p-3 bg-primary text-primary-foreground rounded-2xl mb-4 shadow-xl shadow-primary/20">
          <KeyRound className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-headline font-bold text-primary mb-2">LeaseLoop</h1>
        <p className="text-muted-foreground font-medium">Rental Management Reimagined</p>
      </div>

      <Card className="w-full max-w-md border-none shadow-2xl bg-white/80 backdrop-blur-sm">
        <CardHeader className="space-y-1 pb-2">
          <CardTitle className="text-2xl text-center">Welcome Back</CardTitle>
          <CardDescription className="text-center">Select your portal to continue</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="landlord" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-8 bg-muted/50 p-1">
              <TabsTrigger value="landlord" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                Landlord
              </TabsTrigger>
              <TabsTrigger value="tenant" className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground">
                <Home className="w-4 h-4 mr-2" />
                Resident
              </TabsTrigger>
            </TabsList>
            
            <TabsContent value="landlord" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="landlord-email">Email</Label>
                  <Input id="landlord-email" placeholder="landlord@leaseloop.com" defaultValue="landlord@leaseloop.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="landlord-password">Password</Label>
                  <Input id="landlord-password" type="password" defaultValue="password123" />
                </div>
                <Button 
                  className="w-full h-12 text-base bg-primary hover:bg-primary/90 transition-all duration-300 transform active:scale-[0.98]" 
                  onClick={() => handleLogin('landlord')}
                  disabled={isLoading}
                >
                  {isLoading ? "Authenticating..." : "Login as Landlord"}
                </Button>
              </div>
            </TabsContent>

            <TabsContent value="tenant" className="space-y-4">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="tenant-email">Resident Email</Label>
                  <Input id="tenant-email" placeholder="resident@leaseloop.com" defaultValue="tenant@leaseloop.com" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tenant-password">Password</Label>
                  <Input id="tenant-password" type="password" defaultValue="password123" />
                </div>
                <Button 
                  className="w-full h-12 text-base bg-accent hover:bg-accent/90 transition-all duration-300 transform active:scale-[0.98]" 
                  onClick={() => handleLogin('tenant')}
                  disabled={isLoading}
                >
                  {isLoading ? "Authenticating..." : "Login as Resident"}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
      
      <p className="mt-8 text-xs text-muted-foreground opacity-60">
        &copy; 2024 LeaseLoop Systems. All rights reserved.
      </p>
    </div>
  );
}
