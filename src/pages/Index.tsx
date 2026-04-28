import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  Stethoscope,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const outcomes = [
  {
    title: "A calmer front desk",
    description: "A smoother first hello, less scrambling, and a team that feels ready before the rush begins.",
    icon: LayoutDashboard,
  },
  {
    title: "Cleaner money flow",
    description: "Billing, payments, and reporting stay together so nothing feels lost in the shuffle.",
    icon: CreditCard,
  },
  {
    title: "Stronger team confidence",
    description: "Everyone works from one live picture, which makes the whole clinic feel more in sync.",
    icon: Users,
  },
];

const capabilities = [
  "Patient records that stay easy to find",
  "Drugs and inventory with fewer blind spots",
  "Billing that keeps pace with real work",
  "Payment tracking that reduces follow-up stress",
  "Reports that help you decide with numbers",
  "Access controls for sensitive tasks",
];

const glowPoints = [
  {
    label: "Calm check-in",
    detail: "The front desk sees the right record at the right moment",
  },
  {
    label: "Clear handoff",
    detail: "Nurses, doctors, and billing work from one shared view",
  },
  {
    label: "Clean follow-through",
    detail: "Payments, reports, and inventory keep the story moving",
  },
];

const dashboardSamples = [
  {
    title: "Owner dashboard",
    eyebrow: "Today",
    stat: "24 visits in motion",
    detail: "A single screen for appointments, queue pressure, and the work that needs attention first.",
    bars: [82, 64, 91, 58],
    tone: "from-sky-50 to-white",
    icon: LayoutDashboard,
  },
  {
    title: "Billing flow",
    eyebrow: "Payments",
    stat: "18 cleared today",
    detail: "See what is paid, what is pending, and what needs a follow-up without opening another tab.",
    bars: [45, 72, 88, 66],
    tone: "from-blue-50 to-white",
    icon: CreditCard,
  },
  {
    title: "Lead inbox",
    eyebrow: "New",
    stat: "8 inquiries waiting",
    detail: "Homepage leads land in one place so the team can respond before the day gets noisy.",
    bars: [64, 48, 76, 84],
    tone: "from-cyan-50 to-white",
    icon: HeartHandshake,
  },
  {
    title: "Inventory watch",
    eyebrow: "Alerts",
    stat: "3 low-stock items",
    detail: "Drugs and supplies stay visible before they become a last-minute problem.",
    bars: [38, 60, 52, 78],
    tone: "from-slate-50 to-white",
    icon: BarChart3,
  },
];

const clinicianPhoto = {
  src: "https://images.pexels.com/photos/19963186/pexels-photo-19963186.jpeg?cs=srgb&dl=pexels-tessy-agbonome-521343232-19963186.jpg&fm=jpg",
  alt: "Smiling clinician in a white coat on a bright white background",
  caption: "The people behind the dashboard still matter most.",
};

