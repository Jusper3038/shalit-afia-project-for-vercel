import { Link, Navigate } from "react-router-dom";
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CreditCard,
  HeartHandshake,
  HeartPulse,
  LayoutDashboard,
  Sparkles,
  Stethoscope,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";

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

const heroImages = [
  {
    src: "https://images.pexels.com/photos/4989168/pexels-photo-4989168.jpeg?cs=srgb&dl=pexels-ivan-s-4989168.jpg&fm=jpg",
    alt: "Smiling doctor leaning forward in a bright modern workspace",
    caption: "The dashboard opens with a clinician who already feels in control",
  },
  {
    src: "https://images.pexels.com/photos/8376333/pexels-photo-8376333.jpeg?cs=srgb&dl=pexels-tima-miroshnichenko-8376333.jpg&fm=jpg",
    alt: "Smiling clinician in a white coat speaking warmly at a desk",
    caption: "A patient record that stays easy to read, update, and trust",
  },
  {
    src: "https://images.pexels.com/photos/7578806/pexels-photo-7578806.jpeg?cs=srgb&dl=pexels-cottonbro-7578806.jpg&fm=jpg",
    alt: "Smiling doctor in conversation with a patient in a bright clinic",
    caption: "One conversation moving cleanly through the visit flow",
  },
  {
    src: "https://images.pexels.com/photos/19963186/pexels-photo-19963186.jpeg?cs=srgb&dl=pexels-tessy-agbonome-521343232-19963186.jpg&fm=jpg",
    alt: "Smiling female doctor in blue scrubs on a white background",
    caption: "A bright, white-background moment that mirrors the app's clarity",
  },
];

