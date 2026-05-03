
"use client";

import { useState, useEffect, useRef } from 'react';
import { useUser, useFirestore, useCollection, useMemoFirebase, getLandlordCollectionQuery, addDocumentNonBlocking } from '@/firebase';
import { collection, serverTimestamp, query, where, orderBy, doc } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Send, Loader2, MessageSquare, User } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useSearchParams } from 'next/navigation';

export default function LandlordMessagingPage() {
  const { user } = useUser();
  const db = useFirestore();
  const searchParams = useSearchParams();
  const initialPropId = searchParams.get('prop');

  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const tenantsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    return getLandlordCollectionQuery(db, "tenantProfiles", user.uid);
  }, [db, user]);

  const { data: tenants, loading: tenantsLoading } = useCollection(tenantsQuery);

  const messagesQuery = useMemoFirebase(() => {
    if (!db || !user || !selectedTenantId) return null;
    return query(
      collection(db, 'messages'),
      where('memberIds', 'array-contains', user.uid),
      orderBy('timestamp', 'asc')
    );
  }, [db, user, selectedTenantId]);

  const { data: allMessages, loading: messagesLoading } = useCollection(messagesQuery);

  const activeMessages = allMessages?.filter(m => 
    (m.senderId === user?.uid && m.receiverId === selectedTenantId) ||
    (m.senderId === selectedTenantId && m.receiverId === user?.uid)
  );

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [activeMessages]);

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !db || !selectedTenantId || !messageText.trim()) return;

    const messageId = doc(collection(db, 'messages')).id;
    const messageRef = doc(db, 'messages', messageId);

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
    <div className="h-[calc(100vh-8rem)] flex flex-col md:flex-row gap-6 animate-in fade-in duration-500">
      <Card className="w-full md:w-80 border-none shadow-sm flex flex-col rounded-2xl overflow-hidden">
        <CardHeader className="bg-primary/5 p-4 border-b">
          <CardTitle className="text-lg font-headline flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" /> Conversations
          </CardTitle>
        </CardHeader>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {tenants?.map(tenant => (
              <button
                key={tenant.id}
                onClick={() => setSelectedTenantId(tenant.userId)}
                className={cn(
                  "w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left",
                  selectedTenantId === tenant.userId ? "bg-primary text-white shadow-md" : "hover:bg-muted"
                )}
              >
                <Avatar className="h-10 w-10 border border-white/20">
                  <AvatarFallback className={cn("text-xs font-bold", selectedTenantId === tenant.userId ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                    {tenant.firstName[0]}{tenant.lastName[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate">{tenant.firstName} {tenant.lastName}</p>
                  <p className={cn("text-[10px] truncate opacity-70", selectedTenantId === tenant.userId ? "text-white" : "text-muted-foreground")}>
                    {tenant.email}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex-1 border-none shadow-sm flex flex-col rounded-2xl overflow-hidden">
        {selectedTenantId ? (
          <>
            <CardHeader className="p-4 border-b bg-muted/30 flex flex-row items-center gap-4">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">
                  {tenants?.find(t => t.userId === selectedTenantId)?.firstName[0]}
                </AvatarFallback>
              </Avatar>
              <div className="text-left">
                <p className="font-bold text-sm font-headline">
                  {tenants?.find(t => t.userId === selectedTenantId)?.firstName} {tenants?.find(t => t.userId === selectedTenantId)?.lastName}
                </p>
                <p className="text-[10px] text-muted-foreground font-bold">Resident</p>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-6 space-y-4" ref={scrollRef}>
              {activeMessages?.map((msg, i) => (
                <div key={i} className={cn("flex flex-col max-w-[70%]", msg.senderId === user?.uid ? "ml-auto items-end" : "items-start")}>
                  <div className={cn(
                    "p-4 rounded-2xl text-sm font-medium shadow-sm",
                    msg.senderId === user?.uid ? "bg-primary text-white rounded-tr-none" : "bg-muted rounded-tl-none"
                  )}>
                    {msg.text}
                  </div>
                  <span className="text-[9px] text-muted-foreground mt-1 font-bold uppercase">
                    {msg.timestamp ? format(new Date(msg.timestamp.seconds * 1000), 'p') : 'Just now'}
                  </span>
                </div>
              ))}
            </div>
            <div className="p-4 bg-muted/10 border-t">
              <form onSubmit={handleSendMessage} className="flex gap-2">
                <Input
                  value={messageText}
                  onChange={(e) => setMessageText(e.target.value)}
                  placeholder="Type your message..."
                  className="rounded-xl h-12 bg-white border-none shadow-inner"
                />
                <Button type="submit" size="icon" className="h-12 w-12 rounded-xl shadow-lg shadow-primary/20" disabled={!messageText.trim()}>
                  <Send className="w-5 h-5" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-12 opacity-40">
            <MessageSquare className="w-16 h-16 mb-4" />
            <h3 className="text-xl font-bold font-headline">Messaging Hub</h3>
            <p className="text-sm font-medium">Select a conversation to start messaging your residents.</p>
          </div>
        )}
      </Card>
    </div>
  );
}
