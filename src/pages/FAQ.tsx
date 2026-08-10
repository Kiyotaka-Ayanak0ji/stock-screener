import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { TrendingUp, ArrowRight } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const FAQ_ITEMS: Array<{ q: string; a?: string | null; richAnswer?: React.ReactNode }> = [
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
            <strong className="text-foreground">Guest (Free)</strong>: 1 watchlist with up to 20 stocks,
            basic price data, light &amp; dark mode.
          </li>
          <li>
            <strong className="text-foreground">Pro ($5/mo or $50/yr)</strong>: Up to 5 watchlists × 20
            stocks, column customization, real-time updates.
          </li>
          <li>
            <strong className="text-foreground">Premium ($20/mo or $200/yr)</strong>: Up to 20 watchlists
            × 50 stocks, price trigger alerts with email, event tags, notes, export/share, portfolio
            dashboard with sector analysis.
          </li>
          <li>
            <strong className="text-foreground">Premium Plus ($40/mo or $400/yr)</strong>: Up to 50
            watchlists × 100 stocks, unlimited price trigger alerts, auto-refresh on reload, and
            everything in Premium.
          </li>
        </ul>
      </div>
    ),
  },
  {
    q: "What do I get during the 15-day free trial?",
    a: "During your trial, you unlock full Pro access: multiple watchlists, column customization, real-time price updates, Smart Alerts, and mobile swipe gestures with Undo. Premium features like the stock detail sheet, price triggers, event tags, notes, sharing, and portfolio analytics remain exclusive to Premium subscribers.",
  },
  {
    q: "What's included in the Premium plan?",
    a: "Premium unlocks the full EquityIQ experience: the interactive stock detail sheet, price trigger alerts with email notifications, event tagging & tracking, personal notes on every stock, export as image or PDF, shareable watchlist links, and the Portfolio Dashboard with real-time P&L tracking, sector allocation charts, and diversity scoring.",
  },
  {
    q: "Does the portfolio dashboard update in real time?",
    a: "The Portfolio Dashboard includes a 'Refresh All' button that fetches live prices and re-enriches sector data for all your holdings instantly. You get updated P&L figures, sector allocation recalculation, and diversity score adjustments.",
  },
  {
    q: "Which stock exchanges are supported?",
    a: "EquityIQ tracks stocks listed on both NSE (National Stock Exchange) and BSE (Bombay Stock Exchange), covering 5,000+ Indian equities, including small-cap and micro-cap stocks.",
  },
  {
    q: "How do price triggers work?",
    a: "Set a target price on any stock. When the market price crosses your threshold, you receive an email notification. Email notifications respect the Email Opt-In toggle in your Profile.",
  },
  {
    q: "What are Smart Alerts?",
    a: "Smart Alerts scan your watchlist during live market hours for meaningful events, strict session-high and session-low breaks, and unusual volume-flow spikes. Each event fires once per day per ticker with built-in cooldowns so your inbox stays signal, not noise. Email digests respect the Email Opt-In toggle in your Profile. Smart Alerts are included with Pro, Premium, and Premium Plus plans.",
  },
  {
    q: "Is there an option available to filter stocks?",
    a: "Yes. Premium and Premium Plus subscribers get advanced filtering with min/max range controls on Price, Volume, Market Cap, and P/E ratio, directly from the watchlist column headers. Combine filters to narrow down to exactly the setups you want.",
  },
  {
    q: "Is my data safe?",
    a: "Yes. Your watchlists, notes, custom columns and price triggers are encrypted before they are stored. Your data is never shared with third parties.",
  },
  {
    q: "Can I cancel my subscription anytime?",
    a: "Yes, cancel anytime with no questions asked. You'll retain access to all paid features until the end of your current billing period.",
  },
  {
    q: "Does EquityIQ work on mobile?",
    a: "Yes, EquityIQ is a mobile-first PWA that works on any device. Open it in your phone's browser and tap 'Add to Home Screen' to install it like a native app, with offline support and fast loads. On mobile, swipe left on any card to remove it (with a 5-second Undo), and swipe right to set a price trigger.",
  },
];

const FAQ = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

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

      <section className="pt-24 sm:pt-32 pb-14 sm:pb-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <div className="text-center mb-10 sm:mb-14">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">Frequently Asked Questions</h1>
          </div>

          <Accordion type="single" collapsible className="space-y-3">
            {FAQ_ITEMS.map((faq, i) => (
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
        </div>
      </section>
    </div>
  );
};

export default FAQ;
