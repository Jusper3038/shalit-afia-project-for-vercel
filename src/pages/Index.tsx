import { Link, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ArrowRight, HeartPulse } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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

type IndexProps = {
  keepLandingVisible?: boolean;
};

const Index = ({ keepLandingVisible = false }: IndexProps) => {
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
      <div className="flex min-h-screen items-center justify-center bg-navy text-white">
        <div className="flex items-center gap-3 rounded-full border border-white/20 bg-white/5 px-5 py-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          <span className="text-sm">Loading SHALIT AFIA...</span>
        </div>
      </div>
    );
  }

  if (session && !keepLandingVisible) {
    return <Navigate to={role === "admin" ? "/pharmacy/dashboard" : "/pharmacy/billing"} replace />;
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
            <div className="mt-10 flex flex-col sm:flex-row gap-4">
              <Button asChild size="lg" className="rounded-full bg-cyan-500 px-8 text-slate-950 hover:bg-cyan-400 font-semibold transition">
                <Link to="/register">Begin the story</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full border-white/20 bg-transparent text-white hover:bg-white/5">
                <Link to="/login">Open dashboard</Link>
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
