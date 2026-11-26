import { Suspense, lazy, useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { AppPermission } from "@/lib/app-permissions";
import type { ReleasedAppKey } from "@/lib/app-releases";
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
  Home,
  Sparkles,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";

const ClinicAssistant = lazy(() => import("@/components/ClinicAssistant"));

const navItems = [
  { to: "/home", label: "Home", icon: Home, ownerOnly: false },
  { to: "/ecommerce", label: "Ecommerce", icon: ShoppingBag, ownerOnly: true, release: "ecommerce" as ReleasedAppKey },
  { to: "/payments", label: "Payments", icon: CreditCard, ownerOnly: false, app: "payments" as AppPermission, release: "payments" as ReleasedAppKey },
  { to: "/users", label: "System Accounts", icon: Users, ownerOnly: false, platformOnly: true },
  { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, ownerOnly: false, app: "audit_logs" as AppPermission, release: "audit_logs" as ReleasedAppKey },
  { to: "/settings", label: "Settings", icon: Settings, ownerOnly: false, app: "settings" as AppPermission, release: "settings" as ReleasedAppKey },
];

const pharmacyNavItems = [
  { to: "/pharmacy/dashboard", label: "Reports", icon: LayoutDashboard, ownerOnly: false, app: "dashboard" as AppPermission },
  { to: "/pharmacy/inventory", label: "Inventory", icon: Pill, ownerOnly: false, app: "inventory" as AppPermission },
  { to: "/pharmacy/patients", label: "Patients", icon: Users, ownerOnly: false, app: "patients" as AppPermission },
  { to: "/pharmacy/billing", label: "Billing", icon: Receipt, ownerOnly: false, app: "billing" as AppPermission },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { profile, role, isPlatformOwner, signOut, canAccessApp, isAppReleased } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
  const [pharmacyExpanded, setPharmacyExpanded] = useState(false);
  const [ownerGreeting, setOwnerGreeting] = useState<string | null>(null);
  const visibleNavItems = navItems.filter((item) => {
    if (item.platformOnly) return isPlatformOwner;
    if (item.release && !isAppReleased(item.release)) return false;
    if (item.app && !canAccessApp(item.app)) return false;
    return !item.ownerOnly || role === "admin";
  });
  const visiblePharmacyNavItems = pharmacyNavItems.filter((item) => {
    if (!isAppReleased("pharmacy")) return false;
    if (item.app && !canAccessApp(item.app)) return false;
    return !item.ownerOnly || role === "admin";
  });
  const isPharmacyRoute = location.pathname.startsWith("/pharmacy");
  const selectedPharmacyModule = visiblePharmacyNavItems.some((item) => item.to === location.pathname);
  const displayRole = isPlatformOwner ? "System Owner" : role === "admin" ? "Clinic Owner" : "Team Member";

  const handlePharmacyClick = () => {
    setPharmacyExpanded((expanded) => !expanded);

    if (!isPharmacyRoute) {
      navigate("/pharmacy");
    }
  };

  useEffect(() => {
    if (isPharmacyRoute) {
      setPharmacyExpanded(true);
    }
  }, [isPharmacyRoute]);

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
    <div className="flex min-h-screen overflow-x-hidden bg-slate-50 text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-72 transform flex-col border-r border-white/10 bg-sidebar text-sidebar-foreground shadow-xl transition-[width,transform] duration-300 lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:shadow-[12px_0_28px_rgba(15,23,42,0.12)] ${desktopSidebarOpen ? "lg:w-72" : "lg:w-16"} ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className={cn("flex min-h-20 items-center gap-3 border-b border-white/10 bg-white/[0.03] px-5", !desktopSidebarOpen && "lg:justify-center lg:px-2")}>
          {desktopSidebarOpen && <Pill className="hidden h-6 w-6 shrink-0 text-cyan-300 lg:block" />}
          <div className={cn("min-w-0", !desktopSidebarOpen && "lg:hidden")}>
            <span className="block truncate text-lg font-bold tracking-wide text-white">SHALIT AFIA</span>
            <span className="block truncate text-sm text-sidebar-foreground/70">Clinic operations</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className={cn("ml-auto hidden rounded-md border border-white/10 bg-white/[0.04] text-sidebar-foreground hover:bg-white/10 hover:text-white lg:inline-flex", !desktopSidebarOpen && "lg:ml-0")}
            onClick={() => setDesktopSidebarOpen((open) => !open)}
            aria-label={desktopSidebarOpen ? "Collapse sidebar to icons" : "Expand sidebar"}
            title={desktopSidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            {desktopSidebarOpen ? <PanelLeftClose className="h-5 w-5" /> : <PanelLeftOpen className="h-5 w-5" />}
          </Button>
          <Button variant="ghost" size="icon" className="ml-auto text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground lg:hidden" onClick={() => setSidebarOpen(false)} aria-label="Close menu">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="border-b border-sidebar-border p-3 lg:hidden">
          <Button variant="secondary" className="w-full justify-center gap-2" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
        <nav className={cn("flex flex-1 flex-col gap-1 overflow-y-auto py-5 [scrollbar-color:rgba(255,255,255,0.36)_transparent] [scrollbar-width:thin]", desktopSidebarOpen ? "px-4" : "px-2 lg:px-2")}>
          <p className={cn("px-3 pb-3 pt-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/45", !desktopSidebarOpen && "lg:hidden")}>Workspace</p>
          {visibleNavItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                cn(
                  "group flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-all",
                  !desktopSidebarOpen && "lg:justify-center lg:px-0",
                  isActive
                    ? "bg-white text-sidebar shadow-sm shadow-black/10"
                    : "text-sidebar-foreground/72 hover:bg-white/[0.08] hover:text-white",
                )
              }
              title={item.label}
            >
              <item.icon className="h-4 w-4 shrink-0 transition-transform group-hover:scale-105" />
              <span className={!desktopSidebarOpen ? "lg:hidden" : undefined}>{item.label}</span>
            </NavLink>
          ))}
          {visiblePharmacyNavItems.length > 0 && (
            <div className="space-y-1 pt-5">
              <p className={cn("px-3 pb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-sidebar-foreground/45", !desktopSidebarOpen && "lg:hidden")}>Care Desk</p>
              <button
                type="button"
                onClick={handlePharmacyClick}
                className={cn(
                  "relative flex min-h-11 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm font-semibold transition-all",
                  !desktopSidebarOpen && "lg:justify-center lg:px-0",
                  isPharmacyRoute
                    ? "bg-white/[0.12] text-white"
                    : "text-sidebar-foreground/72 hover:bg-white/[0.08] hover:text-white",
                )}
                aria-expanded={pharmacyExpanded}
                aria-label="Pharmacy menu, opens a dropdown of pharmacy pages"
                title={desktopSidebarOpen ? "Pharmacy pages" : "Pharmacy menu — opens dropdown"}
              >
                <Pill className="h-4 w-4" />
                <span className={cn("flex-1", !desktopSidebarOpen && "lg:hidden")}>Pharmacy</span>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 shrink-0 transition-transform",
                    !desktopSidebarOpen && "absolute bottom-1 right-1 h-3 w-3 text-cyan-300",
                    pharmacyExpanded && "rotate-180",
                  )}
                />
              </button>
              {pharmacyExpanded && (
                <div className="ml-5 space-y-1 border-l border-white/10 pl-2">
                  {visiblePharmacyNavItems.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      onClick={() => setSidebarOpen(false)}
                      className={({ isActive }) =>
                        cn(
                          "flex min-h-10 items-center gap-3 rounded-md px-3 py-2 text-sm font-semibold transition-all",
                          !desktopSidebarOpen && "lg:justify-center lg:px-0",
                          isActive
                            ? "bg-white text-sidebar shadow-sm shadow-black/10"
                            : "text-sidebar-foreground/65 hover:bg-white/[0.08] hover:text-white",
                        )
                      }
                      title={item.label}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className={!desktopSidebarOpen ? "lg:hidden" : undefined}>{item.label}</span>
                    </NavLink>
                  ))}
                </div>
              )}
            </div>
          )}
        </nav>
        <div className="mt-auto hidden border-t border-white/10 bg-white/[0.025] p-4 lg:block">
          <div className="mb-3 rounded-md border border-white/10 bg-white/[0.06] p-4 shadow-inner shadow-white/5">
            <div className="truncate text-sm font-semibold text-white">{profile?.clinic_name || "My Clinic"}</div>
            <div className="mt-1 truncate text-xs text-sidebar-foreground/65">{profile?.name || "User"}</div>
          </div>
          <Button variant="ghost" className="w-full justify-start gap-3 rounded-md text-sidebar-foreground hover:bg-white/[0.08] hover:text-white" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            Sign Out
          </Button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b bg-background/95 px-3 py-3 backdrop-blur sm:gap-4 sm:px-4 lg:px-6">
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-semibold sm:text-lg">
              {profile?.clinic_name || "SHALIT AFIA"}
            </h1>
            <p className="hidden truncate text-xs text-muted-foreground sm:block">
              Signed in as {profile?.name || "User"}
            </p>
          </div>
          <Badge variant="secondary" className="hidden items-center gap-1.5 sm:inline-flex">
            <ShieldCheck className="h-3.5 w-3.5" />
            {displayRole}
          </Badge>
          <div className="hidden h-9 w-9 items-center justify-center rounded-md bg-primary text-sm font-semibold text-primary-foreground sm:flex">
            {(profile?.name || "U").slice(0, 1).toUpperCase()}
          </div>
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-4 lg:p-6">
          {ownerGreeting && (
            <div className="mb-6 rounded-lg border bg-card p-4 shadow-sm sm:p-5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="rounded-md bg-primary/10 p-3 text-primary">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Clinic Owner Greeting</p>
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
            <div className="mb-6 space-y-3 border-b pb-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Module</p>
                  <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Pharmacy</h2>
                </div>
                <p className="text-sm text-muted-foreground">Inventory, patients, reports, and billing in one workspace.</p>
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
                          : "bg-background text-muted-foreground hover:bg-muted hover:text-foreground",
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
