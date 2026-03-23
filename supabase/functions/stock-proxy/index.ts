const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Cache crumb + cookie for reuse across requests
let cachedCrumb: string | null = null;
let cachedCookie: string | null = null;
let crumbExpiry = 0;

async function getCrumbAndCookie(): Promise<{ crumb: string; cookie: string }> {
  if (cachedCrumb && cachedCookie && Date.now() < crumbExpiry) {
    return { crumb: cachedCrumb, cookie: cachedCookie };
  }

  const initRes = await fetch('https://fc.yahoo.com', {
    redirect: 'manual',
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    },
  });
  await initRes.text();

  const setCookieHeader = initRes.headers.get('set-cookie') || '';
  const cookieMatch = setCookieHeader.match(/A3=([^;]+)/);
  const cookie = cookieMatch ? `A3=${cookieMatch[1]}` : '';

  const crumbRes = await fetch('https://query2.finance.yahoo.com/v1/test/getcrumb', {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Cookie': cookie,
    },
  });
  const crumb = await crumbRes.text();

  cachedCrumb = crumb;
  cachedCookie = cookie;
  crumbExpiry = Date.now() + 10 * 60 * 1000;

  return { crumb, cookie };
}

// Fallback: fetch from Google Finance for stocks Yahoo doesn't cover
async function fetchGoogleFinanceFallback(ticker: string, exchange: string): Promise<Record<string, number> | null> {
  try {
    const googleExchange = exchange === 'BSE' ? 'BOM' : 'NSE';
    const url = `https://www.google.com/finance/quote/${ticker}:${googleExchange}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Extract price from Google Finance HTML using data attribute patterns
    const priceMatch = html.match(/data-last-price="([^"]+)"/);
    const prevCloseMatch = html.match(/data-previous-close="([^"]+)"/);
    const openMatch = html.match(/data-open-price="([^"]+)"/);
    const highMatch = html.match(/data-high-price="([^"]+)"/);
    const lowMatch = html.match(/data-low-price="([^"]+)"/);
    const volumeMatch = html.match(/data-volume="([^"]+)"/);
    const mktCapMatch = html.match(/data-market-cap="([^"]+)"/);

    const ltp = priceMatch ? parseFloat(priceMatch[1]) : 0;
    if (ltp <= 0) return null;

    return {
      ltp,
      open: openMatch ? parseFloat(openMatch[1]) : ltp,
      high: highMatch ? parseFloat(highMatch[1]) : ltp,
      low: lowMatch ? parseFloat(lowMatch[1]) : ltp,
      close: prevCloseMatch ? parseFloat(prevCloseMatch[1]) : ltp,
      volume: volumeMatch ? parseInt(volumeMatch[1]) : 0,
      marketCap: mktCapMatch ? parseFloat(mktCapMatch[1]) : 0,
    };
  } catch (err) {
    console.error(`Google Finance fallback failed for ${ticker}:`, err);
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
        console.warn('Yahoo Finance 401 - refreshing crumb and retrying');
        cachedCrumb = null;
        cachedCookie = null;
        crumbExpiry = 0;
        continue;
      }

      if (!response.ok) {
        const text = await response.text();
        console.error('Yahoo Finance error:', response.status, text);
        return new Response(JSON.stringify({ error: 'Yahoo Finance error', status: response.status }), {
          status: 502,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      data = await response.json();
      break;
    }

    if (!data) {
      return new Response(JSON.stringify({ error: 'Failed after retries' }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const quotes = data?.quoteResponse?.result || [];

    const result: Record<string, Record<string, number>> = {};

    const yahooToKey = new Map<string, string>();
    symbols.forEach((s: { ticker: string; exchange: string; yahooSymbol?: string }) => {
      if (s.yahooSymbol) {
        yahooToKey.set(s.yahooSymbol, `${s.exchange}_${s.ticker}`);
      }
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

    // Fallback: try Google Finance for any symbols Yahoo couldn't resolve
    const missingSymbols = symbols.filter((s: { ticker: string; exchange: string }) => {
      const key = `${s.exchange}_${s.ticker}`;
      return !resolvedKeys.has(key);
    });

    if (missingSymbols.length > 0) {
      const fallbackPromises = missingSymbols.map(async (s: { ticker: string; exchange: string }) => {
        const fallback = await fetchGoogleFinanceFallback(s.ticker, s.exchange);
        if (fallback) {
          const key = `${s.exchange}_${s.ticker}`;
          result[key] = fallback;
          console.log(`Google Finance fallback succeeded for ${s.ticker}`);
        }
      });
      await Promise.all(fallbackPromises);
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
