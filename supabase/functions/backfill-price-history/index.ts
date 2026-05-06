// Backfill missing daily price snapshots into stock_price_history.
//
// Why: the live `upsert-stock-prices` flow only writes intraday ticks while
// the IST market is open, and `daily-price-snapshot` only fills "today". If
// the system was offline / paused / newly seeded, charts will have gaps. This
// job fills those gaps by pulling historical daily candles from Yahoo Finance
// for each ticker and inserting one row per missing trading day.
//
// Behaviour:
//   - POST { days?: number, limit?: number, tickers?: [{ticker,exchange}], exchange?: "NSE"|"BSE" }
//   - Default: backfill last 90 calendar days for the 200 ticker rows whose
//     stock_price_history is most-stale (oldest max(recorded_at)).
//   - Skips weekends and any (ticker,day) that already has a row.
//   - Idempotent and safe to re-run; capped per invocation so cron can chip
//     away without timing out.
//   - Public endpoint, no untrusted SQL. Heavy ops gated by service role key.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_TICKERS_PER_RUN = 200;
const MAX_DAYS = 365 * 10;
const YAHOO_CONCURRENCY = 6;

type Exchange = "NSE" | "BSE";

interface TickerRef {
  ticker: string;
  exchange: Exchange;
}

function yahooSymbol(t: TickerRef): string {
  return `${t.ticker}.${t.exchange === "BSE" ? "BO" : "NS"}`;
}

/** "YYYY-MM-DD" string for an epoch ms in IST (so day-bucketing matches NSE close). */
function istDayKey(ms: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Returns true Mon–Fri IST for the given epoch ms. */
function isTradingDayIST(ms: number): boolean {
  const wk = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    weekday: "short",
  }).format(new Date(ms));
  return wk !== "Sat" && wk !== "Sun";
}

/** Convert an IST day-key (YYYY-MM-DD) to the canonical 15:30 IST close
 *  timestamp (10:00 UTC). */
function dayKeyToCloseIso(dayKey: string): string {
  return `${dayKey}T10:00:00.000Z`;
}

interface YahooDaily {
  dayKey: string;
  close: number;
}

