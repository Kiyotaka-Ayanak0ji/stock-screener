import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight, BarChart3, Bell, Eye, Layers, LineChart, Lock,
  Shield, Smartphone, Star, TrendingUp, Zap, Check, Crown,
  Tag, SlidersHorizontal, Share2, FileDown, Users
} from "lucide-react";
import { motion } from "framer-motion";

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
  },
  {
    icon: Tag,
    title: "Event Tagging & Labels",
    description: "Tag stocks with custom labels like 'Earnings Soon', 'Breakout Watch', or 'Long-term Hold'. Sort and filter your watchlist instantly.",
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
  },
  {
    icon: Share2,
    title: "Share & Export",
    description: "Share your watchlist with friends via a unique link, or export it as a high-quality image or PDF report.",
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
    review: "EquityIQ replaced three apps for me. The price triggers alone saved me from missing a breakout I'd been watching for weeks.",
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
    review: "The ability to share watchlists with clients as clean PDF reports? Game changer. My clients think I hired a designer.",
  },
];

const Landing = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [testimonials, setTestimonials] = useState(FALLBACK_TESTIMONIALS);

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
              Equity<span className="text-primary">IQ</span>
            </span>
          </div>
          <div className="flex items-center gap-3">
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
              30 days free trial — no credit card required
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
            EquityIQ is the smarter way to manage and track all your stocks.
            Set custom price triggers, tag events, build watchlists, and export
            professional reports — all in one clean, powerful dashboard.
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
              EquityIQ brings everything into one place
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

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f.title}
                initial="hidden" whileInView="visible" viewport={{ once: true }}
                variants={fadeUp} custom={i}
              >
                <Card className="h-full border-border hover:border-primary/40 transition-colors group">
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
              { step: "01", title: "Create your free account", desc: "Sign up with your email and get 30 days of full access — every feature unlocked." },
              { step: "02", title: "Build your watchlists", desc: "Search from 5,000+ NSE & BSE stocks and add them to organized watchlists with tags." },
              { step: "03", title: "Set triggers & relax", desc: "Configure price alerts and let EquityIQ notify you. No more staring at screens all day." },
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
      <section className="py-20 px-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <Badge variant="secondary" className="mb-3">
              <Crown className="h-3 w-3 mr-1 text-primary" /> Pricing
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold">
              Simple pricing. Serious value.
            </h2>
            <p className="mt-3 text-muted-foreground">
              Start free for 30 days. Cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-2xl mx-auto">
            {/* Monthly */}
            <Card className="border-border">
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg">Monthly</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">$5</span>
                  <span className="text-muted-foreground text-sm">/month</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Billed monthly in INR</p>
                <ul className="mt-6 space-y-2.5">
                  {["All premium features", "Email price alerts", "Unlimited watchlists", "Export & sharing"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-6" variant="outline" onClick={() => navigate("/subscribe")}>
                  Get Started
                </Button>
              </CardContent>
            </Card>

            {/* Yearly */}
            <Card className="border-primary ring-2 ring-primary/20 relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="bg-primary text-primary-foreground text-xs px-3">
                  SAVE 67%
                </Badge>
              </div>
              <CardContent className="p-6">
                <h3 className="font-semibold text-lg">Yearly</h3>
                <div className="mt-3 flex items-baseline gap-1">
                  <span className="text-4xl font-extrabold">$20</span>
                  <span className="text-muted-foreground text-sm">/year</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Just $1.67/month · Billed in INR</p>
                <ul className="mt-6 space-y-2.5">
                  {["Everything in Monthly", "Best value — 67% off", "Priority email support", "Early access to new features"].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className="w-full mt-6" onClick={() => navigate("/subscribe")}>
                  Get Started <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </CardContent>
            </Card>
          </div>
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
            Join EquityIQ today and see why thousands of investors trust us to stay ahead of the market.
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
              Start Your Free 30-Day Trial <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </motion.div>
          <motion.p
            className="mt-3 text-xs text-primary-foreground/60"
            initial="hidden" whileInView="visible" viewport={{ once: true }}
            variants={fadeUp} custom={3}
          >
            No credit card required · Cancel anytime · Full access from day one
          </motion.p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border py-10 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            <span className="font-bold">Equity<span className="text-primary">IQ</span></span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <button onClick={() => navigate("/auth")} className="hover:text-foreground transition-colors">Sign In</button>
            <button onClick={() => navigate("/subscribe")} className="hover:text-foreground transition-colors">Pricing</button>
          </div>
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} EquityIQ. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
