import { useEffect, useState } from "react";
import AppLayout from "@/components/AppLayout";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logAudit } from "@/lib/audit";
import { clampPercent } from "@/lib/discounts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Crown, LockKeyhole, ShieldCheck, Tags } from "lucide-react";

const SettingsPage = () => {
  const { user, profile, hasOwnerSecurityPin, isPlatformOwner, claimPlatformOwnerAccess, setOwnerSecurityPin } = useAuth();
  const [canClaimPlatformOwner, setCanClaimPlatformOwner] = useState<boolean | null>(null);
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const [maximumDiscountPercentage, setMaximumDiscountPercentage] = useState(
    String(profile?.minimum_profit_retention_percentage ?? 0)
  );
  const [savingGuardrail, setSavingGuardrail] = useState(false);
  const [claimingPlatformOwner, setClaimingPlatformOwner] = useState(false);

  useEffect(() => {
    setMaximumDiscountPercentage(String(profile?.minimum_profit_retention_percentage ?? 0));
  }, [profile?.minimum_profit_retention_percentage]);

  useEffect(() => {
    const loadCanClaimPlatformOwner = async () => {
      const { data, error } = await supabase.rpc("can_claim_platform_owner");
      if (error) {
        toast.error(error.message);
        setCanClaimPlatformOwner(false);
        return;
      }

      setCanClaimPlatformOwner(Boolean(data));
    };

    void loadCanClaimPlatformOwner();
  }, []);

  const pinMismatch = newPin.length < 4 || newPin !== confirmPin;
  const configuredMaximumDiscountPercentage = clampPercent(
    parseFloat(maximumDiscountPercentage || "0")
  );

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPin(true);
    const { error } = await setOwnerSecurityPin(newPin, hasOwnerSecurityPin ? currentPin : undefined);
    setSavingPin(false);

    if (error) {
      toast.error(error);
      return;
    }

    await logAudit(
      hasOwnerSecurityPin ? "Updated security PIN" : "Created security PIN",
      hasOwnerSecurityPin ? "Updated the owner security PIN from Settings." : "Created the owner security PIN from Settings."
    );
    toast.success(hasOwnerSecurityPin ? "Security PIN updated." : "Security PIN created.");
    setCurrentPin("");
    setNewPin("");
    setConfirmPin("");
  };

  const saveDiscountSettings = async () => {
    if (!user) return;
    setSavingGuardrail(true);

    const { error } = await supabase
      .from("profiles")
      .update({
        minimum_profit_retention_percentage: configuredMaximumDiscountPercentage,
      })
      .eq("user_id", user.id);

    setSavingGuardrail(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    await logAudit(
      "Updated discount guardrail",
      `Maximum discount limit set to ${configuredMaximumDiscountPercentage}% from Settings.`
    );
    toast.success("Global discount guardrail updated.");
  };

  const handleClaimPlatformOwner = async () => {
    setClaimingPlatformOwner(true);
    const { error } = await claimPlatformOwnerAccess();
    setClaimingPlatformOwner(false);

    if (error) {
      toast.error(error);
      return;
    }

    await logAudit("Claimed platform owner access", `Platform owner access claimed by ${user?.email || "unknown user"}.`);
    toast.success("Platform owner access claimed. The separate Platform Accounts page is now unlocked.");
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Settings</h2>
          <p className="text-sm text-muted-foreground">
            Locked admin controls for owner security and the global discount guardrail that applies across all inventory items.
          </p>
        </div>

        <div className="grid gap-6 xl:grid-cols-2">
          {!isPlatformOwner && canClaimPlatformOwner === true && (
            <Card className="border-primary/20 xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Platform Owner Setup
                </CardTitle>
                <CardDescription>
                  Use this once to unlock the separate creator-only page for managing every account on the system.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  This access is one-time only. After the first account claims it, the `Platform Accounts` page belongs to that account alone.
                </p>
                <p className="text-sm text-muted-foreground">
                  The lead inbox lives in `Platform Accounts`, so only the creator sees new homepage inquiries there.
                </p>
                <Button type="button" onClick={handleClaimPlatformOwner} disabled={claimingPlatformOwner}>
                  {claimingPlatformOwner ? "Claiming..." : "Claim Platform Owner Access"}
                </Button>
              </CardContent>
            </Card>
          )}

          {!isPlatformOwner && canClaimPlatformOwner === false && (
            <Card className="border-primary/20 xl:col-span-2">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5" />
                  Creator Access Already Claimed
                </CardTitle>
                <CardDescription>
                  The creator-only account has already been claimed, so this setup panel is no longer available here.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Only the first account that claimed creator access can see `Platform Accounts` and the lead inbox.
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Owner Security PIN
              </CardTitle>
              <CardDescription>
                Change the locked PIN used for sensitive admin actions and protected areas.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSavePin} className="space-y-4">
                {hasOwnerSecurityPin && (
                  <div className="space-y-2">
                    <Label htmlFor="current-owner-pin">Current Security PIN</Label>
                    <Input
                      id="current-owner-pin"
                      type="password"
                      inputMode="numeric"
                      maxLength={6}
                      value={currentPin}
                      onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="Enter current PIN"
                      required
                    />
                  </div>
                )}
                <div className="space-y-2">
                  <Label htmlFor="new-owner-pin">New Security PIN</Label>
                  <Input
                    id="new-owner-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Enter 4 to 6 digits"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirm-owner-pin">Confirm Security PIN</Label>
                  <Input
                    id="confirm-owner-pin"
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="Re-enter PIN"
                    required
                  />
                </div>
                <Button type="submit" disabled={savingPin || pinMismatch || (hasOwnerSecurityPin && currentPin.length < 4)}>
                  {savingPin ? "Saving..." : hasOwnerSecurityPin ? "Update PIN" : "Create PIN"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Tags className="h-5 w-5" />
                Global Discount Guardrail
              </CardTitle>
              <CardDescription>
                This admin-only rule applies to every item in stock by setting the highest discount allowed during billing.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-accent/20 p-4 text-sm text-muted-foreground">
                The system uses exactly the percentage the admin saves here. New or unset guardrails stay at <span className="font-medium text-foreground">0%</span> until the admin chooses a value.
              </div>
              <div className="space-y-2">
                <Label htmlFor="minimum-profit-retention">Maximum Discount Allowed (%)</Label>
                <Input
                  id="minimum-profit-retention"
                  type="number"
                  min="0"
                  max="100"
                  step="1"
                  value={maximumDiscountPercentage}
                  onChange={(e) => setMaximumDiscountPercentage(e.target.value)}
                  className="max-w-xs"
                />
              </div>
              <Button type="button" onClick={saveDiscountSettings} disabled={savingGuardrail}>
                {savingGuardrail ? "Saving..." : "Save Guardrail"}
              </Button>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <LockKeyhole className="h-5 w-5" />
              Access Model
            </CardTitle>
            <CardDescription>
              This Settings area is PIN-locked for the clinic owner.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Only admins can see this page in the navigation.</p>
            <p>The route is protected by the owner Security PIN before it opens.</p>
            <p>The saved discount guardrail is used by billing and enforced across every stock item during sale recording.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SettingsPage;
