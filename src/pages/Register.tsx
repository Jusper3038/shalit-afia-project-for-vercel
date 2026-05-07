import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Heart, Home } from "lucide-react";
import PhoneNumberInput, { COUNTRY_CODES, normalizePhoneNumber } from "@/components/PhoneNumberInput";

type InvitePreview = {
  invite_code: string;
  invited_email: string;
  invited_phone: string;
  clinic_name: string;
  status: string;
};

const splitPhoneNumber = (value: string) => {
  const country = COUNTRY_CODES.find((item) => value.startsWith(item.code)) ?? COUNTRY_CODES[0];
  return {
    countryCode: country.code,
    phoneNumber: value.startsWith(country.code) ? value.slice(country.code.length) : value,
  };
};

const Register = () => {
  const [name, setName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [email, setEmail] = useState("");
  const [countryCode, setCountryCode] = useState("+254");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const inviteCode = searchParams.get("invite")?.trim().toUpperCase() ?? "";
  const [invitePreview, setInvitePreview] = useState<InvitePreview | null>(null);
  const [checkingInvite, setCheckingInvite] = useState(Boolean(inviteCode));

  useEffect(() => {
    const loadInvite = async () => {
      if (!inviteCode) {
        setCheckingInvite(false);
        return;
      }

      setCheckingInvite(true);
      const { data, error } = await supabase.rpc("get_clinic_invite_preview", {
        p_invite_code: inviteCode,
      });
      setCheckingInvite(false);

      if (error) {
        toast.error(error.message);
        return;
      }

      const preview = Array.isArray(data) ? data[0] : null;
      if (!preview) {
        toast.error("This invite link is not valid. Ask the clinic owner for a new link.");
        return;
      }

      setInvitePreview(preview as InvitePreview);
      setEmail(preview.invited_email ?? "");
      if (preview.invited_phone) {
        const nextPhone = splitPhoneNumber(preview.invited_phone);
        setCountryCode(nextPhone.countryCode);
        setPhoneNumber(nextPhone.phoneNumber);
      }
    };

    void loadInvite();
  }, [inviteCode]);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedClinicName = clinicName.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPhone = normalizePhoneNumber(countryCode, phoneNumber);
    const trimmedPassword = password.trim();

    if (!trimmedName || (!inviteCode && !trimmedClinicName) || !normalizedEmail || !normalizedPhone) {
      toast.error("Please fill in all required fields");
      return;
    }

    if (trimmedPassword.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }

    if (inviteCode) {
      if (!invitePreview) {
        toast.error("This invite could not be verified. Ask the clinic owner to copy the invite link again.");
        return;
      }

      if (invitePreview.status !== "pending") {
        toast.error(invitePreview.status === "accepted" ? "This invite has already been accepted. Sign in instead." : "This invite was revoked by the clinic owner.");
        return;
      }

      if (normalizedEmail !== invitePreview.invited_email.toLowerCase()) {
        toast.error(`This invite is for ${invitePreview.invited_email}. Use that email to accept it.`);
        return;
      }
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password: trimmedPassword,
      options: {
        data: { name: trimmedName, clinic_name: trimmedClinicName, invite_code: inviteCode, phone_number: normalizedPhone },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);

    if (error) {
      toast.error(error.message);
    } else if (data.user?.identities?.length === 0) {
      toast.error("An account with this email already exists. Please sign in instead.");
      navigate("/login");
    } else if (data.session) {
      toast.success(inviteCode ? "Invite accepted. You are signed in." : "Account created successfully!");
      navigate("/");
    } else {
      toast.success(inviteCode ? "Invite accepted. Check your email to confirm, then log in." : "Account created! Check your email to confirm, or log in.");
      navigate(`/login?email=${encodeURIComponent(normalizedEmail)}${inviteCode ? "&invite=accepted" : ""}`);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-accent/10 p-4">
      <Button asChild variant="ghost" className="absolute left-4 top-4 gap-2 bg-white/70 backdrop-blur">
        <Link to="/home">
          <Home className="h-4 w-4" />
          Home
        </Link>
      </Button>
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary">
            <Heart className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">{inviteCode ? "Accept Invite" : "Create Account"}</CardTitle>
          <CardDescription>
            {inviteCode
              ? invitePreview?.clinic_name
                ? `Join ${invitePreview.clinic_name} on SHALIT AFIA`
                : "Join your clinic team on SHALIT AFIA"
              : "Register your clinic on SHALIT AFIA"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input id="name" placeholder="Dr. John" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {inviteCode ? (
              <div className="space-y-2 rounded-md border bg-accent/40 px-3 py-2 text-sm">
                <div><span className="font-medium">Invite Code:</span> {inviteCode}</div>
                {checkingInvite ? (
                  <div className="text-muted-foreground">Checking invite...</div>
                ) : invitePreview?.status === "pending" ? (
                  <div className="text-muted-foreground">Create your password here. After that, sign in normally with this email and password.</div>
                ) : invitePreview ? (
                  <div className="text-destructive">{invitePreview.status === "accepted" ? "This invite has already been accepted." : "This invite is no longer active."}</div>
                ) : (
                  <div className="text-destructive">This invite could not be verified.</div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="clinic">Clinic Name</Label>
                <Input id="clinic" placeholder="My Clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="clinic@example.com" value={email} onChange={(e) => setEmail(e.target.value)} readOnly={Boolean(invitePreview?.invited_email)} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Phone Number</Label>
              <PhoneNumberInput
                id="phone"
                countryCode={countryCode}
                phoneNumber={phoneNumber}
                onCountryCodeChange={setCountryCode}
                onPhoneNumberChange={setPhoneNumber}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <PasswordInput id="password" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" className="w-full" disabled={loading || checkingInvite || (Boolean(inviteCode) && invitePreview?.status !== "pending")}>
              {loading ? "Creating account..." : inviteCode ? "Accept Invite" : "Register"}
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary underline">
              Sign In
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Register;
