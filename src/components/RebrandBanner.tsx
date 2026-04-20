import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

// Bump this version if you ever want to re-show the banner to everyone.
const REBRAND_VERSION = "v1";
const STORAGE_PREFIX = "equityiq-rebrand-dismissed";

/**
 * One-time dismissible banner announcing the EquityLens → EquityIQ rebrand.
 * Dismissal is persisted per-user (or per-device for guests) in localStorage,
 * so each user only ever sees it once.
 */
const RebrandBanner = () => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);

  // Scope the dismissal key to the user (falls back to "guest" for anonymous).
  const storageKey = `${STORAGE_PREFIX}:${REBRAND_VERSION}:${user?.id ?? "guest"}`;

  useEffect(() => {
    try {
      const dismissed = localStorage.getItem(storageKey);
      if (!dismissed) {
        // Slight delay so it doesn't pop in during initial layout flash.
        const t = setTimeout(() => setVisible(true), 250);
        return () => clearTimeout(t);
      }
    } catch {
      // localStorage unavailable (private mode / SSR) — just skip.
    }
  }, [storageKey]);

  const handleDismiss = () => {
    try {
      localStorage.setItem(storageKey, new Date().toISOString());
    } catch {
      // Ignore — banner will reappear next session, which is acceptable.
    }
    setVisible(false);
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          role="status"
          aria-live="polite"
          className="relative mx-auto mt-3 w-[calc(100%-1rem)] max-w-6xl overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent px-4 py-3 backdrop-blur-sm sm:mt-4 sm:w-[calc(100%-2rem)] sm:px-5 sm:py-3.5"
        >
          <div className="flex items-center gap-3">
            <div className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-lg sm:flex">
              👋
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-foreground sm:text-[15px]">
                <span className="sm:hidden">👋 </span>We&apos;re now Equity
                <span className="text-primary">IQ</span> — same app, sharper name.
              </p>
              <p className="mt-0.5 hidden text-xs text-muted-foreground sm:block">
                Everything you love is right where you left it. Just a fresh identity.
              </p>
            </div>
            <Button
              size="sm"
              variant="default"
              onClick={handleDismiss}
              className="hidden h-8 shrink-0 px-3 text-xs sm:inline-flex"
            >
              Got it
            </Button>
            <button
              type="button"
              onClick={handleDismiss}
              aria-label="Dismiss rebrand notice"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default RebrandBanner;
