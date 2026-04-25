// Verify a single stock against Screener.in (and BSE India / Google Finance fallbacks)
// on demand. Public endpoint — market data is non-sensitive. Strict input validation,
// short timeouts, single-ticker rate-friendly. Writes go through the service role.
//
// Resolves numeric BSE codes (e.g. AVAX → 544337) by hitting Screener's search API
// first, so users can verify SME / numeric-coded BSE stocks. For SME and illiquid
// counters where Screener does not expose intraday OHLC / Volume in HTML, we enrich
// with the BSE India quote API (LTP, Open, High, Low, Prev Close, TTQ, MCap) — which
// is the same data feed bseindia.com itself uses, so values are time-synced with the
// official exchange rather than a rough cached snapshot.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TICKER_RE = /^[A-Za-z0-9_\-.]{1,30}$/;
const EXCHANGE_RE = /^(NSE|BSE)$/;
const FETCH_TIMEOUT_MS = 8000;
const GROWW_TOKEN = Deno.env.get("GROWW_API_TOKEN") || "";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);
}

interface ScrapeResult {
  price: number;
  previousClose: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  marketCap: number;
  pe: number;
  name: string;
  source: "screener" | "google" | "bse";
  /** Resolved numeric BSE scrip code if we discovered one (used for BSE enrichment). */
  bseCode?: string;
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Extract a number from inside the first matching <li class="flex flex-space-between">
// block whose <span class="name"> equals the given label. This is robust to the order
// of items on Screener pages and avoids cross-block matches that the previous greedy
// regex was vulnerable to.
function extractRatio(html: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<li[^>]*class="flex flex-space-between"[^>]*>\\s*<span class="name">\\s*${escaped}\\s*</span>[\\s\\S]{0,400}?</li>`,
    "i",
  );
  const block = html.match(re);
  return block ? block[0] : null;
}

function firstNumberIn(block: string | null): number {
  if (!block) return 0;
  const m = block.match(/<span class="number">\s*([\d,]+(?:\.\d+)?)\s*<\/span>/);
  if (!m) return 0;
  const v = parseFloat(m[1].replace(/,/g, ""));
  return Number.isFinite(v) ? v : 0;
}

function allNumbersIn(block: string | null): number[] {
  if (!block) return [];
  const out: number[] = [];
  const re = /<span class="number">\s*([\d,]+(?:\.\d+)?)\s*<\/span>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block)) !== null) {
    const v = parseFloat(m[1].replace(/,/g, ""));
    if (Number.isFinite(v)) out.push(v);
  }
  return out;
}

// Resolve a Screener slug for a ticker. Numeric BSE codes (e.g. 544337) and
// alphanumeric tickers like AVAX/BCCFUBA may not exist directly at /company/<ticker>/,
// so we hit Screener's search endpoint to find the right slug.
async function resolveScreener(
  ticker: string,
): Promise<{ slug: string; bseCode?: string } | null> {
  // Try direct first — fastest path for well-known tickers like RELIANCE.
  try {
    const direct = await withTimeout(
      fetch(`https://www.screener.in/company/${encodeURIComponent(ticker)}/`, {
        method: "HEAD",
        headers: { "User-Agent": UA },
      }),
      4000,
    );
    if (direct.ok) return { slug: ticker };
  } catch { /* fall through to search */ }

  // Search Screener for the ticker.
  try {
    const sres = await withTimeout(
      fetch(
        `https://www.screener.in/api/company/search/?q=${encodeURIComponent(ticker)}`,
        { headers: { "User-Agent": UA, Accept: "application/json" } },
      ),
      5000,
    );
    if (!sres.ok) return null;
    const arr = await sres.json();
    if (!Array.isArray(arr) || arr.length === 0) return null;

    // Prefer an exact ticker match in the URL, otherwise the first result.
    const want = ticker.toUpperCase();
    const exact = arr.find((it: { url?: string }) => {
      const slug = (it?.url || "").split("/")[2] || "";
      return slug.toUpperCase() === want;
    });
    const pick = exact || arr[0];
    const slug = (pick?.url || "").split("/")[2] || null;
    if (!slug) return null;
    // If the resolved slug is a numeric BSE scrip code (Screener uses this for
    // BSE-only listings), capture it for the BSE India enrichment step.
    const bseCode = /^\d{5,7}$/.test(slug) ? slug : undefined;
    console.log(`Resolved ${ticker} → slug=${slug}${bseCode ? ` bseCode=${bseCode}` : ""}`);
    return { slug, bseCode };
  } catch (err) {
    console.error(`resolveScreener failed for ${ticker}:`, (err as Error).message);
    return null;
  }
}

