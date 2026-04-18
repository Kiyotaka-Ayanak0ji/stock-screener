import { getUserIdFromAuthHeader } from "../_shared/auth.ts";

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

// Wrap any fetch with a timeout
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

// Fallback: scrape Screener.in for SME/unlisted stocks Yahoo doesn't cover
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

    // Extract Stock P/E ratio
    let pe = 0;
    const peLiMatch = html.match(/Stock P\/E[\s\S]*?<\/li>/i);
    if (peLiMatch) {
      const peNumMatch = peLiMatch[0].match(/<span class="number">([\d,]+(?:\.\d+)?)<\/span>/);
      if (peNumMatch && peNumMatch[1]) {
        pe = parseFloat(peNumMatch[1].replace(/,/g, ''));
        if (isNaN(pe)) pe = 0;
      }
    }

    console.log(`Screener fallback: ${ticker} = ₹${price}, MCap=${marketCap}, Vol=${volume}, PE=${pe}`);

    return { ltp: price, open: price, high: price, low: price, close: price, volume, marketCap, pe };
  } catch (err) {
    console.error(`Screener fallback error for ${ticker}:`, err);
    return null;
  }
}

// Fetch only market cap and volume from Screener for enrichment
async function fetchScreenerEnrichment(ticker: string): Promise<{ marketCap?: number; volume?: number; pe?: number } | null> {
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

    const result: { marketCap?: number; volume?: number; pe?: number } = {};

    const mcSection = html.match(/Market Cap[\s\S]*?<span class="number">([\d,]+(?:\.\d+)?)<\/span>/i);
    if (mcSection) {
      result.marketCap = parseFloat(mcSection[1].replace(/,/g, '')) * 10000000;
    }

    const volMatch = html.match(/Volume[\s\S]*?<span class="number">([\d,]+(?:\.\d+)?)<\/span>/i);
    if (volMatch) {
      result.volume = Math.round(parseFloat(volMatch[1].replace(/,/g, '')));
    }

    const peLiMatch = html.match(/Stock P\/E[\s\S]*?<\/li>/i);
    if (peLiMatch) {
      const peNumMatch = peLiMatch[0].match(/<span class="number">([\d,]+(?:\.\d+)?)<\/span>/);
      if (peNumMatch && peNumMatch[1]) {
        const pe = parseFloat(peNumMatch[1].replace(/,/g, ''));
        if (!isNaN(pe) && pe > 0) result.pe = pe;
      }
    }

    return result;
  } catch {
    return null;
  }
}

// Fallback: scrape Google Finance for full price data
async function fetchGoogleFinanceFull(ticker: string, exchange: string): Promise<Record<string, number> | null> {
  try {
    const gfExchange = exchange === 'BSE' ? 'BOM' : 'NSE';
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(ticker)}:${gfExchange}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    // Price: data-last-price attribute or prominent price display
    const priceMatch = html.match(/data-last-price="([\d.]+)"/);
    if (!priceMatch) return null;
    const price = parseFloat(priceMatch[1]);
    if (price <= 0 || isNaN(price)) return null;

    const prevMatch = html.match(/data-previous-close="([\d.]+)"/);
    const close = prevMatch ? parseFloat(prevMatch[1]) : price;

    let marketCap = 0;
    const mcMatch = html.match(/Market cap[\s\S]*?([\d,.]+)\s*(T|B|Cr|M|K)?\s*INR/i);
    if (mcMatch) {
      let val = parseFloat(mcMatch[1].replace(/,/g, ''));
      const unit = (mcMatch[2] || '').toUpperCase();
      if (unit === 'T') val *= 1e12;
      else if (unit === 'B') val *= 1e9;
      else if (unit === 'CR') val *= 1e7;
      else if (unit === 'M') val *= 1e6;
      else if (unit === 'K') val *= 1e3;
      marketCap = val;
    }

    let volume = 0;
    const volMatch = html.match(/Avg Volume[\s\S]*?([\d,.]+)\s*(K|M|B)?/i);
    if (volMatch) {
      let vol = parseFloat(volMatch[1].replace(/,/g, ''));
      const unit = (volMatch[2] || '').toUpperCase();
      if (unit === 'K') vol *= 1000;
      else if (unit === 'M') vol *= 1e6;
      else if (unit === 'B') vol *= 1e9;
      volume = Math.round(vol);
    }

    // Extract P/E ratio
    let pe = 0;
    const peMatch = html.match(/P\/E ratio[\s\S]*?([\d,.]+)/i);
    if (peMatch) {
      pe = parseFloat(peMatch[1].replace(/,/g, ''));
      if (isNaN(pe)) pe = 0;
    }

    console.log(`Google Finance full fallback: ${ticker} = ₹${price}, PE=${pe}`);
    return { ltp: price, open: price, high: price, low: price, close, volume, marketCap, pe };
  } catch {
    return null;
  }
}

