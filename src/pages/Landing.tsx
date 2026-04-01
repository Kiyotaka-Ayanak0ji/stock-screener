import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { HelpCircle } from "lucide-react";
import {
  ArrowRight, BarChart3, Bell, Eye, Layers, LineChart, Lock,
  Shield, Smartphone, Star, TrendingUp, Zap, Check, Crown,
  Tag, SlidersHorizontal, Share2, FileDown, Users, X, Briefcase
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.1, duration: 0.5, ease: "easeOut" as const },
  }),
};

const FEATURES = [
  {
    icon: TrendingUp,
    title: "Real-Time Price Tracking",
    description: "Watch your portfolio move in real time with live price updates, change percentages, and volume data across NSE & BSE.",
  },
  {
    icon: Bell,
    title: "Custom Price Triggers",
    description: "Set upper and lower price alerts on any stock. Get notified via email the moment your target price is hit — never miss an entry or exit.",
    badge: "Premium",
  },
  {
    icon: Tag,
    title: "Event Tagging & Labels",
    description: "Tag stocks with custom labels like 'Earnings Soon', 'Breakout Watch', or 'Long-term Hold'. Sort and filter your watchlist instantly.",
    badge: "Premium",
  },
  {
    icon: Layers,
    title: "Multiple Watchlists",
    description: "Organize stocks into separate watchlists — one for swing trades, another for long-term picks, and more. Stay organized, stay sharp.",
  },
  {
    icon: SlidersHorizontal,
    title: "Custom Columns & Notes",
    description: "Add personal notes to any stock and toggle column visibility to see only the data that matters to you.",
    badge: "Premium",
  },
  {
    icon: Share2,
    title: "Share & Export",
    description: "Share your watchlist with friends via a unique link, or export it as a high-quality image or PDF report.",
  },
  {
    icon: Briefcase,
    title: "Portfolio Dashboard",
    description: "Track your actual holdings with buy price, quantity, and real-time P&L. Visualize sector allocation, company fundamentals, and stock-wise performance.",
    badge: "Premium",
  },
];

const STATS = [
  { value: "5,000+", label: "Stocks Tracked" },
  { value: "< 1s", label: "Price Refresh" },
  { value: "NSE & BSE", label: "Exchanges" },
  { value: "99.9%", label: "Uptime" },
];

const FALLBACK_TESTIMONIALS = [
  {
    display_name: "Rahul M.",
    designation: "Swing Trader",
    rating: 5,
    review: "EquityLens replaced three apps for me. The price triggers alone saved me from missing a breakout I'd been watching for weeks.",
  },
  {
    display_name: "Priya S.",
    designation: "Long-term Investor",
    rating: 5,
    review: "I love the event tagging. I label all my stocks with dividend dates and earnings calls — it's like having a personal assistant.",
  },
  {
    display_name: "Arjun K.",
    designation: "Portfolio Manager",
    rating: 5,
    review: "The portfolio dashboard with sector allocation changed how I manage my investments. The fundamentals snapshot keeps me informed.",
  },
];

const PRO_FEATURES = [
  "Up to 5 watchlists",
  "20 stocks per watchlist",
  "Column visibility customization",
  "Multiple watchlists",
  "Real-time price updates",
];

