const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiry = 0;

async function getCrumbAndCookie(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  const initRes = await fetch('https://fc.yahoo.com', {
    redirect: 'manual',
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  });
  await initRes.text();

  const setCookieHeader = initRes.headers.get('set-cookie') || '';
  const cookieMatch = setCookieHeader.match(/A3=([^;]+)/);
  const cookie = cookieMatch ? `A3=${cookieMatch[1]}` : '';

  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36', 'Cookie': cookie },
  });
  const crumb = await crumbRes.text();

  cachedCrumb = crumb;
  cachedCookie = cookie;
  crumbExpiry = Date.now() + 10 * 60 * 1000;

  return { crumb, cookie };
}

// Fallback 3: scrape Google Finance for SME stocks missing from both Yahoo and Screener
async function fetchGoogleFinanceFallback(ticker: string, exchange: string): Promise<Record<string, number> | null> {
  try {
    // Google Finance uses exchange:TICKER format (e.g., NSE:BCCFUBA or BOM:BCCFUBA)
    const gExchange = exchange === 'BSE' ? 'BOM' : 'NSE';
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(ticker)}:${gExchange}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) { console.log(`Google Finance returned ${res.status} for ${ticker}:${gExchange}`); return null; }
    const html = await res.text();

    // Extract price from data-last-price attribute
    const priceAttr = html.match(/data-last-price="([\d.]+)"/);
    if (!priceAttr) {
      console.log(`Google Finance: no price found for ${ticker}:${gExchange}`);
      // Try alternate exchange
      if (exchange === 'NSE') {
        return fetchGoogleFinanceFallback(ticker, 'BSE');
      }
      return null;
    }

    const price = parseFloat(priceAttr[1]);
    if (price <= 0 || isNaN(price)) return null;

    // Extract previous close
    let close = price;
    const prevCloseMatch = html.match(/Previous close[\s\S]*?>([\d,]+\.\d+)</);
    if (prevCloseMatch) {
      close = parseFloat(prevCloseMatch[1].replace(/,/g, ''));
    }

    // Extract open, high, low from the "Today's range" or individual fields
    let open = price, high = price, low = price;
    const openMatch = html.match(/Open[\s\S]*?>([\d,]+\.\d+)</);
    if (openMatch) open = parseFloat(openMatch[1].replace(/,/g, ''));
    const highMatch = html.match(/High[\s\S]*?>([\d,]+\.\d+)</);
    if (highMatch) high = parseFloat(highMatch[1].replace(/,/g, ''));
    const lowMatch = html.match(/Low[\s\S]*?>([\d,]+\.\d+)</);
    if (lowMatch) low = parseFloat(lowMatch[1].replace(/,/g, ''));

    // Extract volume
    let volume = 0;
    const volMatch = html.match(/Avg volume[\s\S]*?>([\d,]+(?:\.\d+)?[MBK]?)</i) || html.match(/Volume[\s\S]*?>([\d,]+(?:\.\d+)?[MBK]?)</i);
    if (volMatch) {
      let volStr = volMatch[1].replace(/,/g, '');
      if (volStr.endsWith('M')) volume = parseFloat(volStr) * 1_000_000;
      else if (volStr.endsWith('B')) volume = parseFloat(volStr) * 1_000_000_000;
      else if (volStr.endsWith('K')) volume = parseFloat(volStr) * 1_000;
      else volume = Math.round(parseFloat(volStr));
    }

    // Extract market cap
    let marketCap = 0;
    const mcMatch = html.match(/Market cap[\s\S]*?>([\d,.]+[TBMK]?\s*[A-Z]{3}?)</i);
    if (mcMatch) {
      let mcStr = mcMatch[1].replace(/[A-Z]{3}$/i, '').trim().replace(/,/g, '');
      if (mcStr.endsWith('T')) marketCap = parseFloat(mcStr) * 1_000_000_000_000;
      else if (mcStr.endsWith('B')) marketCap = parseFloat(mcStr) * 1_000_000_000;
      else if (mcStr.endsWith('M')) marketCap = parseFloat(mcStr) * 1_000_000;
      else if (mcStr.endsWith('K')) marketCap = parseFloat(mcStr) * 1_000;
      else marketCap = parseFloat(mcStr) || 0;
    }

    console.log(`Google Finance fallback: ${ticker}:${gExchange} = ₹${price}, MCap=${marketCap}, Vol=${volume}`);
    return { ltp: price, open, high, low, close, volume, marketCap };
  } catch (err) {
    console.error(`Google Finance fallback error for ${ticker}:`, err);
    return null;
  }
}

