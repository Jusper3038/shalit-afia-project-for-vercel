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
  Settings,
  LogOut,
  Menu,
  X,
  Heart,
  Home,
  Sparkles,
} from "lucide-react";

const ClinicAssistant = lazy(() => import("@/components/ClinicAssistant"));

const navItems = [
  { to: "/home", label: "Home", icon: Home, ownerOnly: false },
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: true },
  { to: "/drugs", label: "Inventory", icon: Pill, ownerOnly: true },
  { to: "/patients", label: "Patients", icon: Users, ownerOnly: false },
  { to: "/billing", label: "Billing", icon: Receipt, ownerOnly: false },
  { to: "/payments", label: "Payments", icon: CreditCard, ownerOnly: true },
  { to: "/users", label: "Platform Accounts", icon: Users, ownerOnly: false, platformOnly: true },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, ownerOnly: true },
  { to: "/settings", label: "Settings", icon: Settings, ownerOnly: true },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, role, isPlatformOwner, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [ownerGreeting, setOwnerGreeting] = useState<string | null>(null);
  const visibleNavItems = navItems.filter((item) => {
    if (item.platformOnly) return isPlatformOwner;
    return !item.ownerOnly || role === "admin";
  });

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

  return (
    <div className="flex min-h-screen overflow-x-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-64 transform flex-col border-r bg-card transition-transform duration-200 lg:relative lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-16 items-center gap-2 border-b px-4">
          <Heart className="h-6 w-6 text-primary" />
          <span className="text-lg font-bold">SHALIT AFIA</span>
          <Button variant="ghost" size="icon" className="ml-auto lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="border-b p-3 lg:hidden">
          <Button variant="outline" className="w-full justify-center gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
        <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
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
        <div className="mt-auto hidden border-t p-3 lg:block">
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
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex min-h-16 items-center gap-2 border-b bg-card px-3 py-3 sm:gap-4 sm:px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="min-w-0 flex-1 truncate text-base font-semibold sm:text-lg">
            {profile?.clinic_name || "SHALIT AFIA"}
          </h1>
          <div className="hidden text-sm text-muted-foreground sm:block">
            {profile?.name || "User"}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
          {ownerGreeting && (
            <div className="mb-6 rounded-2xl border bg-gradient-to-r from-primary/15 via-background to-amber-500/15 p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="rounded-xl bg-primary/15 p-3 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">Clinic Owner Greeting</p>
                  <h2 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl lg:text-3xl">
                    {ownerGreeting}
                  </h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    You are signed in as the clinic owner and your dashboard is ready.
                  </p>
                </div>
                <Button variant="ghost" size="sm" className="self-start" onClick={() => setOwnerGreeting(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
      <Suspense fallback={null}>
        <ClinicAssistant />
      </Suspense>
    </div>
  );
};

export default AppLayout;
