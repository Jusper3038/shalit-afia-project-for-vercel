import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";

const AuditLogsPage = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Tables<"audit_logs">[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("audit_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(100)
      .then(({ data }) => { setLogs(data ?? []); setLoading(false); });
  }, [user]);

  return (
    <AppLayout>
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Audit Logs</h2>
        <Card>
          <CardContent className="overflow-x-auto p-0">
            {loading ? (
              <div className="flex items-center justify-center h-32"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" /></div>
            ) : logs.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No activity yet.</div>
            ) : (
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Timestamp</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l) => (
                    <TableRow key={l.id}>
                      <TableCell className="text-sm">{new Date(l.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{l.action}</TableCell>
                      <TableCell className="text-muted-foreground">{l.details || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default AuditLogsPage;
