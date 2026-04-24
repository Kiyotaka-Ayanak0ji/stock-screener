import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DemoModal from "@/components/DemoModal";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { HelpCircle, Mail, LifeBuoy } from "lucide-react";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Eye,
  Layers,
  LineChart,
  Lock,
  Shield,
  Smartphone,
  Star,
  TrendingUp,
  Check,
  Crown,
  Tag,
  SlidersHorizontal,
  Share2,
  Users,
  X,
  Briefcase,
  Filter,
  Sparkles,
  Hand,
  Undo2,
  Activity,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: "easeOut" as const },
  }),
};

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Real-Time Price Tracking",
    description:
      "Watch your stocks move in real time with live price updates, change percentages, and volume data across NSE & BSE.",
  },
  {
    icon: Activity,
    title: "Interactive Multi-Day Charts",
    description:
      "Tap any stock to open a rich detail sheet with an interactive price chart: switch between 1D, 1W, 1M, and All-time ranges, with crosshair tooltips on hover and touch.",
    badge: "Premium",
  },
  {
    icon: Bell,
    title: "Custom Price Triggers",
    description:
      "Set upper and lower price alerts on any stock. Get notified via email the moment your target price is hit so that you never miss an entry or exit.",
    badge: "Premium",
  },
  {
    icon: Tag,
    title: "Event Tagging & Labels",
    description:
      "Tag stocks with custom labels like 'Earnings Soon', 'Breakout Watch', or 'Long-term Hold'. Sort and filter your watchlist instantly.",
    badge: "Premium",
  },
  {
    icon: Layers,
    title: "Multiple Watchlists",
    description:
      "Organize stocks into separate watchlists : one for swing trades, another for long-term picks, and more. Stay organized, stay sharp.",
    badge: "Pro",
  },
  {
    icon: SlidersHorizontal,
    title: "Custom Columns & Notes",
    description:
      "Add personal notes to any stock and toggle column visibility to see only the data that matters to you.",
    badge: "Premium",
  },
  {
    icon: Hand,
    title: "Mobile Swipe Gestures",
    description:
      "Swipe left to remove a stock (with a 5-second Undo) and swipe right to instantly set a price trigger. Manage your watchlist faster than ever on mobile.",
  },
  {
    icon: Share2,
    title: "Share & Export",
    description:
      "Share your watchlist with friends via a unique link, or export it as a high-quality image or PDF report.",
    badge: "Premium",
  },
  {
    icon: Sparkles,
    title: "Smart Alerts",
    description:
      "Automatic anomaly detection across your watchlist: 52-week highs/lows and unusual volume spikes flagged in real time so you spot moves the moment they happen.",
    badge: "Pro",
  },
  {
    icon: Filter,
    title: "Advanced Filters",
    description:
      "Slice your watchlist by Price, Volume, Market Cap, and P/E ratio with min/max range filters. Find exactly the setups you're looking for in seconds.",
    badge: "Premium",
  },
  {
    icon: Briefcase,
    title: "Portfolio Dashboard",
    description: "Track your actual holdings with buy price, quantity, and real-time P&L.",
    badge: "Premium",
  },
  {
    icon: Smartphone,
    title: "Mobile PWA:  Install Anywhere",
    description:
      "Install EquityIQ to your home screen for a native-app feel. Locked to portrait orientation, fast loads, and works offline for your last-known prices.",
  },
];

const STATS = [
  { value: "7,500+", label: "NSE + BSE + SME tickers" },
  { value: "< 1s", label: "Live price refresh" },
  { value: "24h", label: "Full universe sweep" },
  { value: "99.9%", label: "Uptime" },
];

const WHATS_NEW = [
  {
    icon: Activity,
    title: "Verify against Screener",
    desc: "One-click sanity check on any ticker. Cross-references Yahoo + Screener + Groww and rewrites stale prices instantly.",
  },
  {
    icon: Layers,
    title: "Full universe coverage",
    desc: "We continuously seed all NSE, BSE and SME tickers (~7,500) every 24 hours so even illiquid micro-caps stay fresh.",
  },
  {
    icon: Sparkles,
    title: "Smart anomaly alerts",
    desc: "Auto-flagged 52-week breakouts and unusual volume spikes across your watchlist — no manual setup, ever.",
  },
  {
    icon: Shield,
    title: "Transparent missing data",
    desc: "Whenever a price, volume, market-cap or P/E can't be fetched, you see a clear tooltip — never a silent zero.",
  },
];

