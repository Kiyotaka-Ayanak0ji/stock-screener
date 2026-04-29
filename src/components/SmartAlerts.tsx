import { useEffect, useRef, useCallback, useState } from "react";
import { useStocks } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface SmartAlert {
  id: string;
  type: "52w_high" | "52w_low" | "volume_spike";
  ticker: string;
  message: string;
  detail: string;
  timestamp: Date;
}

// Tunables for accurate, non-redundant detection
const HIGH_LOW_COOLDOWN_MS = 15 * 60 * 1000; // 15 min between same-direction alerts per ticker
const VOL_COOLDOWN_MS = 30 * 60 * 1000;       // 30 min between volume spike alerts per ticker
const MIN_PRICE_BREAK_PCT = 0.001;            // require 0.1% strict break above prior session high
const MIN_VOL_DELTA = 5000;                   // ignore tiny volume increments (noise)
const VOL_SPIKE_MULTIPLIER = 3;               // delta must be 3x avg recent delta
const VOL_HISTORY_SIZE = 8;

type Tracker = {
  sessionHigh: number;
  sessionLow: number;
  lastHighAlertAt: number;
  lastLowAlertAt: number;
  lastVolAlertAt: number;
  lastVolume: number;
  volDeltas: number[]; // recent positive deltas only
  dateKey: string;
};

function todayKey() {
  return new Date().toDateString();
}

