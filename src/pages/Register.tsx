import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Heart, Home } from "lucide-react";
import PhoneNumberInput, { normalizePhoneNumber } from "@/components/PhoneNumberInput";

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
      toast.success("Account created successfully!");
      navigate("/");
    } else {
      toast.success("Account created! Check your email to confirm, or log in.");
      navigate("/login");
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
          <CardTitle className="text-2xl font-bold">Create Account</CardTitle>
          <CardDescription>
            {inviteCode ? "Join your clinic team on SHALIT AFIA" : "Register your clinic on SHALIT AFIA"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input id="name" placeholder="Dr. John" value={name} onChange={(e) => setName(e.target.value)} required />
            </div>
            {inviteCode ? (
              <div className="rounded-md border bg-accent/40 px-3 py-2 text-sm">
                <span className="font-medium">Invite Code:</span> {inviteCode}
              </div>
            ) : (
              <div className="space-y-2">
                <Label htmlFor="clinic">Clinic Name</Label>
                <Input id="clinic" placeholder="My Clinic" value={clinicName} onChange={(e) => setClinicName(e.target.value)} required />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="clinic@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
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
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Creating account..." : "Register"}
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