async function scrapeScreener(ticker: string): Promise<ScrapeResult | null> {
  try {
    const resolved = await resolveScreener(ticker);
    if (!resolved) return null;

    const url = `https://www.screener.in/company/${encodeURIComponent(resolved.slug)}/`;
    const res = await withTimeout(
      fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } }),
      FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const html = await res.text();

    // Anchor each value to its labeled <li> block (much more reliable than
    // grabbing the first ₹ on the page, which previously misread Market Cap as price).
    const price = firstNumberIn(extractRatio(html, "Current Price"));
    if (!Number.isFinite(price) || price <= 0) return null;

    const mcapCr = firstNumberIn(extractRatio(html, "Market Cap"));
    const marketCap = mcapCr > 0 ? mcapCr * 1e7 : 0; // Cr → raw

    const peVal = firstNumberIn(extractRatio(html, "Stock P/E"));
    const pe = peVal > 0 ? peVal : 0;

    // Screener exposes 52-week High / Low (not intraday). We capture these so the UI
    // can show meaningful 52w range instead of falling silently back to LTP. Intraday
    // OHLC is enriched from BSE India later when available.
    const hl = allNumbersIn(extractRatio(html, "High / Low"));
    const high = hl[0] || price;
    const low = hl[1] || price;

    let name = ticker;
    const titleMatch = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/);
    if (titleMatch) name = titleMatch[1].trim().slice(0, 200);

    // Open / previousClose / volume are not on the Screener company header for SME
    // and illiquid counters. We leave them at sensible defaults; the BSE/Groww step
    // below fills them in when possible.
    return {
      price,
      previousClose: price,
      high,
      low,
      open: price,
      volume: 0,
      marketCap,
      pe,
      name,
      source: "screener",
      bseCode: resolved.bseCode,
    };
  } catch (err) {
    console.error(`scrapeScreener error for ${ticker}:`, (err as Error).message);
    return null;
  }
}

