import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Inbox, Mail, Power, ShieldCheck, Trash2, Users as UsersIcon } from "lucide-react";
import type { Enums, Tables } from "@/integrations/supabase/types";

type SystemUser = {
  clinic_name: string;
  created_at: string;
  deactivated_at: string | null;
  email: string;
  is_active: boolean;
  name: string;
  profile_id: string;
  role: Enums<"app_role">;
  updated_at: string;
  user_id: string;
};

type LeadRow = Tables<"leads">;

const UsersPage = () => {
  const { isPlatformOwner, claimPlatformOwnerAccess, loading, user } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [claimingAccess, setClaimingAccess] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingStatusUserId, setUpdatingStatusUserId] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { data, error } = await supabase.rpc("get_platform_accounts");
    setLoadingUsers(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setUsers((data ?? []) as SystemUser[]);
  };

  const fetchLeads = async () => {
    setLoadingLeads(true);
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(8);
    setLoadingLeads(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setLeads((data ?? []) as LeadRow[]);
  };

  useEffect(() => {
    if (!isPlatformOwner) {
      setUsers([]);
      setLeads([]);
      return;
    }

    void fetchUsers();
    void fetchLeads();
  }, [isPlatformOwner]);

  const handleDelete = async (account: SystemUser) => {
    const confirmed = window.confirm(
      `Delete ${account.name || account.email}? This removes the account and all records linked to it.`
    );

    if (!confirmed) return;

    setDeletingUserId(account.user_id);
    const { error } = await supabase.rpc("platform_delete_account", {
      p_user_id: account.user_id,
    });
    setDeletingUserId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logAudit("Deleted platform account", `Deleted ${account.email}`);
    toast.success("User account deleted.");
    void fetchUsers();
  };

  const handleToggleStatus = async (account: SystemUser) => {
    const nextActiveState = !account.is_active;
    const actionLabel = nextActiveState ? "reactivate" : "deactivate";
    const confirmed = window.confirm(
      `${actionLabel.charAt(0).toUpperCase()}${actionLabel.slice(1)} ${account.name || account.email}?`
    );

    if (!confirmed) return;

    setUpdatingStatusUserId(account.user_id);
    const { error } = await supabase.rpc("platform_set_account_status", {
      p_user_id: account.user_id,
      p_is_active: nextActiveState,
      p_reason: nextActiveState ? null : "Deactivated by platform owner",
    });
    setUpdatingStatusUserId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logAudit(
      nextActiveState ? "Reactivated platform account" : "Deactivated platform account",
      `${nextActiveState ? "Reactivated" : "Deactivated"} ${account.email}`
    );
    toast.success(`Account ${nextActiveState ? "reactivated" : "deactivated"}.`);
    void fetchUsers();
  };

  const filteredUsers = users.filter((account) => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return true;

    return [account.name, account.email, account.clinic_name, account.role].some((value) =>
      value?.toLowerCase().includes(needle)
    );
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="flex min-h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
        </div>
      </AppLayout>
    );
  }

  if (!isPlatformOwner) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Platform Accounts</h2>
            <p className="text-sm text-muted-foreground">
              This page is reserved for the first account that claimed creator access.
            </p>
          </div>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Creator Access
              </CardTitle>
              <CardDescription>
                Current account: {user?.email || "Unknown user"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Claim creator access from Settings on the first account, then this page will appear only for that account.
              </p>
              <Button type="button" onClick={() => void claimPlatformOwnerAccess()} disabled={claimingAccess}>
                {claimingAccess ? "Opening..." : "Retry Creator Access"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold">Platform Accounts</h2>
            <p className="text-sm text-muted-foreground">
              Creator-only view of every clinic account using this system.
            </p>
          </div>
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, clinic, or role"
            className="w-full lg:w-[320px]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between">
              <span className="text-2xl font-bold">{users.length}</span>
              <UsersIcon className="h-5 w-5 text-muted-foreground" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Active Accounts</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{users.filter((account) => account.is_active).length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Deactivated</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{users.filter((account) => !account.is_active).length}</span>
            </CardContent>
          </Card>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Lead Inbox
            </CardTitle>
            <CardDescription>
              Homepage leads are visible here only for the creator of the system, not for clinic owners.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {loadingLeads ? (
              <div className="text-sm text-muted-foreground">Loading leads...</div>
            ) : leads.length === 0 ? (
              <div className="rounded-xl border bg-muted/40 p-4 text-sm text-muted-foreground">
                No leads yet. Once someone submits the popup on the homepage, their details will appear here.
              </div>
            ) : (
              <div className="space-y-3">
                {leads.map((lead) => (
                  <div key={lead.id} className="rounded-2xl border bg-background p-4 shadow-sm">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-foreground">{lead.full_name}</p>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                            {lead.status}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-4 w-4" />
                            {lead.email}
                          </span>
                          <span>{lead.clinic_name}</span>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(lead.created_at).toLocaleString([], {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>User Directory</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0">
            {loadingUsers ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No users found for this search.</div>
            ) : (
              <Table className="min-w-[980px]">
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Clinic</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((account) => (
                    <TableRow key={account.user_id}>
                      <TableCell className="font-medium">{account.name || "-"}</TableCell>
                      <TableCell>{account.email || "-"}</TableCell>
                      <TableCell>{account.clinic_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={account.role === "admin" ? "default" : "secondary"}>{account.role}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={account.is_active ? "default" : "destructive"}>
                          {account.is_active ? "Active" : "Deactivated"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(account.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(account)}
                            disabled={updatingStatusUserId === account.user_id}
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {updatingStatusUserId === account.user_id
                              ? "Saving..."
                              : account.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(account)}
                            disabled={deletingUserId === account.user_id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingUserId === account.user_id ? "Deleting..." : "Delete"}
                          </Button>
                        </div>
                      </TableCell>
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

export default UsersPage;