// Fallback 1: scrape Screener.in for SME/unlisted stocks Yahoo doesn't cover
async function fetchScreenerFallback(ticker: string): Promise<Record<string, number> | null> {
  try {
    const url = `https://www.screener.in/company/${encodeURIComponent(ticker)}/`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) { console.log(`Screener returned ${res.status} for ${ticker}`); return null; }
    const html = await res.text();

    // Extract first price: <span>₹ 330</span>
    const priceMatch = html.match(/₹\s*([\d,]+(?:\.\d+)?)/);
    if (!priceMatch) { console.log(`Screener: no price found for ${ticker}`); return null; }

    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (price <= 0 || isNaN(price)) return null;

    // Extract market cap value (appears after "Market Cap" label)
    let marketCap = 0;
    const mcSection = html.match(/Market Cap[\s\S]*?<span class="number">([\d,]+(?:\.\d+)?)<\/span>/i);
    if (mcSection) {
      marketCap = parseFloat(mcSection[1].replace(/,/g, '')) * 10000000; // Cr to raw
    }

    // Extract volume from "Volume" row in the top ratios section
    let volume = 0;
    const volMatch = html.match(/Volume[\s\S]*?<span class="number">([\d,]+(?:\.\d+)?)<\/span>/i);
    if (volMatch) {
      volume = Math.round(parseFloat(volMatch[1].replace(/,/g, '')));
    }

    console.log(`Screener fallback: ${ticker} = ₹${price}, MCap=${marketCap}, Vol=${volume}`);

    return { ltp: price, open: price, high: price, low: price, close: price, volume, marketCap };
  } catch (err) {
    console.error(`Screener fallback error for ${ticker}:`, err);
    return null;
  }
}

