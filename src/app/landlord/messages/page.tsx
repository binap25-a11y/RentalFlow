"use client";

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, getLandlordCollectionQuery, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Loader2, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSearchParams } from 'next/navigation';

export default function LandlordMessagingPage() {
  const { user } = useUser();
  const db = useFirestore();
  const searchParams = useSearchParams();

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "tenantProfiles", user.uid);
  }, [db, user]);

  const { data: tenants, loading: tenantsLoading } = useCollection(tenantsQuery);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'messages'),
      where('memberIds', 'array-contains', user.uid)
    );
  }, [db, user]);

  const { data: allMessages, loading: messagesLoading } = useCollection(messagesQuery);

  const activeMessages = allMessages?.filter(m => 
    (m.senderId === user?.uid && m.receiverId === selectedTenantId) ||
    (m.senderId === selectedTenantId && m.receiverId === user?.uid)
  ).sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedTenantId || !messageText.trim()) return;

    const messageId = doc(collection(db, 'messages')).id;

    addDocumentNonBlocking(collection(db, 'messages'), {
      id: messageId,
      senderId: user.uid,
      receiverId: selectedTenantId,
      text: messageText.trim(),
      timestamp: serverTimestamp(),
      memberIds: [user.uid, selectedTenantId]
    });

    setMessageText("");
  };

  if (tenantsLoading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500 max-w-5xl mx-auto pb-12">
      <Card className="w-full border-none shadow-sm flex flex-col rounded-3xl overflow-hidden bg-white">
        <CardHeader className="bg-primary/5 p-6 border-b">
          <CardTitle className="text-xl font-headline flex items-center gap-2 text-left text-primary">
            <MessageSquare className="w-5 h-5" /> Resident Conversations
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-2">
            {tenants?.map(tenant => (
              <button
                key={tenant.id}
                onClick={() => setSelectedTenantId(tenant.userId)}
                className={cn(
                  "flex items-center gap-3 p-4 rounded-2xl transition-all text-left border border-transparent min-w-[220px] flex-1 md:flex-none",
                  selectedTenantId === tenant.userId 
                    ? "bg-primary text-white shadow-lg shadow-primary/20 scale-[1.02]" 
                    : "bg-muted/50 hover:bg-muted"
                )}
              >
                <Avatar className="h-10 w-10 border-2 border-white/20">
                  <AvatarFallback className={cn("text-xs font-bold", selectedTenantId === tenant.userId ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                    {tenant.firstName[0]}{tenant.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{tenant.firstName} {tenant.lastName}</p>
                  <p className={cn("text-[10px] truncate font-medium", selectedTenantId === tenant.userId ? "text-white/70" : "text-muted-foreground")}>
                    {tenant.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card className="flex-1 border-none shadow-sm flex flex-col rounded-3xl overflow-hidden min-h-[550px] bg-white">
        {selectedTenantId ? (
          <>
            <CardHeader className="p-5 border-b bg-muted/10 flex flex-row items-center gap-4">
              <Avatar className="h-10 w-10 border-2 border-primary/10">
                <AvatarFallback className="bg-primary/10 text-primary text-sm font-bold">
                  {tenants?.find(t => t.userId === selectedTenantId)?.firstName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="font-bold text-base font-headline text-primary">
                  {tenants?.find(t => t.userId === selectedTenantId)?.firstName} {tenants?.find(t => t.userId === selectedTenantId)?.lastName}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">Direct Line</p>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-8 space-y-6 max-h-[450px]" ref={scrollRef}>
              {activeMessages?.map((msg, i) => (
                <div key={i} className={cn("flex flex-col max-w-[75%]", msg.senderId === user?.uid ? "ml-auto items-end" : "items-start")}>
                  <div className={cn(
                    "p-5 rounded-2xl text-sm font-medium shadow-sm leading-relaxed",
                    msg.senderId === user?.uid ? "bg-primary text-white rounded-tr-none" : "bg-muted text-foreground rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-2 font-bold uppercase tracking-widest">
                    {msg.timestamp ? format(new Date(msg.timestamp.seconds * 1000), 'p') : 'Just now'}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-6 bg-muted/5 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-3">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type a professional message..."
                  className="rounded-2xl h-14 bg-white border-none shadow-inner px-6 text-base"
                />
                <Button type="submit" size="icon" className="h-14 w-14 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-white" disabled={!messageText.trim()}>
                  <Send className="w-6 h-6" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-16 opacity-30">
            <MessageSquare className="w-20 h-20 mb-6 text-primary" />
            <h3 className="text-2xl font-bold font-headline text-primary">Communication Hub</h3>
            <p className="text-sm font-medium max-w-sm">Select a resident conversation above to manage communications securely.</p>
          </div>
        )}
      </Card>
    </div>
  );
}