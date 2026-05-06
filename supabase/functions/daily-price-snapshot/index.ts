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

/**
 * NSE trading holidays (full-day equity market closures).
 * Source: NSE official holiday calendar. Update yearly.
 * Format: "YYYY-MM-DD" in IST.
 */
const NSE_HOLIDAYS: ReadonlySet<string> = new Set([
  // 2025
  "2025-02-26", // Mahashivratri
  "2025-03-14", // Holi
  "2025-03-31", // Id-Ul-Fitr (Ramzan Id)
  "2025-04-10", // Shri Mahavir Jayanti
  "2025-04-14", // Dr. Baba Saheb Ambedkar Jayanti
  "2025-04-18", // Good Friday
  "2025-05-01", // Maharashtra Day
  "2025-08-15", // Independence Day
  "2025-08-27", // Shri Ganesh Chaturthi
  "2025-10-02", // Mahatma Gandhi Jayanti / Dussehra
  "2025-10-21", // Diwali Laxmi Pujan (special muhurat session — treat as holiday for daily close)
  "2025-10-22", // Balipratipada
  "2025-11-05", // Prakash Gurpurb Sri Guru Nanak Dev
  "2025-12-25", // Christmas
  // 2026
  "2026-01-26", // Republic Day
  "2026-03-03", // Mahashivratri
  "2026-03-04", // Holi
  "2026-03-21", // Id-Ul-Fitr
  "2026-04-01", // Shri Mahavir Jayanti
  "2026-04-03", // Good Friday
  "2026-04-14", // Dr. Baba Saheb Ambedkar Jayanti
  "2026-05-01", // Maharashtra Day
  "2026-05-27", // Bakri Id
  "2026-06-26", // Moharram
  "2026-08-15", // Independence Day
  "2026-09-15", // Shri Ganesh Chaturthi
  "2026-10-02", // Mahatma Gandhi Jayanti
  "2026-10-22", // Dussehra
  "2026-11-09", // Diwali Balipratipada
  "2026-11-24", // Prakash Gurpurb Sri Guru Nanak Dev
  "2026-12-25", // Christmas
]);

function istDateKey(date = new Date()): string {
  const { year, month, day } = istParts(date);
  return `${year}-${month}-${day}`;
}

/** True only on NSE equity trading days: Mon–Fri IST and not in the holiday set. */
function isTradingDayIST(date = new Date()): { ok: boolean; reason?: string } {
  const { weekday } = istParts(date);
  if (weekday === "Sat" || weekday === "Sun") return { ok: false, reason: "weekend_ist" };
  const key = istDateKey(date);
  if (NSE_HOLIDAYS.has(key)) return { ok: false, reason: `nse_holiday_${key}` };
  return { ok: true };
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
    const tradingDay = isTradingDayIST();
    if (!tradingDay.ok) {
      return new Response(
        JSON.stringify({ ok: true, skipped: tradingDay.reason, inserted: 0 }),
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
