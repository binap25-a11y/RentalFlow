
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { MOCK_PROPERTIES, MOCK_MAINTENANCE } from "@/lib/mock-data";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Phone, FileText, Download, AlertCircle, Wrench, ShieldAlert, Home as HomeIcon } from "lucide-react";
import Image from "next/image";

export default function TenantHub() {
  const property = MOCK_PROPERTIES.length > 0 ? MOCK_PROPERTIES[0] : null;
  const activeRequests = MOCK_MAINTENANCE.filter(m => m.status !== 'completed');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const formatDate = (dateString: string) => {
    if (!mounted) return "";
    return new Date(dateString).toLocaleDateString();
  };

  if (!property) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="p-6 bg-accent/10 rounded-full">
          <HomeIcon className="w-12 h-12 text-accent" />
        </div>
        <div className="max-w-md">
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Welcome Home</h1>
          <p className="text-muted-foreground font-medium mb-6">You haven't been assigned to a property yet. Contact your landlord to get started.</p>
          <Button variant="outline" className="rounded-xl">Refresh Hub</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Resident Hub</h1>
          <p className="text-muted-foreground font-medium">Your sanctuary at {property.address.split(',')[0]}</p>
        </div>
        <Button className="bg-accent hover:bg-accent/90 rounded-xl shadow-lg shadow-accent/20">
          <AlertCircle className="w-4 h-4 mr-2" />
          Request Maintenance
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <Card className="lg:col-span-2 border-none shadow-sm overflow-hidden">
          <div className="relative h-64 w-full">
            <Image 
              src={property.imageUrl} 
              alt={property.address} 
              fill 
              className="object-cover"
              data-ai-hint="modern apartment interior"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
            <div className="absolute bottom-6 left-6 text-white">
              <p className="flex items-center text-sm mb-1 opacity-90"><MapPin className="w-4 h-4 mr-1" /> {property.address}</p>
              <h2 className="text-2xl font-headline font-bold">Property Details</h2>
            </div>
          </div>
          <CardContent className="pt-8 grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <h3 className="font-bold font-headline text-lg">About Your Home</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{property.description}</p>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary">Active Lease</Badge>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="font-bold font-headline text-lg flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-red-500" />
                Emergency Contacts
              </h3>
              <div className="space-y-3">
                {property.emergencyContacts.length > 0 ? (
                  property.emergencyContacts.map(contact => (
                    <div key={contact.id} className="flex items-center justify-between p-3 bg-muted/40 rounded-xl border border-muted">
                      <div>
                        <p className="text-sm font-bold">{contact.name}</p>
                        <p className="text-xs text-muted-foreground">{contact.role}</p>
                      </div>
                      <Button size="icon" variant="ghost" className="rounded-full text-primary hover:bg-primary/10">
                        <Phone className="w-4 h-4" />
                      </Button>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground italic">No emergency contacts listed.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-8">
          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-headline flex items-center justify-between">
                Active Requests
                <Badge className="bg-accent">{activeRequests.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeRequests.length > 0 ? (
                activeRequests.map(req => (
                  <div key={req.id} className="p-4 rounded-xl bg-muted/30 border border-muted">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="capitalize text-[10px] font-bold">{req.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">{formatDate(req.createdAt)}</span>
                    </div>
                    <p className="text-sm font-semibold text-primary mb-1 truncate">{req.description}</p>
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Wrench className="w-3 h-3 mr-1" /> {req.category}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-center py-4 text-muted-foreground italic">No active requests</p>
              )}
            </CardContent>
          </Card>

          <Card className="border-none shadow-sm">
            <CardHeader>
              <CardTitle className="text-xl font-headline">Documents</CardTitle>
              <CardDescription>Your lease and building guides</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {property.documents.length > 0 ? (
                property.documents.map(doc => (
                  <div key={doc.id} className="flex items-center justify-between p-3 hover:bg-muted/50 transition-colors rounded-xl cursor-pointer group">
                    <div className="flex items-center">
                      <div className="p-2 bg-blue-50 text-blue-600 rounded-lg mr-3 group-hover:bg-blue-100">
                        <FileText className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="text-sm font-bold truncate max-w-[150px]">{doc.name}</p>
                        <p className="text-[10px] text-muted-foreground">Uploaded {doc.uploadedAt}</p>
                      </div>
                    </div>
                    <Download className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                ))
              ) : (
                <p className="text-xs text-muted-foreground italic text-center py-2">No documents available.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
