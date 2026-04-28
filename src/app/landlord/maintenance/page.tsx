
"use client";

import { useState } from 'react';
import { triageMaintenanceRequest } from "@/ai/flows/maintenance-request-triage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MOCK_MAINTENANCE } from "@/lib/mock-data";
import { Wrench, Sparkles, AlertCircle, CheckCircle2, Clock, Filter, BrainCircuit } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MaintenancePage() {
  const [requests, setRequests] = useState(MOCK_MAINTENANCE);
  const [isTriaging, setIsTriaging] = useState<string | null>(null);
  const { toast } = useToast();

  const handleTriage = async (id: string, description: string) => {
    setIsTriaging(id);
    try {
      const result = await triageMaintenanceRequest({ maintenanceRequest: description });
      
      setRequests(prev => prev.map(req => 
        req.id === id ? { ...req, priority: result.priority, category: result.category, reasoning: result.reasoning } : req
      ));
      
      toast({
        title: "AI Triage Complete",
        description: `Suggested priority: ${result.priority}`,
      });
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Triage failed",
        description: "Could not analyze request at this time.",
      });
    } finally {
      setIsTriaging(null);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch(priority) {
      case 'critical': return 'bg-red-500 text-white border-red-200';
      case 'urgent': return 'bg-orange-500 text-white border-orange-200';
      case 'routine': return 'bg-blue-500 text-white border-blue-200';
      default: return 'bg-slate-400 text-white border-slate-200';
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">Maintenance Management</h1>
          <p className="text-muted-foreground font-medium">Review, prioritize and assign maintenance tasks.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" className="rounded-xl">
            <Filter className="w-4 h-4 mr-2" />
            Filter
          </Button>
          <Button className="bg-primary hover:bg-primary/90 rounded-xl shadow-lg shadow-primary/20">
            <Wrench className="w-4 h-4 mr-2" />
            Log Issue
          </Button>
        </div>
      </div>

      <div className="grid gap-6">
        {requests.map((request) => (
          <Card key={request.id} className="border-none shadow-sm overflow-hidden group">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-0">
              <div className="p-6 md:col-span-3 space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <Badge variant="outline" className="text-xs uppercase font-bold text-primary/60 border-primary/20">
                    ID: {request.id}
                  </Badge>
                  <Badge className={`capitalize font-bold border ${getPriorityColor(request.priority)}`}>
                    {request.priority}
                  </Badge>
                  <Badge variant="secondary" className="capitalize">
                    {request.category}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium flex items-center ml-auto">
                    <Clock className="w-3 h-3 mr-1" /> {new Date(request.createdAt).toLocaleDateString()}
                  </span>
                </div>
                
                <div className="space-y-2">
                  <h3 className="text-xl font-bold font-headline group-hover:text-primary transition-colors">Maintenance Request</h3>
                  <p className="text-muted-foreground leading-relaxed">{request.description}</p>
                </div>

                {request.reasoning && (
                  <div className="bg-accent/10 border border-accent/20 rounded-xl p-4 flex gap-3">
                    <BrainCircuit className="w-5 h-5 text-accent shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-accent uppercase tracking-wider mb-1">AI Recommendation Insight</p>
                      <p className="text-sm text-accent-foreground/80 italic">{request.reasoning}</p>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-muted/30 p-6 flex flex-col justify-center gap-3 border-l border-muted/50">
                <Button 
                  className="w-full bg-accent hover:bg-accent/90 text-white rounded-xl shadow-lg shadow-accent/10 font-bold"
                  onClick={() => handleTriage(request.id, request.description)}
                  disabled={isTriaging === request.id}
                >
                  <Sparkles className={`w-4 h-4 mr-2 ${isTriaging === request.id ? 'animate-spin' : ''}`} />
                  {isTriaging === request.id ? 'Analyzing...' : 'Auto-Triage with AI'}
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" className="rounded-xl text-xs h-9">Assign</Button>
                  <Button variant="outline" className="rounded-xl text-xs h-9">Update Status</Button>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
