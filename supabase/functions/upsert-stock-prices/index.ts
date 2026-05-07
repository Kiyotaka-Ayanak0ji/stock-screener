import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TICKER_RE = /^[A-Za-z0-9_\-.]{1,30}$/;
const EXCHANGE_RE = /^(NSE|BSE)$/;
const MAX_ROWS = 200;

interface InboundRow {
  ticker: unknown;
  exchange: unknown;
  name?: unknown;
  price?: unknown;
  previous_close?: unknown;
  change?: unknown;
  change_percent?: unknown;
  high?: unknown;
  low?: unknown;
  open_price?: unknown;
  volume?: unknown;
  market_cap?: unknown;
  pe?: unknown;
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : typeof v === "string" ? parseFloat(v) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Returns true only when the Indian equity market is open
 * (Mon–Fri, 09:15–15:30 IST). Used to gate chart-history writes so
 * `stock_price_history` only accumulates real intraday ticks.
 */
function isMarketOpenIST(date: Date = new Date()): boolean {
  // Convert "now" to IST wall-clock components without depending on server TZ.
  const istParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => istParts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday"); // Mon, Tue, ...
  if (weekday === "Sat" || weekday === "Sun") return false;
  const hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return false;
  const minutes = hour * 60 + minute;
  return minutes >= 555 && minutes <= 930; // 09:15 – 15:30 IST
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Public endpoint — writes go through service role with strict input validation.
  // Same model as cached_stock_prices: market data is non-sensitive.

  try {
    const body = await req.json();
    const rowsIn = Array.isArray(body?.rows) ? body.rows : null;
    if (!rowsIn || rowsIn.length === 0) {
      return new Response(JSON.stringify({ error: "rows required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rowsIn.length > MAX_ROWS) {
      return new Response(JSON.stringify({ error: `too many rows (max ${MAX_ROWS})` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date().toISOString();
    const cleaned = (rowsIn as InboundRow[])
      .filter((r) =>
        typeof r?.ticker === "string" && TICKER_RE.test(r.ticker as string) &&
        typeof r?.exchange === "string" && EXCHANGE_RE.test(r.exchange as string) &&
        num(r.price, 0) > 0
      )
      .map((r) => ({
        ticker: r.ticker as string,
        exchange: r.exchange as string,
        name: typeof r.name === "string" ? (r.name as string).slice(0, 200) : (r.ticker as string),
        price: num(r.price),
        previous_close: num(r.previous_close),
        change: num(r.change),
        change_percent: num(r.change_percent),
        high: num(r.high),
        low: num(r.low),
        open_price: num(r.open_price),
        volume: Math.max(0, Math.floor(num(r.volume))),
        market_cap: num(r.market_cap),
        pe: num(r.pe, 0),
        updated_at: now,
      }));

    if (cleaned.length === 0) {
      return new Response(JSON.stringify({ ok: true, written: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error } = await sb
      .from("cached_stock_prices")
      .upsert(cleaned, { onConflict: "ticker,exchange" });

    if (error) {
      console.error("upsert-stock-prices db error:", error);
      return new Response(JSON.stringify({ error: "Failed to persist prices" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, written: cleaned.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("upsert-stock-prices error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
