
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Users, Wrench, AlertTriangle, ArrowUpRight, Clock, FileCheck, Plus } from "lucide-react";
import { MOCK_PROPERTIES, MOCK_MAINTENANCE } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function LandlordDashboard() {
  const stats = [
    { label: 'Total Properties', value: MOCK_PROPERTIES.length, icon: Building2, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Tenants', value: 0, icon: Users, color: 'text-violet-600', bg: 'bg-violet-50' },
    { label: 'Open Issues', value: MOCK_MAINTENANCE.filter(m => m.status !== 'completed').length, icon: Wrench, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Urgent Alerts', value: MOCK_MAINTENANCE.filter(m => m.priority === 'urgent').length, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
  ];

  const hasActivity = MOCK_MAINTENANCE.length > 0;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div>
        <h1 className="text-3xl font-headline font-bold text-primary mb-2">Portfolio Overview</h1>
        <p className="text-muted-foreground font-medium">Monitoring your properties and resident requests.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.label} className="border-none shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <div className={`${stat.bg} ${stat.color} p-3 rounded-xl`}>
                  <stat.icon className="w-6 h-6" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-2xl font-bold font-headline">{stat.value}</p>
                <p className="text-sm text-muted-foreground font-medium">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-headline flex items-center">
              <Clock className="w-5 h-5 mr-2 text-primary" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {hasActivity ? (
              MOCK_MAINTENANCE.map((request) => (
                <div key={request.id} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 hover:bg-muted/50 transition-colors">
                  <div className="p-2 bg-white rounded-lg shadow-sm">
                    <Wrench className="w-5 h-5 text-amber-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-semibold text-sm truncate">Maintenance Request # {request.id}</h3>
                      <Badge variant={request.priority === 'urgent' ? 'destructive' : 'secondary'} className="capitalize">
                        {request.priority}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground line-clamp-1 mb-2">{request.description}</p>
                    <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                      <span className="flex items-center"><Building2 className="w-3 h-3 mr-1" /> Prop ID: {request.propertyId}</span>
                      <span className="flex items-center"><Clock className="w-3 h-3 mr-1" /> Just now</span>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Clock className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold mb-1">No recent activity</h3>
                <p className="text-sm text-muted-foreground max-w-xs">When tenants submit maintenance requests or properties are updated, they will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-none shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl font-headline">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            <Button className="w-full justify-start h-12 bg-primary hover:bg-primary/90 rounded-xl" asChild>
              <Link href="/landlord/properties">
                <Building2 className="w-5 h-5 mr-3" />
                Add New Property
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl border-primary/20 hover:bg-primary/5" asChild>
              <Link href="/landlord/tenants">
                <Users className="w-5 h-5 mr-3 text-primary" />
                Assign Resident
              </Link>
            </Button>
            <Button variant="outline" className="w-full justify-start h-12 rounded-xl border-accent/20 hover:bg-accent/5" asChild>
              <Link href="/landlord/inspections">
                <FileCheck className="w-5 h-5 mr-3 text-accent" />
                Schedule Inspection
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
