import { Link } from "react-router-dom";
import { Suspense, lazy, useEffect, useState } from "react";
import {
  ArrowRight,
  CreditCard,
  HeartPulse,
  Pill,
  ScrollText,
  Settings,
  ShoppingBag,
  Store,
  Users,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import PhoneNumberInput, { normalizePhoneNumber } from "@/components/PhoneNumberInput";
import type { AppPermission } from "@/lib/app-permissions";
import type { ReleasedAppKey } from "@/lib/app-releases";

const ClinicAssistant = lazy(() => import("@/components/ClinicAssistant"));

const featuredNews = [
  "Meet the clinic that stopped chasing records and started focusing on people.",
  "A wristband, a waiting room, and the moment the day finally felt predictable.",
  "How one director brought financial clarity to every treatment path.",
];

const capabilityCards = [
  {
    title: "Patient Flow",
    detail: "Turn every arrival, consultation, and follow-up into a clear story that the whole team can trust.",
    cta: "See the flow",
  },
  {
    title: "Inventory Intelligence",
    detail: "Know what is available before the next appointment, so clinical teams can focus on care instead of stock checks.",
    cta: "See the flow",
  },
  {
    title: "Owner Controls",
    detail: "Keep important approvals secure without interrupting the rhythm of a busy day.",
    cta: "See the flow",
  },
];

const latestNews = [
  {
    date: "2026-04-22",
    title: "From crowded reception to calm routines in one month",
    detail: "A story about a clinic that reclaimed time by aligning patient intake, billing, and team handoffs.",
  },
  {
    date: "2026-03-14",
    title: "Why transparent billing changed how patients feel",
    detail: "Three small changes that made cost conversations easier and staff confidence higher.",
  },
  {
    date: "2026-02-06",
    title: "Secure decisions that keep care moving forward",
    detail: "How clinics maintain trust with staff and owners while preserving fast, accurate workflows.",
  },
];

const trustMetrics = [
  { value: "500+", label: "clinics onboarded" },
  { value: "99.9%", label: "guaranteed uptime" },
  { value: "24/7", label: "clinic support" },
];

const testimonials = [
  {
    quote: "SHALIT AFIA gave our front desk the confidence to manage patients without delays. The whole team feels aligned now.",
    name: "Dr. Laila Mwangi",
    role: "Clinic Director, Mombasa Care",
  },
  {
    quote: "Inventory is finally under control and approvals move faster. This solution saved us hours every day.",
    name: "James Otieno",
    role: "Pharmacy Manager, Nairobi Health",
  },
  {
    quote: "The onboarding support was seamless, and our team adopted the workflow quickly.",
    name: "Amina Yusuf",
    role: "Practice Manager, Kisumu Wellness",
  },
];

const faqItems = [
  {
    id: "faq-implementation",
    question: "How long does it take to implement SHALIT AFIA?",
    answer: "Most clinics are up and running within 2-3 weeks. Our implementation team handles data migration, staff training, and system customization. The timeline depends on your clinic's size and complexity, but we prioritize getting you operational with minimal disruption to patient care.",
  },
  {
    id: "faq-security",
    question: "How secure is my clinic and patient data?",
    answer: "Security is our top priority. SHALIT AFIA uses enterprise-grade encryption (AES-256), is HIPAA compliant, and undergoes regular security audits. All patient data is backed up in real-time, and we maintain 99.99% uptime with redundant servers across multiple data centers.",
  },
  {
    id: "faq-integration",
    question: "Can SHALIT AFIA integrate with our existing systems?",
    answer: "Yes. We support integration with most major EMR systems, lab equipment, pharmacy software, and payment processors. If you're using a specific system, contact our integration team—we likely support it or can build a custom connector.",
  },
  {
    id: "faq-support",
    question: "What kind of support do you provide?",
    answer: "Every clinic gets dedicated support: 24/7 technical helpline, email support, monthly check-ins with your success manager, and a comprehensive knowledge base. Premium customers also get priority support and quarterly training sessions.",
  },
  {
    id: "faq-pricing",
    question: "How is SHALIT AFIA priced?",
    answer: "We offer transparent, per-user pricing with no hidden fees. Pricing starts at an affordable rate for small clinics and scales with your team size. All plans include core features—nothing is locked behind expensive upgrades. Request a custom quote for your clinic's needs.",
  },
  {
    id: "faq-customize",
    question: "Can we customize SHALIT AFIA for our clinic's workflows?",
    answer: "Absolutely. The system is highly configurable for different clinic types, specialties, and workflows. You can customize templates, approval processes, reports, and user roles. Our team helps you set this up during implementation.",
  },
  {
    id: "faq-training",
    question: "Is training provided for our team?",
    answer: "Yes, comprehensive training is included. We provide role-based training for doctors, nurses, administrators, and staff. Training includes live sessions, video tutorials, quick-start guides, and ongoing support to ensure your team feels confident using the system.",
  },
  {
    id: "faq-data-backup",
    question: "What happens to our data if something goes wrong?",
    answer: "Your data is automatically backed up every 4 hours with full redundancy. If any issue occurs, we can restore data to any point in time. You also have the option to download your complete data anytime—you're never locked in.",
  },
];

type IndexProps = {
  keepLandingVisible?: boolean;
};

type LauncherApp = {
  title: string;
  description: string;
  to: string;
  icon: LucideIcon;
  color: string;
  permission?: AppPermission | AppPermission[];
  releaseKey?: ReleasedAppKey;
  adminOnly?: boolean;
  platformOnly?: boolean;
};

const launcherApps: LauncherApp[] = [
  {
    title: "Pharmacy",
    description: "Reports, inventory, patients, and billing",
    to: "/pharmacy",
    icon: Pill,
    color: "bg-sky-500",
    permission: ["dashboard", "inventory", "patients", "billing"],
    releaseKey: "pharmacy",
  },
  {
    title: "Payments",
    description: "M-Pesa requests and payment history",
    to: "/payments",
    icon: CreditCard,
    color: "bg-teal-500",
    permission: "payments",
    releaseKey: "payments",
  },
  {
    title: "Ecommerce",
    description: "Manage your online clinic shop",
    to: "/ecommerce",
    icon: ShoppingBag,
    color: "bg-rose-500",
    adminOnly: true,
    releaseKey: "ecommerce",
  },
  {
    title: "Storefront",
    description: "Open the customer-facing shop",
    to: "/shop",
    icon: Store,
    color: "bg-indigo-500",
    releaseKey: "storefront",
  },
  {
    title: "Audit Logs",
    description: "Review sensitive clinic activity",
    to: "/audit-logs",
    icon: ScrollText,
    color: "bg-orange-500",
    permission: "audit_logs",
    releaseKey: "audit_logs",
  },
  {
    title: "Settings",
    description: "Clinic profile, team, and controls",
    to: "/settings",
    icon: Settings,
    color: "bg-slate-600",
    permission: "settings",
    releaseKey: "settings",
  },
  {
    title: "Platform Accounts",
    description: "Manage owner-level accounts",
    to: "/users",
    icon: Users,
    color: "bg-cyan-600",
    platformOnly: true,
  },
];

const ModuleLauncher = () => {
  const { profile, role, canAccessApp, isPlatformOwner, isAppReleased } = useAuth();
  const visibleApps = launcherApps.filter((app) => {
    if (app.platformOnly) return isPlatformOwner;
    if (app.releaseKey && !isAppReleased(app.releaseKey)) return false;
    if (app.adminOnly) return role === "admin";
    if (Array.isArray(app.permission)) return app.permission.some((permission) => canAccessApp(permission));
    if (app.permission) return canAccessApp(app.permission);
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-foreground">
      <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="border-b pb-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Applications</p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {profile?.clinic_name || "SHALIT AFIA"}
            </h2>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Choose a workspace to open. Each app shows only when your account has access.
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-5">
          {visibleApps.map((app) => (
            <Link key={app.title} to={app.to} className="group block">
              <Card className="flex min-h-28 flex-col justify-between rounded-md border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md">
                <div className="flex items-start justify-between gap-3">
                  <div className={`flex h-9 w-9 items-center justify-center rounded-md text-white ${app.color}`}>
                    <app.icon className="h-[18px] w-[18px]" />
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:translate-x-0.5 group-hover:opacity-100" />
                </div>
                <div className="mt-4">
                  <h3 className="text-sm font-semibold tracking-tight">{app.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{app.description}</p>
                </div>
              </Card>
            </Link>
          ))}
        </div>

        {visibleApps.length === 0 && (
          <div className="rounded-lg border border-dashed bg-card p-8 text-center">
            <h3 className="text-base font-semibold">No apps assigned yet</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Ask the clinic owner to assign app permissions to this account.
            </p>
          </div>
        )}
      </main>
      <Suspense fallback={null}>
        <ClinicAssistant />
      </Suspense>
    </div>
  );
};

const Index = (_props: IndexProps) => {
  const { session, loading } = useAuth();
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
  const [leadCountryCode, setLeadCountryCode] = useState("+254");
  const [leadPhone, setLeadPhone] = useState("");
  const [leadClinic, setLeadClinic] = useState("");

  useEffect(() => {
    if (session) return;

    const seen = window.localStorage.getItem("shalit-afia-lead-popup-seen");
    if (seen) return;

    const timer = window.setTimeout(() => {
      setLeadOpen(true);
      window.localStorage.setItem("shalit-afia-lead-popup-seen", "1");
    }, 4500);

    return () => window.clearTimeout(timer);
  }, [session]);

  const handleLeadSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const normalizedPhone = normalizePhoneNumber(leadCountryCode, leadPhone);
    if (!leadName.trim() || !leadEmail.trim() || !leadClinic.trim() || !normalizedPhone) {
      toast.error("Please fill in your name, email, phone number, and clinic.");
      return;
    }

    const submitLead = async () => {
      const { error } = await supabase.from("leads").insert({
        full_name: leadName.trim(),
        email: leadEmail.trim().toLowerCase(),
        phone_number: normalizedPhone,
        clinic_name: leadClinic.trim(),
        page_path: window.location.pathname,
        source: "homepage_popup",
      });

      if (error) {
        toast.error(error.message);
        return;
      }

      toast.success("Thanks. We'll reach out soon.");
      setLeadOpen(false);
      setLeadName("");
      setLeadEmail("");
      setLeadPhone("");
      setLeadClinic("");
    };

    void submitLead();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-navy text-white">
        <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-5 py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span className="text-sm">Loading SHALIT AFIA...</span>
        </div>
      </div>
    );
  }

  if (session) {
    return <ModuleLauncher />;
  }

  return (
    <div className="min-h-screen bg-navy [font-family:'Manrope',ui-sans-serif,system-ui]">
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-blue-950 to-slate-900" />
        <div className="absolute top-0 right-0 -translate-y-1/2 translate-x-1/3 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
        
        <header className="relative z-20">
          <div className="mx-auto flex w-full max-w-[1880px] items-center justify-between px-4 py-6 sm:px-8 lg:px-16">
            <Link to="/" className="flex items-center gap-2 group">
              <HeartPulse className="h-6 w-6 text-cyan-400 group-hover:text-cyan-300 transition" />
              <p className="text-xl font-bold tracking-tight text-white sm:text-2xl">SHALIT AFIA</p>
            </Link>

            <nav className="hidden lg:flex items-center bg-white/[0.05] backdrop-blur-md rounded-full px-8 py-3 border border-white/10">
              <a href="#platform" className="text-white/70 transition hover:text-cyan-400 px-4 py-2 text-sm font-medium">Platform</a>
              <a href="#services" className="text-white/70 transition hover:text-cyan-400 px-4 py-2 text-sm font-medium">Services</a>
              <a href="#news" className="text-white/70 transition hover:text-cyan-400 px-4 py-2 text-sm font-medium">News</a>
              <a href="#faq" className="text-white/70 transition hover:text-cyan-400 px-4 py-2 text-sm font-medium">FAQ</a>
              <a href="#contact" className="text-white/70 transition hover:text-cyan-400 px-4 py-2 text-sm font-medium">Contact</a>
            </nav>

            <div className="flex items-center gap-2">
              <Button asChild variant="ghost" className="hidden text-white/70 hover:text-white hover:bg-white/5 sm:inline-flex">
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild className="rounded-full bg-cyan-500/20 px-5 text-cyan-300 hover:bg-cyan-500/30 border border-cyan-500/30 hover:border-cyan-500/50 transition">
                <Link to="/register">Get started</Link>
              </Button>
            </div>
          </div>
        </header>

        <div className="relative z-10 mx-auto grid min-h-[70vh] w-full max-w-[1880px] items-center gap-8 px-4 pb-14 pt-6 sm:px-8 lg:grid-cols-[minmax(0,0.88fr)_minmax(520px,0.82fr)] lg:px-16 lg:pb-20 lg:pt-8">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">Clinic Operating System</p>
            <h1 className="mt-4 text-4xl leading-tight tracking-tight text-white sm:text-6xl lg:text-7xl font-bold">
              Every patient journey deserves a clearer story.
            </h1>
            <p className="mt-6 text-lg text-white/70 max-w-lg leading-relaxed">
              You already know the moments that matter: the first welcome, the next follow-up, the reassurance that everything is moving as it should. SHALIT AFIA turns those moments into one smooth, dependable flow.
            </p>
            <p className="mt-4 text-base text-cyan-300 max-w-lg">
              See how your clinic improves in 30 days with smarter workflows, clearer patient journeys, and faster billing.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="rounded-full bg-cyan-500 px-8 text-slate-950 hover:bg-cyan-400 font-semibold transition">
                <Link to="/register">Start your clinic-ready trial</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/5">
                <Link to="#platform">Watch a 60-second demo</Link>
              </Button>
            </div>
          </div>

          <div className="relative mx-auto flex min-h-[300px] w-full max-w-[520px] items-center justify-center self-center overflow-visible sm:min-h-[420px] sm:max-w-[640px] lg:min-h-[560px] lg:max-w-[760px] lg:pr-20 xl:pr-28">
            <div className="absolute left-1/2 top-1/2 h-56 w-[92%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-300/20 blur-3xl sm:h-72 lg:w-[82%]" />
            <div className="relative z-10 w-full overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.03] shadow-2xl shadow-cyan-950/30 lg:overflow-visible lg:rounded-none lg:border-0 lg:bg-transparent lg:shadow-none">
              <img
                src="/images/clinician-tablet-hero.png"
                alt="Black female clinician using SHALIT AFIA to coordinate clinic care"
                className="h-[300px] w-full object-cover object-[52%_30%] sm:h-[420px] lg:h-[560px] lg:scale-110 lg:object-[50%_42%] lg:[mask-image:radial-gradient(ellipse_at_56%_48%,black_0%,black_58%,transparent_82%)] lg:[-webkit-mask-image:radial-gradient(ellipse_at_56%_48%,black_0%,black_58%,transparent_82%)]"
                loading="eager"
                decoding="async"
                onError={(event) => {
                  event.currentTarget.src =
                    "https://images.pexels.com/photos/19963169/pexels-photo-19963169.jpeg?auto=compress&cs=tinysrgb&w=1200";
                }}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-slate-950/10 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-10 lg:grid-cols-[1.3fr_0.7fr] lg:items-center">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-cyan-400">Trusted by clinics</p>
              <h2 className="text-4xl font-bold tracking-tight text-white sm:text-5xl">
                Clinics choose SHALIT AFIA because it makes their day easier.
              </h2>
              <p className="max-w-2xl text-lg text-white/70">
                Clear patient journeys, faster approvals, and reliable support help clinics run smoothly while staff stay focused on care.
              </p>

              <div className="grid gap-4 sm:grid-cols-3">
                {trustMetrics.map((metric) => (
                  <div key={metric.label} className="rounded-3xl border border-white/10 bg-slate-900/80 px-6 py-7 text-center">
                    <p className="text-4xl font-semibold text-white">{metric.value}</p>
                    <p className="mt-3 text-sm uppercase tracking-[0.24em] text-white/60">{metric.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              {testimonials.map((item) => (
                <article key={item.name} className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-xl shadow-slate-950/20">
                  <p className="text-lg leading-8 text-white/80">“{item.quote}”</p>
                  <div className="mt-6">
                    <p className="font-semibold text-white">{item.name}</p>
                    <p className="text-sm text-white/60">{item.role}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      <main className="text-white">
        <section className="border-b border-white/10 bg-slate-800 py-12">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-slate-700 to-slate-800">
              <div className="grid gap-0 md:grid-cols-3">
                {featuredNews.map((item) => (
                  <article key={item} className="border-b border-white/10 p-6 last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 hover:bg-white/5 transition">
                    <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400">Featured</p>
                    <p className="mt-3 text-base font-semibold leading-7 text-white">{item}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="services" className="border-b border-white/10 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16">
              <h2 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
                Real clinic stories, simplified.
              </h2>
              <p className="mt-4 text-lg text-white/70 max-w-2xl">
                Every day in a clinic is a sequence of handoffs, decisions, and care moments. SHALIT AFIA helps your team move from busy to intentional, from fragmented to aligned.
              </p>
            </div>

            <div className="grid gap-6 md:grid-cols-3">
              {capabilityCards.map((card) => (
                <article key={card.title} className="group rounded-2xl border border-white/10 bg-gradient-to-br from-slate-700 to-slate-800 p-8 hover:border-cyan-500/50 hover:bg-slate-700 transition">
                  <h3 className="text-2xl font-bold text-white">{card.title}</h3>
                  <p className="mt-3 text-white/70 leading-7">{card.detail}</p>
                  <a href="#platform" className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-cyan-400 hover:text-cyan-300 transition">
                    {card.cta}
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition" />
                  </a>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="platform" className="border-b border-white/10 py-20 sm:py-28">
          <div className="mx-auto grid w-full max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_0.9fr] lg:items-center lg:px-8">
            <div>
              <p className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">The Platform</p>
              <h2 className="mt-4 text-5xl font-bold sm:text-6xl text-white">
                A platform built around the moments that matter.
              </h2>
              <p className="mt-6 text-lg text-white/70 leading-relaxed">
                Imagine a clinic where notes, inventory, and approvals arrive together instead of as questions. SHALIT AFIA makes that a reality, helping your team spend less time searching and more time caring.
              </p>
              <Button asChild className="mt-8 rounded-full bg-cyan-500 px-8 text-slate-950 hover:bg-cyan-400 font-semibold transition">
                <Link to="/register">Start your journey</Link>
              </Button>
            </div>
            <div className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-slate-700 to-slate-800">
              <img
                src="https://images.pexels.com/photos/7089629/pexels-photo-7089629.jpeg?auto=compress&cs=tinysrgb&w=1400"
                alt="Healthcare workers coordinating patient care in a clinic"
                className="h-96 w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            </div>
          </div>
        </section>

        <section id="news" className="border-b border-white/10 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <h2 className="text-5xl font-bold sm:text-6xl text-white">
              Latest updates
            </h2>

            <div className="mt-12 space-y-4">
              {latestNews.map((item) => (
                <article key={item.title} className="group rounded-2xl border border-white/10 bg-gradient-to-r from-slate-700 to-slate-800 p-8 hover:border-cyan-500/50 hover:bg-slate-700 transition">
                  <p className="text-sm font-semibold text-cyan-400">{item.date}</p>
                  <h3 className="mt-3 text-2xl font-bold text-white group-hover:text-cyan-300 transition">{item.title}</h3>
                  <p className="mt-3 text-white/70 leading-7">{item.detail}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="contact" className="border-b border-white/10 py-20 sm:py-28 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-transparent" />
          <div className="relative z-10 mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold text-cyan-400 uppercase tracking-widest">Write the next chapter</p>
              <h2 className="mt-4 text-5xl font-bold sm:text-6xl text-white">
                Start with a clinic experience that feels effortless.
              </h2>
              <p className="mt-6 text-lg text-white/70">
                Every team deserves software that supports their story — from welcoming the first patient of the day to closing out the final appointment with ease.
              </p>
            </div>
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button asChild className="rounded-full bg-cyan-500 px-8 text-slate-950 hover:bg-cyan-400 font-semibold transition">
                <Link to="/register">Create account</Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-white/20 bg-transparent px-8 text-white hover:bg-white/5 hover:border-cyan-500/50 transition"
                onClick={() => setLeadOpen(true)}
              >
                Request a walkthrough
              </Button>
            </div>
          </div>
        </section>

        <section id="faq" className="border-b border-white/10 py-20 sm:py-28">
          <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="mb-16">
              <h2 className="text-5xl font-bold tracking-tight text-white sm:text-6xl">
                Questions answered
              </h2>
              <p className="mt-4 text-lg text-white/70 max-w-2xl">
                Everything you need to know about implementing and running SHALIT AFIA at your clinic.
              </p>
            </div>

            <div className="mx-auto max-w-3xl">
              <Accordion type="single" collapsible className="w-full space-y-3">
                {faqItems.map((item) => (
                  <AccordionItem
                    key={item.id}
                    value={item.id}
                    className="rounded-xl border border-white/10 bg-gradient-to-br from-slate-700 to-slate-800 px-6 hover:border-cyan-500/50 transition data-[state=open]:border-cyan-500/50"
                  >
                    <AccordionTrigger className="text-white hover:text-cyan-300 transition py-5">
                      <span className="text-left text-lg font-semibold">{item.question}</span>
                    </AccordionTrigger>
                    <AccordionContent className="text-white/70 leading-relaxed pb-5">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>

            <div className="mt-16 text-center">
              <p className="text-white/70 mb-6">Didn't find what you're looking for?</p>
              <Button
                type="button"
                className="rounded-full bg-cyan-500 px-8 text-slate-950 hover:bg-cyan-400 font-semibold transition"
                onClick={() => setLeadOpen(true)}
              >
                Contact our team
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-white/10 bg-slate-900 py-8 text-white/60">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between px-4 text-sm sm:px-6 lg:px-8">
          <p>(c) SHALIT AFIA 2026</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-cyan-400 transition">Privacy Policy</a>
            <a href="#" className="hover:text-cyan-400 transition">Terms</a>
          </div>
        </div>
      </footer>

      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent className="max-w-md border-white/10 bg-slate-800">
          <DialogHeader>
            <DialogTitle className="text-2xl text-white">
              Request guided setup
            </DialogTitle>
            <DialogDescription className="text-white/70">
              Share your details and we&apos;ll help your clinic launch quickly.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleLeadSubmit}>
            <div className="space-y-2">
              <Label htmlFor="lead-name" className="text-white">Your name</Label>
              <Input
                id="lead-name"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Dr. Amina"
                className="bg-slate-700 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email" className="text-white">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="you@clinic.com"
                className="bg-slate-700 border-white/10 text-white placeholder:text-white/40"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-phone" className="text-white">Phone Number</Label>
              <PhoneNumberInput
                id="lead-phone"
                countryCode={leadCountryCode}
                phoneNumber={leadPhone}
                onCountryCodeChange={setLeadCountryCode}
                onPhoneNumberChange={setLeadPhone}
                selectClassName="bg-slate-700 border-white/10 text-white"
                inputClassName="bg-slate-700 border-white/10 text-white placeholder:text-white/40"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-clinic" className="text-white">Clinic name</Label>
              <Input
                id="lead-clinic"
                value={leadClinic}
                onChange={(e) => setLeadClinic(e.target.value)}
                placeholder="Shalit Afia Clinic"
                className="bg-slate-700 border-white/10 text-white placeholder:text-white/40"
              />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full rounded-full bg-cyan-500 text-slate-950 hover:bg-cyan-400 font-semibold transition">
                Send request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