import {
  PRO_FEATURES,
  PRO_LOCKED,
  PREMIUM_EXTRAS,
  PREMIUM_PLUS_EXTRAS,
  GUEST_FEATURES,
  GUEST_LOCKED,
} from "@/lib/planFeatures";

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [demoOpen, setDemoOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-3 sm:px-4 h-14 sm:h-16">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
            <span className="text-base sm:text-lg font-bold tracking-tight">
              Equity<span className="text-primary">IQ</span>
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}
            >
              Features
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}
            >
              Pricing
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}
            >
              FAQ
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex"
              onClick={() => document.getElementById("support")?.scrollIntoView({ behavior: "smooth" })}
            >
              Support
            </Button>
            {user ? (
              <Button onClick={() => navigate("/dashboard")} size="sm" className="text-xs sm:text-sm">
                Dashboard <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")} className="hidden sm:inline-flex">
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate("/auth")} className="text-xs sm:text-sm">
                  Get Started <ArrowRight className="h-3.5 w-3.5 sm:h-4 sm:w-4 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-20 sm:pt-28 md:pt-32 pb-12 sm:pb-16 md:pb-20 px-4 sm:px-6 overflow-hidden">
        {/* Decorative gradient orbs */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10"
        >
          <div className="absolute top-10 left-1/2 -translate-x-1/2 h-[320px] sm:h-[420px] w-[680px] max-w-[90vw] rounded-full bg-primary/15 blur-3xl" />
          <div className="absolute -bottom-20 right-1/4 h-[200px] sm:h-[280px] w-[200px] sm:w-[280px] rounded-full bg-accent/10 blur-3xl" />
        </div>

        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <Badge
              variant="secondary"
              className="mb-5 sm:mb-6 px-3 sm:px-4 py-1 sm:py-1.5 text-[11px] sm:text-xs font-medium border border-primary/20 max-w-[92vw] whitespace-normal sm:whitespace-nowrap text-center leading-snug"
            >
              <Sparkles className="h-3 w-3 mr-1.5 text-primary shrink-0" />
              <span>New · Improved stock coverage and data accuracy.</span>
            </Badge>
          </motion.div>

          <motion.h1
            className="text-[2rem] leading-[1.1] sm:text-5xl md:text-6xl font-extrabold tracking-tight"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Your Stocks. <br className="hidden sm:block" />
            Your Rules.{" "}
            <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Your Edge.
            </span>
          </motion.h1>

          <motion.p
            className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed px-1"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            EquityIQ is the smarter way to manage and track all your stocks. Set custom price triggers, tag events,
            build watchlists, track your portfolio performance — all in one clean, powerful dashboard.
          </motion.p>

          <motion.div
            className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-2.5 sm:gap-3 max-w-sm sm:max-w-none mx-auto"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <Button
              size="lg"
              className="w-full sm:w-auto px-6 sm:px-8 text-sm sm:text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97] transition-all"
              onClick={() => navigate("/auth")}
            >
              Start Free Trial <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 ml-2" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="w-full sm:w-auto px-6 sm:px-8 text-sm sm:text-base hover:bg-accent/10 active:scale-[0.97] transition-all"
              onClick={() => setDemoOpen(true)}
            >
              <Eye className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> View Demo
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="w-full sm:w-auto px-6 sm:px-8 text-sm sm:text-base active:scale-[0.97] transition-all"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              See Features
            </Button>
          </motion.div>

          <motion.p
            className="mt-5 sm:mt-4 text-[11px] sm:text-xs text-muted-foreground px-2"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
          >
            · User-friendly UI · Trusted by Indian retail investors
          </motion.p>
        </div>
      </section>

      {/* What's New */}
      <section className="py-12 sm:py-14 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-8 sm:mb-10">
            <Badge variant="secondary" className="mb-3">
              <Sparkles className="h-3 w-3 mr-1 text-primary" /> Just shipped
            </Badge>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight">Fresh from the lab</h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto px-2">
              Latest upgrades to make EquityIQ faster, broader and more transparent.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {WHATS_NEW.map((item, i) => (
              <motion.div
                key={item.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="h-full border-border/60 bg-gradient-to-br from-card to-muted/30 hover:border-primary/40 transition-colors">
                  <CardContent className="p-4 sm:p-5">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
                      <item.icon className="h-4.5 w-4.5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-sm mb-1.5">{item.title}</h3>
                    <p className="text-xs text-muted-foreground leading-relaxed">{item.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-muted/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 py-8 sm:py-10 px-4 sm:px-6">
          {STATS.map((s, i) => (
            <motion.div
              key={s.label}
              className="text-center"
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              variants={fadeUp}
              custom={i}
            >
              <p className="text-2xl sm:text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Problem / Story */}
      <section className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            Stop juggling five apps to track your stocks
          </motion.h2>
          <motion.p
            className="mt-5 sm:mt-6 text-muted-foreground text-base sm:text-lg leading-relaxed"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
          >
            You check Groww for prices, set alarms in a notes app, maintain an Excel sheet for your watchlist, and
            screenshot charts to share with friends. Sound familiar?{" "}
            <span className="text-foreground font-semibold">EquityIQ brings everything into one place</span> — so you
            spend less time managing tools and more time making decisions.
          </motion.p>
        </div>
      </section>

      {/* Features Grid - Tabbed by Plan */}
      <section id="features" className="py-10 sm:py-14 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-6 sm:mb-8">
            <Badge variant="secondary" className="mb-2">
              <Star className="h-3 w-3 mr-1 text-primary" /> Features
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
              Everything you need. Nothing you don't.
            </h2>
            <p className="mt-2 text-sm text-muted-foreground max-w-xl mx-auto px-2">
              Switch between plans to see what's included — no scrolling required.
            </p>
          </div>

          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mx-auto mb-6 grid grid-cols-5 w-full max-w-2xl h-auto p-1">
              <TabsTrigger value="all" className="text-[11px] sm:text-sm px-1 sm:px-3 py-1.5">All</TabsTrigger>
              <TabsTrigger value="free" className="text-[11px] sm:text-sm px-1 sm:px-3 py-1.5">Free</TabsTrigger>
              <TabsTrigger value="pro" className="text-[11px] sm:text-sm px-1 sm:px-3 py-1.5">Pro</TabsTrigger>
              <TabsTrigger value="premium" className="text-[11px] sm:text-sm px-1 sm:px-3 py-1.5">Premium</TabsTrigger>
              <TabsTrigger value="premium_plus" className="text-[10px] sm:text-sm px-1 sm:px-3 py-1.5 leading-tight">
                Premium+
              </TabsTrigger>
            </TabsList>

            {(["all", "free", "pro", "premium", "premium_plus"] as const).map((tab) => {
              const tierRank: Record<string, number> = { Pro: 1, Premium: 2, "Premium Plus": 3 };
              const filtered = FEATURES.filter((f) => {
                const badge = (f as any).badge as string | undefined;
                const featureRank = badge ? tierRank[badge] ?? 0 : 0;
                if (tab === "all") return true;
                if (tab === "free") return !badge;
                if (tab === "pro") return featureRank <= 1;
                if (tab === "premium") return featureRank <= 2;
                if (tab === "premium_plus") return true;
                return true;
              });
              return (
                <TabsContent key={tab} value={tab} className="mt-0">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
                    {filtered.map((f, i) => (
                      <motion.div
                        key={f.title}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.03, duration: 0.25 }}
                      >
                        <Card className="h-full border-border hover:border-primary/40 hover:shadow-md transition-all duration-200 group relative">
                          {(f as any).badge && (
                            <Badge className="absolute top-2 right-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[9px]">
                              <Crown className="h-2 w-2 mr-0.5" />
                              {(f as any).badge}
                            </Badge>
                          )}
                          <CardContent className="p-3 sm:p-4">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/20 transition-colors">
                              <f.icon className="h-4 w-4 text-primary" />
                            </div>
                            <h3 className="font-semibold text-sm mb-1">{f.title}</h3>
                            <p className="text-[11px] text-muted-foreground leading-snug">{f.description}</p>
                          </CardContent>
                        </Card>
                      </motion.div>
                    ))}
                  </div>
                  {filtered.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-8">
                      No features in this category.
                    </p>
                  )}
                </TabsContent>
              );
            })}
          </Tabs>
        </div>
      </section>

      {/* How it works */}
      <section className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Get started in 60 seconds</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground">No complicated setup.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 sm:gap-8">
            {[
              {
                step: "01",
                title: "Create your free account",
                desc: "Sign up with your email and get 15 days of Pro-level access — most features unlocked.",
              },
              {
                step: "02",
                title: "Build your watchlists",
                desc: "Search from 5,000+ NSE & BSE stocks and add them to organized watchlists with tags and custom notes.",
              },
              {
                step: "03",
                title: "Set triggers & relax",
                desc: "Configure price alerts and let EquityIQ notify you. Upgrade to Premium for price triggers, event tags, notes, and portfolio tracking.",
              },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="text-center group"
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <div className="text-4xl sm:text-5xl font-extrabold text-primary/15 mb-2 sm:mb-3 group-hover:text-primary/25 transition-colors">
                  {item.step}
                </div>
                <h3 className="font-semibold text-base sm:text-lg mb-1.5 sm:mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed px-2 sm:px-0">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <Badge variant="secondary" className="mb-3">
              <Crown className="h-3 w-3 mr-1 text-primary" /> Pricing
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Simple pricing. Serious value.</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground px-2">
              Start free for 15 days. Choose the plan that fits your trading style.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-1 mt-6 bg-muted rounded-full p-1 w-fit mx-auto relative">
              <button
                onClick={() => setBillingCycle("monthly")}
                className="relative z-10 px-5 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{
                  color: billingCycle === "monthly" ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className="relative z-10 px-5 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5"
                style={{
                  color: billingCycle === "yearly" ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))",
                }}
              >
                Yearly
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-600 dark:text-green-400 border-0"
                >
                  Save 17%
                </Badge>
              </button>
              <motion.div
                className="absolute top-1 bottom-1 rounded-full bg-primary"
                layout
                transition={{ type: "spring", stiffness: 500, damping: 35 }}
                style={{
                  left: billingCycle === "monthly" ? "4px" : undefined,
                  right: billingCycle === "yearly" ? "4px" : undefined,
                  width: billingCycle === "monthly" ? "calc(50% - 6px)" : "calc(50% + 10px)",
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 max-w-6xl mx-auto">
            {/* Free / Guest */}
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg">Guest</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">Free</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Limited access</p>
                <ul className="mt-6 space-y-2.5">
                  {GUEST_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                  {GUEST_LOCKED.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6 active:scale-[0.97] transition-all"
                  variant="outline"
                  onClick={() => navigate("/auth")}
                >
                  Try for Free
                </Button>
              </CardContent>
            </Card>

            {/* Pro */}
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg">Pro</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billingCycle === "yearly" ? "50" : "5"}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="text-4xl font-extrabold"
                    >
                      ${billingCycle === "yearly" ? "50" : "5"}
                    </motion.span>
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billingCycle === "yearly" ? "/year" : "/month"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-muted-foreground text-sm"
                    >
                      /{billingCycle === "yearly" ? "year" : "month"}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <AnimatePresence mode="wait">
                  {billingCycle === "yearly" ? (
                    <motion.p
                      key="yearly-savings"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-green-600 dark:text-green-400 mt-1"
                    >
                      ~$4.17/mo — save $10/year
                    </motion.p>
                  ) : (
                    <motion.p
                      key="monthly-hint"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-muted-foreground mt-1"
                    >
                      or <strong>$50/year</strong> (save 17%)
                    </motion.p>
                  )}
                </AnimatePresence>
                <ul className="mt-6 space-y-2.5">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                  {PRO_LOCKED.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6 active:scale-[0.97] transition-all"
                  variant="outline"
                  onClick={() => navigate("/subscribe")}
                >
                  Get Pro
                </Button>
              </CardContent>
            </Card>

            {/* Premium */}
            <Card className="border-primary ring-2 ring-primary/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground text-xs px-3">BEST VALUE</Badge>
              </div>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg flex items-center gap-1.5">
                  Premium <Crown className="h-4 w-4 text-amber-500" />
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billingCycle === "yearly" ? "200" : "20"}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="text-4xl font-extrabold"
                    >
                      ${billingCycle === "yearly" ? "200" : "20"}
                    </motion.span>
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billingCycle === "yearly" ? "/year-p" : "/month-p"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-muted-foreground text-sm"
                    >
                      /{billingCycle === "yearly" ? "year" : "month"}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <AnimatePresence mode="wait">
                  {billingCycle === "yearly" ? (
                    <motion.p
                      key="yearly-savings-p"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-green-600 dark:text-green-400 mt-1"
                    >
                      ~$16.67/mo — save $40/year
                    </motion.p>
                  ) : (
                    <motion.p
                      key="monthly-hint-p"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-muted-foreground mt-1"
                    >
                      or <strong>$200/year</strong> (save 17%)
                    </motion.p>
                  )}
                </AnimatePresence>
                <ul className="mt-6 space-y-2.5">
                  <li className="flex items-center gap-2 text-sm font-medium">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    Everything in Pro, plus:
                  </li>
                  {PREMIUM_EXTRAS.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6 shadow-lg shadow-primary/20 hover:shadow-xl active:scale-[0.97] transition-all"
                  onClick={() => navigate("/subscribe")}
                >
                  Get Premium <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>

            {/* Premium Plus */}
            <Card className="border-border relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-xs px-3">
                  UNLIMITED
                </Badge>
              </div>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg flex items-center gap-1.5">
                  Premium Plus <Sparkles className="h-4 w-4 text-orange-500" />
                </h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billingCycle === "yearly" ? "450" : "40"}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      transition={{ duration: 0.2 }}
                      className="text-4xl font-extrabold"
                    >
                      ${billingCycle === "yearly" ? "450" : "40"}
                    </motion.span>
                  </AnimatePresence>
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={billingCycle === "yearly" ? "/year-pp" : "/month-pp"}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-muted-foreground text-sm"
                    >
                      /{billingCycle === "yearly" ? "year" : "month"}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <AnimatePresence mode="wait">
                  {billingCycle === "yearly" ? (
                    <motion.p
                      key="yearly-savings-pp"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-green-600 dark:text-green-400 mt-1"
                    >
                      ~$37.50/mo — save $30/year
                    </motion.p>
                  ) : (
                    <motion.p
                      key="monthly-hint-pp"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="text-xs text-muted-foreground mt-1"
                    >
                      or <strong>$450/year</strong> (save ~6%)
                    </motion.p>
                  )}
                </AnimatePresence>
                <ul className="mt-6 space-y-2.5">
                  <li className="flex items-center gap-2 text-sm font-medium">
                    <Check className="h-4 w-4 text-primary shrink-0" />
                    Everything in Premium, plus:
                  </li>
                  {PREMIUM_PLUS_EXTRAS.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full mt-6 active:scale-[0.97] transition-all"
                  variant="outline"
                  onClick={() => navigate("/subscribe")}
                >
                  Get Premium Plus <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-14 sm:py-20 px-4 sm:px-6 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <Badge variant="secondary" className="mb-3">
              <HelpCircle className="h-3 w-3 mr-1 text-primary" /> FAQ
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Frequently Asked Questions</h2>
            <p className="mt-3 text-sm sm:text-base text-muted-foreground px-2">Everything you need to know before getting started</p>
          </div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <Accordion type="single" collapsible className="space-y-3">
              {[
                {
                  q: "Is EquityIQ free to use?",
                  a: "Yes! Sign up and get a 15-day free trial with full Pro-level access. No credit card required. After the trial, choose a plan that suits your needs or continue with the free Guest tier.",
                },
                {
                  q: "What plans are available and what's included?",
                  a: null,
                  richAnswer: (
                    <div className="space-y-2">
                      <p>We offer three tiers:</p>
                      <ul className="list-disc list-inside space-y-1.5 ml-1">
                        <li>
                          <strong className="text-foreground">Guest (Free)</strong> — 1 watchlist with up to 20 stocks,
                          basic price data, light &amp; dark mode.
                        </li>
                        <li>
                          <strong className="text-foreground">Pro ($5/mo or $50/yr)</strong> — Up to 5 watchlists × 20
                          stocks, column customization, real-time updates.
                        </li>
                        <li>
                          <strong className="text-foreground">Premium ($20/mo or $200/yr)</strong> — Up to 20 watchlists
                          × 50 stocks, price trigger alerts with email, event tags, notes, export/share, portfolio
                          dashboard with sector analysis.
                        </li>
                      </ul>
                    </div>
                  ),
                },
                {
                  q: "What do I get during the 15-day free trial?",
                  a: "During your trial, you unlock full Pro access: multiple watchlists, column customization, real-time price updates, Smart Alerts, and mobile swipe gestures with Undo. Premium features like the interactive stock detail sheet, multi-day charts, price triggers, event tags, notes, sharing, and portfolio analytics remain exclusive to Premium subscribers.",
                },
                {
                  q: "What's included in the Premium plan?",
                  a: "Premium unlocks the full EquityIQ experience: the interactive stock detail sheet with multi-day price charts (1D / 1W / 1M / All), price trigger alerts with email notifications, event tagging & tracking, personal notes on every stock, export as image or PDF, shareable watchlist links, and the Portfolio Dashboard — complete with real-time P&L tracking, sector allocation charts, and diversity scoring.",
                },
                {
                  q: "Is there an unlimited plan?",
                  a: "Yes! Premium Plus ($40/mo or $450/yr) gives you unlimited watchlists, unlimited stocks per watchlist, unlimited price trigger alerts, everything in Premium, and early beta access to new features as they launch.",
                },
                {
                  q: "Does the portfolio dashboard update in real time?",
                  a: "Absolutely. The Portfolio Dashboard includes a 'Refresh All' button that fetches live prices and re-enriches sector data for all your holdings instantly. You get updated P&L figures, sector allocation recalculation, and diversity score adjustments — all in real time.",
                },
                {
                  q: "Which stock exchanges are supported?",
                  a: "EquityIQ tracks stocks listed on both NSE (National Stock Exchange) and BSE (Bombay Stock Exchange), covering 5,000+ Indian equities — including small-cap and micro-cap stocks.",
                },
                {
                  q: "How do price triggers work?",
                  a: "Set a target price on any stock. When the market price crosses your threshold (up or down), you receive an instant email notification — so you never miss a buy or sell opportunity. This feature is available on Premium and Premium Plus plans.",
                },
                {
                  q: "What are Smart Alerts?",
                  a: "Smart Alerts automatically scan your watchlist for meaningful market events — 52-week highs and lows, unusual volume spikes, and other anomalies — and surface them in real time. No setup required. Smart Alerts are included with Pro, Premium, and Premium Plus plans.",
                },
                {
                  q: "Can I filter stocks by price, volume, market cap, or P/E ratio?",
                  a: "Yes. Premium and Premium Plus subscribers get advanced filtering with min/max range controls on Price, Volume, Market Cap, and P/E ratio — directly from the watchlist column headers. Combine filters to narrow down to exactly the setups you want.",
                },
                {
                  q: "Is my data safe?",
                  a: "Absolutely. All your data: watchlists, notes, custom columns, and triggers — is encrypted and stored securely. We follow industry-standard security practices, and your data is never shared with third parties.",
                },
                {
                  q: "Can I cancel my subscription anytime?",
                  a: "Yes, cancel anytime with no questions asked. You'll retain access to all paid features until the end of your current billing period.",
                },
                {
                  q: "Does EquityIQ work on mobile?",
                  a: "Yes, EquityIQ is a mobile-first PWA that works seamlessly on any device. Open it in your phone's browser and tap 'Add to Home Screen' to install it like a native app, with offline support, portrait-locked layout, and fast loads. On mobile, swipe left on any card to remove it (with a 5-second Undo), and swipe right to instantly set a price trigger.",
                },
                {
                  q: "How does the interactive multi-day price chart work?",
                  a: "Tap any stock (or click the info icon on desktop) to open the detail sheet with a full interactive chart. Switch between 1D, 1W, 1M, and All-time ranges, and hover or touch the chart to see exact prices and dates with crosshair tooltips. Charts load instantly thanks to client-side caching, and price history is persisted to our database — so you see real multi-day trends, not session-reset sparklines.",
                },
              ].map((faq, i) => (
                <AccordionItem
                  key={i}
                  value={`faq-${i}`}
                  className="border border-border rounded-lg px-4 data-[state=open]:bg-background data-[state=open]:shadow-sm transition-shadow"
                >
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline py-4">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pb-4">
                    {faq.richAnswer || faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Support */}
      <section id="support" className="py-14 sm:py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Badge variant="secondary" className="mb-3">
              <LifeBuoy className="h-3 w-3 mr-1 text-primary" /> Support
            </Badge>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Need a hand?</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-3 max-w-xl mx-auto px-2">
              Questions about features, pricing, billing, or anything else? Reach out and we'll get back to you as soon
              as possible.
            </p>
            <a
              href="mailto:support@equityiq.in?subject=EquityIQ%20Support"
              className="inline-block mt-6 text-lg sm:text-xl font-semibold text-primary hover:text-primary/80 transition-colors break-all"
            >
              support@equityiq.in
            </a>
            <p className="text-xs text-muted-foreground mt-4">
              Typical response time: within 24 hours on business days.
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold">
              Equity<span className="text-primary">IQ</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => navigate("/auth")} className="hover:text-foreground transition-colors">
              Sign In
            </button>
            <button onClick={() => navigate("/subscribe")} className="hover:text-foreground transition-colors">
              Pricing
            </button>
            <a
              href="mailto:support@equityiq.in?subject=EquityIQ%20Support"
              className="hover:text-foreground transition-colors"
            >
              Support
            </a>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EquityIQ. All rights reserved.</p>
        </div>
      </footer>
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
};

export default Landing;