const Index = () => {
  const { session, loading, role } = useAuth();
  const [leadOpen, setLeadOpen] = useState(false);
  const [leadName, setLeadName] = useState("");
  const [leadEmail, setLeadEmail] = useState("");
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
    if (!leadName.trim() || !leadEmail.trim() || !leadClinic.trim()) {
      toast.error("Please fill in your name, email, and clinic.");
      return;
    }

    const submitLead = async () => {
      const { error } = await supabase.from("leads").insert({
        full_name: leadName.trim(),
        email: leadEmail.trim().toLowerCase(),
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
      setLeadClinic("");
    };

    void submitLead();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.14),_transparent_34%),linear-gradient(180deg,#f9fdff_0%,#ffffff_100%)]">
        <div className="flex items-center gap-3 rounded-full border border-white/70 bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
          <span className="text-sm text-muted-foreground">Loading SHALIT AFIA...</span>
        </div>
      </div>
    );
  }

  if (session) {
    return <Navigate to={role === "admin" ? "/dashboard" : "/billing"} replace />;
  }

  return (
    <div className="min-h-screen overflow-hidden bg-white text-foreground">
      <header className="sticky top-0 z-40 border-b border-sky-100 bg-white/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-primary">SHALIT AFIA</p>
              <p className="text-xs text-muted-foreground">Clinic management, made brighter</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#outcomes" className="transition hover:text-foreground">
              Outcomes
            </a>
            <a href="#solutions" className="transition hover:text-foreground">
              Solutions
            </a>
            <a href="#platform" className="transition hover:text-foreground">
              Platform
            </a>
            <a href="#start" className="transition hover:text-foreground">
              Start
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="hidden sm:inline-flex">
              <Link to="/login">Sign in</Link>
            </Button>
            <Button asChild className="shadow-lg shadow-primary/15">
              <Link to="/register">
                Create account
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="bg-white">
        <section className="relative -mt-10 lg:-mt-14">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.08),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.08),transparent_20%)]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-14 pt-0 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-start lg:px-8 lg:pb-18 lg:pt-0">
            <div className="flex flex-col justify-start pt-0 lg:pt-2">
              <div className="mb-4 inline-flex w-fit items-center rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-medium text-primary">
                Dashboard story starts here
              </div>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                A clinic homepage that shows the software behind the calm.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                Shalit Afia brings patient records, billing, inventory, lead capture, payments, and owner controls into
                one clear dashboard so the clinic feels organized before anyone signs in.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                  <a href="#solutions">
                    See the dashboard
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-primary/20 bg-white/80 backdrop-blur">
                  <a href="#platform">Explore the workflow</a>
                </Button>
                <Button type="button" size="lg" variant="ghost" className="text-primary" onClick={() => setLeadOpen(true)}>
                  Request a demo
                </Button>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {glowPoints.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-sky-100 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-md">
                    <div className="text-lg font-semibold text-foreground">{item.label}</div>
                    <div className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-8 h-28 w-28 rounded-full bg-sky-100 blur-3xl" />
              <div className="absolute -right-8 bottom-10 h-32 w-32 rounded-full bg-blue-100 blur-3xl" />

              <div className="grid gap-5">
                <div className="overflow-hidden rounded-[32px] border border-sky-100 bg-white shadow-[0_30px_90px_rgba(59,130,246,0.08)]">
                  <div className="border-b border-sky-100 px-6 py-5">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Owner dashboard</p>
                        <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">The day, already organized</h2>
                      </div>
                      <div className="rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                        Live view
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-5 p-6 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="rounded-[28px] bg-[linear-gradient(180deg,#f8fcff_0%,#ffffff_100%)] p-5">
                      <div className="grid gap-4 sm:grid-cols-3">
                        <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Queue</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">24</p>
                          <p className="mt-1 text-sm text-muted-foreground">Visits in motion</p>
                        </div>
                        <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Payments</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">18</p>
                          <p className="mt-1 text-sm text-muted-foreground">Cleared today</p>
                        </div>
                        <div className="rounded-2xl border border-sky-100 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Alerts</p>
                          <p className="mt-2 text-2xl font-semibold text-foreground">3</p>
                          <p className="mt-1 text-sm text-muted-foreground">Items to restock</p>
                        </div>
                      </div>

                      <div className="mt-5 rounded-[24px] border border-sky-100 bg-white p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm font-semibold text-foreground">Today&apos;s rhythm</p>
                            <p className="text-sm text-muted-foreground">A quick chart that shows the clinic moving forward.</p>
                          </div>
                          <BarChart3 className="h-5 w-5 text-primary" />
                        </div>
                        <div className="mt-5 flex items-end gap-3">
                          {[82, 64, 91, 58, 76, 88].map((value, index) => (
                            <div key={index} className="flex-1">
                              <div
                                className="rounded-t-2xl bg-gradient-to-t from-primary/70 to-sky-200"
                                style={{ height: `${value}px` }}
                              />
                              <div className="mt-2 h-2 rounded-full bg-sky-100" />
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="grid gap-4">
                      {dashboardSamples.slice(1).map((item) => {
                        const Icon = item.icon;
                        return (
                          <div
                            key={item.title}
                            className={`rounded-[26px] border border-sky-100 bg-gradient-to-br ${item.tone} p-5 shadow-sm`}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-white text-primary shadow-sm">
                                  <Icon className="h-5 w-5" />
                                </div>
                                <div>
                                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{item.eyebrow}</p>
                                  <h3 className="mt-1 text-lg font-semibold text-foreground">{item.title}</h3>
                                </div>
                              </div>
                              <div className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-semibold text-primary">
                                {item.stat}
                              </div>
                            </div>
                            <p className="mt-4 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                            <div className="mt-4 grid grid-cols-4 gap-2">
                              {item.bars.map((bar, index) => (
                                <div key={index} className="flex h-16 items-end rounded-2xl bg-white p-2 shadow-inner">
                                  <div
                                    className="w-full rounded-full bg-gradient-to-t from-primary/80 to-sky-300"
                                    style={{ height: `${bar}%` }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {dashboardSamples.map((item) => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.title}
                        className={`rounded-[26px] border border-sky-100 bg-gradient-to-br ${item.tone} p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-white text-primary shadow-sm">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{item.eyebrow}</p>
                            <h3 className="mt-1 text-lg font-semibold text-foreground">{item.title}</h3>
                          </div>
                        </div>
                        <p className="mt-4 text-sm font-semibold text-foreground">{item.stat}</p>
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">{item.detail}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="solutions" className="border-y border-sky-100 bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Solutions</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Dashboard samples that show the product at work.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                These sample views make the promise concrete: cleaner billing, visible inventory, lead capture, and owner
                control, all in one place.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {dashboardSamples.map((sample) => {
                const Icon = sample.icon;
                return (
                  <div
                    key={sample.title}
                    className={`group overflow-hidden rounded-[28px] border border-sky-100 bg-gradient-to-br ${sample.tone} shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl`}
                  >
                    <div className="border-b border-sky-100 p-5">
                      <div className="flex items-center justify-between">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-sky-100 bg-white text-primary shadow-sm">
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="rounded-full border border-sky-100 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-primary shadow-sm">
                          {sample.eyebrow}
                        </div>
                      </div>
                      <h3 className="mt-4 text-2xl font-semibold tracking-tight text-foreground">{sample.title}</h3>
                      <p className="mt-2 text-sm font-semibold text-primary">{sample.stat}</p>
                    </div>
                    <div className="p-5">
                      <p className="text-sm leading-6 text-muted-foreground">{sample.detail}</p>
                      <div className="mt-5 grid grid-cols-4 gap-2">
                        {sample.bars.map((bar, index) => (
                          <div key={index} className="flex h-16 items-end rounded-2xl bg-white p-2 shadow-inner">
                            <div
                              className="w-full rounded-full bg-gradient-to-t from-primary/80 to-sky-300"
                              style={{ height: `${bar}%` }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="outcomes" className="py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Outcomes</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                The right system changes the mood of the whole day.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                When the clinic runs more smoothly, people stop rushing through the work and start enjoying the service they give.
              </p>
            </div>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {outcomes.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="border-sky-100 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <CardHeader>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-primary">
                        <Icon className="h-5 w-5" />
                      </div>
                      <CardTitle className="mt-4 text-xl">{item.title}</CardTitle>
                      <CardDescription className="text-base leading-7">{item.description}</CardDescription>
                    </CardHeader>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="platform" className="py-14">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
            <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_30px_80px_rgba(59,130,246,0.08)]">
              <div className="border-b border-sky-100">
                <img
                  src={clinicianPhoto.src}
                  alt={clinicianPhoto.alt}
                  className="h-60 w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </div>
              <div className="border-b border-sky-100 px-6 py-5">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Platform</p>
                <h3 className="mt-3 max-w-lg text-2xl font-semibold leading-tight sm:text-3xl">
                  The room feels lighter when the software keeps the work flowing and the team can see the next step.
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                  A white canvas, blue accents, and one steady system behind the scenes.
                </p>
                <p className="mt-3 text-sm font-semibold text-primary">{clinicianPhoto.caption}</p>
              </div>

              <div className="grid gap-4 p-6 sm:grid-cols-2">
                <div className="rounded-[24px] border border-sky-100 bg-sky-50 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Billing</p>
                    <CreditCard className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">18 paid</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Less chasing. More clarity. A cleaner close to the day.</p>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Lead inbox</p>
                    <HeartHandshake className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">8 new</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">New interest captured and ready for follow-up.</p>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Inventory</p>
                    <BarChart3 className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">3 alerts</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">The shelf stays visible before it becomes a problem.</p>
                </div>

                <div className="rounded-[24px] border border-sky-100 bg-blue-50 p-5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Owner access</p>
                    <LayoutDashboard className="h-5 w-5 text-primary" />
                  </div>
                  <p className="mt-3 text-2xl font-semibold text-foreground">PIN locked</p>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">Creator-only settings stay guarded and easy to manage.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col justify-start">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">What changes</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Less friction. More presence. More room for the software to do the heavy lifting.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Shalit Afia is built for the clinic that wants to feel modern without feeling cold. It keeps the essentials
                visible, the workflow simple, and the emotional tone brighter while the system carries the admin load.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {capabilities.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-sky-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-accent" />
                    <p className="text-sm leading-6 text-foreground">{item}</p>
                  </div>
                ))}
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg">
                  <Link to="/register">
                    Start your account
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="outline">
                  <Link to="/login">Sign in</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="border-sky-100 bg-white shadow-sm">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-primary">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Built for the real clinic day</CardTitle>
                  <CardDescription className="text-base leading-7">
                    Fast enough for a busy queue, clear enough for a careful handoff, and simple enough for the whole team.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-sky-100 bg-white shadow-sm">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-accent">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Easy to settle into</CardTitle>
                  <CardDescription className="text-base leading-7">
                    The layout keeps the important work at the center so staff can learn it once and keep moving.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-sky-100 bg-white shadow-sm">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-50 text-sky-600">
                    <BarChart3 className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Feels more alive</CardTitle>
                  <CardDescription className="text-base leading-7">
                    Because the right interface should lift the room, not drain it.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section id="start" className="py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[32px] border border-sky-100 bg-primary px-6 py-12 text-primary-foreground shadow-[0_30px_80px_rgba(14,165,233,0.16)] sm:px-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/75">Ready when you are</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Give your clinic a homepage that feels like a living part of the workflow, not a dead-end form.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-white/80">
                    Start with the story, then step into the app when you're ready. The page should feel inviting long before
                    it asks for a password.
                  </p>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row lg:flex-col">
                  <Button asChild size="lg" variant="secondary" className="bg-white text-primary hover:bg-white/90">
                    <Link to="/register">
                      Create account
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild size="lg" variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white">
                    <Link to="/login">Sign in</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Dialog open={leadOpen} onOpenChange={setLeadOpen}>
        <DialogContent className="max-w-md border-sky-100 bg-white">
          <DialogHeader>
            <DialogTitle className="text-2xl">See the dashboard story up close</DialogTitle>
            <DialogDescription>
              Leave your details and we'll send the next step for your clinic.
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4" onSubmit={handleLeadSubmit}>
            <div className="space-y-2">
              <Label htmlFor="lead-name">Your name</Label>
              <Input
                id="lead-name"
                value={leadName}
                onChange={(e) => setLeadName(e.target.value)}
                placeholder="Dr. Amina"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-email">Email</Label>
              <Input
                id="lead-email"
                type="email"
                value={leadEmail}
                onChange={(e) => setLeadEmail(e.target.value)}
                placeholder="you@clinic.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lead-clinic">Clinic name</Label>
              <Input
                id="lead-clinic"
                value={leadClinic}
                onChange={(e) => setLeadClinic(e.target.value)}
                placeholder="Shalit Afia Clinic"
              />
            </div>

            <DialogFooter>
              <Button type="submit" className="w-full">
                Send me the demo
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
