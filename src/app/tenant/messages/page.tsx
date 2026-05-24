"use client";

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, getTenantCollectionQuery, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, query, where, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Loader2, MessageSquare, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function TenantMessagingPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [messageText, setMessageText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const tenantProfileQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getTenantCollectionQuery({ db, collectionName: "tenantProfiles", userId: user.uid });
  }, [db, user]);

  const { data: tenantProfiles } = useCollection(tenantProfileQuery);
  const profile = tenantProfiles?.[0];
  const landlordId = profile?.landlordId;

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'messages'),
      where('memberIds', 'array-contains', user.uid)
    );
  }, [db, user]);

  const { data: allMessages, loading } = useCollection(messagesQuery);

  const activeMessages = allMessages?.filter(m => 
    (m.senderId === user?.uid && m.receiverId === landlordId) ||
    (m.senderId === landlordId && m.receiverId === user?.uid)
  ).sort((a, b) => (a.timestamp?.seconds || 0) - (b.timestamp?.seconds || 0));

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !landlordId || !messageText.trim()) return;

    const messageId = doc(collection(db, 'messages')).id;
    addDocumentNonBlocking(collection(db, 'messages'), {
      id: messageId,
      senderId: user.uid,
      receiverId: landlordId,
      text: messageText.trim(),
      timestamp: serverTimestamp(),
      memberIds: [user.uid, landlordId]
    });

    setMessageText("");
  };

  if (loading) return <div className="flex h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 animate-in fade-in duration-500 max-w-4xl mx-auto">
      <Card className="w-full border-none shadow-xl flex flex-col rounded-3xl overflow-hidden bg-card ring-1 ring-border">
        <CardHeader className="p-6 bg-primary text-primary-foreground flex flex-row items-center gap-4">
          <div className="p-3 bg-white/20 rounded-2xl">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="text-left flex-1">
            <CardTitle className="text-2xl font-headline font-bold">Property Management</CardTitle>
            <p className="text-xs opacity-70 font-bold uppercase tracking-widest font-headline">Secure Direct Line</p>
          </div>
        </CardHeader>
      </Card>
      
      <Card className="flex-1 border-none shadow-xl flex flex-col rounded-3xl overflow-hidden bg-card ring-1 ring-border">
        <div className="flex-1 overflow-y-auto p-6 space-y-6" ref={scrollRef}>
          {!landlordId ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <MessageSquare className="w-16 h-16 mb-4 text-foreground" />
              <p className="font-bold font-headline text-foreground">Account Connection Required</p>
              <p className="text-sm text-foreground">Link your property to start messaging your landlord.</p>
            </div>
          ) : activeMessages?.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
              <MessageSquare className="w-16 h-16 mb-4 text-foreground" />
              <p className="font-bold font-headline text-foreground">No messages yet</p>
              <p className="text-sm text-foreground">Send a message to your landlord to get started.</p>
            </div>
          ) : (
            activeMessages?.map((msg, i) => (
              <div key={i} className={cn("flex flex-col max-w-[80%]", msg.senderId === user?.uid ? "ml-auto items-end" : "items-start")}>
                <div className={cn(
                  "p-5 rounded-2xl text-sm font-bold leading-relaxed shadow-sm",
                  msg.senderId === user?.uid ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-muted text-foreground rounded-tl-none"
                )}>
                  {msg.text}
                </div>
                <span className="text-[10px] text-muted-foreground mt-2 font-bold uppercase tracking-tighter text-left">
                  {msg.timestamp ? format(new Date(msg.timestamp.seconds * 1000), 'PPp') : 'Just now'}
                </span>
              </div>
            ))
          )}
        </div>

        <div className="p-6 bg-muted/5 border-t">
          <form onSubmit={handleSendMessage} className="flex gap-3">
            <Input
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Ask management something..."
              className="rounded-2xl h-14 bg-background border-none shadow-inner px-6 text-base focus-visible:ring-primary"
              disabled={!landlordId}
            />
            <Button type="submit" size="icon" className="h-14 w-14 rounded-2xl shadow-xl shadow-primary/20 bg-primary text-primary-foreground hover:bg-primary/90" disabled={!messageText.trim() || !landlordId}>
              <Send className="w-6 h-6" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  );
}
