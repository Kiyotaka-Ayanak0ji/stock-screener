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

    // Append history points for sparklines (multi-day trend)
    // Only record when price actually changed since the last point to avoid bloat.
    try {
      const tickers = cleaned.map((c) => c.ticker);
      const { data: lastPoints } = await sb
        .from("stock_price_history")
        .select("ticker, exchange, price, recorded_at")
        .in("ticker", tickers)
        .order("recorded_at", { ascending: false })
        .limit(500);

      const lastByKey = new Map<string, number>();
      (lastPoints ?? []).forEach((p: any) => {
        const key = `${p.exchange}|${p.ticker}`;
        if (!lastByKey.has(key)) lastByKey.set(key, Number(p.price));
      });

      const historyRows = cleaned
        .filter((c) => {
          const key = `${c.exchange}|${c.ticker}`;
          const last = lastByKey.get(key);
          // Always store first point; otherwise store only on actual change
          return last === undefined || Math.abs(last - c.price) > 0.0001;
        })
        .map((c) => ({
          ticker: c.ticker,
          exchange: c.exchange,
          price: c.price,
          recorded_at: now,
        }));

      if (historyRows.length > 0) {
        await sb.from("stock_price_history").insert(historyRows);
      }

      // Prune points older than 30 days (best-effort, ignore errors)
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await sb.from("stock_price_history").delete().lt("recorded_at", cutoff);
    } catch (historyErr) {
      console.error("price history append failed:", historyErr);
      // Non-fatal — primary upsert already succeeded
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
