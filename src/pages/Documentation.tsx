import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import {
  TrendingUp,
  ArrowLeft,
  ArrowRight,
  Rocket,
  Star,
  Bell,
  Share2,
  Wrench,
  Terminal,
  Info,
  LifeBuoy,
} from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/contexts/AuthContext";

const SECTIONS = [
  { id: "getting-started", label: "Getting started" },
  { id: "watchlists", label: "Watchlists & screener" },
  { id: "favourites", label: "Favourites" },
  { id: "alerts", label: "Alerts & email" },
  { id: "sharing", label: "Sharing & export" },
  { id: "self-hosting", label: "Self-hosting" },
  { id: "troubleshooting", label: "Troubleshooting" },
];

const TROUBLESHOOTING = [
  {
    q: "My watchlist shows fewer stocks than I added",
    a: "Check the active filters (Data completeness, sector, price range) in the toolbar — a filter can hide rows. Clear all filters, then press Refresh Now. Duplicate tickers are merged automatically.",
  },
  {
    q: "Prices look stale or a column shows “—”",
    a: "Quotes only move while the Indian market is open (9:15–15:30 IST, Mon–Fri). Outside those hours the last traded values are shown. A “—” means the upstream feed does not publish that field for the instrument — indices, for example, have no volume or market cap.",
  },
  {
    q: "Auto-refresh isn’t running",
    a: "Auto-refresh every 5 seconds is a Premium Plus feature. Enable it in Profile → Preferences, keep the tab visible (polling pauses on hidden tabs to save quota), and make sure the market is open.",
  },
  {
    q: "I never received the verification email",
    a: "Check your spam or junk folder first. Use “Check Now” on the verification screen after confirming, or request a new link. Transactional emails also respect the Email opt-in toggle in your profile.",
  },
  {
    q: "Sign-up rejects my password",
    a: "Passwords are checked against known breach lists, so common passwords are blocked even when they look complex. Use at least 8 characters mixing upper case, lower case, a digit and a symbol — the live checklist on the sign-up form shows what is still missing.",
  },
  {
    q: "Google sign-in fails with “Unsupported provider”",
    a: "The Google provider is not enabled on your backend project, or the current origin is missing from the allowed redirect URLs. Add both the site URL and the preview URL to the auth configuration.",
  },
  {
    q: "A ticker cannot be found when adding a stock",
    a: "Search by NSE/BSE symbol rather than company name, and use the exact index identifier for indices. If the quote resolves but fields are empty, the app automatically reconciles the value once per session against the reference source.",
  },
  {
    q: "The published app is blank",
    a: "The frontend environment variables were missing at build time. Set them and rebuild — Vite inlines them into the bundle, so changing them requires a fresh build.",
  },
];

const SectionHeading = ({
  id,
  icon: Icon,
  eyebrow,
  title,
  intro,
}: {
  id: string;
  icon: React.ElementType;
  eyebrow: string;
  title: string;
  intro: string;
}) => (
  <div id={id} className="scroll-mt-28">
    <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">{eyebrow}</p>
    <h2 className="mt-2 flex items-center gap-2.5 text-2xl font-semibold tracking-tight">
      <Icon className="h-5 w-5 text-primary" />
      {title}
    </h2>
    <p className="mt-2 max-w-2xl text-sm text-muted-foreground">{intro}</p>
  </div>
);

const Step = ({ n, children }: { n: string; children: React.ReactNode }) => (
  <li className="flex gap-3 border-l border-border/70 pl-4 py-1.5">
    <span className="font-mono text-[11px] text-primary pt-0.5">{n}</span>
    <span className="text-sm text-muted-foreground leading-relaxed">{children}</span>
  </li>
);

const Callout = ({ children }: { children: React.ReactNode }) => (
  <div className="mt-5 flex gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
    <Info className="h-4 w-4 shrink-0 text-primary mt-0.5" />
    <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
  </div>
);

