import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Copy, Plus, XCircle } from "lucide-react";
import { APP_PERMISSION_OPTIONS, type AppPermission } from "@/lib/app-permissions";
import PhoneNumberInput, { normalizePhoneNumber } from "@/components/PhoneNumberInput";

type ClinicInvite = {
  id: string;
  owner_user_id: string;
  invited_email: string;
  invited_phone: string;
  invite_code: string;
  allowed_apps: AppPermission[];
  status: "pending" | "accepted" | "revoked";
  accepted_by: string | null;
  accepted_at: string | null;
  created_at: string;
  expires_at: string;
};

const TeamUsersSettings = () => {
  const [invites, setInvites] = useState<ClinicInvite[]>([]);
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+254");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [selectedApps, setSelectedApps] = useState<AppPermission[]>(["billing"]);
  const [savingAccessId, setSavingAccessId] = useState<string | null>(null);

  const activeInviteCount = useMemo(
    () => invites.filter((invite) => invite.status === "pending" || invite.status === "accepted").length,
    [invites]
  );

  const fetchInvites = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_clinic_user_invites");
    setLoading(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setInvites((data ?? []) as ClinicInvite[]);
  };

  useEffect(() => {
    void fetchInvites();
  }, []);

  const toggleSelectedApp = (permission: AppPermission) => {
    setSelectedApps((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission]
    );
  };

  const handleCreateInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    const invitedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneNumber(countryCode, phoneNumber);

    if (!invitedEmail || !normalizedPhone) {
      toast.error("Enter the user's email and phone number first");
      return;
    }

    setCreating(true);
    const { data, error } = await supabase.rpc("create_clinic_user_invite", {
      p_invited_email: invitedEmail,
      p_allowed_apps: selectedApps,
      p_invited_phone: normalizedPhone,
    });
    setCreating(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    const invite = data as ClinicInvite;
    setEmail("");
    setPhoneNumber("");
    setSelectedApps(["billing"]);
    toast.success(`Invite code created: ${invite.invite_code}`);
    void fetchInvites();
  };

  const handleCopyInvite = async (invite: ClinicInvite) => {
    const inviteUrl = `${window.location.origin}/register?invite=${invite.invite_code}`;
    await navigator.clipboard.writeText(inviteUrl);
    toast.success("Invite link copied.");
  };

  const toggleInviteApp = async (invite: ClinicInvite, permission: AppPermission) => {
    if (invite.status === "accepted" && !invite.accepted_by) {
      toast.error("Accepted user account was not found.");
      return;
    }

    const nextApps = invite.allowed_apps.includes(permission)
      ? invite.allowed_apps.filter((item) => item !== permission)
      : [...invite.allowed_apps, permission];

    setInvites((current) =>
      current.map((item) => item.id === invite.id ? { ...item, allowed_apps: nextApps } : item)
    );

    setSavingAccessId(invite.id);
    const rpcName = invite.status === "accepted" ? "update_clinic_user_apps" : "update_clinic_invite_apps";
    const rpcArgs = invite.status === "accepted"
      ? { p_target_user_id: invite.accepted_by, p_allowed_apps: nextApps }
      : { p_invite_id: invite.id, p_allowed_apps: nextApps };

    const { error } = await supabase.rpc(rpcName, rpcArgs);
    setSavingAccessId(null);

    if (error) {
      toast.error(error.message);
      void fetchInvites();
      return;
    }

    toast.success("App access updated.");
  };

  const handleRevoke = async (invite: ClinicInvite) => {
    setRevokingId(invite.id);
    const { error } = await supabase.rpc("revoke_clinic_user_invite", {
      p_invite_id: invite.id,
    });
    setRevokingId(null);

    if (error) {
      toast.error(error.message);
      return;
    }

    toast.success("Invite revoked.");
    void fetchInvites();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>Team Users</CardTitle>
            <CardDescription>Add up to 2 users and choose which apps each user can access.</CardDescription>
          </div>
          <Badge variant={activeInviteCount >= 2 ? "default" : "secondary"}>{activeInviteCount}/2 added</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <form onSubmit={handleCreateInvite} className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:items-end">
          <div className="space-y-2">
            <Label htmlFor="team-email">User Email</Label>
            <Input
              id="team-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="staff@example.com"
              disabled={activeInviteCount >= 2}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="team-phone">Phone Number</Label>
            <PhoneNumberInput
              id="team-phone"
              countryCode={countryCode}
              phoneNumber={phoneNumber}
              onCountryCodeChange={setCountryCode}
              onPhoneNumberChange={setPhoneNumber}
              disabled={activeInviteCount >= 2}
              required
            />
          </div>
          <Button type="submit" disabled={creating || activeInviteCount >= 2}>
            <Plus className="mr-2 h-4 w-4" />
            {creating ? "Creating..." : "Add User"}
          </Button>
          <div className="lg:col-span-3">
            <Label>Allowed Apps</Label>
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {APP_PERMISSION_OPTIONS.map((option) => (
                <label key={option.key} className="flex cursor-pointer items-start gap-3 rounded-md border p-3 transition-colors hover:bg-accent/50">
                  <Checkbox checked={selectedApps.includes(option.key)} onCheckedChange={() => toggleSelectedApp(option.key)} disabled={activeInviteCount >= 2} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 font-medium">
                      <option.icon className="h-4 w-4 text-primary" />
                      {option.label}
                    </span>
                    <span className="mt-1 block text-xs text-muted-foreground">{option.description}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>
        </form>

        <div className="overflow-x-auto rounded-md border">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : invites.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">No users added yet.</div>
          ) : (
            <Table className="min-w-[980px]">
              <TableHeader>
                <TableRow>
                  <TableHead>Email</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Allowed Apps</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invites.map((invite) => (
                  <TableRow key={invite.id}>
                    <TableCell className="font-medium">{invite.invited_email}</TableCell>
                    <TableCell>{invite.invited_phone || "-"}</TableCell>
                    <TableCell>{invite.invite_code}</TableCell>
                    <TableCell>
                      <Badge variant={invite.status === "accepted" ? "default" : invite.status === "revoked" ? "destructive" : "secondary"}>
                        {invite.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="grid min-w-[360px] gap-2 sm:grid-cols-2">
                        {APP_PERMISSION_OPTIONS.map((option) => (
                          <label key={`${invite.id}-${option.key}`} className="flex items-center gap-2 text-sm">
                            <Checkbox
                              checked={invite.allowed_apps.includes(option.key)}
                              disabled={invite.status === "revoked" || savingAccessId === invite.id || (invite.status === "accepted" && !invite.accepted_by)}
                              onCheckedChange={() => void toggleInviteApp(invite, option.key)}
                            />
                            <span className="inline-flex items-center gap-1">
                              <option.icon className="h-3.5 w-3.5 text-muted-foreground" />
                              {option.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{new Date(invite.expires_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button type="button" variant="outline" size="sm" onClick={() => handleCopyInvite(invite)} disabled={invite.status !== "pending"}>
                          <Copy className="mr-2 h-4 w-4" />
                          Copy
                        </Button>
                        <Button type="button" variant="ghost" size="sm" onClick={() => handleRevoke(invite)} disabled={invite.status !== "pending" || revokingId === invite.id}>
                          <XCircle className="mr-2 h-4 w-4" />
                          {revokingId === invite.id ? "Revoking..." : "Revoke"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TeamUsersSettings;
