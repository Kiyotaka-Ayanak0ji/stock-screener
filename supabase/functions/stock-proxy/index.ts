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

// Fallback: scrape Screener.in for SME/unlisted stocks Yahoo doesn't cover
async function fetchScreenerFallback(ticker: string): Promise<Record<string, number> | null> {
  try {
    const url = `https://www.screener.in/company/${ticker}/`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract current price from the page - look for the price in the top section
    // Screener uses a specific pattern: <span class="number">₹ 330</span> or similar
    const priceMatch = html.match(/Current Price[^₹]*₹\s*([\d,.]+)/i)
      || html.match(/<span[^>]*class="[^"]*number[^"]*"[^>]*>\s*₹?\s*([\d,.]+)/i)
      || html.match(/id="top"[\s\S]*?₹\s*([\d,.]+)/i);

    if (!priceMatch) {
      // Try alternate pattern - the top-level price
      const altMatch = html.match(/<h1[\s\S]*?<\/h1>[\s\S]*?₹\s*([\d,.]+)/i);
      if (!altMatch) return null;
      const price = parseFloat(altMatch[1].replace(/,/g, ''));
      if (price <= 0 || isNaN(price)) return null;
      return { ltp: price, open: price, high: price, low: price, close: price, volume: 0, marketCap: 0 };
    }

    const price = parseFloat(priceMatch[1].replace(/,/g, ''));
    if (price <= 0 || isNaN(price)) return null;

    // Try to extract market cap
    const mcMatch = html.match(/Market Cap[^₹]*₹\s*([\d,.]+)\s*Cr/i);
    const marketCap = mcMatch ? parseFloat(mcMatch[1].replace(/,/g, '')) * 10000000 : 0; // Convert Cr to raw

    // Try to extract high/low
    const highMatch = html.match(/High[^₹]*₹\s*([\d,.]+)/i);
    const lowMatch = html.match(/Low[^₹]*₹\s*([\d,.]+)/i);

    const high = highMatch ? parseFloat(highMatch[1].replace(/,/g, '')) : price;
    const low = lowMatch ? parseFloat(lowMatch[1].replace(/,/g, '')) : price;

    console.log(`Screener fallback succeeded for ${ticker}: ₹${price}`);

    return {
      ltp: price,
      open: price,
      high,
      low,
      close: price, // Screener doesn't easily expose previous close
      volume: 0,
      marketCap,
    };
  } catch (err) {
    console.error(`Screener fallback failed for ${ticker}:`, err);
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

    // Fallback via Screener.in for unresolved tickers
    const missingSymbols = symbols.filter((s: { ticker: string; exchange: string }) => {
      return !resolvedKeys.has(`${s.exchange}_${s.ticker}`);
    });

    if (missingSymbols.length > 0) {
      await Promise.all(missingSymbols.map(async (s: { ticker: string; exchange: string }) => {
        const fallback = await fetchScreenerFallback(s.ticker);
        if (fallback) {
          result[`${s.exchange}_${s.ticker}`] = fallback;
        }
      }));
    }

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