// Hook that detects smart alerts and fires email notifications
export function useSmartAlerts(onAlert: (alert: SmartAlert) => void) {
  const { stocks, isMarketOpen } = useStocks();
  const { user } = useAuth();
  const trackers = useRef<Record<string, Tracker>>({});
  const [emailOptIn, setEmailOptIn] = useState<boolean | null>(null);

  // Fetch user's email opt-in preference (live)
  useEffect(() => {
    if (!user?.id) {
      setEmailOptIn(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("email_opt_in")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setEmailOptIn(data?.email_opt_in ?? false);
      });

    // Listen for realtime profile updates so toggling opt-in takes effect immediately
    const channel = supabase
      .channel(`profile-optin-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const next = (payload.new as any)?.email_opt_in;
          if (typeof next === "boolean") setEmailOptIn(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  const checkAlerts = useCallback(() => {
    if (!isMarketOpen) return;
    const now = Date.now();
    const dKey = todayKey();

    for (const stock of stocks) {
      if (!Number.isFinite(stock.price) || stock.price <= 0) continue;

      let t = trackers.current[stock.ticker];
      if (!t || t.dateKey !== dKey) {
        // Seed fresh tracker for the trading day using the broker-reported H/L as baseline
        t = {
          sessionHigh: Math.max(stock.price, stock.high || stock.price),
          sessionLow: Math.min(stock.price, stock.low > 0 ? stock.low : stock.price),
          lastHighAlertAt: 0,
          lastLowAlertAt: 0,
          lastVolAlertAt: 0,
          lastVolume: stock.volume || 0,
          volDeltas: [],
          dateKey: dKey,
        };
        trackers.current[stock.ticker] = t;
        continue; // wait for the next tick to compare against a real baseline
      }

      // ── Session-high break: strict break above prior tracked high + cooldown ──
      const highThreshold = t.sessionHigh * (1 + MIN_PRICE_BREAK_PCT);
      if (
        stock.price > highThreshold &&
        stock.price > stock.previousClose &&
        now - t.lastHighAlertAt > HIGH_LOW_COOLDOWN_MS
      ) {
        t.lastHighAlertAt = now;
        const alert: SmartAlert = {
          id: `52wh_${stock.ticker}_${now}`,
          type: "52w_high",
          ticker: stock.ticker,
          message: `${stock.ticker} broke session high`,
          detail: `₹${stock.price.toFixed(2)} — prev high ₹${t.sessionHigh.toFixed(2)}`,
          timestamp: new Date(now),
        };
        onAlert(alert);
      }
      if (stock.price > t.sessionHigh) t.sessionHigh = stock.price;

      // ── Session-low break ──
      const lowThreshold = t.sessionLow * (1 - MIN_PRICE_BREAK_PCT);
      if (
        stock.price < lowThreshold &&
        stock.price < stock.previousClose &&
        t.sessionLow > 0 &&
        now - t.lastLowAlertAt > HIGH_LOW_COOLDOWN_MS
      ) {
        t.lastLowAlertAt = now;
        const alert: SmartAlert = {
          id: `52wl_${stock.ticker}_${now}`,
          type: "52w_low",
          ticker: stock.ticker,
          message: `${stock.ticker} broke session low`,
          detail: `₹${stock.price.toFixed(2)} — prev low ₹${t.sessionLow.toFixed(2)}`,
          timestamp: new Date(now),
        };
        onAlert(alert);
      }
      if (stock.price < t.sessionLow || t.sessionLow <= 0) t.sessionLow = stock.price;

      // ── Volume spike: compare per-tick delta against rolling avg of prior deltas ──
      const vol = Number.isFinite(stock.volume) ? stock.volume : 0;
      const delta = vol - t.lastVolume;
      if (delta > 0) {
        if (t.volDeltas.length >= 5) {
          const avgDelta = t.volDeltas.reduce((a, b) => a + b, 0) / t.volDeltas.length;
          if (
            delta > MIN_VOL_DELTA &&
            avgDelta > 0 &&
            delta > avgDelta * VOL_SPIKE_MULTIPLIER &&
            now - t.lastVolAlertAt > VOL_COOLDOWN_MS
          ) {
            t.lastVolAlertAt = now;
            const multiplier = (delta / avgDelta).toFixed(1);
            const alert: SmartAlert = {
              id: `vol_${stock.ticker}_${now}`,
              type: "volume_spike",
              ticker: stock.ticker,
              message: `${stock.ticker} volume spike`,
              detail: `${multiplier}x recent flow — +${formatVolume(delta)} traded`,
              timestamp: new Date(now),
            };
            onAlert(alert);
          }
        }
        t.volDeltas.push(delta);
        if (t.volDeltas.length > VOL_HISTORY_SIZE) t.volDeltas.shift();
      }
      t.lastVolume = vol;
    }
  }, [stocks, isMarketOpen, onAlert]);

  useEffect(() => {
    checkAlerts();
  }, [checkAlerts]);

  // Send email digest for smart alerts (batched, dedup'd, respects opt-in)
  const pendingEmailAlerts = useRef<SmartAlert[]>([]);
  const sentDedupKeys = useRef<Set<string>>(new Set());
  const emailTimer = useRef<ReturnType<typeof setTimeout>>();

  const sendSmartAlertEmail = useCallback(
    (alert: SmartAlert) => {
      if (!user?.email || !user.email_confirmed_at) return;
      if (emailOptIn === false) return; // user opted out — never queue email

      // Per-day dedup key prevents duplicate digest entries for the same event
      const dedupKey = `${alert.type}_${alert.ticker}_${todayKey()}`;
      if (sentDedupKeys.current.has(dedupKey)) return;
      sentDedupKeys.current.add(dedupKey);

      pendingEmailAlerts.current.push(alert);

      if (emailTimer.current) clearTimeout(emailTimer.current);
      emailTimer.current = setTimeout(() => {
        const alerts = [...pendingEmailAlerts.current];
        pendingEmailAlerts.current = [];
        if (alerts.length === 0) return;
        // Note: opt-in is also re-validated server-side before send.

        supabase.functions
          .invoke("send-transactional-email", {
            body: {
              template: "smart_alert_digest",
              props: {
                displayName: user.user_metadata?.display_name || user.email,
                alerts: alerts.map((a) => ({
                  type: a.type,
                  ticker: a.ticker,
                  message: a.message,
                  detail: a.detail,
                  timestamp: a.timestamp.toLocaleString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                    hour12: true,
                  }),
                })),
              },
              idempotencyKey: `smart-alert-${todayKey()}-${Date.now()}`,
            },
          })
          .catch((err) => console.error("Failed to send smart alert email:", err));
      }, 30000);
    },
    [user, emailOptIn],
  );

  return { sendSmartAlertEmail };
}

function formatVolume(v: number): string {
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toString();
}