const Documentation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [active, setActive] = useState(SECTIONS[0].id);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActive(visible.target.id);
      },
      { rootMargin: "-120px 0px -65% 0px", threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-7xl mx-auto flex items-center justify-between px-3 sm:px-6 h-14 sm:h-16">
          <button onClick={() => navigate("/")} className="flex items-center gap-2" aria-label="Back to home">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="text-base sm:text-lg font-bold tracking-tight">
              Equity<span className="text-primary">IQ</span>
            </span>
            <span className="hidden sm:inline ml-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground border-l border-border pl-2">
              Docs
            </span>
          </button>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> <span className="hidden sm:inline">Home</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/faq")} className="hidden sm:inline-flex">
              FAQ
            </Button>
            <Button variant="ghost" size="sm" onClick={() => navigate("/support")} className="hidden sm:inline-flex">
              Support
            </Button>
            {user ? (
              <Button onClick={() => navigate("/dashboard")} size="sm" className="text-xs sm:text-sm">
                Dashboard <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <Button size="sm" onClick={() => navigate("/auth")} className="text-xs sm:text-sm">
                Get Started <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />
              </Button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block lg:col-span-3">
          <div className="sticky top-28 space-y-6">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground mb-3">
                On this page
              </p>
              <nav className="flex flex-col gap-0.5">
                {SECTIONS.map((s) => {
                  const isActive = active === s.id;
                  return (
                    <button
                      key={s.id}
                      onClick={() => scrollTo(s.id)}
                      className={`text-left rounded-md px-3 py-2 text-sm transition-colors border-l-2 ${
                        isActive
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                      }`}
                    >
                      {s.label}
                    </button>
                  );
                })}
              </nav>
            </div>

            <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/10 to-transparent p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <LifeBuoy className="h-4 w-4 text-primary" /> Need a hand?
              </p>
              <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
                If something here doesn’t match what you see in the app, tell us — we keep this page in sync with every
                release.
              </p>
              <Button variant="outline" size="sm" className="mt-3 w-full" onClick={() => navigate("/support")}>
                Contact support
              </Button>
            </div>
          </div>
        </aside>

        {/* Content */}
        <main className="lg:col-span-9 space-y-14">
          <motion.header
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="border-b border-border pb-8"
          >
            <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-primary">Documentation</p>
            <h1 className="mt-3 text-3xl sm:text-4xl font-bold tracking-tight">How to use EquityIQ</h1>
            <p className="mt-3 max-w-2xl text-base text-muted-foreground leading-relaxed">
              A practical, written-by-the-team guide to the screener, watchlists, favourites, alerts and sharing — with
              honest fixes for the issues people actually hit.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 lg:hidden">
              {SECTIONS.map((s) => (
                <Button key={s.id} variant="outline" size="sm" onClick={() => scrollTo(s.id)}>
                  {s.label}
                </Button>
              ))}
            </div>
          </motion.header>

          <section>
            <SectionHeading
              id="getting-started"
              icon={Rocket}
              eyebrow="01 — Setup"
              title="Getting started"
              intro="Four steps from a blank account to a live watchlist. It takes about two minutes."
            />
            <ol className="mt-5 space-y-1">
              <Step n="01">Create an account with email and password, or continue with Google.</Step>
              <Step n="02">Confirm the verification email — check spam if it does not arrive within a minute.</Step>
              <Step n="03">The guided walkthrough runs on first login and can be replayed from Profile at any time.</Step>
              <Step n="04">Every new account starts on a 15-day trial with full Pro access.</Step>
            </ol>
          </section>

          <section>
            <SectionHeading
              id="watchlists"
              icon={TrendingUp}
              eyebrow="02 — Core"
              title="Watchlists & screener"
              intro="The screener is the heart of the app: add instruments, shape the table, and refresh on your terms."
            />
            <ul className="mt-5 space-y-1">
              <Step n="•">Add stocks by NSE/BSE symbol; indices are supported alongside regular equities.</Step>
              <Step n="•">Sort any column, and filter by sector, price band or data completeness (Complete vs Partial).</Step>
              <Step n="•">Choose which columns are visible — the layout is stored per user and encrypted.</Step>
              <Step n="•">
                Use <strong className="text-foreground">Refresh Now</strong> for an on-demand update; Premium Plus can
                enable a 5-second auto-refresh that pauses when the tab is hidden or the market is closed.
              </Step>
            </ul>
            <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { plan: "Free", limit: "1 × 20" },
                { plan: "Pro", limit: "5 × 20" },
                { plan: "Premium", limit: "20 × 50" },
                { plan: "Premium Plus", limit: "50 × 100" },
              ].map((p) => (
                <div key={p.plan} className="rounded-xl border border-border bg-card/50 p-4">
                  <p className="text-xs text-muted-foreground">{p.plan}</p>
                  <p className="mt-1 font-mono text-sm text-foreground">{p.limit}</p>
                </div>
              ))}
            </div>
            <Callout>Limits read as watchlists × stocks per watchlist.</Callout>
          </section>

          <section className="grid grid-cols-1 md:grid-cols-2 gap-10">
            <div>
              <SectionHeading
                id="favourites"
                icon={Star}
                eyebrow="03"
                title="Favourites"
                intro="A single starred set that cuts across every watchlist you own."
              />
              <ul className="mt-5 space-y-1">
                <Step n="•">Star any row to pin it across every watchlist.</Step>
                <Step n="•">The Favourites page shows live prices for starred tickers and supports one-click removal.</Step>
                <Step n="•">Favourites sync to your account, so they follow you to any device.</Step>
              </ul>
            </div>
            <div>
              <SectionHeading
                id="alerts"
                icon={Bell}
                eyebrow="04"
                title="Alerts & email"
                intro="Signals are deduplicated on purpose — you should hear from us only when something changes."
              />
              <ul className="mt-5 space-y-1">
                <Step n="•">Price triggers fire when a stock crosses your upper or lower bound (Premium and above).</Step>
                <Step n="•">
                  Smart Alerts flag 52-week breaks and volume spikes using rolling averages with cooldowns, so the same
                  signal is not repeated.
                </Step>
                <Step n="•">Digest emails respect the Email opt-in toggle in Profile — turning it off stops all digests.</Step>
              </ul>
            </div>
          </section>

          <section>
            <SectionHeading
              id="sharing"
              icon={Share2}
              eyebrow="05 — Distribution"
              title="Sharing & export"
              intro="Send a watchlist to someone who does not have an account, or keep it on your home screen."
            />
            <ul className="mt-5 space-y-1">
              <Step n="•">Export a watchlist as an image or PDF snapshot.</Step>
              <Step n="•">Generate a read-only share link that works without an account.</Step>
              <Step n="•">Install the app to your home screen — it ships as a PWA on Android, iOS and desktop.</Step>
            </ul>
          </section>

          <section>
            <SectionHeading
              id="self-hosting"
              icon={Terminal}
              eyebrow="06 — Engineering"
              title="Self-hosting (Node.js)"
              intro="The project runs on Node.js 20+ with npm and npx — no other package manager is required."
            />
            <pre className="mt-5 rounded-xl border border-border bg-muted/60 p-4 text-xs overflow-x-auto font-mono leading-relaxed">
{`npm install          # install dependencies
npm run dev          # local dev server on http://localhost:8080
npm run build        # production bundle -> dist/
npm run preview      # serve the production build
npm run lint         # eslint
npm run test         # vitest

npx supabase link --project-ref <project-ref>
npx supabase db push
npx supabase functions deploy`}
            </pre>
            <Callout>
              Full architecture, environment variables and deployment steps live in <code className="font-mono text-primary">Setup.md</code>,
              with the backend reference in <code className="font-mono text-primary">API.md</code>.
            </Callout>
          </section>

          <section>
            <SectionHeading
              id="troubleshooting"
              icon={Wrench}
              eyebrow="07 — Support"
              title="Troubleshooting"
              intro="The questions our inbox receives most, answered without hand-waving."
            />
            <div className="mt-5 rounded-2xl border border-border divide-y divide-border overflow-hidden bg-card/40">
              <Accordion type="single" collapsible className="w-full">
                {TROUBLESHOOTING.map((item, i) => (
                  <AccordionItem key={i} value={`t-${i}`} className="border-b-0 px-5">
                    <AccordionTrigger className="text-sm text-left hover:no-underline">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                      {item.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </div>
          </section>

          <footer className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-border pt-8">
            <p className="text-sm text-muted-foreground">
              Still stuck? A real person reads every support request.
            </p>
            <Button onClick={() => navigate("/support")}>
              Contact support <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </footer>
        </main>
      </div>
    </div>
  );
};

export default Documentation;
