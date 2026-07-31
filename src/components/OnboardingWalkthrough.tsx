import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Check, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface Step {
  selector: string;
  title: string;
  body: string;
}

const STEPS: Step[] = [
  {
    selector: '[data-tour="search"]',
    title: "1. Search for stocks",
    body: "Open this panel to search any NSE or BSE listed company by ticker or name. Results come from your local universe plus a live Screener.in lookup.",
  },
  {
    selector: '[data-tour="filter"]',
    title: "2. Filter your list",
    body: "Narrow the table down by data completeness, price, volume, market cap or P/E. Filters stack with search and sorting.",
  },
  {
    selector: '[data-tour="sort"]',
    title: "3. Sort the table",
    body: "Click a column header (or the Sort menu on mobile) to order stocks by ticker, price, change, volume or market cap. Click again to flip the direction.",
  },
  {
    selector: '[data-tour="add-stock"]',
    title: "4. Add a stock",
    body: "Pick a result from the search panel and it is added to the active watchlist instantly, then priced on the next refresh.",
  },
  {
    selector: '[data-tour="remove-stock"]',
    title: "5. Remove a stock",
    body: "Use the delete icon on a row (or swipe a card on mobile) to drop a stock from the current watchlist.",
  },
  {
    selector: '[data-tour="favourite"]',
    title: "6. Mark a favourite",
    body: "Tap the star to keep a stock in your favourites. Favourites are saved to your account and follow you across devices.",
  },
  {
    selector: '[data-tour="favourites-nav"]',
    title: "7. Open Favourites",
    body: "All your starred stocks live on the Favourites page — available on every plan, free included.",
  },
];

const LS_KEY = "eq_onboarding_done";
const REPLAY_KEY = "eq_onboarding_replay";

interface Rect { top: number; left: number; width: number; height: number }

const PADDING = 8;

const OnboardingWalkthrough = () => {
  const { user, isLoading } = useAuth();
  const [active, setActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Decide whether the walkthrough should run for this user.
  useEffect(() => {
    if (isLoading || !user) return;
    let cancelled = false;

    const start = () => {
      if (cancelled) return;
      setStepIndex(0);
      setActive(true);
    };

    const replay = localStorage.getItem(REPLAY_KEY) === "1";
    if (replay) {
      localStorage.removeItem(REPLAY_KEY);
      start();
      return;
    }

    if (localStorage.getItem(`${LS_KEY}_${user.id}`) === "1") return;

    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("onboarding_completed")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      if (data?.onboarding_completed) {
        localStorage.setItem(`${LS_KEY}_${user.id}`, "1");
        return;
      }
      start();
    })();

    return () => { cancelled = true; };
  }, [user, isLoading]);

  const persistCompletion = useCallback(async () => {
    if (!user) return;
    localStorage.setItem(`${LS_KEY}_${user.id}`, "1");
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("user_id", user.id);
  }, [user]);

  const finish = useCallback(() => {
    setActive(false);
    setRect(null);
    void persistCompletion();
  }, [persistCompletion]);

  // Track the highlighted element.
  const measure = useCallback(() => {
    if (!active) return;
    const el = document.querySelector(STEPS[stepIndex].selector) as HTMLElement | null;
    if (!el) { setRect(null); return; }
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) { setRect(null); return; }
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [active, stepIndex]);

  useLayoutEffect(() => {
    if (!active) return;
    const el = document.querySelector(STEPS[stepIndex].selector) as HTMLElement | null;
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    measure();
    const t = setTimeout(measure, 350);
    return () => clearTimeout(t);
  }, [active, stepIndex, measure]);

  useEffect(() => {
    if (!active) return;
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    const interval = setInterval(measure, 500);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
      clearInterval(interval);
    };
  }, [active, measure]);

  // Keyboard support
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); finish(); }
      if (e.key === "ArrowRight") { e.preventDefault(); setStepIndex(i => Math.min(i + 1, STEPS.length - 1)); }
      if (e.key === "ArrowLeft") { e.preventDefault(); setStepIndex(i => Math.max(i - 1, 0)); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, finish]);

  useEffect(() => {
    if (active) cardRef.current?.focus();
  }, [active, stepIndex]);

  if (!active) return null;

  const step = STEPS[stepIndex];
  const isLast = stepIndex === STEPS.length - 1;

  // Position the instruction card: below the target when there is room,
  // otherwise above it; centred when no target is on screen.
  const viewportH = window.innerHeight;
  const viewportW = window.innerWidth;
  const cardWidth = Math.min(340, viewportW - 24);
  let cardStyle: React.CSSProperties = {
    top: viewportH / 2 - 100,
    left: Math.max(12, viewportW / 2 - cardWidth / 2),
    width: cardWidth,
  };
  if (rect) {
    const below = rect.top + rect.height + PADDING + 12;
    const spaceBelow = viewportH - (rect.top + rect.height);
    const top = spaceBelow > 220 ? below : Math.max(12, rect.top - 212);
    const left = Math.min(
      Math.max(12, rect.left + rect.width / 2 - cardWidth / 2),
      viewportW - cardWidth - 12,
    );
    cardStyle = { top, left, width: cardWidth };
  }

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="dialog" aria-modal="true" aria-label="Product walkthrough">
      {/* Dimmed backdrop with a spotlight cut-out around the target */}
      {rect ? (
        <div
          className="fixed rounded-lg pointer-events-none transition-all duration-200"
          style={{
            top: rect.top - PADDING,
            left: rect.left - PADDING,
            width: rect.width + PADDING * 2,
            height: rect.height + PADDING * 2,
            boxShadow: "0 0 0 9999px hsl(var(--background) / 0.82)",
            outline: "2px solid hsl(var(--primary))",
            outlineOffset: "2px",
          }}
        />
      ) : (
        <div className="fixed inset-0 bg-background/82" />
      )}

      {/* Click-blocking layer so the tour doesn't get lost mid-flow */}
      <div className="fixed inset-0" onClick={(e) => e.stopPropagation()} />

      <div
        ref={cardRef}
        tabIndex={-1}
        className="fixed rounded-xl border border-border bg-card p-4 shadow-xl outline-none"
        style={cardStyle}
      >
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-semibold text-foreground">{step.title}</p>
          <button
            onClick={finish}
            aria-label="Skip walkthrough"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{step.body}</p>

        <div className="mt-3 flex items-center gap-1" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 flex-1 rounded-full ${i <= stepIndex ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <span className="text-[11px] text-muted-foreground">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <div className="flex items-center gap-1.5">
            <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={finish}>
              Skip
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 gap-1 text-xs"
              onClick={() => setStepIndex(i => Math.max(0, i - 1))}
              disabled={stepIndex === 0}
            >
              <ArrowLeft className="h-3.5 w-3.5" /> Back
            </Button>
            <Button
              size="sm"
              className="h-8 gap-1 text-xs"
              onClick={() => (isLast ? finish() : setStepIndex(i => i + 1))}
            >
              {isLast ? (<><Check className="h-3.5 w-3.5" /> Done</>) : (<>Next <ArrowRight className="h-3.5 w-3.5" /></>)}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default OnboardingWalkthrough;

/** Queue a replay of the walkthrough on the next dashboard visit. */
export function requestWalkthroughReplay(userId?: string) {
  localStorage.setItem(REPLAY_KEY, "1");
  if (userId) localStorage.removeItem(`${LS_KEY}_${userId}`);
}
