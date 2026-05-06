// Daily end-of-day snapshot for stock_price_history.
//
// Purpose: guarantee that the detail-sheet PriceChart has at least ONE point
// per trading day, even if no intraday tick happened to be persisted in the
// last few minutes of the session. This makes the 1Y / 5Y / 10Y ranges stable
// and consistent over time.
//
// Behaviour:
//   - Runs only on Indian trading days (Mon–Fri IST). Weekends → no-op.
//   - Reads the latest row per ticker from cached_stock_prices.
//   - Inserts one history row per ticker, stamped at 15:30 IST of "today",
//     skipping any ticker that already has a row for that exact close.
//   - Idempotent: re-running the same day is safe (de-dupes on ticker+timestamp).
//   - Public endpoint, intended for invocation by pg_cron at ~15:35 IST.
//
// Called functions: none external. Only DB I/O via service-role client.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function istParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return {
    weekday: get("weekday"),
    year: get("year"),
    month: get("month"),
    day: get("day"),
  };
}

/** Returns true Mon–Fri IST. (NSE holiday calendar is not consulted — those days
 *  simply produce a no-op snapshot since cached prices won't have moved.) */
function isTradingDayIST(date = new Date()): boolean {
  const { weekday } = istParts(date);
  return weekday !== "Sat" && weekday !== "Sun";
}

/** Returns the ISO timestamp for 15:30 IST of "today" in IST. */
function todayCloseIso(date = new Date()): string {
  const { year, month, day } = istParts(date);
  // 15:30 IST == 10:00 UTC
  return `${year}-${month}-${day}T10:00:00.000Z`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (!isTradingDayIST()) {
      return new Response(
        JSON.stringify({ ok: true, skipped: "weekend_ist", inserted: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const closeIso = todayCloseIso();
    const closeMs = new Date(closeIso).getTime();
    const dayStartIso = new Date(closeMs - 12 * 60 * 60 * 1000).toISOString();
    const dayEndIso = new Date(closeMs + 12 * 60 * 60 * 1000).toISOString();

    // Pull all cached prices in pages (Supabase caps at 1000 per response).
    const cached: Array<{ ticker: string; exchange: string; price: number }> = [];
    const PAGE = 1000;
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await sb
        .from("cached_stock_prices")
        .select("ticker, exchange, price")
        .gt("price", 0)
        .range(from, from + PAGE - 1);
      if (error) {
        console.error("daily-price-snapshot read error:", error);
        return new Response(JSON.stringify({ error: "read_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!data || data.length === 0) break;
      cached.push(...(data as any));
      if (data.length < PAGE) break;
    }

    if (cached.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, inserted: 0, reason: "no_cached_prices" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Find tickers that already have a snapshot in today's IST window so we
    // don't double-insert if cron retries.
    const { data: existing } = await sb
      .from("stock_price_history")
      .select("ticker, exchange")
      .gte("recorded_at", dayStartIso)
      .lte("recorded_at", dayEndIso);

    const seen = new Set(
      (existing ?? []).map((e: any) => `${e.exchange}|${e.ticker}`),
    );

    const rows = cached
      .filter((c) => !seen.has(`${c.exchange}|${c.ticker}`))
      .map((c) => ({
        ticker: c.ticker,
        exchange: c.exchange,
        price: c.price,
        recorded_at: closeIso,
      }));

    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, inserted: 0, reason: "already_snapshotted" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Insert in batches to stay well under request size limits.
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk = rows.slice(i, i + BATCH);
      const { error } = await sb.from("stock_price_history").insert(chunk);
      if (error) {
        console.error("daily-price-snapshot insert batch error:", error);
        continue;
      }
      inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({ ok: true, inserted, total_candidates: cached.length, close_at: closeIso }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("daily-price-snapshot error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
