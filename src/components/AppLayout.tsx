import { Suspense, lazy, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { AppPermission } from "@/lib/app-permissions";
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
  ChevronDown,
} from "lucide-react";

const ClinicAssistant = lazy(() => import("@/components/ClinicAssistant"));

const navItems = [
  { to: "/home", label: "Home", icon: Home, ownerOnly: false },
  { to: "/payments", label: "Payments", icon: CreditCard, ownerOnly: false, app: "payments" as AppPermission },
  { to: "/users", label: "Platform Accounts", icon: Users, ownerOnly: false, platformOnly: true },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, ownerOnly: false, app: "audit_logs" as AppPermission },
  { to: "/settings", label: "Settings", icon: Settings, ownerOnly: false, app: "settings" as AppPermission },
];

const pharmacyNavItems = [
  { to: "/pharmacy/dashboard", label: "Dashboard", icon: LayoutDashboard, ownerOnly: false, app: "dashboard" as AppPermission },
  { to: "/pharmacy/inventory", label: "Inventory", icon: Pill, ownerOnly: false, app: "inventory" as AppPermission },
  { to: "/pharmacy/patients", label: "Patients", icon: Users, ownerOnly: false, app: "patients" as AppPermission },
  { to: "/pharmacy/billing", label: "Billing", icon: Receipt, ownerOnly: false, app: "billing" as AppPermission },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, role, isPlatformOwner, signOut, canAccessApp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [pharmacyExpanded, setPharmacyExpanded] = useState(false);
  const [ownerGreeting, setOwnerGreeting] = useState<string | null>(null);
  const visibleNavItems = navItems.filter((item) => {
    if (item.platformOnly) return isPlatformOwner;
    if (item.app && !canAccessApp(item.app)) return false;
    return !item.ownerOnly || role === "admin";
  });
  const visiblePharmacyNavItems = pharmacyNavItems.filter((item) => {
    if (item.app && !canAccessApp(item.app)) return false;
    return !item.ownerOnly || role === "admin";
  });
  const isPharmacyRoute = location.pathname.startsWith("/pharmacy");
  const selectedPharmacyModule = visiblePharmacyNavItems.some((item) => item.to === location.pathname);

  const handlePharmacyClick = () => {
    setPharmacyExpanded((expanded) => !expanded);

    if (!isPharmacyRoute) {
      navigate("/pharmacy");
    }
  };

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
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
          {visiblePharmacyNavItems.length > 0 && (
            <div className="space-y-1">
              <button
                type="button"
                onClick={handlePharmacyClick}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors",
                  isPharmacyRoute
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                )}
                aria-expanded={pharmacyExpanded}
              >
                <Pill className="h-4 w-4" />
                <span className="flex-1">Pharmacy</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform",
                    pharmacyExpanded && "rotate-180",
                  )}
                />
              </button>
              {pharmacyExpanded && (
                <div className="ml-5 space-y-1 border-l pl-2">
                  {visiblePharmacyNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                        )
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
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
          {selectedPharmacyModule && visiblePharmacyNavItems.length > 0 && (
            <div className="mb-6 space-y-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Module</p>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Pharmacy</h2>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {visiblePharmacyNavItems.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={({ isActive }) =>
                      cn(
                        "inline-flex min-h-10 shrink-0 items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
                        isActive
                          ? "border-primary bg-primary text-primary-foreground"
                          : "bg-card text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                      )
                    }
                  >
                    <item.icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                ))}
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
