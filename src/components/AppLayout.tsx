import { Suspense, lazy, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  LayoutDashboard,
  Pill,
  Users,
  Receipt,
  ScrollText,
  CreditCard,
  Users,
  LogOut,
  Menu,
  X,
  Heart,
  Sparkles,
  ShieldCheck,
} from "lucide-react";

const ClinicAssistant = lazy(() => import("@/components/ClinicAssistant"));

const navItems = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
  { to: "/drugs", label: "Inventory", icon: Pill, ownerOnly: true },
  { to: "/patients", label: "Patients", icon: Users, ownerOnly: false },
  { to: "/billing", label: "Billing", icon: Receipt, ownerOnly: false },
  { to: "/payments", label: "Payments", icon: CreditCard, ownerOnly: true },
  { to: "/users", label: "Users", icon: Users, ownerOnly: true },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, ownerOnly: true },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, role, signOut, setOwnerSecurityPin, hasOwnerSecurityPin } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ownerGreeting, setOwnerGreeting] = useState<string | null>(null);
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [currentPin, setCurrentPin] = useState("");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [savingPin, setSavingPin] = useState(false);
  const visibleNavItems = navItems.filter((item) => !item.ownerOnly || role === "admin");

  useEffect(() => {
    const shouldShowGreeting = sessionStorage.getItem("show_owner_greeting") === "true";

    if (!shouldShowGreeting || !profile) return;

    if (role === "admin") {
      const ownerName = profile.name?.trim() || "Clinic Owner";
      const clinicName = profile.clinic_name?.trim() || "your clinic";
      setOwnerGreeting(`Welcome back, ${ownerName}. ${clinicName} is ready for you today.`);
    }

    sessionStorage.removeItem("show_owner_greeting");
  }, [profile, role]);

  useEffect(() => {
    if (!ownerGreeting) return;

    const timeoutId = window.setTimeout(() => {
      setOwnerGreeting(null);
    }, 5000);

    return () => window.clearTimeout(timeoutId);
  }, [ownerGreeting]);

  const pinMismatch = pin.length < 4 || pin !== confirmPin;

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingPin(true);
    const { error } = await setOwnerSecurityPin(pin, hasOwnerSecurityPin ? currentPin : undefined);
    setSavingPin(false);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(hasOwnerSecurityPin ? "Security PIN updated." : "Security PIN created.");
    setCurrentPin("");
    setPin("");
    setConfirmPin("");
    setPinDialogOpen(false);
  };

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 transform bg-card border-r transition-transform duration-200 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Heart className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">SHALIT AFIA</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {visibleNavItems.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-0 left-0 right-0 border-t p-3">
          <div className="mb-2 px-3 text-xs text-muted-foreground truncate">
            {profile?.clinic_name || "My Clinic"}
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-16 items-center gap-4 border-b bg-card px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">
            {profile?.clinic_name || "SHALIT AFIA"}
          </h1>
          {role === "admin" && (
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setPinDialogOpen(true)}>
              <ShieldCheck className="h-4 w-4" />
              {hasOwnerSecurityPin ? "Change Security PIN" : "Set Security PIN"}
            </Button>
          )}
          <div className="ml-auto text-sm text-muted-foreground">
            {profile?.name || "User"}
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-6">
          {ownerGreeting && (
            <div className="mb-6 rounded-2xl border bg-gradient-to-r from-primary/15 via-background to-amber-500/15 p-5 shadow-sm">
              <div className="flex items-start gap-4">
                <div className="rounded-xl bg-primary/15 p-3 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Clinic Owner Greeting</p>
                  <h2 className="mt-1 text-2xl font-bold tracking-tight lg:text-3xl">
                    {ownerGreeting}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You are signed in as the clinic owner and your dashboard is ready.
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setOwnerGreeting(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{hasOwnerSecurityPin ? "Change Owner Security PIN" : "Create Owner Security PIN"}</DialogTitle>
            <DialogDescription>
              Use a separate 4 to 6 digit PIN for sensitive owner-only areas like Dashboard, Inventory, Payments, and Audit Logs.
            </DialogDescription>
          </DialogHeader>
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
                  placeholder="Enter current Security PIN"
                  required
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="new-owner-pin">Security PIN</Label>
              <Input
                id="new-owner-pin"
                type="password"
                inputMode="numeric"
                maxLength={6}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))}
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
                placeholder="Re-enter Security PIN"
                required
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={savingPin || pinMismatch || (hasOwnerSecurityPin && currentPin.length < 4)}>
                {savingPin ? "Saving..." : hasOwnerSecurityPin ? "Update PIN" : "Create PIN"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Suspense fallback={null}>
        <ClinicAssistant />
      </Suspense>
    </div>
  );
};

export default AppLayout;
