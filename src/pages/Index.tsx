import { Navigate, Link } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  HeartPulse,
  LayoutDashboard,
  Sparkles,
  Stethoscope,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

const outcomes = [
  {
    title: "A calmer front desk",
    description: "Less chasing, fewer handoffs, and a smoother first five minutes for every patient who walks in.",
    icon: LayoutDashboard,
  },
  {
    title: "Cleaner money flow",
    description: "Billing, payments, and reporting stay in one place so you can see what came in and what still needs attention.",
    icon: CreditCard,
  },
  {
    title: "Stronger team confidence",
    description: "Doctors, pharmacy, and admin staff work from the same live picture instead of separate guesses.",
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

const socialProof = [
  { value: "1 hub", label: "for patients, billing, and inventory" },
  { value: "Less friction", label: "at check-in, payment, and handover" },
  { value: "More trust", label: "because the clinic feels organized" },
];

const Index = () => {
  const { session, loading, role } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgba(14,165,233,0.12),_transparent_35%),linear-gradient(180deg,#f8fbff_0%,#ffffff_100%)]">
        <div className="flex items-center gap-3 rounded-full border border-border/70 bg-white/80 px-5 py-3 shadow-sm backdrop-blur">
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
    <div className="min-h-screen overflow-hidden bg-[linear-gradient(180deg,#f7fbff_0%,#ffffff_36%,#f5faff_100%)] text-foreground">
      <header className="sticky top-0 z-40 border-b border-white/50 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <Link to="/" className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
              <HeartPulse className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-semibold tracking-wide text-primary">SHALIT AFIA</p>
              <p className="text-xs text-muted-foreground">Clinic management, made calm</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#outcomes" className="transition hover:text-foreground">
              Outcomes
            </a>
            <a href="#platform" className="transition hover:text-foreground">
              Platform
            </a>
            <a href="#story" className="transition hover:text-foreground">
              Story
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

      <main>
        <section className="relative">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.16),transparent_25%),radial-gradient(circle_at_85%_10%,rgba(16,185,129,0.14),transparent_18%),linear-gradient(180deg,rgba(255,255,255,0.5),rgba(255,255,255,0))]" />
          <div className="mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-10 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:px-8 lg:pb-24 lg:pt-16">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-4 py-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                A better day for your clinic starts here
              </div>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                Run the clinic that feels organized before the day even starts.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                Shalit Afia brings patients, drugs, billing, payments, and reporting into one calm workflow so your team
                can move faster, your records stay clear, and patients feel looked after from the first hello to the last
                receipt.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                  <a href="#story">
                    See the transformation
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-primary/20 bg-white/80 backdrop-blur">
                  <a href="#platform">Explore the platform</a>
                </Button>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                {socialProof.map((item) => (
                  <div key={item.label} className="rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm backdrop-blur">
                    <div className="text-2xl font-semibold text-foreground">{item.value}</div>
                    <div className="mt-1 text-sm text-muted-foreground">{item.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -left-6 top-8 h-24 w-24 rounded-full bg-primary/10 blur-3xl" />
              <div className="absolute -right-8 bottom-10 h-32 w-32 rounded-full bg-accent/15 blur-3xl" />

              <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white shadow-[0_30px_80px_rgba(15,23,42,0.12)]">
                <img
                  src="https://images.unsplash.com/photo-1576765607924-7e5f4a4d5f1c?auto=format&fit=crop&w=1400&q=80"
                  alt="Healthcare team reviewing a patient plan together"
                  className="h-[420px] w-full object-cover sm:h-[500px]"
                  loading="eager"
                  decoding="async"
                />

                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(3,7,18,0.04)_0%,rgba(3,7,18,0.42)_100%)]" />

                <div className="absolute left-4 right-4 top-4 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/30 bg-white/85 p-4 shadow-lg backdrop-blur">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">Today</p>
                    <p className="mt-2 text-2xl font-semibold text-foreground">128 visits ready</p>
                    <p className="mt-1 text-sm text-muted-foreground">The team sees what matters before the next patient walks in.</p>
                  </div>
                  <div className="rounded-2xl border border-primary/20 bg-primary/95 p-4 text-primary-foreground shadow-lg">
                    <p className="text-xs font-semibold uppercase tracking-[0.22em] text-white/75">Outcome</p>
                    <p className="mt-2 text-2xl font-semibold">Less rushing</p>
                    <p className="mt-1 text-sm text-white/80">More confidence at reception, in the pharmacy, and at billing.</p>
                  </div>
                </div>

                <div className="absolute bottom-4 left-4 right-4 rounded-2xl border border-white/30 bg-slate-950/70 p-4 text-white backdrop-blur">
                  <div className="flex flex-wrap items-center gap-3 text-sm">
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                      <ShieldCheck className="h-4 w-4" />
                      Trusted access
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                      <BadgeCheck className="h-4 w-4" />
                      Clean records
                    </span>
                    <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1">
                      <BarChart3 className="h-4 w-4" />
                      Clear reporting
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="outcomes" className="border-y border-border/60 bg-white/70 py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Outcomes</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                The right system does more than save time. It changes the mood of the whole day.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                When your clinic is easier to run, the energy shifts. People stop hunting for information and start helping
                patients with confidence.
              </p>
            </div>

            <div className="mt-10 grid gap-5 lg:grid-cols-3">
              {outcomes.map((item) => {
                const Icon = item.icon;
                return (
                  <Card key={item.title} className="border-white/70 bg-white/90 shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                    <CardHeader>
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
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

        <section id="platform" className="py-20">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
            <div className="relative overflow-hidden rounded-[28px] border border-white/70 bg-slate-900 shadow-[0_30px_80px_rgba(15,23,42,0.2)]">
              <img
                src="https://images.unsplash.com/photo-1580281657527-47f249e8f4f4?auto=format&fit=crop&w=1200&q=80"
                alt="Clinic staff working at a modern reception desk"
                className="h-full min-h-[420px] w-full object-cover opacity-80"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.1)_0%,rgba(15,23,42,0.8)_100%)]" />
              <div className="absolute inset-x-0 bottom-0 p-6 text-white sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/70">Story</p>
                <h3 className="mt-3 max-w-lg text-2xl font-semibold leading-tight sm:text-3xl">
                  A clinic that feels composed gives patients something to trust before anyone says a word.
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-6 text-white/75">
                  The experience becomes smoother for the team and more reassuring for the people walking through the door.
                </p>
              </div>
            </div>

            <div id="story" className="flex flex-col justify-center">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">What changes</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Less friction. More presence. A better feeling at every touchpoint.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Shalit Afia is built for the clinic that wants to feel modern without feeling cold. It keeps the essentials
                visible, the workflow simple, and the pressure lower.
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-2">
                {capabilities.map((item) => (
                  <div key={item} className="flex items-start gap-3 rounded-2xl border border-border/70 bg-white/80 p-4 shadow-sm">
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

        <section className="bg-[linear-gradient(180deg,rgba(14,165,233,0.06)_0%,rgba(16,185,129,0.06)_100%)] py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-5 lg:grid-cols-3">
              <Card className="border-white/70 bg-white/90 shadow-sm">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Stethoscope className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Built for the real clinic day</CardTitle>
                  <CardDescription className="text-base leading-7">
                    Fast enough for a busy queue, clear enough for a careful handoff, and simple enough for the whole team.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-white/70 bg-white/90 shadow-sm">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Easy to settle into</CardTitle>
                  <CardDescription className="text-base leading-7">
                    The layout keeps the important work at the center so staff can learn it once and keep moving.
                  </CardDescription>
                </CardHeader>
              </Card>

              <Card className="border-white/70 bg-white/90 shadow-sm">
                <CardHeader>
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-sky-500/10 text-sky-600">
                    <HeartPulse className="h-5 w-5" />
                  </div>
                  <CardTitle className="mt-4 text-xl">Feels more human</CardTitle>
                  <CardDescription className="text-base leading-7">
                    Because when the system is calm, the people using it can be calm too.
                  </CardDescription>
                </CardHeader>
              </Card>
            </div>
          </div>
        </section>

        <section id="start" className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="rounded-[32px] border border-primary/10 bg-primary px-6 py-10 text-primary-foreground shadow-[0_30px_80px_rgba(14,165,233,0.2)] sm:px-10">
              <div className="grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-white/75">Ready when you are</p>
                  <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
                    Give your clinic a homepage that feels like the future, not a form field.
                  </h2>
                  <p className="mt-4 max-w-2xl text-base leading-7 text-white/80">
                    Start with the story, then step into the app when you’re ready. The page should feel inviting before it
                    ever asks for a password.
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
    </div>
  );
};

export default Index;