async function scrapeGoogleFinance(ticker: string, exchange: string): Promise<ScrapeResult | null> {
  try {
    const gfExchange = exchange === "BSE" ? "BOM" : "NSE";
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(ticker)}:${gfExchange}`;
    const res = await withTimeout(
      fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } }),
      FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const html = await res.text();

    const priceMatch = html.match(/data-last-price="([\d.]+)"/);
    if (!priceMatch) return null;
    const price = parseFloat(priceMatch[1]);
    if (!Number.isFinite(price) || price <= 0) return null;

    const prevMatch = html.match(/data-previous-close="([\d.]+)"/);
    const previousClose = prevMatch ? parseFloat(prevMatch[1]) : price;

    let marketCap = 0;
    const mc = html.match(/Market cap[\s\S]*?([\d,.]+)\s*(T|B|Cr|M|K)?\s*INR/i);
    if (mc) {
      let val = parseFloat(mc[1].replace(/,/g, ""));
      const unit = (mc[2] || "").toUpperCase();
      if (unit === "T") val *= 1e12;
      else if (unit === "B") val *= 1e9;
      else if (unit === "CR") val *= 1e7;
      else if (unit === "M") val *= 1e6;
      else if (unit === "K") val *= 1e3;
      marketCap = val;
    }

    let volume = 0;
    const vm = html.match(/Avg Volume[\s\S]*?([\d,.]+)\s*(K|M|B)?/i);
    if (vm) {
      let v = parseFloat(vm[1].replace(/,/g, ""));
      const unit = (vm[2] || "").toUpperCase();
      if (unit === "K") v *= 1e3;
      else if (unit === "M") v *= 1e6;
      else if (unit === "B") v *= 1e9;
      volume = Math.round(v);
    }

    let pe = 0;
    const pm = html.match(/P\/E ratio[\s\S]*?([\d,.]+)/i);
    if (pm) {
      const v = parseFloat(pm[1].replace(/,/g, ""));
      if (Number.isFinite(v) && v > 0) pe = v;
    }

    return {
      price,
      previousClose,
      high: price,
      low: price,
      open: price,
      volume,
      marketCap,
      pe,
      name: ticker,
      source: "google",
    };
  } catch {
    return null;
  }
}

// Groww quote — used as a volume / mcap fallback when Screener returns zero.
async function fetchGrowwVolume(
  ticker: string,
  exchange: "NSE" | "BSE",
): Promise<{ volume: number; marketCap: number; pe: number } | null> {
  if (!GROWW_TOKEN) return null;
  try {
    const u = new URL("https://api.groww.in/v1/live-data/quote");
    u.searchParams.set("exchange", exchange);
    u.searchParams.set("segment", "CASH");
    u.searchParams.set("trading_symbol", ticker);
    const res = await withTimeout(
      fetch(u.toString(), {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${GROWW_TOKEN}`,
          "X-API-VERSION": "1.0",
        },
      }),
      4000,
    );
    if (!res.ok) return null;
    const json = await res.json();
    const p = json?.payload ?? json?.data ?? json;
    const volume = Math.round(Number(p?.volume ?? p?.day_volume ?? 0));
    let marketCap = Number(p?.market_cap ?? p?.marketCap ?? 0);
    if (marketCap > 0 && marketCap < 1e7) marketCap *= 1e7;
    const pe = Number(p?.pe_ratio ?? p?.pe ?? 0);
    return { volume, marketCap, pe: isNaN(pe) ? 0 : pe };
  } catch {
    return null;
  }
}

interface BseEnrichment {
  ltp: number;
  open: number;
  high: number;
  low: number;
  previousClose: number;
  volume: number;
  marketCap: number;
}

// BSE India official quote API. Returns time-synced intraday OHLC + LTP + TTQ + MCap
// for SME and main-board scrips. Used to fill the gaps Screener leaves (volume, open,
// real intraday high/low, accurate previous close) so verified data matches what the
// exchange shows right now.
async function fetchBseQuote(scripCode: string): Promise<BseEnrichment | null> {
  if (!/^\d{5,7}$/.test(scripCode)) return null;
  try {
    const headers = {
      "User-Agent": UA,
      Accept: "application/json, text/plain, */*",
      Referer: "https://www.bseindia.com/",
      Origin: "https://www.bseindia.com",
    };
    const [headerRes, tradingRes] = await Promise.all([
      withTimeout(
        fetch(
          `https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=${scripCode}&seriesid=`,
          { headers },
        ),
        5000,
      ),
      withTimeout(
        fetch(
          `https://api.bseindia.com/BseIndiaAPI/api/StockTrading/w?quotetype=EQ&scripcode=${scripCode}`,
          { headers },
        ),
        5000,
      ).catch(() => null as Response | null),
    ]);

    if (!headerRes.ok) return null;
    const hjson = await headerRes.json();
    const head = hjson?.Header ?? {};
    const ltp = parseFloat(head?.LTP ?? hjson?.CurrRate?.LTP ?? "0");
    if (!Number.isFinite(ltp) || ltp <= 0) return null;

    const open = parseFloat(head?.Open ?? "0") || ltp;
    const high = parseFloat(head?.High ?? "0") || ltp;
    const low = parseFloat(head?.Low ?? "0") || ltp;
    const prev = parseFloat(head?.PrevClose ?? "0") || ltp;

    let volume = 0;
    let marketCap = 0;
    if (tradingRes && tradingRes.ok) {
      try {
        const tjson = await tradingRes.json();
        // TTQ is in Lakhs by default per BSE response.
        const ttq = parseFloat(tjson?.TTQ ?? "0");
        const ttqUnit = String(tjson?.TTQin ?? "").toLowerCase();
        if (Number.isFinite(ttq) && ttq > 0) {
          if (ttqUnit.includes("lakh")) volume = Math.round(ttq * 1e5);
          else if (ttqUnit.includes("crore")) volume = Math.round(ttq * 1e7);
          else volume = Math.round(ttq);
        }
        // MktCapFull is in Cr by default per BSE response.
        const mcap = parseFloat(tjson?.MktCapFull ?? "0");
        if (Number.isFinite(mcap) && mcap > 0) marketCap = mcap * 1e7;
      } catch (_) { /* non-fatal */ }
    }

    return { ltp, open, high, low, previousClose: prev, volume, marketCap };
  } catch (err) {
    console.error(`fetchBseQuote failed for ${scripCode}:`, (err as Error).message);
    return null;
  }
}