const Index = () => {
  const { session, loading, role } = useAuth();

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
            <a href="#gallery" className="transition hover:text-foreground">
              Gallery
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
        <section className="relative">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_15%_20%,rgba(14,165,233,0.08),transparent_24%),radial-gradient(circle_at_85%_18%,rgba(59,130,246,0.08),transparent_20%)]" />
          <div className="mx-auto grid max-w-7xl gap-16 px-4 pb-20 pt-14 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:pb-28 lg:pt-20">
            <div className="flex flex-col justify-center">
              <div className="mb-6 inline-flex w-fit items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-4 py-2 text-sm font-medium text-primary">
                <Sparkles className="h-4 w-4" />
                A clearer clinic story starts here
              </div>

              <h1 className="max-w-2xl text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
                A bright white homepage with blue energy and a story that feels easy to follow.
              </h1>

              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground">
                Shalit Afia brings patients, drugs, billing, payments, and reporting into one calm workflow so the whole
                clinic feels easier to understand, easier to trust, and easier to love using.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="shadow-lg shadow-primary/20">
                  <a href="#gallery">
                    See the story
                    <ArrowRight className="h-4 w-4" />
                  </a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-primary/20 bg-white/80 backdrop-blur">
                  <a href="#platform">Explore the workflow</a>
                </Button>
              </div>

              <div className="mt-12 grid gap-4 sm:grid-cols-3">
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

              <div className="relative grid gap-5 sm:grid-cols-[1.1fr_0.9fr]">
                <div className="overflow-hidden rounded-[30px] border border-sky-100 bg-white shadow-[0_30px_90px_rgba(59,130,246,0.08)] float-slow">
                  <img
                    src={heroImages[0].src}
                    alt={heroImages[0].alt}
                    className="h-[470px] w-full object-cover"
                    loading="eager"
                    decoding="async"
                  />
                  <div className="p-4">
                    <p className="text-sm font-semibold text-foreground">{heroImages[0].caption}</p>
                    <p className="mt-1 text-sm text-muted-foreground">The first glance says the clinic is already organized.</p>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_24px_70px_rgba(59,130,246,0.08)] float-fast">
                    <img
                      src={heroImages[1].src}
                      alt={heroImages[1].alt}
                      className="h-[222px] w-full object-cover"
                      loading="eager"
                      decoding="async"
                    />
                    <div className="p-4">
                      <p className="text-sm font-semibold text-foreground">{heroImages[1].caption}</p>
                      <p className="mt-1 text-sm text-muted-foreground">A clear record turns the next step into an easy one.</p>
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-sky-100 bg-sky-50 p-5 text-foreground shadow-sm">
                    <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.22em] text-primary">
                      <HeartHandshake className="h-4 w-4" />
                      Workflow lift
                    </div>
                    <p className="mt-3 text-2xl font-semibold leading-tight text-primary">Blue accents guide the eye without taking over the page.</p>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      The visual language stays clean, bright, and uncluttered while the app carries the work.
                    </p>
                  </div>
                </div>

                <div className="sm:col-span-2 grid gap-4 sm:grid-cols-[0.9fr_1.1fr]">
                  <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_24px_70px_rgba(59,130,246,0.08)] float-fast">
                    <img
                      src={heroImages[3].src}
                      alt={heroImages[3].alt}
                      className="h-[230px] w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="p-4">
                      <p className="text-sm font-semibold text-foreground">{heroImages[3].caption}</p>
                      <p className="mt-1 text-sm text-muted-foreground">This image now matches the page: white background, blue energy, clear story.</p>
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_24px_70px_rgba(59,130,246,0.08)] float-slow">
                    <img
                      src={heroImages[2].src}
                      alt={heroImages[2].alt}
                      className="h-[230px] w-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="p-4">
                      <p className="text-sm font-semibold text-foreground">{heroImages[2].caption}</p>
                      <p className="mt-1 text-sm text-muted-foreground">A visit that moves cleanly from hello to handoff.</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="gallery" className="border-y border-sky-100 bg-white py-24">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Gallery</p>
              <h2 className="mt-3 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                Four images, four parts of the story.
              </h2>
              <p className="mt-4 text-base leading-7 text-muted-foreground">
                Each photo ties back to a real product moment: a calmer check-in, a clearer patient view, a smoother handoff,
                and a billing flow that closes the loop.
              </p>
            </div>

            <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {heroImages.map((image, index) => (
                <div
                  key={image.src}
                  className="group overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl"
                >
                  <div className="relative">
                    <img
                      src={image.src}
                      alt={image.alt}
                      className="h-72 w-full object-cover transition duration-500 group-hover:scale-[1.04]"
                      loading="lazy"
                      decoding="async"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_40%,rgba(14,165,233,0.2)_100%)]" />
                    <div className="absolute left-4 top-4 rounded-full border border-sky-100 bg-white/90 px-3 py-1 text-xs font-semibold text-primary shadow-sm">
                      {index === 0 ? "Dashboard ready" : index === 1 ? "Record clarity" : index === 2 ? "Visit flow" : "Shared view"}
                    </div>
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-semibold text-foreground">{image.caption}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      A visual cue that the software is quietly making the day easier behind the smile.
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="outcomes" className="py-24">
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

        <section id="platform" className="py-24">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[0.92fr_1.08fr] lg:px-8">
            <div className="relative overflow-hidden rounded-[28px] border border-sky-100 bg-white shadow-[0_30px_80px_rgba(59,130,246,0.08)]">
              <img
                src={heroImages[2].src}
                alt={heroImages[2].alt}
                className="h-full min-h-[420px] w-full object-cover"
                loading="lazy"
                decoding="async"
              />
              <div className="absolute inset-x-0 bottom-0 bg-[linear-gradient(180deg,rgba(255,255,255,0)_0%,rgba(255,255,255,0.94)_55%,rgba(255,255,255,1)_100%)] p-6 sm:p-8">
                <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">Story</p>
                <h3 className="mt-3 max-w-lg text-2xl font-semibold leading-tight sm:text-3xl">
                  The room feels lighter when the software keeps the work flowing and the people smiling.
                </h3>
                <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">
                  A white canvas, blue accents, and one steady system behind the scenes.
                </p>
              </div>
            </div>

            <div className="flex flex-col justify-center">
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

        <section className="bg-white py-24">
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

        <section id="start" className="py-24">
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
    </div>
  );
};

export default Index;