async function fetchYahooDaily(
  t: TickerRef,
  days: number,
): Promise<YahooDaily[]> {
  // range options: 1mo, 3mo, 6mo, 1y, 2y, 5y, 10y, max
  let range = "3mo";
  if (days > 30 * 6) range = "1y";
  if (days > 365) range = "2y";
  if (days > 365 * 2) range = "5y";
  if (days > 365 * 5) range = "10y";

  const sym = encodeURIComponent(yahooSymbol(t));
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${sym}?range=${range}&interval=1d`;

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) return [];
    const json: any = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return [];
    const ts: number[] = result.timestamp ?? [];
    const closes: (number | null)[] =
      result.indicators?.quote?.[0]?.close ?? [];
    const out: YahooDaily[] = [];
    const seen = new Set<string>();
    for (let i = 0; i < ts.length; i++) {
      const close = closes[i];
      if (typeof close !== "number" || !Number.isFinite(close) || close <= 0) continue;
      const ms = ts[i] * 1000;
      if (!isTradingDayIST(ms)) continue;
      const key = istDayKey(ms);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ dayKey: key, close });
    }
    return out;
  } catch (err) {
    console.error(`yahoo fetch failed for ${yahooSymbol(t)}:`, err);
    return [];
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const days = Math.min(MAX_DAYS, Math.max(1, Number(body?.days) || 90));
    const limit = Math.min(MAX_TICKERS_PER_RUN, Math.max(1, Number(body?.limit) || 200));
    const exchangeFilter: Exchange | undefined =
      body?.exchange === "NSE" || body?.exchange === "BSE" ? body.exchange : undefined;
    const explicitTickers: TickerRef[] | null = Array.isArray(body?.tickers)
      ? body.tickers
          .filter(
            (t: any) =>
              t && typeof t.ticker === "string" &&
              (t.exchange === "NSE" || t.exchange === "BSE"),
          )
          .slice(0, limit)
      : null;

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Build the work list ----------------------------------------------------
    let work: TickerRef[] = [];
    if (explicitTickers && explicitTickers.length > 0) {
      work = explicitTickers as TickerRef[];
    } else {
      // Pick tickers whose history is most-stale (oldest max(recorded_at) first),
      // using cached_stock_prices.updated_at as a cheap proxy for "tracked, but
      // possibly never snapshotted".
      let q = sb
        .from("cached_stock_prices")
        .select("ticker, exchange, updated_at")
        .gt("price", 0)
        .order("updated_at", { ascending: true })
        .limit(limit * 2); // overfetch, then de-dupe vs explicit filter
      if (exchangeFilter) q = q.eq("exchange", exchangeFilter);
      const { data, error } = await q;
      if (error) {
        console.error("backfill candidates read error:", error);
        return new Response(JSON.stringify({ error: "read_failed" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const seen = new Set<string>();
      for (const row of (data ?? []) as any[]) {
        const key = `${row.exchange}|${row.ticker}`;
        if (seen.has(key)) continue;
        seen.add(key);
        work.push({ ticker: row.ticker, exchange: row.exchange as Exchange });
        if (work.length >= limit) break;
      }
    }

    if (work.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, processed: 0, inserted: 0, reason: "no_candidates" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 2. Pre-load existing day-keys per ticker so we only insert true gaps -----
    const sinceIso = new Date(Date.now() - days * DAY_MS).toISOString();
    const tickerNames = Array.from(new Set(work.map((w) => w.ticker)));
    const existingByKey = new Map<string, Set<string>>(); // "EX|TKR" -> Set<dayKey>
    // Page in batches of 100 tickers (IN clause)
    const BATCH = 100;
    for (let i = 0; i < tickerNames.length; i += BATCH) {
      const slice = tickerNames.slice(i, i + BATCH);
      const { data, error } = await sb
        .from("stock_price_history")
        .select("ticker, exchange, recorded_at")
        .in("ticker", slice)
        .gte("recorded_at", sinceIso)
        .limit(50000);
      if (error) {
        console.error("existing history read error:", error);
        continue;
      }
      for (const row of (data ?? []) as any[]) {
        const k = `${row.exchange}|${row.ticker}`;
        const dk = istDayKey(new Date(row.recorded_at).getTime());
        let set = existingByKey.get(k);
        if (!set) {
          set = new Set();
          existingByKey.set(k, set);
        }
        set.add(dk);
      }
    }

    // 3. Fetch Yahoo daily candles concurrently and build insert rows ---------
    const cutoffMs = Date.now() - days * DAY_MS;
    const insertRows: Array<{
      ticker: string;
      exchange: string;
      price: number;
      recorded_at: string;
    }> = [];
    const stats = { processed: 0, ticker_with_data: 0, ticker_no_data: 0 };

    for (let i = 0; i < work.length; i += YAHOO_CONCURRENCY) {
      const slice = work.slice(i, i + YAHOO_CONCURRENCY);
      const results = await Promise.all(
        slice.map(async (t) => ({ t, candles: await fetchYahooDaily(t, days) })),
      );
      for (const { t, candles } of results) {
        stats.processed++;
        if (candles.length === 0) {
          stats.ticker_no_data++;
          continue;
        }
        stats.ticker_with_data++;
        const k = `${t.exchange}|${t.ticker}`;
        const have = existingByKey.get(k) ?? new Set<string>();
        for (const c of candles) {
          const closeIso = dayKeyToCloseIso(c.dayKey);
          if (new Date(closeIso).getTime() < cutoffMs) continue;
          if (have.has(c.dayKey)) continue;
          insertRows.push({
            ticker: t.ticker,
            exchange: t.exchange,
            price: c.close,
            recorded_at: closeIso,
          });
        }
      }
    }

    // 4. Insert in batches ----------------------------------------------------
    let inserted = 0;
    const INSERT_BATCH = 500;
    for (let i = 0; i < insertRows.length; i += INSERT_BATCH) {
      const chunk = insertRows.slice(i, i + INSERT_BATCH);
      const { error } = await sb.from("stock_price_history").insert(chunk);
      if (error) {
        console.error("backfill insert batch error:", error);
        continue;
      }
      inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        days,
        tickers_targeted: work.length,
        ...stats,
        inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("backfill-price-history error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
