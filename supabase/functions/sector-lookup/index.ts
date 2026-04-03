import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Multiple extraction strategies for maximum accuracy
async function fetchSectorFromScreener(ticker: string): Promise<string | null> {
  try {
    // Strategy 1: Try Screener.in company page
    const url = `https://www.screener.in/company/${encodeURIComponent(ticker)}/`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Match from company info section - multiple patterns
    // Pattern 1: Sector link in company header/info
    const sectorPatterns = [
      /title="Sector"[^>]*>([^<]+)<\/a>/i,
      /<a[^>]*href="\/screen\/raw\/[^"]*sector[^"]*"[^>]*>([^<]+)<\/a>/i,
      /Sector\s*:\s*<[^>]*>([^<]+)</i,
      /class="sub"[^>]*>([^<]+)<\/a>\s*<\/li>\s*<li[^>]*>\s*<a[^>]*title="Industry"/i,
    ];

    for (const pattern of sectorPatterns) {
      const match = html.match(pattern);
      if (match && match[1]) {
        const sector = match[1].replace(/&amp;/g, "&").replace(/&#39;/g, "'").trim();
        if (sector.length > 1 && sector.length < 60) return sector;
      }
    }

    // Pattern 2: Broad Sector from peers section
    const broadMatch = html.match(/title="Broad Sector"[^>]*>([^<]+)<\/a>/i);
    if (broadMatch) return broadMatch[1].replace(/&amp;/g, "&").trim();

    // Pattern 3: Industry as fallback
    const industryMatch = html.match(/title="Industry"[^>]*>([^<]+)<\/a>/i);
    if (industryMatch) return industryMatch[1].replace(/&amp;/g, "&").trim();

    // Pattern 4: Extract from peers table header
    const peersMatch = html.match(/Peer comparison.*?<a[^>]*>([^<]+)<\/a>/is);
    if (peersMatch) return peersMatch[1].replace(/&amp;/g, "&").trim();

    return null;
  } catch {
    return null;
  }
}

// Fallback: Try Google Finance for sector
async function fetchSectorFromGoogle(ticker: string): Promise<string | null> {
  try {
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(ticker)}:NSE`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Google Finance shows sector in company description area
    const sectorMatch = html.match(/data-attrid="Sector"[^>]*>([^<]+)/i) 
      || html.match(/"sector"\s*:\s*"([^"]+)"/i)
      || html.match(/Sector<\/[^>]+>[^<]*<[^>]+>([^<]+)/i);
    if (sectorMatch) return sectorMatch[1].trim();

    return null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tickers } = await req.json();
    if (!Array.isArray(tickers) || tickers.length === 0) {
      return new Response(JSON.stringify({}), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limited = tickers.slice(0, 15);
    const results: Record<string, string | null> = {};

    await Promise.all(
      limited.map(async (ticker: string) => {
        // Try Screener first
        let sector = await fetchSectorFromScreener(ticker);
        
        // Fallback to Google Finance if Screener fails
        if (!sector) {
          sector = await fetchSectorFromGoogle(ticker);
        }
        
        results[ticker] = sector;
      })
    );

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
