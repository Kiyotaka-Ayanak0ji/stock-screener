// Verify a single stock against Screener.in (and Google Finance fallback) on demand.
// Public endpoint — market data is non-sensitive. Strict input validation,
// short timeouts, single-ticker rate-friendly. Writes go through the service role.
//
// Resolves numeric BSE codes (e.g. AVAX → 543291) by hitting Screener's search API
// first, so users can verify SME / numeric-coded BSE stocks. Volume falls back to
// Groww (when the secret is set) for stocks where Screener returns 0.

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
  source: "screener" | "google";
}

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Resolve a Screener slug for a ticker. Numeric BSE codes (e.g. 543291) and
// alphanumeric tickers like AVAX/BCCFUBA may not exist directly at /company/<ticker>/,
// so we hit Screener's search endpoint to find the right slug.
async function resolveScreenerSlug(ticker: string): Promise<string | null> {
  // Try direct first — fastest path for well-known tickers like RELIANCE.
  try {
    const direct = await withTimeout(
      fetch(`https://www.screener.in/company/${encodeURIComponent(ticker)}/`, {
        method: "HEAD",
        headers: { "User-Agent": UA },
      }),
      4000,
    );
    if (direct.ok) return ticker;
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
    if (slug) console.log(`Resolved ${ticker} → Screener slug: ${slug}`);
    return slug;
  } catch (err) {
    console.error(`resolveScreenerSlug failed for ${ticker}:`, (err as Error).message);
    return null;
  }
}

async function scrapeScreener(ticker: string): Promise<ScrapeResult | null> {
  try {
    const slug = await resolveScreenerSlug(ticker);
    if (!slug) return null;

    const url = `https://www.screener.in/company/${encodeURIComponent(slug)}/`;
    const res = await withTimeout(
      fetch(url, { headers: { "User-Agent": UA, Accept: "text/html" } }),
      FETCH_TIMEOUT_MS,
    );
    if (!res.ok) return null;
    const html = await res.text();

    const priceMatch = html.match(/₹\s*([\d,]+(?:\.\d+)?)/);
    if (!priceMatch) return null;
    const price = parseFloat(priceMatch[1].replace(/,/g, ""));
    if (!Number.isFinite(price) || price <= 0) return null;

    let marketCap = 0;
    const mc = html.match(/Market Cap[\s\S]*?<span class="number">([\d,]+(?:\.\d+)?)<\/span>/i);
    if (mc) marketCap = parseFloat(mc[1].replace(/,/g, "")) * 10000000; // Cr → raw

    // Volume — try multiple shapes Screener uses across MAIN and SME pages.
    let volume = 0;
    const volPatterns = [
      /Volume[\s\S]{0,400}?<span class="number">([\d,]+(?:\.\d+)?)<\/span>/i,
      /<li[^>]*>[\s\S]{0,200}?Volume[\s\S]{0,200}?<span[^>]*>([\d,]+(?:\.\d+)?)<\/span>/i,
      /"volume"\s*:\s*([\d.]+)/i,
    ];
    for (const re of volPatterns) {
      const m = html.match(re);
      if (m) {
        const v = parseFloat(m[1].replace(/,/g, ""));
        if (Number.isFinite(v) && v > 0) { volume = Math.round(v); break; }
      }
    }

    let pe = 0;
    const peLi = html.match(/Stock P\/E[\s\S]*?<\/li>/i);
    if (peLi) {
      const peNum = peLi[0].match(/<span class="number">([\d,]+(?:\.\d+)?)<\/span>/);
      if (peNum) {
        const v = parseFloat(peNum[1].replace(/,/g, ""));
        if (Number.isFinite(v) && v > 0) pe = v;
      }
    }

    let high = price, low = price, open = price, previousClose = price;
    const highMatch = html.match(/High[\s\S]*?₹\s*([\d,]+(?:\.\d+)?)/i);
    if (highMatch) {
      const v = parseFloat(highMatch[1].replace(/,/g, ""));
      if (Number.isFinite(v) && v > 0) high = v;
    }
    const lowMatch = html.match(/Low[\s\S]*?₹\s*([\d,]+(?:\.\d+)?)/i);
    if (lowMatch) {
      const v = parseFloat(lowMatch[1].replace(/,/g, ""));
      if (Number.isFinite(v) && v > 0) low = v;
    }

    let name = ticker;
    const titleMatch = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/);
    if (titleMatch) name = titleMatch[1].trim().slice(0, 200);

    return { price, previousClose, high, low, open, volume, marketCap, pe, name, source: "screener" };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const ticker = typeof body?.ticker === "string" ? body.ticker.trim() : "";
    const exchange = typeof body?.exchange === "string" ? body.exchange.trim() : "";

    if (!TICKER_RE.test(ticker) || !EXCHANGE_RE.test(exchange)) {
      return new Response(JSON.stringify({ error: "Invalid ticker or exchange" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Screener first (best for Indian small/SME), Google Finance as fallback
    let scraped = await scrapeScreener(ticker);
    if (!scraped) scraped = await scrapeGoogleFinance(ticker, exchange);

    if (!scraped) {
      return new Response(
        JSON.stringify({ error: "Could not verify against Screener or Google Finance", ticker }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Volume / mcap enrichment via Groww when Screener missed them.
    if (scraped.volume === 0 || scraped.marketCap === 0) {
      const groww = await fetchGrowwVolume(ticker, exchange as "NSE" | "BSE");
      if (groww) {
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

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: upsertErr } = await sb
      .from("cached_stock_prices")
      .upsert([row], { onConflict: "ticker,exchange" });

    if (upsertErr) {
      console.error("verify-stock-screener upsert error:", upsertErr);
      return new Response(JSON.stringify({ error: "Failed to persist verified data" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await sb
        .from("stock_price_history")
        .insert({ ticker, exchange, price: scraped.price, recorded_at: now });
    } catch (_) { /* non-fatal */ }

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
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
