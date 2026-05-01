"use client";

import { useUser, useFirestore, useCollection, useMemoFirebase } from "@/firebase";
import { query, where, collectionGroup } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Download, Loader2, Calendar, ShieldCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { format, isValid } from "date-fns";
import { useState } from "react";

export default function TenantDocumentsPage() {
  const { user } = useUser();
  const db = useFirestore();
  const [searchTerm, setSearchTerm] = useState("");

  const docsQuery = useMemoFirebase(() => {
    if (!db || !user) return null;
    // Documents are nested. Use collectionGroup with correct filter.
    return query(
      collectionGroup(db, "documents"),
      where("userId", "==", user.uid)
    );
  }, [db, user]);

  const { data: documents, isLoading } = useCollection(docsQuery);

  const filteredDocs = documents?.filter(doc => 
    doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.documentType?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-headline font-bold text-primary mb-2">My Documents</h1>
          <p className="text-muted-foreground font-medium">Access your lease, certificates, and property guides.</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" />
        <Input 
          placeholder="Search documents by name or type..." 
          className="pl-10 h-12 rounded-xl"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {isLoading ? (
          <div className="col-span-full py-20 flex flex-col items-center justify-center">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
            <p className="text-sm text-muted-foreground">Retrieving vault items...</p>
          </div>
        ) : !filteredDocs || filteredDocs.length === 0 ? (
          <Card className="col-span-full border-2 border-dashed py-20 text-center">
            <div className="p-4 bg-muted rounded-full w-fit mx-auto mb-4">
              <FileText className="w-8 h-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold">No documents found</h3>
            <p className="text-sm text-muted-foreground">Documents shared by your landlord will appear here.</p>
          </Card>
        ) : (
          filteredDocs.map((doc) => {
            const createdAt = doc.createdAt ? new Date(doc.createdAt) : null;
            return (
              <Card key={doc.id} className="border-none shadow-sm hover:shadow-md transition-all group">
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                      <FileText className="w-5 h-5" />
                    </div>
                    <Badge variant="outline" className="text-[10px] font-bold">
                      {doc.documentType || 'Other'}
                    </Badge>
                  </div>
                  <CardTitle className="text-base font-bold line-clamp-1 group-hover:text-primary transition-colors">
                    {doc.fileName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center text-xs text-muted-foreground">
                      <Calendar className="w-3.5 h-3.5 mr-2" />
                      Shared: {createdAt && isValid(createdAt) ? format(createdAt, 'PP') : 'Recently'}
                    </div>
                    {doc.expiryDate && (
                      <div className="flex items-center text-xs text-amber-600 font-bold">
                        <ShieldCheck className="w-3.5 h-3.5 mr-2" />
                        Valid until: {format(new Date(doc.expiryDate), 'PP')}
                      </div>
                    )}
                  </div>
                  <Button variant="outline" className="w-full rounded-lg border-primary/10 hover:bg-primary/5 h-9 text-xs font-bold" asChild>
                    <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                      <Download className="w-3 h-3 mr-2" />
                      Download Copy
                    </a>
                  </Button>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}