// Field set we track for debug logging. Keep in sync with the Admin UI.
const TRACKED_FIELDS = [
  "price",
  "previousClose",
  "open",
  "high",
  "low",
  "volume",
  "marketCap",
  "pe",
] as const;
type TrackedField = (typeof TRACKED_FIELDS)[number];

function fieldsFromScreener(s: ScrapeResult): {
  filled: TrackedField[];
  missing: TrackedField[];
} {
  // Screener exposes Price, PE, MCap and 52w High/Low; intraday Open/PrevClose/Volume
  // are not on the company header so they default to LTP / 0 inside scrapeScreener.
  const filled: TrackedField[] = [];
  const missing: TrackedField[] = [];
  const push = (f: TrackedField, ok: boolean) => (ok ? filled : missing).push(f);
  push("price", s.price > 0);
  push("previousClose", false); // never on the screener header
  push("open", false);
  push("high", s.high > 0 && s.high !== s.price);
  push("low", s.low > 0 && s.low !== s.price);
  push("volume", false);
  push("marketCap", s.marketCap > 0);
  push("pe", s.pe > 0);
  return { filled, missing };
}

function fieldsFromBse(b: BseEnrichment): {
  filled: TrackedField[];
  missing: TrackedField[];
} {
  const filled: TrackedField[] = [];
  const missing: TrackedField[] = [];
  const push = (f: TrackedField, ok: boolean) => (ok ? filled : missing).push(f);
  push("price", b.ltp > 0);
  push("previousClose", b.previousClose > 0);
  push("open", b.open > 0);
  push("high", b.high > 0);
  push("low", b.low > 0);
  push("volume", b.volume > 0);
  push("marketCap", b.marketCap > 0);
  push("pe", false); // BSE API doesn't return PE
  return { filled, missing };
}

function fieldsFromGroww(g: { volume: number; marketCap: number; pe: number }): {
  filled: TrackedField[];
  missing: TrackedField[];
} {
  const filled: TrackedField[] = [];
  const missing: TrackedField[] = [];
  const push = (f: TrackedField, ok: boolean) => (ok ? filled : missing).push(f);
  // Groww is only consulted for these three.
  for (const f of ["price", "previousClose", "open", "high", "low"] as TrackedField[]) {
    missing.push(f);
  }
  push("volume", g.volume > 0);
  push("marketCap", g.marketCap > 0);
  push("pe", g.pe > 0);
  return { filled, missing };
}

