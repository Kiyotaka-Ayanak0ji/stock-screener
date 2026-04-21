import { getUserIdFromAuthHeader } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// For numeric BSE codes, fetch the Screener company page to extract the BSE trading symbol
async function resolveBseTradingSymbol(bseCode: string): Promise<{ tradingSymbol: string | null; isIndex: boolean; yahooSymbol: string | null }> {
  try {
    const res = await fetch(`https://www.screener.in/company/${bseCode}/`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return { tradingSymbol: null, isIndex: false, yahooSymbol: null };
    const html = await res.text();

    // Check if this is an index page (has "Constituents" section or "Index" in title)
    const isIndex = /class="sub-heading"[^>]*>.*Index/i.test(html) || 
                    /id="constituents"/i.test(html) ||
                    /<title>[^<]*Index[^<]*<\/title>/i.test(html);

    if (isIndex) {
      // Try to find the Yahoo Finance symbol by searching Yahoo
      const yahooSymbol = await resolveYahooIndexSymbol(bseCode, html);
      // Extract the index name from the page title
      const titleMatch = html.match(/<title>\s*([^<]+?)\s*-/);
      const indexName = titleMatch ? titleMatch[1].trim() : null;
      console.log(`Detected index: ${bseCode} → Yahoo: ${yahooSymbol}, Name: ${indexName}`);
      return { tradingSymbol: null, isIndex: true, yahooSymbol };
    }
    
    // Look for BSE link pattern: bseindia.com/stock-share-price/.../TRADINGSYMBOL/CODE/
    const bseMatch = html.match(/bseindia\.com\/stock-share-price\/[^/]+\/([A-Z0-9]+)\/\d+/);
    if (bseMatch && bseMatch[1]) {
      console.log(`Resolved BSE code ${bseCode} to trading symbol: ${bseMatch[1]}`);
      return { tradingSymbol: bseMatch[1], isIndex: false, yahooSymbol: null };
    }
    return { tradingSymbol: null, isIndex: false, yahooSymbol: null };
  } catch (err) {
    console.error(`Failed to resolve BSE trading symbol for ${bseCode}:`, err);
    return { tradingSymbol: null, isIndex: false, yahooSymbol: null };
  }
}

// Resolve a Yahoo Finance symbol for a BSE/NSE index
async function resolveYahooIndexSymbol(screenerCode: string, html: string): Promise<string | null> {
  try {
    // Extract the index name from the HTML
    const titleMatch = html.match(/<h1[^>]*>\s*([^<]+?)\s*<\/h1>/);
    const indexName = titleMatch ? titleMatch[1].trim() : '';
    
    if (!indexName) return null;

    // Search Yahoo Finance for this index
    const searchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(indexName)}&quotesCount=5&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&multiQuoteQueryId=multi_quote_single_token_query&enableCb=false&enableNavLinks=false`;
    
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!searchRes.ok) return null;
    const searchData = await searchRes.json();
    
    // Look for an index result (.BO or ^-prefixed)
    const quotes = searchData.quotes || [];
    const indexResult = quotes.find((q: any) => 
      q.quoteType === 'INDEX' || 
      (q.symbol && (q.symbol.endsWith('.BO') || q.symbol.startsWith('^')))
    );

    if (indexResult) {
      console.log(`Yahoo Finance resolved index "${indexName}" → ${indexResult.symbol}`);
      return indexResult.symbol;
    }

    return null;
  } catch (err) {
    console.error(`Failed to resolve Yahoo index symbol for ${screenerCode}:`, err);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Auth is optional - guests can also search for stocks to add.
  // We still attempt to read the user id for logging/rate-limiting purposes,
  // but do not block unauthenticated callers.
  await getUserIdFromAuthHeader(req.headers.get("Authorization")).catch(() => null);

  try {
    const { query } = await req.json();

    if (!query || typeof query !== "string" || query.trim().length < 1) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    // Cap query length and restrict to safe characters to prevent abuse
    if (query.length > 100 || !/^[A-Za-z0-9 .&_\-]+$/.test(query.trim())) {
      return new Response(JSON.stringify({ results: [], error: 'Invalid query' }), {
        status: 400,
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

      // Detect index by name
      const isLikelyIndex = /\bindex\b/i.test(name);

      return { ticker, name, exchange, bseCode: /^\d+$/.test(ticker) ? ticker : null, isLikelyIndex };
    }).filter((item: any) => item.ticker && item.name);

    // Resolve BSE numeric codes to trading symbols (or index info) in parallel
    const results = await Promise.all(
      parsed.map(async (item: any) => {
        if (item.bseCode) {
          const resolved = await resolveBseTradingSymbol(item.bseCode);
          
          if (resolved.isIndex && resolved.yahooSymbol) {
            // It's an index with a valid Yahoo symbol
            return {
              ticker: item.name.replace(/[^a-zA-Z0-9 ]/g, '').replace(/\s+/g, '_').toUpperCase().slice(0, 30),
              name: item.name,
              exchange: 'BSE' as const,
              isIndex: true,
              yahooSymbol: resolved.yahooSymbol,
              screenerCode: item.bseCode,
            };
          }
          
          if (resolved.tradingSymbol) {
            return { ticker: resolved.tradingSymbol, name: item.name, exchange: 'BSE' as const, screenerCode: item.bseCode };
          }
        }
        
        const result: any = { ticker: item.ticker, name: item.name, exchange: item.exchange, screenerCode: item.ticker };
        if (item.isLikelyIndex) {
          result.isIndex = true;
        }
        return result;
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
