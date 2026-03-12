const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// For numeric BSE codes, fetch the Screener company page to extract the BSE trading symbol
async function resolveBseTradingSymbol(bseCode: string): Promise<string | null> {
  try {
    const res = await fetch(`https://www.screener.in/company/${bseCode}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();
    
    // Look for BSE link pattern: bseindia.com/stock-share-price/.../TRADINGSYMBOL/CODE/
    const bseMatch = html.match(/bseindia\.com\/stock-share-price\/[^/]+\/([A-Z0-9]+)\/\d+/);
    if (bseMatch && bseMatch[1]) {
      console.log(`Resolved BSE code ${bseCode} to trading symbol: ${bseMatch[1]}`);
      return bseMatch[1];
    }
    return null;
  } catch (err) {
    console.error(`Failed to resolve BSE trading symbol for ${bseCode}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 1) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query.trim())}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Screener API error:', response.status, text);
      return new Response(JSON.stringify({ results: [], error: 'Screener API error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Screener returns array of objects like: { id, name, url }
    // url format: "/company/RELIANCE/consolidated/" or "/company/500325/consolidated/"
    const parsed = (data || []).map((item: any) => {
      const urlParts = (item.url || '').split('/');
      const ticker = urlParts[2] || '';
      
      let exchange: 'NSE' | 'BSE' = 'NSE';
      let name = item.name || '';
      
      if (name.includes('BSE:')) {
        exchange = 'BSE';
        name = name.split(' - BSE:')[0].trim();
      } else if (name.includes('NSE:')) {
        name = name.split(' - NSE:')[0].trim();
      }

      // Numeric tickers are always BSE codes
      if (/^\d+$/.test(ticker)) {
        exchange = 'BSE';
      }

      return { ticker, name, exchange, bseCode: /^\d+$/.test(ticker) ? ticker : null };
    }).filter((item: any) => item.ticker && item.name);

    // Resolve BSE numeric codes to trading symbols in parallel
    const results = await Promise.all(
      parsed.map(async (item: any) => {
        if (item.bseCode) {
          const tradingSymbol = await resolveBseTradingSymbol(item.bseCode);
          if (tradingSymbol) {
            return { ticker: tradingSymbol, name: item.name, exchange: 'BSE' as const };
          }
        }
        return { ticker: item.ticker, name: item.name, exchange: item.exchange };
      })
    );

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ results: [], error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