// Fallback: scrape Google Finance for market cap when Screener is unavailable
async function fetchGoogleFinanceMarketCap(ticker: string, exchange: string): Promise<{ marketCap?: number; volume?: number; pe?: number } | null> {
  try {
    const gfExchange = exchange === 'BSE' ? 'BOM' : 'NSE';
    const url = `https://www.google.com/finance/quote/${encodeURIComponent(ticker)}:${gfExchange}`;
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html',
      },
    });
    if (!res.ok) return null;
    const html = await res.text();

    const result: { marketCap?: number; volume?: number; pe?: number } = {};

    const mcMatch = html.match(/Market cap[\s\S]*?([\d,.]+)\s*(T|B|Cr|M|K)?\s*INR/i);
    if (mcMatch) {
      let val = parseFloat(mcMatch[1].replace(/,/g, ''));
      const unit = (mcMatch[2] || '').toUpperCase();
      if (unit === 'T') val = val * 1e12;
      else if (unit === 'B') val = val * 1e9;
      else if (unit === 'CR') val = val * 1e7;
      else if (unit === 'M') val = val * 1e6;
      else if (unit === 'K') val = val * 1e3;
      result.marketCap = val;
      console.log(`Google Finance enrichment: ${ticker} marketCap=${val}`);
    }

    const volMatch = html.match(/Avg Volume[\s\S]*?([\d,.]+)\s*(K|M|B)?/i);
    if (volMatch) {
      let vol = parseFloat(volMatch[1].replace(/,/g, ''));
      const unit = (volMatch[2] || '').toUpperCase();
      if (unit === 'K') vol *= 1000;
      else if (unit === 'M') vol *= 1e6;
      else if (unit === 'B') vol *= 1e9;
      result.volume = Math.round(vol);
    }

    const peMatch = html.match(/P\/E ratio[\s\S]*?([\d,.]+)/i);
    if (peMatch) {
      const pe = parseFloat(peMatch[1].replace(/,/g, ''));
      if (!isNaN(pe) && pe > 0) result.pe = pe;
    }

    return Object.keys(result).length > 0 ? result : null;
  } catch (err) {
    console.error(`Google Finance fallback error for ${ticker}:`, err);
    return null;
  }
}


Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require an authenticated Supabase user
  const userId = await getUserIdFromAuthHeader(req.headers.get("Authorization"));
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
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
        pe: q.trailingPE ?? 0,
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

    // FAST FALLBACK: Try alternate exchange on Yahoo first (NSE↔BSE swap)
    if (missingSymbols.length > 0) {
      const altSuffixSymbols = missingSymbols.map((s: { ticker: string; exchange: string }) => {
        const altSuffix = s.exchange === 'BSE' ? '.NS' : '.BO';
        return `${s.ticker}${altSuffix}`;
      }).join(',');

      try {
        const { crumb, cookie } = await getCrumbAndCookie();
        const altUrl = `https://query2.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(altSuffixSymbols)}&crumb=${encodeURIComponent(crumb)}`;
        const altRes = await withTimeout(fetch(altUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Cookie': cookie,
          },
        }), 5000);

        if (altRes.ok) {
          const altData = await altRes.json();
          const altQuotes = altData?.quoteResponse?.result || [];
          for (const q of altQuotes) {
            const ltp = q.regularMarketPrice ?? 0;
            if (ltp === 0) continue;
            const ticker = (q.symbol || '').replace(/\.(NS|BO)$/, '');
            // Find the original request for this ticker
            const orig = missingSymbols.find((s: { ticker: string }) => s.ticker === ticker);
            if (!orig) continue;
            const key = `${orig.exchange}_${orig.ticker}`;
            if (resolvedKeys.has(key)) continue;
            result[key] = {
              ltp,
              open: q.regularMarketOpen ?? 0,
              high: q.regularMarketDayHigh ?? 0,
              low: q.regularMarketDayLow ?? 0,
              close: q.regularMarketPreviousClose ?? 0,
              volume: q.regularMarketVolume ?? 0,
              marketCap: q.marketCap ?? 0,
              pe: q.trailingPE ?? 0,
            };
            resolvedKeys.add(key);
            console.log(`Alt-exchange resolved ${ticker} via ${q.symbol}`);
          }
        }
      } catch (e) {
        console.log('Alt-exchange Yahoo retry failed:', (e as Error).message);
      }
    }

    // Remaining missing after alt-exchange retry
    const stillMissing = symbols.filter((s: { ticker: string; exchange: string }) => {
      return !resolvedKeys.has(`${s.exchange}_${s.ticker}`);
    });

    // Identify resolved tickers that need enrichment (marketCap=0, volume=0, or pe=0)
    const needsEnrichment = symbols.filter((s: { ticker: string; exchange: string }) => {
      const key = `${s.exchange}_${s.ticker}`;
      if (!resolvedKeys.has(key)) return false;
      const d = result[key];
      return (d.marketCap === 0 || d.volume === 0 || d.pe === 0);
    });

    const SCRAPE_TIMEOUT = 4000; // 4s timeout per scrape

    // Run both fallback and enrichment in parallel
    await Promise.all([
      // Full fallback for still-missing stocks — race Screener vs Google Finance
      ...stillMissing.map(async (s: { ticker: string; exchange: string }) => {
        try {
          const [screener, gf] = await Promise.allSettled([
            withTimeout(fetchScreenerFallback(s.ticker), SCRAPE_TIMEOUT),
            withTimeout(fetchGoogleFinanceFull(s.ticker, s.exchange), SCRAPE_TIMEOUT),
          ]);
          const screenerData = screener.status === 'fulfilled' ? screener.value : null;
          const gfData = gf.status === 'fulfilled' ? gf.value : null;
          const fallback = screenerData || gfData;
          if (fallback) {
            if (screenerData && gfData) {
              if (fallback.marketCap === 0 && gfData.marketCap) fallback.marketCap = gfData.marketCap;
              if (fallback.volume === 0 && gfData.volume) fallback.volume = gfData.volume;
              if ((!fallback.pe || fallback.pe === 0) && gfData.pe) fallback.pe = gfData.pe;
            }
            result[`${s.exchange}_${s.ticker}`] = fallback;
          }
        } catch { /* both timed out */ }
      }),
      // Enrichment for stocks with missing marketCap, volume, or P/E — race both sources
      ...needsEnrichment.map(async (s: { ticker: string; exchange: string }) => {
        const key = `${s.exchange}_${s.ticker}`;
        try {
          const [screener, gf] = await Promise.allSettled([
            withTimeout(fetchScreenerEnrichment(s.ticker), SCRAPE_TIMEOUT),
            withTimeout(fetchGoogleFinanceMarketCap(s.ticker, s.exchange), SCRAPE_TIMEOUT),
          ]);
          const sData = screener.status === 'fulfilled' ? screener.value : null;
          const gData = gf.status === 'fulfilled' ? gf.value : null;
          if (result[key].marketCap === 0) {
            result[key].marketCap = sData?.marketCap || gData?.marketCap || 0;
          }
          if (result[key].volume === 0) {
            result[key].volume = sData?.volume || gData?.volume || 0;
          }
          if (result[key].pe === 0) {
            result[key].pe = sData?.pe || gData?.pe || 0;
          }
        } catch { /* both timed out */ }
      }),
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
