import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { Tables } from "@/integrations/supabase/types";
import { readClinicCache, withQueryTimeout, writeClinicCache } from "@/lib/clinic-cache";

const AUDIT_LOGS_PAGE_SIZE = 50;

const AuditLogsPage = () => {
  const { clinicOwnerId } = useAuth();
  const [logs, setLogs] = useState<Tables<"audit_logs">[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);

  const timestampFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }),
    []
  );

  const fetchLogsPage = async (ownerId: string, page: number) => {
    const from = page * AUDIT_LOGS_PAGE_SIZE;
    const to = from + AUDIT_LOGS_PAGE_SIZE - 1;

    const fallback = { data: [] as Tables<"audit_logs">[], error: null };
    const { data } = await withQueryTimeout(
      supabase
        .from("audit_logs")
        .select("id, action, details, created_at, user_id")
        .eq("user_id", ownerId)
        .order("created_at", { ascending: false })
        .range(from, to),
      fallback
    );

    return data ?? [];
  };

  useEffect(() => {
    if (!clinicOwnerId) return;
    const cached = readClinicCache<Tables<"audit_logs">[]>(clinicOwnerId, "audit_logs");
    if (cached) {
      setLogs(cached);
      setLoading(false);
      setHasMore(cached.length >= AUDIT_LOGS_PAGE_SIZE);
    }

    void fetchLogsPage(clinicOwnerId, 0).then((data) => {
      setLogs(data);
      setHasMore(data.length === AUDIT_LOGS_PAGE_SIZE);
      writeClinicCache(clinicOwnerId, "audit_logs", data);
      setLoading(false);
    });
  }, [clinicOwnerId]);

  const loadMoreLogs = async () => {
    if (!clinicOwnerId || loadingMore || !hasMore) return;

    setLoadingMore(true);
    const nextPage = Math.floor(logs.length / AUDIT_LOGS_PAGE_SIZE);
    const nextLogs = await fetchLogsPage(clinicOwnerId, nextPage);
    setLogs((current) => [...current, ...nextLogs]);
    setHasMore(nextLogs.length === AUDIT_LOGS_PAGE_SIZE);
    setLoadingMore(false);
  };

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
                      <TableCell className="text-sm">{timestampFormatter.format(new Date(l.created_at))}</TableCell>
                      <TableCell className="font-medium">{l.action}</TableCell>
                      <TableCell className="text-muted-foreground">{l.details || "-"}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
        {!loading && logs.length > 0 && (
          <div className="flex justify-center">
            <Button variant="outline" onClick={loadMoreLogs} disabled={loadingMore || !hasMore}>
              {loadingMore ? "Loading..." : hasMore ? "Load older logs" : "No more logs"}
            </Button>
          </div>
        )}
      </div>
    </AppLayout>
  );
};

export default AuditLogsPage;
