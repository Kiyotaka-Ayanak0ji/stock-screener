import { useEffect, useRef, useCallback } from "react";
import { useStocks } from "@/contexts/StockContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface SmartAlert {
  id: string;
  type: "52w_high" | "52w_low" | "volume_spike";
  ticker: string;
  message: string;
  detail: string;
  timestamp: Date;
}

// Hook that detects smart alerts and fires email notifications
export function useSmartAlerts(onAlert: (alert: SmartAlert) => void) {
  const { stocks, isMarketOpen } = useStocks();
  const { user } = useAuth();
  const firedAlerts = useRef<Set<string>>(new Set());
  const prevVolumes = useRef<Record<string, number[]>>({});

  const checkAlerts = useCallback(() => {
    if (!isMarketOpen) return;

    for (const stock of stocks) {
      if (stock.price <= 0 || stock.high <= 0) continue;

      // 52-week high detection: price >= day high (proxy since we don't have 52w data)
      // Using high as approximation - if price equals day high, it's at session high
      const highKey = `52wh_${stock.ticker}_${new Date().toDateString()}`;
      if (stock.price >= stock.high && stock.high > stock.previousClose && !firedAlerts.current.has(highKey)) {
        firedAlerts.current.add(highKey);
        const alert: SmartAlert = {
          id: highKey,
          type: "52w_high",
          ticker: stock.ticker,
          message: `${stock.ticker} hit session high`,
          detail: `₹${stock.price.toFixed(2)} — Day high ₹${stock.high.toFixed(2)}`,
          timestamp: new Date(),
        };
        onAlert(alert);
      }

      // 52-week low detection: price <= day low
      const lowKey = `52wl_${stock.ticker}_${new Date().toDateString()}`;
      if (stock.price <= stock.low && stock.low < stock.previousClose && stock.low > 0 && !firedAlerts.current.has(lowKey)) {
        firedAlerts.current.add(lowKey);
        const alert: SmartAlert = {
          id: lowKey,
          type: "52w_low",
          ticker: stock.ticker,
          message: `${stock.ticker} hit session low`,
          detail: `₹${stock.price.toFixed(2)} — Day low ₹${stock.low.toFixed(2)}`,
          timestamp: new Date(),
        };
        onAlert(alert);
      }

      // Volume spike detection: current volume > 2x average of last 5 readings
      if (!prevVolumes.current[stock.ticker]) {
        prevVolumes.current[stock.ticker] = [];
      }
      const history = prevVolumes.current[stock.ticker];
      if (history.length >= 5) {
        const avgVol = history.reduce((a, b) => a + b, 0) / history.length;
        const spikeKey = `vol_${stock.ticker}_${new Date().toDateString()}`;
        if (stock.volume > avgVol * 2 && avgVol > 0 && !firedAlerts.current.has(spikeKey)) {
          firedAlerts.current.add(spikeKey);
          const multiplier = (stock.volume / avgVol).toFixed(1);
          const alert: SmartAlert = {
            id: spikeKey,
            type: "volume_spike",
            ticker: stock.ticker,
            message: `${stock.ticker} volume spike`,
            detail: `${multiplier}x normal volume — ${formatVolume(stock.volume)}`,
            timestamp: new Date(),
          };
          onAlert(alert);
        }
      }
      history.push(stock.volume);
      if (history.length > 10) history.shift();
    }
  }, [stocks, isMarketOpen, onAlert]);

  useEffect(() => {
    checkAlerts();
  }, [checkAlerts]);

  // Send email digest for smart alerts (batched)
  const pendingEmailAlerts = useRef<SmartAlert[]>([]);
  const emailTimer = useRef<ReturnType<typeof setTimeout>>();

  const sendSmartAlertEmail = useCallback((alert: SmartAlert) => {
    if (!user?.email || !user.email_confirmed_at) return;

    pendingEmailAlerts.current.push(alert);

    // Debounce: batch alerts sent within 30s into one email
    if (emailTimer.current) clearTimeout(emailTimer.current);
    emailTimer.current = setTimeout(() => {
      const alerts = [...pendingEmailAlerts.current];
      pendingEmailAlerts.current = [];
      if (alerts.length === 0) return;

      supabase.functions.invoke('send-transactional-email', {
        body: {
          template: 'smart_alert_digest',
          props: {
            displayName: user.user_metadata?.display_name || user.email,
            alerts: alerts.map(a => ({
              type: a.type,
              ticker: a.ticker,
              message: a.message,
              detail: a.detail,
              timestamp: a.timestamp.toLocaleString('en-IN', {
                day: '2-digit', month: 'short', hour: '2-digit',
                minute: '2-digit', hour12: true,
              }),
            })),
          },
          idempotencyKey: `smart-alert-${new Date().toDateString()}-${Date.now()}`,
        },
      }).catch(err => console.error('Failed to send smart alert email:', err));
    }, 30000);
  }, [user]);

  return { sendSmartAlertEmail };
}

function formatVolume(v: number): string {
  if (v >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (v >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toString();
}