async function isDebugEnabled(
  sb: ReturnType<typeof createClient>,
): Promise<boolean> {
  try {
    const { data } = await sb
      .from("app_settings")
      .select("value")
      .eq("key", "verification_debug_enabled")
      .maybeSingle();
    return data?.value === true || data?.value === "true";
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startedAt = Date.now();
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Per-run debug accumulator. Only persisted at the end if the toggle is on.
  const sourcesUsed: string[] = [];
  const sourceFields: Record<string, { filled: string[]; missing: string[] }> = {};
  let primarySource: string | null = null;
  let resolvedBseCode: string | null = null;
  let errorMessage: string | null = null;

  let ticker = "";
  let exchange = "";

  try {
    const body = await req.json();
    ticker = typeof body?.ticker === "string" ? body.ticker.trim() : "";
    exchange = typeof body?.exchange === "string" ? body.exchange.trim() : "";

    if (!TICKER_RE.test(ticker) || !EXCHANGE_RE.test(exchange)) {
      return new Response(JSON.stringify({ error: "Invalid ticker or exchange" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Screener first (best for Indian small/SME), Google Finance as fallback
    let scraped = await scrapeScreener(ticker);
    if (scraped) {
      sourcesUsed.push("screener");
      sourceFields.screener = fieldsFromScreener(scraped);
      primarySource = "screener";
    } else {
      scraped = await scrapeGoogleFinance(ticker, exchange);
      if (scraped) {
        sourcesUsed.push("google");
        // Google fallback: price/prev/mcap/volume/pe are best-effort, OHLC = price.
        sourceFields.google = {
          filled: [
            ...(scraped.price > 0 ? ["price"] : []),
            ...(scraped.previousClose > 0 ? ["previousClose"] : []),
            ...(scraped.volume > 0 ? ["volume"] : []),
            ...(scraped.marketCap > 0 ? ["marketCap"] : []),
            ...(scraped.pe > 0 ? ["pe"] : []),
          ],
          missing: ["open", "high", "low"],
        };
        primarySource = "google";
      }
    }

    if (!scraped) {
      errorMessage = "Could not verify against Screener or Google Finance";
      // Persist a debug row even on failure if the toggle is on.
      if (await isDebugEnabled(sb)) {
        await sb.from("verification_debug_logs").insert({
          ticker,
          exchange,
          primary_source: "none",
          sources_used: sourcesUsed,
          source_fields: sourceFields,
          final_fields: {},
          final_values: {},
          duration_ms: Date.now() - startedAt,
          error_message: errorMessage,
        });
      }
      return new Response(
        JSON.stringify({ error: errorMessage, ticker }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // BSE India enrichment — fills the intraday OHLC + Volume + MCap gaps Screener
    // doesn't expose, and gives us a fresh, time-synced LTP straight from the exchange.
    const bseCode = scraped.bseCode;
    if (bseCode) {
      resolvedBseCode = bseCode;
      const bse = await fetchBseQuote(bseCode);
      if (bse) {
        sourcesUsed.push("bse");
        sourceFields.bse = fieldsFromBse(bse);
        // Always trust BSE's intraday LTP/OHLC over Screener's cached HTML snapshot.
        scraped.price = bse.ltp;
        scraped.open = bse.open;
        scraped.high = bse.high;
        scraped.low = bse.low;
        scraped.previousClose = bse.previousClose;
        if (bse.volume > 0) scraped.volume = bse.volume;
        if (bse.marketCap > 0) scraped.marketCap = bse.marketCap;
        console.log(
          `BSE enrichment ${ticker} (${bseCode}): LTP=${bse.ltp} O/H/L=${bse.open}/${bse.high}/${bse.low} Vol=${bse.volume} MCap=${bse.marketCap}`,
        );
      }
    }

    // Volume / mcap enrichment via Groww when both Screener and BSE missed them.
    if (scraped.volume === 0 || scraped.marketCap === 0) {
      const groww = await fetchGrowwVolume(ticker, exchange as "NSE" | "BSE");
      if (groww) {
        sourcesUsed.push("groww");
        sourceFields.groww = fieldsFromGroww(groww);
        if (scraped.volume === 0 && groww.volume > 0) scraped.volume = groww.volume;
        if (scraped.marketCap === 0 && groww.marketCap > 0) scraped.marketCap = groww.marketCap;
        if (scraped.pe === 0 && groww.pe > 0) scraped.pe = groww.pe;
      }
    }

    const change = Math.round((scraped.price - scraped.previousClose) * 100) / 100;
    const changePercent =
      scraped.previousClose > 0
        ? Math.round((change / scraped.previousClose) * 10000) / 100
        : 0;

    const now = new Date().toISOString();
    const row = {
      ticker,
      exchange,
      name: scraped.name.slice(0, 200),
      price: scraped.price,
      previous_close: scraped.previousClose,
      change,
      change_percent: changePercent,
      high: scraped.high,
      low: scraped.low,
      open_price: scraped.open,
      volume: Math.max(0, Math.floor(scraped.volume)),
      market_cap: scraped.marketCap,
      pe: scraped.pe,
      updated_at: now,
    };

    const { error: upsertErr } = await sb
      .from("cached_stock_prices")
      .upsert([row], { onConflict: "ticker,exchange" });

    if (upsertErr) {
      console.error("verify-stock-screener upsert error:", upsertErr);
      errorMessage = "Failed to persist verified data";
      if (await isDebugEnabled(sb)) {
        await sb.from("verification_debug_logs").insert({
          ticker,
          exchange,
          primary_source: primarySource,
          sources_used: sourcesUsed,
          source_fields: sourceFields,
          final_fields: {},
          final_values: {},
          bse_code: resolvedBseCode,
          duration_ms: Date.now() - startedAt,
          error_message: errorMessage,
        });
      }
      return new Response(JSON.stringify({ error: errorMessage }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await sb
        .from("stock_price_history")
        .insert({ ticker, exchange, price: scraped.price, recorded_at: now });
    } catch (_) { /* non-fatal */ }

    // Persist the debug row for a successful run.
    if (await isDebugEnabled(sb)) {
      const finalFields: Record<string, boolean> = {
        price: scraped.price > 0,
        previousClose: scraped.previousClose > 0,
        open: scraped.open > 0,
        high: scraped.high > 0,
        low: scraped.low > 0,
        volume: scraped.volume > 0,
        marketCap: scraped.marketCap > 0,
        pe: scraped.pe > 0,
      };
      const finalValues = {
        price: scraped.price,
        previousClose: scraped.previousClose,
        open: scraped.open,
        high: scraped.high,
        low: scraped.low,
        volume: scraped.volume,
        marketCap: scraped.marketCap,
        pe: scraped.pe,
      };
      try {
        await sb.from("verification_debug_logs").insert({
          ticker,
          exchange,
          primary_source: primarySource,
          sources_used: sourcesUsed,
          source_fields: sourceFields,
          final_fields: finalFields,
          final_values: finalValues,
          bse_code: resolvedBseCode,
          duration_ms: Date.now() - startedAt,
        });
      } catch (logErr) {
        console.error("verification_debug_logs insert failed:", (logErr as Error).message);
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        source: scraped.source,
        verifiedAt: now,
        data: {
          ltp: scraped.price,
          open: scraped.open,
          high: scraped.high,
          low: scraped.low,
          close: scraped.previousClose,
          volume: scraped.volume,
          marketCap: scraped.marketCap,
          pe: scraped.pe,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("verify-stock-screener error:", err);
    errorMessage = (err as Error)?.message || "Internal server error";
    try {
      if (ticker && exchange && (await isDebugEnabled(sb))) {
        await sb.from("verification_debug_logs").insert({
          ticker,
          exchange,
          primary_source: primarySource ?? "none",
          sources_used: sourcesUsed,
          source_fields: sourceFields,
          final_fields: {},
          final_values: {},
          bse_code: resolvedBseCode,
          duration_ms: Date.now() - startedAt,
          error_message: errorMessage,
        });
      }
    } catch (_) { /* swallow */ }
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