const PREMIUM_EXTRAS = [
  "Everything in Pro",
  "Up to 20 watchlists",
  "50 stocks per watchlist",
  "Export as Image & PDF",
  "Shareable watchlist links",
  "Price trigger alerts with email",
  "Event tagging & tracking",
  "Notes on stocks",
  "Portfolio performance dashboard",
  "Sector allocation & fundamentals",
  "Stock-wise P&L charts",
  "Priority email support",
  "Early access to new features",
];

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState(FALLBACK_TESTIMONIALS);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    const fetchReviews = async () => {
      const { data } = await supabase
        .from("app_reviews")
        .select("display_name, designation, rating, review")
        .eq("is_approved", true)
        .order("created_at", { ascending: false })
        .limit(6);
      if (data && data.length > 0) {
        setTestimonials(data);
      }
    };
    fetchReviews();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-background/80 backdrop-blur-lg border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 h-16">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-primary" />
            <span className="text-lg font-bold tracking-tight">
              Equity<span className="text-primary">Lens</span>
            </span>
          </div>
          <div className="flex items-center gap-1 sm:gap-3">
            <Button variant="ghost" size="sm" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>
              Features
            </Button>
            <Button variant="ghost" size="sm" onClick={() => document.getElementById("pricing")?.scrollIntoView({ behavior: "smooth" })}>
              Pricing
            </Button>
            <Button variant="ghost" size="sm" onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}>
              FAQ
            </Button>
            {user ? (
              <Button onClick={() => navigate("/dashboard")} size="sm">
                Go to Dashboard <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate("/auth")}>
                  Sign In
                </Button>
                <Button size="sm" onClick={() => navigate("/auth")}>
                  Get Started Free <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </>
            )}
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-32 pb-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={0}>
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium">
              <Zap className="h-3 w-3 mr-1.5 text-primary" />
              15 days free trial — no credit card required
            </Badge>
          </motion.div>

          <motion.h1
            className="text-4xl sm:text-5xl md:text-6xl font-extrabold leading-tight tracking-tight"
            initial="hidden" animate="visible" variants={fadeUp} custom={1}
          >
            Your Stocks. <br className="hidden sm:block" />
            Your Rules.{" "}
            <span className="text-primary">Your Edge.</span>
          </motion.h1>

          <motion.p
            className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed"
            initial="hidden" animate="visible" variants={fadeUp} custom={2}
          >
            EquityLens is the smarter way to manage and track all your stocks.
            Set custom price triggers, tag events, build watchlists,
            track your portfolio performance — all in one clean, powerful dashboard.
          </motion.p>

          <motion.div
            className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            initial="hidden" animate="visible" variants={fadeUp} custom={3}
          >
            <Button size="lg" className="px-8 text-base" onClick={() => navigate("/auth")}>
              Start Free Trial <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
            <Button size="lg" variant="outline" className="px-8 text-base" onClick={() => {
              document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
            }}>
              See Features
            </Button>
          </motion.div>

          <motion.p
            className="mt-4 text-xs text-muted-foreground"
            initial="hidden" animate="visible" variants={fadeUp} custom={4}
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
              initial="hidden" whileInView="visible" viewport={{ once: true }}
              variants={fadeUp} custom={i}
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
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            Stop juggling five apps to track your stocks
          </motion.h2>
          <motion.p
            className="mt-6 text-muted-foreground text-lg leading-relaxed"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={1}
          >
            You check Groww for prices, set alarms in a notes app, maintain an
            Excel sheet for your watchlist, and screenshot charts to share with
            friends. Sound familiar?{" "}
            <span className="text-foreground font-semibold">
              EquityLens brings everything into one place
            </span>{" "}
            — so you spend less time managing tools and more time making decisions.
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
            <h2 className="text-3xl sm:text-4xl font-bold">
              Everything you need. Nothing you don't.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Built by investors, for investors. Every feature is designed to give you an edge.
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <Card className="h-full border-border hover:border-primary/40 transition-colors group relative">
                  {(f as any).badge && (
                    <Badge className="absolute top-3 right-3 bg-amber-500/10 text-amber-600 dark:text-amber-400 border-0 text-[10px]">
                      <Crown className="h-2.5 w-2.5 mr-1" />
                      {(f as any).badge}
                    </Badge>
                  )}
                  <CardContent className="p-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {f.description}
                    </p>
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
              { step: "01", title: "Create your free account", desc: "Sign up with your email and get 15 days of Pro-level access — most features unlocked, no credit card needed." },
              { step: "02", title: "Build your watchlists", desc: "Search from 5,000+ NSE & BSE stocks and add them to organized watchlists with tags and custom notes." },
              { step: "03", title: "Set triggers & relax", desc: "Configure price alerts and let EquityLens notify you. Upgrade to Premium for price triggers, event tags, notes, and portfolio tracking." },
            ].map((item, i) => (
              <motion.div
                key={item.step}
                className="text-center"
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <div className="text-5xl font-extrabold text-primary/20 mb-3">{item.step}</div>
                <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold">Loved by investors</h2>
            <p className="mt-3 text-muted-foreground">Here's what our users say</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.display_name + i}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <Card className="h-full">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-4">
                      {[...Array(t.rating)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-primary text-primary" />
                      ))}
                      {[...Array(5 - t.rating)].map((_, j) => (
                        <Star key={`empty-${j}`} className="h-4 w-4 text-muted-foreground/30" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed italic mb-4">
                      "{t.review}"
                    </p>
                    <div>
                      <p className="font-semibold text-sm">{t.display_name}</p>
                      {t.designation && (
                        <p className="text-xs text-muted-foreground">{t.designation}</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
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
            <h2 className="text-3xl sm:text-4xl font-bold">
              Simple pricing. Serious value.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Start free for 15 days. Choose the plan that fits your trading style.
            </p>

            {/* Billing Cycle Toggle */}
            <div className="flex items-center justify-center gap-1 mt-6 bg-muted rounded-full p-1 w-fit mx-auto relative">
              <button
                onClick={() => setBillingCycle("monthly")}
                className="relative z-10 px-5 py-1.5 rounded-full text-sm font-medium transition-colors"
                style={{ color: billingCycle === "monthly" ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}
              >
                Monthly
              </button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className="relative z-10 px-5 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5"
                style={{ color: billingCycle === "yearly" ? "hsl(var(--primary-foreground))" : "hsl(var(--muted-foreground))" }}
              >
                Yearly
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-600 dark:text-green-400 border-0">
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
                  {["Up to 20 stocks in watchlist", "Basic price data (NSE & BSE)", "Single default watchlist", "Light & dark mode"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                  {["Price triggers & email alerts", "Event tags & notes", "Export & sharing", "Portfolio dashboard"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-6" variant="outline" onClick={() => navigate("/auth")}>
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
                    <motion.p key="yearly-savings" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="text-xs text-green-600 dark:text-green-400 mt-1">~$4.17/mo — save $10/year</motion.p>
                  ) : (
                    <motion.p key="monthly-hint" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="text-xs text-muted-foreground mt-1">or <strong>$50/year</strong> (save 17%)</motion.p>
                  )}
                </AnimatePresence>
                <ul className="mt-6 space-y-2.5">
                  {PRO_FEATURES.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                  {["Export & sharing", "Price triggers & alerts", "Event tags & notes", "Portfolio dashboard"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-6" variant="outline" onClick={() => navigate("/subscribe")}>
                  Get Pro
                </Button>
              </CardContent>
            </Card>

            {/* Premium */}
            <Card className="border-primary ring-2 ring-primary/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground text-xs px-3">
                  BEST VALUE
                </Badge>
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
                    <motion.p key="yearly-savings-p" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="text-xs text-green-600 dark:text-green-400 mt-1">~$16.67/mo — save $40/year</motion.p>
                  ) : (
                    <motion.p key="monthly-hint-p" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="text-xs text-muted-foreground mt-1">or <strong>$200/year</strong> (save 17%)</motion.p>
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
                <Button className="w-full mt-6" onClick={() => navigate("/subscribe")}>
                  Get Premium <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
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
                  a: "Yes! You can start with a 15-day free trial that gives you full Pro-level access — no credit card required. Guests can also browse with a limited 20-stock watchlist without signing up.",
                },
                {
                  q: "What are the available plans?",
                  a: "EquityLens has three tiers: Free (limited access, 20 stocks), Pro ($5/month or $50/year — up to 5 watchlists with 20 stocks each, column customization, and real-time updates), and Premium ($20/month or $200/year — up to 20 watchlists with 50 stocks each, export/share, price triggers, event tags, notes, and portfolio performance dashboard).",
                },
                {
                  q: "What do I get during the 15-day free trial?",
                  a: "During your trial you get full Pro access — up to 5 watchlists with 20 stocks each, custom columns, and real-time updates. Premium-exclusive features like price triggers, event tags, notes, export/share, and portfolio management require a Premium subscription.",
                },
                {
                  q: "What Premium-only features are available?",
                  a: "Premium subscribers unlock price trigger alerts with email notifications, event tagging, stock notes, export as image/PDF, shareable watchlist links, and the portfolio performance dashboard with real-time P&L tracking, sector allocation charts, stock-wise gain/loss analysis, and a diversity score based on the Herfindahl-Hirschman Index.",
                },
                {
                  q: "Which stock exchanges does EquityLens support?",
                  a: "EquityLens tracks stocks listed on both the NSE (National Stock Exchange) and BSE (Bombay Stock Exchange), covering 5,000+ Indian equities including small-cap and micro-cap stocks.",
                },
                {
                  q: "How accurate are the stock prices?",
                  a: "We source data from multiple providers with real-time fallbacks to ensure 98–99% accuracy. Prices refresh in under a second during market hours.",
                },
                {
                  q: "What are price triggers and how do they work?",
                  a: "Price triggers let you set upper and lower price thresholds on any stock. When the stock hits your target, you'll receive an email notification so you never miss an entry or exit opportunity. Available on Premium plans.",
                },
                {
                  q: "Can I share my watchlist with others?",
                  a: "Yes! Premium subscribers can generate a unique shareable link for any watchlist, or export it as a high-quality image or professional PDF report to share with friends, family, or clients.",
                },
                {
                  q: "Is my data safe and private?",
                  a: "All user data — including watchlists, notes, and custom columns — is encrypted before being stored. We use industry-standard security practices and your data is never shared with third parties.",
                },
                {
                  q: "Can I cancel my subscription anytime?",
                  a: "Yes, you can cancel anytime with no questions asked. You'll continue to have access until the end of your billing period.",
                },
              ].map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4 data-[state=open]:bg-background">
                  <AccordionTrigger className="text-left text-sm font-medium hover:no-underline">
                    {faq.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground leading-relaxed">
                    {faq.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </motion.div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto text-center">
          <motion.h2
            className="text-3xl sm:text-4xl font-bold"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={0}
          >
            Ready to take control of your portfolio?
          </motion.h2>
          <motion.p
            className="mt-4 text-primary-foreground/80 text-lg"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={1}
          >
            Join EquityLens today and see why thousands of investors trust us to stay ahead of the market.
          </motion.p>
          <motion.div
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={2}
          >
            <Button
              size="lg"
              variant="secondary"
              className="mt-8 px-10 text-base"
              onClick={() => navigate("/auth")}
            >
              Start Your Free 15-Day Trial <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </motion.div>
          <motion.p
            className="mt-3 text-xs text-primary-foreground/60"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={3}
          >
            No credit card required · Cancel anytime · Pro access from day one
          </motion.p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold">Equity<span className="text-primary">Lens</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => navigate("/auth")} className="hover:text-foreground transition-colors">Sign In</button>
            <button onClick={() => navigate("/subscribe")} className="hover:text-foreground transition-colors">Pricing</button>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} EquityLens. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
