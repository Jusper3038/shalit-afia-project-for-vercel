import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Inbox, Mail, Power, ShieldCheck, Trash2, Users as UsersIcon } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";
import type { Tables } from "@/integrations/supabase/types";

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
  const { isPlatformOwner, isPlatformOwnerReady, claimPlatformOwnerAccess, user } = useAuth();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [updatingStatusUserId, setUpdatingStatusUserId] = useState<string | null>(null);
  const [claimingAccess, setClaimingAccess] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_platform_accounts");
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setUsers(data ?? []);
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
    if (isPlatformOwnerReady && isPlatformOwner) {
      fetchUsers();
      fetchLeads();
    } else {
      setUsers([]);
      setLeads([]);
    }
  }, [isPlatformOwner, isPlatformOwnerReady]);

  const handleDelete = async (user: SystemUser) => {
    const confirmed = window.confirm(
      `Delete ${user.name || user.email}? This removes the account and all records linked to it.`
    );

    if (!confirmed) return;

    setDeletingUserId(user.user_id);
    const { error } = await supabase.rpc("platform_delete_account", {
      p_user_id: user.user_id,
    });
    setDeletingUserId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logAudit("Deleted platform account", `Deleted ${user.email}`);
    toast.success("User account deleted.");
    fetchUsers();
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
    fetchUsers();
  };

  const handleClaimPlatformOwner = async () => {
    setClaimingAccess(true);
    const { error } = await claimPlatformOwnerAccess();
    setClaimingAccess(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Platform owner access enabled for this account.");
    fetchUsers();
  };

  const filteredUsers = users.filter((user) => {
    const needle = searchTerm.trim().toLowerCase();
    if (!needle) return true;

    return [
      user.name,
      user.email,
      user.clinic_name,
      user.role,
    ].some((value) => value?.toLowerCase().includes(needle));
  });

  if (!isPlatformOwnerReady) {
    return (
      <AppLayout>
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold">Platform Accounts</h2>
            <p className="text-sm text-muted-foreground">
              Checking creator access...
            </p>
          </div>
          <Card className="border-primary/20">
            <CardContent className="flex min-h-[40vh] items-center justify-center p-6">
              <div className="flex items-center gap-3 rounded-full border bg-card px-5 py-3 shadow-sm">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
                <span className="text-sm text-muted-foreground">Opening Platform Accounts...</span>
              </div>
            </CardContent>
          </Card>
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
              This page is reserved for the creator of the system to manage every account globally.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Platform Owner Access
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The first successful claim creates the platform owner account for this system and unlocks the global account management page.
              </p>
              <p className="text-sm text-muted-foreground">
                Current account: <span className="font-medium text-foreground">{user?.email || "Unknown user"}</span>
              </p>
              <Button type="button" onClick={handleClaimPlatformOwner} disabled={claimingAccess}>
                {claimingAccess ? "Claiming..." : "Claim Platform Owner Access"}
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
              Creator-only view of every clinic account using this system. You can deactivate or delete accounts here.
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
          <CardContent className="p-0">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-6 text-center text-muted-foreground">No users found for this search.</div>
            ) : (
              <Table>
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
                  {filteredUsers.map((user) => (
                    <TableRow key={user.user_id}>
                      <TableCell className="font-medium">{user.name || "-"}</TableCell>
                      <TableCell>{user.email || "-"}</TableCell>
                      <TableCell>{user.clinic_name || "-"}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={user.is_active ? "default" : "destructive"}>
                          {user.is_active ? "Active" : "Deactivated"}
                        </Badge>
                      </TableCell>
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleStatus(user)}
                            disabled={updatingStatusUserId === user.user_id}
                          >
                            <Power className="mr-2 h-4 w-4" />
                            {updatingStatusUserId === user.user_id
                              ? "Saving..."
                              : user.is_active ? "Deactivate" : "Reactivate"}
                          </Button>
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDelete(user)}
                            disabled={deletingUserId === user.user_id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingUserId === user.user_id ? "Deleting..." : "Delete"}
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
