import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { getUserIdFromAuthHeader } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TICKER_RE = /^[A-Za-z0-9_\-.]{1,30}$/;

// Well-known Indian stock sectors as fallback
const KNOWN_SECTORS: Record<string, string> = {
  RELIANCE: "Oil & Gas", TATAMOTORS: "Automobile", TCS: "Information Technology",
  INFY: "Information Technology", HDFCBANK: "Banking", ICICIBANK: "Banking",
  SBIN: "Banking", KOTAKBANK: "Banking", AXISBANK: "Banking", INDUSINDBK: "Banking",
  BAJFINANCE: "Financial Services", BAJAJFINSV: "Financial Services",
  HCLTECH: "Information Technology", WIPRO: "Information Technology",
  TECHM: "Information Technology", LTIM: "Information Technology",
  HINDUNILVR: "FMCG", ITC: "FMCG", NESTLEIND: "FMCG", BRITANNIA: "FMCG",
  MARUTI: "Automobile", BAJAJ_AUTO: "Automobile", HEROMOTOCO: "Automobile", EICHERMOT: "Automobile",
  BHARTIARTL: "Telecom", JIOFINANCE: "Financial Services",
  SUNPHARMA: "Pharma", DRREDDY: "Pharma", CIPLA: "Pharma", DIVISLAB: "Pharma",
  APOLLOHOSP: "Healthcare", MAXHEALTH: "Healthcare",
  LT: "Construction", ULTRACEMCO: "Cement", SHREECEM: "Cement", AMBUJACEM: "Cement",
  ADANIENT: "Diversified", ADANIPORTS: "Infrastructure", ADANIGREEN: "Power",
  NTPC: "Power", POWERGRID: "Power", TATAPOWER: "Power",
  TATASTEEL: "Metals", JSWSTEEL: "Metals", HINDALCO: "Metals", COALINDIA: "Mining",
  ONGC: "Oil & Gas", BPCL: "Oil & Gas", IOC: "Oil & Gas", GAIL: "Oil & Gas",
  ASIANPAINT: "Chemicals", PIDILITIND: "Chemicals", BERGEPAINT: "Chemicals",
  TITAN: "Consumer Durables", HAVELLS: "Consumer Durables", VOLTAS: "Consumer Durables",
  POLYCAB: "Consumer Durables", CROMPTON: "Consumer Durables",
  DMART: "Retail", TRENT: "Retail",
  HDFCLIFE: "Insurance", SBILIFE: "Insurance", ICICIPRULI: "Insurance",
  IRCTC: "Tourism", INDIGO: "Aviation",
  ZOMATO: "Internet", NAUKRI: "Internet", PAYTM: "Internet",
  PERSISTENT: "Information Technology", COFORGE: "Information Technology",
  KFINTECH: "Financial Services", CAMS: "Financial Services",
  GANDHAR: "Chemicals", RPSGVENT: "Diversified",
};

function extractSectorFromHtml(html: string): string | null {
  const patterns = [
    /title="Sector"[^>]*>([^<]+)<\/a>/i,
    /class="sub"[^>]*>[^<]*<a[^>]*>([^<]+)<\/a>/i,
    /title="Broad Sector"[^>]*>([^<]+)<\/a>/i,
    /title="Industry"[^>]*>([^<]+)<\/a>/i,
    /Sector\s*(?::|=)\s*([A-Za-z &,]+)/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m?.[1]) {
      const sector = m[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
      if (sector.length > 1 && sector.length < 60) return sector;
    }
  }
  return null;
}

async function fetchScreenerHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    return await res.text();
  } catch {
    return null;
  }
}

