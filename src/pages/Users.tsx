import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2, Users as UsersIcon } from "lucide-react";
import type { Enums } from "@/integrations/supabase/types";

type SystemUser = {
  clinic_name: string;
  created_at: string;
  email: string;
  name: string;
  profile_id: string;
  role: Enums<"app_role">;
  updated_at: string;
  user_id: string;
};

const UsersPage = () => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_system_users");
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setUsers(data ?? []);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleDelete = async (user: SystemUser) => {
    const confirmed = window.confirm(
      `Delete ${user.name || user.email}? This removes the account and all records linked to it.`
    );

    if (!confirmed) return;

    setDeletingUserId(user.user_id);
    const { error } = await supabase.rpc("admin_delete_user", {
      p_user_id: user.user_id,
    });
    setDeletingUserId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logAudit("Deleted user account", `Deleted ${user.email}`);
    toast.success("User account deleted.");
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

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-2xl font-bold">System Users</h2>
            <p className="text-sm text-muted-foreground">
              Review all registered users in the system and remove accounts when needed.
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
              <CardTitle className="text-sm font-medium">Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{users.filter((user) => user.role === "admin").length}</span>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Staff</CardTitle>
            </CardHeader>
            <CardContent>
              <span className="text-2xl font-bold">{users.filter((user) => user.role === "staff").length}</span>
            </CardContent>
          </Card>
        </div>

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
                      <TableCell>{new Date(user.created_at).toLocaleDateString()}</TableCell>
                      <TableCell className="text-right">
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
