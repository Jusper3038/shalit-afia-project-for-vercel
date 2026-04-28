import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import type { Enums } from "@/integrations/supabase/types";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

type ProtectedRouteProps = {
  children: React.ReactNode;
  allowedRoles?: Enums<"app_role">[];
  redirectTo?: string;
  requireSensitiveVerification?: boolean;
  requirePlatformOwner?: boolean;
};

const ProtectedRoute = ({
  children,
  allowedRoles,
  redirectTo = "/billing",
  requireSensitiveVerification = false,
  requirePlatformOwner = false,
}: ProtectedRouteProps) => {
  const {
    session,
    loading,
    role,
    isPlatformOwner,
    isPlatformOwnerReady,
    hasOwnerSecurityPin,
    isSensitiveAccessVerified,
    getSensitiveAccessExpiresAt,
    verifySensitiveAccess,
    setOwnerSecurityPin,
    resetOwnerSecurityPin,
  } = useAuth();
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && (!role || !allowedRoles.includes(role as Enums<"app_role">))) {
    return <Navigate to={redirectTo} replace />;
  }

  if (requirePlatformOwner && !isPlatformOwnerReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (requirePlatformOwner && !isPlatformOwner) {
    return <Navigate to={redirectTo} replace />;
  }

  const needsSensitiveVerification =
    requireSensitiveVerification &&
    role === "admin" &&
    !isSensitiveAccessVerified();
  const sensitiveAccessExpiresAt = getSensitiveAccessExpiresAt();

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = hasOwnerSecurityPin
      ? await verifySensitiveAccess(pin)
      : await setOwnerSecurityPin(pin);
    setSubmitting(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(hasOwnerSecurityPin ? "Sensitive access verified." : "Security PIN created and access unlocked.");
    setPin("");
    setConfirmPin("");
  };

  const handleResetPassword = async () => {
    setSendingReset(true);
    const { error } = await resetOwnerSecurityPin();
    setSendingReset(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Security PIN cleared. A reset email has been sent to the clinic owner's email.");
  };

  const pinSetupInvalid = !hasOwnerSecurityPin && (pin.length < 4 || pin !== confirmPin);

  const getPrimaryLabel = () => {
    if (submitting) return hasOwnerSecurityPin ? "Verifying..." : "Saving PIN...";
    return hasOwnerSecurityPin ? "Unlock Access" : "Save PIN";
  };

  if (needsSensitiveVerification) {
    return (
      <Dialog open>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>{hasOwnerSecurityPin ? "Enter Owner Security PIN" : "Create Owner Security PIN"}</DialogTitle>
            <DialogDescription>
              {hasOwnerSecurityPin
                ? "Enter the separate owner Security PIN to open this sensitive area. Access stays verified for 15 minutes."
                : "Create a separate 4 to 6 digit Security PIN for sensitive owner-only areas."}
            </DialogDescription>
            {sensitiveAccessExpiresAt && (
              <p className="text-xs text-muted-foreground">
                Last sensitive access stays verified until {new Date(sensitiveAccessExpiresAt).toLocaleTimeString()}.
              </p>
            )}
          </DialogHeader>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="owner-security-pin">Owner Security PIN</Label>
              <Input
                id="owner-security-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="Enter 4 to 6 digits"
                required
              />
            </div>
            {!hasOwnerSecurityPin && (
              <div className="space-y-2">
                <Label htmlFor="confirm-owner-security-pin">Confirm Security PIN</Label>
                <Input
                  id="confirm-owner-security-pin"
                  type="password"
                  inputMode="numeric"
                  maxLength={6}
                  value={confirmPin}
                  onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="Re-enter Security PIN"
                  required
                />
              </div>
            )}
            <DialogFooter className="gap-2 sm:justify-between">
              {hasOwnerSecurityPin ? (
                <Button type="button" variant="ghost" onClick={handleResetPassword} disabled={sendingReset}>
                  {sendingReset ? "Sending reset..." : "Forgot PIN?"}
                </Button>
              ) : (
                <div className="text-xs text-muted-foreground">Only the clinic owner can create or change this PIN.</div>
              )}
              <Button type="submit" disabled={submitting || pinSetupInvalid}>
                {getPrimaryLabel()}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;