async function fetchSectorFromScreener(ticker: string): Promise<string | null> {
  // Try direct ticker URL first
  const html = await fetchScreenerHtml(
    `https://www.screener.in/company/${encodeURIComponent(ticker)}/`
  );
  if (html) {
    const sector = extractSectorFromHtml(html);
    if (sector) return sector;
  }

  // Fallback: use Screener search API to find the correct company page
  try {
    const searchRes = await fetch(
      `https://www.screener.in/api/company/search/?q=${encodeURIComponent(ticker)}`,
      {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!searchRes.ok) return null;
    const results = await searchRes.json();
    if (!Array.isArray(results) || results.length === 0) return null;

    // Use the first search result's URL (e.g. /company/526443/)
    const companyUrl = results[0]?.url;
    if (!companyUrl) return null;

    console.log(`Screener search resolved ${ticker} → ${companyUrl}`);
    const companyHtml = await fetchScreenerHtml(`https://www.screener.in${companyUrl}`);
    if (companyHtml) {
      return extractSectorFromHtml(companyHtml);
    }
  } catch {
    // ignore
  }

  return null;
}

async function fetchSectorFromGoogle(ticker: string): Promise<string | null> {
  try {
    // Try NSE first, then BSE
    for (const exchange of ["NSE", "BOM"]) {
      const url = `https://www.google.com/finance/quote/${encodeURIComponent(ticker)}:${exchange}`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const html = await res.text();

      const patterns = [
        /data-attrid="Sector"[^>]*>([^<]+)/i,
        /"sector"\s*:\s*"([^"]+)"/i,
        /Sector<\/[^>]+>[^<]*<[^>]+>([^<]+)/i,
        // Google Finance shows sector in about section
        /About[^]*?<div[^>]*>([A-Z][a-z]+(?:\s+[A-Za-z&]+)*)\s*sector/i,
      ];

      for (const p of patterns) {
        const m = html.match(p);
        if (m?.[1]) {
          const sector = m[1].trim();
          if (sector.length > 1 && sector.length < 60) return sector;
        }
      }
    }
    return null;
  } catch {
    return null;
  }
}

// Try Yahoo Finance sector lookup
async function fetchSectorFromYahoo(ticker: string): Promise<string | null> {
  try {
    for (const suffix of [".NS", ".BO"]) {
      const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}${suffix}?modules=assetProfile`;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) continue;
      const data = await res.json();
      const sector = data?.quoteSummary?.result?.[0]?.assetProfile?.sector;
      if (sector && sector !== "N/A") return sector;
    }
    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Require an authenticated Supabase user
  const userId = await getUserIdFromAuthHeader(req.headers.get("Authorization"));
  if (!userId) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const { tickers } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    // Validate ticker format to prevent injection / abuse
    const safeTickers = tickers.filter((t: unknown): t is string => typeof t === "string" && TICKER_RE.test(t));
    if (safeTickers.length === 0) {
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    const limited = tickers.slice(0, 20);
    const results: Record<string, string> = {};

    // Step 1: Check sector_cache first
    const { data: cached } = await sb
      .from("sector_cache")
      .select("ticker, sector")
      .in("ticker", limited);

    const cachedMap = new Map((cached || []).map((c: any) => [c.ticker, c.sector]));
    const uncached: string[] = [];

    for (const t of limited) {
      if (cachedMap.has(t)) {
        results[t] = cachedMap.get(t)!;
      } else {
        uncached.push(t);
      }
    }

    // Step 2: For uncached, try known map → Screener → Yahoo → Google
    if (uncached.length > 0) {
      const toCache: { ticker: string; sector: string; source: string }[] = [];

      await Promise.all(
        uncached.map(async (ticker) => {
          let sector: string | null = null;
          let source = "unknown";

          // Known fallback map
          if (KNOWN_SECTORS[ticker]) {
            sector = KNOWN_SECTORS[ticker];
            source = "known_map";
          }

          // Try Screener.in (most reliable for Indian stocks)
          if (!sector) {
            sector = await fetchSectorFromScreener(ticker);
            if (sector) source = "screener";
          }

          // Try Yahoo Finance
          if (!sector) {
            sector = await fetchSectorFromYahoo(ticker);
            if (sector) source = "yahoo";
          }

          // Try Google Finance
          if (!sector) {
            sector = await fetchSectorFromGoogle(ticker);
            if (sector) source = "google";
          }

          if (sector) {
            results[ticker] = sector;
            toCache.push({ ticker, sector, source });
          }
        })
      );

      // Step 3: Cache results for future lookups
      if (toCache.length > 0) {
        await sb.from("sector_cache").upsert(
          toCache.map(c => ({
            ticker: c.ticker,
            sector: c.sector,
            source: c.source,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "ticker" }
        );
        console.log(`Cached sectors for: ${toCache.map(c => `${c.ticker}=${c.sector}`).join(", ")}`);
      }
    }

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Sector lookup error:", err);
    return new Response(JSON.stringify({ error: "Failed to lookup sectors" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