// Fetch only market cap and volume from Screener for enrichment
async function fetchScreenerEnrichment(ticker: string): Promise<{ marketCap?: number; volume?: number } | null> {
  try {
    const url = `https://www.screener.in/company/${encodeURIComponent(ticker)}/`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const result: { marketCap?: number; volume?: number } = {};

    const mcSection = html.match(/Market Cap[\s\S]*?<span class="number">([\d,]+(?:\.\d+)?)<\/span>/i);
    if (mcSection) {
      result.marketCap = parseFloat(mcSection[1].replace(/,/g, '')) * 10000000;
    }

    const volMatch = html.match(/Volume[\s\S]*?<span class="number">([\d,]+(?:\.\d+)?)<\/span>/i);
    if (volMatch) {
      result.volume = Math.round(parseFloat(volMatch[1].replace(/,/g, '')));
    }

    return result;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ error: 'symbols array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const yahooSymbols = symbols.map((s: { ticker: string; exchange: string; yahooSymbol?: string }) => {
      if (s.yahooSymbol) return s.yahooSymbol;
      const suffix = s.exchange === 'BSE' ? '.BO' : '.NS';
      return `${s.ticker}${suffix}`;
    }).join(',');

    let data: any;
    for (let attempt = 0; attempt < 2; attempt++) {
      const { crumb, cookie } = await getCrumbAndCookie();
      const url = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooSymbols)}&crumb=${encodeURIComponent(crumb)}`;

      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Cookie': cookie,
        },
      });

      if (response.status === 401 && attempt === 0) {
        await response.text();
        cachedCrumb = null; cachedCookie = null; crumbExpiry = 0;
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        console.error('Yahoo Finance error:', response.status, text);
        return new Response(JSON.stringify({ error: 'Yahoo Finance error', status: response.status }), {
          status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      data = await response.json();
      break;
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'Failed after retries' }), {
        status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const quotes = data?.quoteResponse?.result || [];
    const result: Record<string, Record<string, number>> = {};

    const yahooToKey = new Map<string, string>();
    symbols.forEach((s: { ticker: string; exchange: string; yahooSymbol?: string }) => {
      if (s.yahooSymbol) yahooToKey.set(s.yahooSymbol, `${s.exchange}_${s.ticker}`);
    });

    const resolvedKeys = new Set<string>();

    for (const q of quotes) {
      const symbol = q.symbol || '';
      const ltp = q.regularMarketPrice ?? 0;
      if (ltp === 0) continue;

      const quoteData = {
        ltp,
        open: q.regularMarketOpen ?? 0,
        high: q.regularMarketDayHigh ?? 0,
        low: q.regularMarketDayLow ?? 0,
        close: q.regularMarketPreviousClose ?? 0,
        volume: q.regularMarketVolume ?? 0,
        marketCap: q.marketCap ?? 0,
      };

      const mappedKey = yahooToKey.get(symbol);
      if (mappedKey) {
        result[mappedKey] = quoteData;
        resolvedKeys.add(mappedKey);
        continue;
      }

      const isBSE = symbol.endsWith('.BO');
      const ticker = symbol.replace(/\.(NS|BO)$/, '');
      const exchange = isBSE ? 'BSE' : 'NSE';
      const key = `${exchange}_${ticker}`;
      result[key] = quoteData;
      resolvedKeys.add(key);
    }

    // Fallback via Screener.in for completely unresolved tickers
    const missingSymbols = symbols.filter((s: { ticker: string; exchange: string }) => {
      return !resolvedKeys.has(`${s.exchange}_${s.ticker}`);
    });

    // Identify resolved tickers that need enrichment (marketCap=0 or volume=0)
    const needsEnrichment = symbols.filter((s: { ticker: string; exchange: string }) => {
      const key = `${s.exchange}_${s.ticker}`;
      if (!resolvedKeys.has(key)) return false;
      const d = result[key];
      return (d.marketCap === 0 || d.volume === 0);
    });

    // Run both fallback and enrichment in parallel
    const [, ] = await Promise.all([
      // Full fallback for missing stocks: Screener first, then Google Finance
      missingSymbols.length > 0
        ? Promise.all(missingSymbols.map(async (s: { ticker: string; exchange: string }) => {
            const screenerData = await fetchScreenerFallback(s.ticker);
            if (screenerData) {
              result[`${s.exchange}_${s.ticker}`] = screenerData;
              return;
            }
            // Fallback 2: Google Finance
            const googleData = await fetchGoogleFinanceFallback(s.ticker, s.exchange);
            if (googleData) {
              result[`${s.exchange}_${s.ticker}`] = googleData;
            } else {
              console.log(`All fallbacks failed for ${s.ticker} (${s.exchange})`);
            }
          }))
        : Promise.resolve(),
      // Enrichment for stocks with missing marketCap or volume
      needsEnrichment.length > 0
        ? Promise.all(needsEnrichment.map(async (s: { ticker: string; exchange: string }) => {
            const key = `${s.exchange}_${s.ticker}`;
            const enrichment = await fetchScreenerEnrichment(s.ticker);
            if (enrichment) {
              if (result[key].marketCap === 0 && enrichment.marketCap) {
                result[key].marketCap = enrichment.marketCap;
                console.log(`Enriched ${s.ticker} marketCap from Screener: ${enrichment.marketCap}`);
              }
              if (result[key].volume === 0 && enrichment.volume) {
                result[key].volume = enrichment.volume;
                console.log(`Enriched ${s.ticker} volume from Screener: ${enrichment.volume}`);
              }
            }
          }))
        : Promise.resolve(),
    ]);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stock proxy error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
