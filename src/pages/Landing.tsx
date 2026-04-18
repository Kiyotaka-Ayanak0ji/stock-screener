import { useState } from "react";
import { useNavigate } from "react-router-dom";
import DemoModal from "@/components/DemoModal";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
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
  Zap,
  Check,
  Crown,
  Tag,
  SlidersHorizontal,
  Share2,
  FileDown,
  Users,
  X,
  Briefcase,
  Filter,
  Sparkles,
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
      "Organize stocks into separate watchlists — one for swing trades, another for long-term picks, and more. Stay organized, stay sharp.",
  },
  {
    icon: SlidersHorizontal,
    title: "Custom Columns & Notes",
    description:
      "Add personal notes to any stock and toggle column visibility to see only the data that matters to you.",
    badge: "Premium",
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
      "Automatic anomaly detection across your watchlist — 52-week highs/lows and unusual volume spikes flagged in real time so you spot moves the moment they happen.",
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
    description:
      "Track your actual holdings with buy price, quantity, and real-time P&L. Visualize sector allocation, company details, and stock-wise performance.",
    badge: "Premium",
  },
];

const STATS = [
  { value: "5,000+", label: "Stocks Tracked" },
  { value: "< 1s", label: "Price Refresh" },
  { value: "NSE & BSE", label: "Exchanges" },
  { value: "99.9%", label: "Uptime" },
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
              Equity<span className="text-primary">Lens</span>
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
      <section className="pt-24 sm:pt-32 pb-14 sm:pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium">
              <Zap className="h-3 w-3 mr-1.5 text-primary" />
              15 days free trial
            </Badge>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={1}
          >
            Your Stocks. <br className="hidden sm:block" />
            Your Rules. <span className="text-primary">Your Edge.</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={2}
          >
            EquityLens is the smarter way to manage and track all your stocks. Set custom price triggers, tag events,
            build watchlists, track your portfolio performance — all in one clean, powerful dashboard.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={3}
          >
            <Button size="lg" className="px-8 text-base shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 active:scale-[0.97] transition-all" onClick={() => navigate("/auth")}>
              Start Free Trial <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="px-8 text-base hover:bg-accent/10 active:scale-[0.97] transition-all" onClick={() => setDemoOpen(true)}>
              <Eye className="h-5 w-5 mr-2" /> View Demo
            </Button>
            <Button
              size="lg"
              variant="ghost"
              className="px-8 text-base active:scale-[0.97] transition-all"
              onClick={() => {
                document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              See Features
            </Button>
          </motion.div>

          <motion.p
            className="mt-4 text-xs text-muted-foreground"
            initial="hidden"
            animate="visible"
            variants={fadeUp}
            custom={4}
          >
            Join thousands of Indian investors making smarter decisions
          </motion.p>
        </div>
      </section>

      {/* Stats bar */}
      <section className="border-y border-border bg-muted/50">
        <div className="max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-6 py-10 px-4">
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
              <p className="text-3xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Problem / Story */}
      <section className="py-20 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={0}
          >
            Stop juggling five apps to track your stocks
          </motion.h2>
          <motion.p
            className="mt-6 text-muted-foreground text-lg leading-relaxed"
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true }}
            variants={fadeUp}
            custom={1}
          >
            You check Groww for prices, set alarms in a notes app, maintain an Excel sheet for your watchlist, and
            screenshot charts to share with friends. Sound familiar?{" "}
            <span className="text-foreground font-semibold">EquityLens brings everything into one place</span> — so you
            spend less time managing tools and more time making decisions.
          </motion.p>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 bg-muted/30">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-3">
              <Star className="h-3 w-3 mr-1 text-primary" /> Features
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Everything you need. Nothing you don't.</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Built by investors, for investors. Every feature is designed to give you an edge.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                variants={fadeUp}
                custom={i}
              >
                <Card className="h-full border-border hover:border-primary/40 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group relative">
                  {(f as any).badge && (
                    <Badge className="absolute top-3 right-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[10px]">
                      <Crown className="h-2.5 w-2.5 mr-1" />
                      {(f as any).badge}
                    </Badge>
                  )}
                  <CardContent className="p-6">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 group-hover:scale-110 transition-all duration-300">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold">Get started in 60 seconds</h2>
            <p className="mt-3 text-muted-foreground">No credit card. No complicated setup.</p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
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
                desc: "Configure price alerts and let EquityLens notify you. Upgrade to Premium for price triggers, event tags, notes, and portfolio tracking.",
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
                <div className="text-5xl font-extrabold text-primary/15 mb-3 group-hover:text-primary/25 transition-colors">{item.step}</div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-3">
              <Crown className="h-3 w-3 mr-1 text-primary" /> Pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Simple pricing. Serious value.</h2>
            <p className="mt-3 text-muted-foreground">
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

          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {/* Free / Guest */}
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg">Guest</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">Free</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Limited access</p>
                <ul className="mt-6 space-y-2.5">
                  {[
                    "Up to 20 stocks in watchlist",
                    "Basic price data (NSE & BSE)",
                    "Single default watchlist",
                    "Light & dark mode",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                  {[
                    "Smart Alerts",
                    "Advanced filters (Price, Volume, P/E, Market Cap)",
                    "Price triggers & email alerts",
                    "Event tags & notes",
                    "Export & sharing",
                    "Portfolio dashboard",
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-6 active:scale-[0.97] transition-all" variant="outline" onClick={() => navigate("/auth")}>
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
                  {["Advanced filters (Premium)", "Export & sharing", "Price triggers & alerts", "Event tags & notes", "Portfolio dashboard"].map(
                    (f) => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                        {f}
                      </li>
                    ),
                  )}
                </ul>
                <Button className="w-full mt-6 active:scale-[0.97] transition-all" variant="outline" onClick={() => navigate("/subscribe")}>
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
                  {PREMIUM_EXTRAS.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-6 shadow-lg shadow-primary/20 hover:shadow-xl active:scale-[0.97] transition-all" onClick={() => navigate("/subscribe")}>
                  Get Premium <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Downloads */}
      <section id="downloads" className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-3">
              <Smartphone className="h-3 w-3 mr-1 text-primary" /> Download
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Get EquityLens on Your Device</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Track your stocks natively on Windows or Android — same powerful features, optimized for your platform.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Windows */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
              <Card className="border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary" fill="currentColor">
                      <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">Windows</h3>
                  <p className="text-sm text-muted-foreground">Desktop app for Windows 10/11 (x64)</p>
                  <Button
                    className="w-full active:scale-[0.97] transition-all gap-2"
                    onClick={() => window.open("https://github.com/nicholasxdavis/EquityLens/releases/latest", "_blank")}
                  >
                    <FileDown className="h-4 w-4" /> Download for Windows
                  </Button>
                  <p className="text-xs text-muted-foreground">.exe installer · ~80 MB</p>
                </CardContent>
              </Card>
            </motion.div>

            {/* Android */}
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={1}>
              <Card className="border-border hover:shadow-lg hover:-translate-y-1 transition-all duration-300">
                <CardContent className="p-8 text-center space-y-4">
                  <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <svg viewBox="0 0 24 24" className="h-7 w-7 text-primary" fill="currentColor">
                      <path d="M17.523 15.341a.96.96 0 0 0-.96.96v3.168a.96.96 0 1 0 1.92 0v-3.168a.96.96 0 0 0-.96-.96zm-11.046 0a.96.96 0 0 0-.96.96v3.168a.96.96 0 1 0 1.92 0v-3.168a.96.96 0 0 0-.96-.96zM15.165 5.344l1.29-2.344a.269.269 0 0 0-.468-.268l-1.308 2.376A7.95 7.95 0 0 0 12 4.476a7.95 7.95 0 0 0-2.679.632L8.013 2.732a.269.269 0 0 0-.468.268l1.29 2.344C6.567 6.512 5.133 8.748 5.133 11.34h13.734c0-2.592-1.434-4.828-3.702-5.996zM9.504 9.18a.72.72 0 1 1 .001-1.44.72.72 0 0 1-.001 1.44zm4.992 0a.72.72 0 1 1 .001-1.44.72.72 0 0 1-.001 1.44zM5.133 12.54v7.776a1.2 1.2 0 0 0 1.2 1.2h1.08v2.52a.96.96 0 1 0 1.92 0v-2.52h3.334v2.52a.96.96 0 1 0 1.92 0v-2.52h1.08a1.2 1.2 0 0 0 1.2-1.2V12.54H5.133z"/>
                    </svg>
                  </div>
                  <h3 className="text-xl font-bold">Android</h3>
                  <p className="text-sm text-muted-foreground">Native app for Android 8.0+</p>
                  <Button
                    className="w-full active:scale-[0.97] transition-all gap-2"
                    onClick={() => window.open("https://github.com/nicholasxdavis/EquityLens/releases/latest", "_blank")}
                  >
                    <FileDown className="h-4 w-4" /> Download for Android
                  </Button>
                  <p className="text-xs text-muted-foreground">.apk file · ~25 MB</p>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-20 px-4 bg-muted/30">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-3">
              <HelpCircle className="h-3 w-3 mr-1 text-primary" /> FAQ
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">Frequently Asked Questions</h2>
            <p className="mt-3 text-muted-foreground">Everything you need to know before getting started</p>
          </div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <Accordion type="single" collapsible className="space-y-3">
              {[
                {
                  q: "Is EquityLens free to use?",
                  a: "Yes! Sign up and get a 15-day free trial with full Pro-level access. No credit card required. After the trial, choose a plan that suits your needs or continue with the free Guest tier.",
                },
                {
                  q: "What plans are available and what's included?",
                  a: null,
                  richAnswer: (
                    <div className="space-y-2">
                      <p>We offer three tiers:</p>
                      <ul className="list-disc list-inside space-y-1.5 ml-1">
                        <li><strong className="text-foreground">Guest (Free)</strong> — 1 watchlist with up to 20 stocks, basic price data, light &amp; dark mode.</li>
                        <li><strong className="text-foreground">Pro ($5/mo or $50/yr)</strong> — Up to 5 watchlists × 20 stocks, column customization, real-time updates.</li>
                        <li><strong className="text-foreground">Premium ($20/mo or $200/yr)</strong> — Up to 20 watchlists × 50 stocks, price trigger alerts with email, event tags, notes, export/share, portfolio dashboard with sector analysis.</li>
                      </ul>
                    </div>
                  ),
                },
                {
                  q: "What do I get during the 15-day free trial?",
                  a: "During your trial, you unlock full Pro access — multiple watchlists, column customization, and real-time price updates. Premium features like price triggers, event tags, notes, sharing, and portfolio analytics are exclusive to Premium subscribers.",
                },
                {
                  q: "What's included in the Premium plan?",
                  a: "Premium unlocks the full EquityLens experience: price trigger alerts with email notifications, event tagging & tracking, personal notes on every stock, export as image or PDF, shareable watchlist links, and the Portfolio Dashboard — complete with real-time P&L tracking, sector allocation charts, diversity scoring, and a one-click 'Refresh All' button.",
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
                  a: "EquityLens tracks stocks listed on both NSE (National Stock Exchange) and BSE (Bombay Stock Exchange), covering 5,000+ Indian equities — including small-cap and micro-cap stocks.",
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
                  q: "Can I share my watchlist with others?",
                  a: "Yes! Premium users can generate a unique shareable link for any watchlist, or export it as a high-quality image or a professional PDF report — perfect for sharing with friends, family, or clients.",
                },
                {
                  q: "Is my data safe?",
                  a: "Absolutely. All your data — watchlists, notes, custom columns, and triggers — is encrypted and stored securely. We follow industry-standard security practices, and your data is never shared with third parties.",
                },
                {
                  q: "Can I cancel my subscription anytime?",
                  a: "Yes, cancel anytime with no questions asked. You'll retain access to all paid features until the end of your current billing period.",
                },
                {
                  q: "Does EquityLens work on mobile?",
                  a: "Yes! EquityLens is available as a native Android app and a Windows desktop app. Download the APK for Android or the installer for Windows from our Downloads section above. Both versions deliver the full EquityLens experience optimized for your platform.",
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
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line pb-4">{faq.richAnswer || faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>


      {/* Footer */}
      <footer className="border-t border-border py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold">
              Equity<span className="text-primary">Lens</span>
            </span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => navigate("/auth")} className="hover:text-foreground transition-colors">
              Sign In
            </button>
            <button onClick={() => navigate("/subscribe")} className="hover:text-foreground transition-colors">
              Pricing
            </button>
          </div>
          <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} EquityLens. All rights reserved.</p>
        </div>
      </footer>
      <DemoModal open={demoOpen} onOpenChange={setDemoOpen} />
    </div>
  );
};

export default Landing;
