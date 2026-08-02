import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { BookOpen, TrendingUp, ArrowLeft, ArrowRight, Rocket, Star, Bell, Share2, Wrench, Terminal } from "lucide-react";
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

const Documentation = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-3 sm:px-4 h-14 sm:h-16">
          <button onClick={() => navigate("/")} className="flex items-center gap-2" aria-label="Back to home">
            <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="text-base sm:text-lg font-bold tracking-tight">
              Equity<span className="text-primary">IQ</span>
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

      <section className="pt-24 sm:pt-32 pb-8 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-3">
              <BookOpen className="h-3 w-3 mr-1 text-primary" /> Documentation
            </Badge>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              How to use EquityIQ
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-2xl mx-auto px-2">
              A practical guide to the screener, watchlists, favourites, alerts and sharing — plus fixes for the issues
              people hit most often.
            </p>
          </motion.div>

          <div className="flex flex-wrap justify-center gap-2 mt-6">
            {SECTIONS.map((s) => (
              <Button key={s.id} variant="outline" size="sm" onClick={() => scrollTo(s.id)}>
                {s.label}
              </Button>
            ))}
          </div>
        </div>
      </section>

      <main className="px-4 sm:px-6 pb-20">
        <div className="max-w-4xl mx-auto space-y-6">
          <Card id="getting-started" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Rocket className="h-4 w-4 text-primary" /> Getting started
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc list-inside space-y-1.5">
                <li>Create an account with email and password, or continue with Google.</li>
                <li>Confirm the verification email — check spam if it does not arrive within a minute.</li>
                <li>The guided walkthrough runs on first login and can be replayed from Profile at any time.</li>
                <li>Every new account starts on a 15-day trial with full Pro access.</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="watchlists" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <TrendingUp className="h-4 w-4 text-primary" /> Watchlists &amp; screener
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc list-inside space-y-1.5">
                <li>Add stocks by NSE/BSE symbol; indices are supported alongside regular equities.</li>
                <li>Sort any column, and filter by sector, price band or data completeness (Complete vs Partial).</li>
                <li>Choose which columns are visible — the layout is stored per user and encrypted.</li>
                <li>
                  Use <strong className="text-foreground">Refresh Now</strong> for an on-demand update; Premium Plus can
                  enable a 5-second auto-refresh that pauses when the tab is hidden or the market is closed.
                </li>
                <li>Plan limits: Free 1×20, Pro 5×20, Premium 20×50, Premium Plus 50×100.</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="favourites" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Star className="h-4 w-4 text-primary" /> Favourites
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc list-inside space-y-1.5">
                <li>Star any row to pin it across every watchlist.</li>
                <li>The Favourites page shows live prices for starred tickers and supports one-click removal.</li>
                <li>Favourites sync to your account, so they follow you to any device.</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="alerts" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Bell className="h-4 w-4 text-primary" /> Alerts &amp; email
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc list-inside space-y-1.5">
                <li>Price triggers fire when a stock crosses your upper or lower bound (Premium and above).</li>
                <li>
                  Smart Alerts flag 52-week breaks and volume spikes using rolling averages with cooldowns, so the same
                  signal is not repeated.
                </li>
                <li>Digest emails respect the Email opt-in toggle in Profile — turning it off stops all digests.</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="sharing" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Share2 className="h-4 w-4 text-primary" /> Sharing &amp; export
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-2">
              <ul className="list-disc list-inside space-y-1.5">
                <li>Export a watchlist as an image or PDF snapshot.</li>
                <li>Generate a read-only share link that works without an account.</li>
                <li>Install the app to your home screen — it ships as a PWA on Android, iOS and desktop.</li>
              </ul>
            </CardContent>
          </Card>

          <Card id="self-hosting" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Terminal className="h-4 w-4 text-primary" /> Self-hosting (Node.js)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground space-y-3">
              <p>The project runs on Node.js 20+ with npm and npx — no other package manager is required.</p>
              <pre className="rounded-md bg-muted p-3 text-xs overflow-x-auto">
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
              <p>
                Full architecture, environment variables and deployment steps live in <code>Setup.md</code>, with the
                backend reference in <code>API.md</code>.
              </p>
            </CardContent>
          </Card>

          <Card id="troubleshooting" className="scroll-mt-24">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Wrench className="h-4 w-4 text-primary" /> Troubleshooting
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {TROUBLESHOOTING.map((item, i) => (
                  <AccordionItem key={i} value={`t-${i}`}>
                    <AccordionTrigger className="text-sm text-left">{item.q}</AccordionTrigger>
                    <AccordionContent className="text-sm text-muted-foreground">{item.a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </CardContent>
          </Card>

          <div className="text-center pt-2">
            <p className="text-sm text-muted-foreground">
              Still stuck? Our team is happy to help.
            </p>
            <Button className="mt-3" onClick={() => navigate("/support")}>
              Contact support <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Documentation;
