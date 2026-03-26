import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function fetchSectorFromScreener(ticker: string): Promise<string | null> {
  try {
    const url = `https://www.screener.in/company/${encodeURIComponent(ticker)}/`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Look for sector in the company info section
    const sectorMatch = html.match(
      /Sector\s*<\/span>\s*<span[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i
    );
    if (sectorMatch) return sectorMatch[1].trim();

    // Fallback: look for industry
    const industryMatch = html.match(
      /Industry\s*<\/span>\s*<span[^>]*>\s*<a[^>]*>([^<]+)<\/a>/i
    );
    if (industryMatch) return industryMatch[1].trim();

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

    // Limit to 10 at a time to avoid overloading
    const limited = tickers.slice(0, 10);
    const results: Record<string, string | null> = {};

    await Promise.all(
      limited.map(async (ticker: string) => {
        results[ticker] = await fetchSectorFromScreener(ticker);
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
