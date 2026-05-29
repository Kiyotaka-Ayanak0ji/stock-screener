// stock-proxy is a public endpoint — prices are public market data.

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

// ─── NSE / BSE direct quote helpers ─────────────────────────────────
// Indian exchanges expose proper OHLC + volume + previous-close for *every*
// listed scrip including SME boards (e.g. C2C, BCCFUBA, ONIXSOLAR, AVAX),
// where Yahoo / Groww frequently 404 and Screener doesn't carry intraday
// numbers at all. We use them as a final OHLC enrichment pass.

let nseCookieCache: string | null = null;
let nseCookieExpiry = 0;

const NSE_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function extractCookies(res: Response): string {
  // Deno fetch lets us read multiple Set-Cookie via getSetCookie()
  // (older runtimes only expose .get('set-cookie') concatenated by commas).
  // deno-lint-ignore no-explicit-any
  const headers: any = res.headers;
  let cookieList: string[] = [];
  if (typeof headers.getSetCookie === 'function') {
    cookieList = headers.getSetCookie();
  } else {
    const raw = res.headers.get('set-cookie') || '';
    cookieList = raw.split(/,(?=[^;]+=)/);
  }
  return cookieList
    .map((c) => c.split(';')[0].trim())
    .filter(Boolean)
    .join('; ');
}

async function getNseCookie(symbolForReferer?: string): Promise<string> {
  if (nseCookieCache && Date.now() < nseCookieExpiry) return nseCookieCache;
  try {
    // Step 1: hit homepage to seed the basic cookies
    const homeRes = await fetch('https://www.nseindia.com/', {
      headers: {
        'User-Agent': NSE_UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });
    await homeRes.text();
    let cookies = extractCookies(homeRes);

    // Step 2: warm a symbol-specific page (NSE rejects API calls until a
    // get-quotes/equity page has been visited with the same cookie jar).
    // We use a well-known liquid scrip when no specific symbol is provided.
    const warmSym = symbolForReferer || 'RELIANCE';
    const warmRes = await fetch(
      `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(warmSym)}`,
      {
        headers: {
          'User-Agent': NSE_UA,
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cookie': cookies,
          'Referer': 'https://www.nseindia.com/',
        },
        redirect: 'manual',
      },
    );
    await warmRes.text();
    const extra = extractCookies(warmRes);
    if (extra) {
      // merge: symbol-page cookies override homepage ones with the same name
      const map = new Map<string, string>();
      for (const c of cookies.split('; ').filter(Boolean)) {
        const eq = c.indexOf('=');
        if (eq > 0) map.set(c.slice(0, eq), c.slice(eq + 1));
      }
      for (const c of extra.split('; ').filter(Boolean)) {
        const eq = c.indexOf('=');
        if (eq > 0) map.set(c.slice(0, eq), c.slice(eq + 1));
      }
      cookies = Array.from(map.entries()).map(([k, v]) => `${k}=${v}`).join('; ');
    }

    if (cookies) {
      nseCookieCache = cookies;
      nseCookieExpiry = Date.now() + 5 * 60 * 1000; // 5 min
    }
    return cookies;
  } catch {
    return '';
  }
}

interface OhlcSlice {
  open?: number;
  high?: number;
  low?: number;
  close?: number;       // previous close
  volume?: number;
  ltp?: number;
}

async function fetchNseOhlc(ticker: string): Promise<OhlcSlice | null> {
  try {
    // Warm cookies for THIS specific symbol — NSE rejects API calls otherwise.
    const cookie = await getNseCookie(ticker);
    if (!cookie) return null;
    const headers = {
      'User-Agent': NSE_UA,
      'Accept': 'application/json, text/plain, */*',
      'Accept-Language': 'en-US,en;q=0.9',
      'Referer': `https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(ticker)}`,
      'Cookie': cookie,
      'X-Requested-With': 'XMLHttpRequest',
    };
    const sym = encodeURIComponent(ticker);
    let quoteRes = await fetch(`https://www.nseindia.com/api/quote-equity?symbol=${sym}`, { headers });

    // 401/403 → invalidate cache, warm again with this symbol, retry once.
    if (quoteRes.status === 401 || quoteRes.status === 403) {
      await quoteRes.text();
      nseCookieCache = null;
      nseCookieExpiry = 0;
      const fresh = await getNseCookie(ticker);
      if (!fresh) return null;
      quoteRes = await fetch(`https://www.nseindia.com/api/quote-equity?symbol=${sym}`, {
        headers: { ...headers, Cookie: fresh },
      });
    }
    if (!quoteRes.ok) { await quoteRes.text(); return null; }
    const q = await quoteRes.json();

    const tradeRes = await fetch(
      `https://www.nseindia.com/api/quote-equity?symbol=${sym}&section=trade_info`,
      { headers: { ...headers, Cookie: nseCookieCache || cookie } },
    );
    const t = tradeRes.ok ? await tradeRes.json() : (await tradeRes.text(), null);

    const pi = q?.priceInfo;
    if (!pi) return null;

    const open = Number(pi.open) || 0;
    const high = Number(pi.intraDayHighLow?.max) || 0;
    const low = Number(pi.intraDayHighLow?.min) || 0;
    const previousClose = Number(pi.previousClose) || 0;
    const ltp = Number(pi.lastPrice) || 0;
    const volume = Math.round(Number(
      t?.securityWiseDP?.quantityTraded ??
      t?.marketDeptOrderBook?.tradeInfo?.totalTradedVolume ??
      0,
    ));

    console.log(`NSE OHLC ${ticker}: open=${open} prev=${previousClose} vol=${volume}`);
    if (open === 0 && previousClose === 0 && volume === 0) return null;
    return { open, high, low, close: previousClose, ltp, volume };
  } catch (err) {
    console.log(`NSE OHLC error ${ticker}: ${(err as Error).message}`);
    return null;
  }
}

async function fetchBseOhlc(ticker: string): Promise<OhlcSlice | null> {
  // BSE's public stockreach API returns JSON without auth dance.
  // We require a numeric scrip code; use the api.bseindia.com search to resolve.
  try {
    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'application/json, text/plain, */*',
      'Referer': 'https://www.bseindia.com/',
    };
    const lookup = await fetch(
      `https://api.bseindia.com/BseIndiaAPI/api/PeerSmartSearch/w?Type=SS&text=${encodeURIComponent(ticker)}`,
      { headers },
    );
    if (!lookup.ok) { await lookup.text(); return null; }
    const html = await lookup.text();
    // Returns inline HTML chunks containing scrip codes like (532540)
    const codeMatch = html.match(/\((\d{6})\)/);
    if (!codeMatch) return null;
    const scripCode = codeMatch[1];

    const headRes = await fetch(
      `https://api.bseindia.com/BseIndiaAPI/api/StockReachGraph/w?scripcode=${scripCode}&flag=0`,
      { headers },
    );
    await headRes.text(); // ignored — primarily used to warm CDN

    const quoteRes = await fetch(
      `https://api.bseindia.com/BseIndiaAPI/api/getScripHeaderData/w?Debtflag=&scripcode=${scripCode}&seriesid=`,
      { headers },
    );
    if (!quoteRes.ok) { await quoteRes.text(); return null; }
    const data = await quoteRes.json();

    const open = Number(data?.CurrRate?.OpnRate ?? data?.OpenRate) || 0;
    const high = Number(data?.CurrRate?.HighRate ?? data?.HighRate) || 0;
    const low = Number(data?.CurrRate?.LowRate ?? data?.LowRate) || 0;
    const previousClose = Number(data?.PrevClose) || 0;
    const ltp = Number(data?.CurrRate?.LTP ?? data?.CurrentValue) || 0;
    const volume = Math.round(Number(data?.Volume ?? data?.TotTrdQty ?? 0));

    console.log(`BSE OHLC ${ticker}(${scripCode}): open=${open} prev=${previousClose} vol=${volume}`);
    return { open, high, low, close: previousClose, ltp, volume };
  } catch (err) {
    console.log(`BSE OHLC error ${ticker}: ${(err as Error).message}`);
    return null;
  }
}

async function fetchExchangeOhlc(ticker: string, exchange: string): Promise<OhlcSlice | null> {
  if (exchange === 'BSE') {
    return (await fetchBseOhlc(ticker)) || (await fetchNseOhlc(ticker));
  }
  // For NSE, try NSE first; if NSE blocks/returns nothing, dual-listed SME stocks
  // are still on BSE so we try BSE OHLC as a final fallback.
  return (await fetchNseOhlc(ticker)) || (await fetchBseOhlc(ticker));
}

// ─── BSE / NSE INDEX support ────────────────────────────────────────
// Indices (e.g. "BSE 250 LargeMidCap Index", "Nifty 50", "Sensex") aren't
// listed scrips and never resolve via Yahoo's `.NS`/`.BO` suffix or Groww.
// We rely on the public BSE IndexMovers feed (returns LTP + change for ALL
// indices in one call) and fall back to NSE's All Indices feed.

interface IndexSlice {
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number; // previous close (derived from change for BSE)
  volume?: number;
  marketCap?: number;
  pe?: number;
  pb?: number;
  divYield?: number;
}

// deno-lint-ignore no-explicit-any
let bseIndexCache: { rows: any[]; expiry: number } | null = null;
// deno-lint-ignore no-explicit-any
let nseIndexCache: { rows: any[]; expiry: number } | null = null;

// deno-lint-ignore no-explicit-any
async function loadBseIndexTable(): Promise<any[]> {
  if (bseIndexCache && Date.now() < bseIndexCache.expiry) return bseIndexCache.rows;
  try {
    const res = await fetch(
      'https://api.bseindia.com/BseIndiaAPI/api/IndexMovers/w?indexcode=BSE250LMI',
      { headers: { 'User-Agent': NSE_UA, 'Accept': 'application/json', 'Referer': 'https://www.bseindia.com/' } },
    );
    if (!res.ok) { await res.text(); return []; }
    const json = await res.json();
    const rows = Array.isArray(json?.Table) ? json.Table : [];
    bseIndexCache = { rows, expiry: Date.now() + 60_000 }; // 1 min
    return rows;
  } catch {
    return [];
  }
}

// deno-lint-ignore no-explicit-any
async function loadNseIndexTable(): Promise<any[]> {
  if (nseIndexCache && Date.now() < nseIndexCache.expiry) return nseIndexCache.rows;
  try {
    const cookie = await getNseCookie('NIFTY');
    if (!cookie) return [];
    const res = await fetch('https://www.nseindia.com/api/allIndices', {
      headers: {
        'User-Agent': NSE_UA,
        'Accept': 'application/json',
        'Referer': 'https://www.nseindia.com/market-data/live-market-indices',
        'Cookie': cookie,
      },
    });
    if (!res.ok) { await res.text(); return []; }
    const json = await res.json();
    const rows = Array.isArray(json?.data) ? json.data : [];
    nseIndexCache = { rows, expiry: Date.now() + 60_000 };
    return rows;
  } catch {
    return [];
  }
}

// Normalise an index name for fuzzy matching (strip non-alphanumerics, uppercase).
function normIdx(s: string): string {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

async function fetchIndexQuote(ticker: string, exchange: string): Promise<IndexSlice | null> {
  const needle = normIdx(ticker);
  if (!needle) return null;

  // (BSE preferred when `exchange === 'BSE'`, otherwise NSE preferred — merge logic below handles fallbacks)

  // Score-based matcher: exact > startsWith/endsWith > contains, longest first.
  // This avoids "MIDCAP" matching "BSE 250 LargeMidCap Index" before the exact
  // "BSE 250 LargeMidCap Index" entry does.
  // deno-lint-ignore no-explicit-any
  function pickBest(rows: any[], nameKey: (r: any) => string, aliasKey?: (r: any) => string): any | null {
    let best: { row: any; score: number; len: number } | null = null;
    for (const r of rows) {
      const name = normIdx(nameKey(r));
      const alias = aliasKey ? normIdx(aliasKey(r)) : '';
      let score = 0;
      let candLen = 0;
      if (name === needle || alias === needle) { score = 100; candLen = needle.length; }
      else if (name && needle.startsWith(name)) { score = 80; candLen = name.length; }
      else if (name && needle.endsWith(name)) { score = 70; candLen = name.length; }
      else if (name && needle.includes(name)) { score = 60; candLen = name.length; }
      else if (alias && needle.includes(alias)) { score = 50; candLen = alias.length; }
      else if (name && name.includes(needle)) { score = 40; candLen = needle.length; }
      if (score === 0) continue;
      if (!best || score > best.score || (score === best.score && candLen > best.len)) {
        best = { row: r, score, len: candLen };
      }
    }
    return best?.row ?? null;
  }

  // Try BOTH exchanges and merge — NSE allIndices reliably carries pe/pb/dy
  // (which BSE IndexMovers omits), while BSE IndexMovers gives the live LTP for
  // BSE-only indices. We use BSE for price, NSE for valuations when both match.
  const bseRows = await loadBseIndexTable();
  const nseRows = await loadNseIndexTable();

  const bseMatch = bseRows.length
    ? pickBest(bseRows, (r) => r.indexName, (r) => r.shortalias)
    : null;
  let nseMatch = nseRows.length
    ? pickBest(nseRows, (r) => r.index ?? r.indexName)
    : null;

  // Cross-exchange equivalence map — when the BSE ticker is well-known, pull
  // valuations from its NSE analogue (the index methodologies are similar
  // enough that PE/PB/DivYield are directionally identical).
  if (!nseMatch && nseRows.length) {
    const NSE_EQUIV: Record<string, string> = {
      'BSE250LARGEMIDCAPINDEX': 'NIFTYLARGEMIDCAP250',
      'BSE100': 'NIFTY100',
      'BSE200': 'NIFTY200',
      'BSE500': 'NIFTY500',
      'BSEMIDCAP': 'NIFTYMIDCAP100',
      'BSESMALLCAP': 'NIFTYSMALLCAP100',
      'BSESENSEX': 'NIFTY50',
      'SENSEX': 'NIFTY50',
      'BSEBANKEX': 'NIFTYBANK',
    };
    const aliasNeedle = NSE_EQUIV[needle];
    if (aliasNeedle) {
      // deno-lint-ignore no-explicit-any
      nseMatch = nseRows.find((r: any) => normIdx(r.index ?? r.indexName) === aliasNeedle) ?? null;
      if (nseMatch) console.log(`Index alias resolved: ${needle} → ${aliasNeedle}`);
    }
  }

  // Prefer the exchange the user asked for, but always merge valuations from NSE.
  const preferBse = exchange === 'BSE' && bseMatch;

  if (preferBse && bseMatch) {
    const ltp = Number(bseMatch.LTP) || 0;
    const change = Number(bseMatch.change) || 0;
    if (ltp) {
      const prev = ltp - change;
      console.log(`BSE Index ${ticker} → ${bseMatch.indexName} ltp=${ltp}`);
      const slice: IndexSlice = {
        ltp, close: prev, open: prev, high: ltp, low: ltp,
        volume: 0, marketCap: 0, pe: 0,
      };
      // Borrow valuations from a matching NSE index if one exists.
      if (nseMatch) {
        const pe = Number(nseMatch.pe) || 0;
        const pb = Number(nseMatch.pb) || 0;
        const dy = Number(nseMatch.dy) || 0;
        if (pe > 0) slice.pe = pe;
        if (pb > 0) slice.pb = pb;
        if (dy > 0) slice.divYield = dy;
      }
      return slice;
    }
  }

  if (nseMatch) {
    const ltp = Number(nseMatch.last ?? nseMatch.lastPrice) || 0;
    if (ltp) {
      const open = Number(nseMatch.open) || ltp;
      const high = Number(nseMatch.high) || ltp;
      const low = Number(nseMatch.low) || ltp;
      const prev = Number(nseMatch.previousClose) || ltp;
      const pe = Number(nseMatch.pe) || 0;
      const pb = Number(nseMatch.pb) || 0;
      const dy = Number(nseMatch.dy) || 0;
      console.log(`NSE Index ${ticker} → ${nseMatch.index} ltp=${ltp} pe=${pe}`);
      return {
        ltp, open, high, low, close: prev,
        volume: 0, marketCap: 0,
        pe: pe > 0 ? pe : 0,
        pb: pb > 0 ? pb : undefined,
        divYield: dy > 0 ? dy : undefined,
      };
    }
  }

  // Fallback: BSE-only index with no NSE analogue → return price-only slice.
  if (bseMatch) {
    const ltp = Number(bseMatch.LTP) || 0;
    const change = Number(bseMatch.change) || 0;
    if (ltp) {
      const prev = ltp - change;
      console.log(`BSE Index ${ticker} → ${bseMatch.indexName} ltp=${ltp} (no NSE valuations)`);
      return { ltp, close: prev, open: prev, high: ltp, low: ltp, volume: 0, marketCap: 0, pe: 0 };
    }
  }
  return null;
}

function looksLikeIndex(ticker: string, yahooSymbol?: string): boolean {
  if (yahooSymbol && yahooSymbol.startsWith('^')) return true;
  const t = (ticker || '').toUpperCase();
  return /(_INDEX$|^INDEX_|NIFTY|SENSEX|BSE_\d|BANKEX|MIDCAP|SMALLCAP|LARGECAP)/.test(t);
}


// ─── Groww (official API) ───────────────────────────────────────────
// Used as PRIMARY source for SME / small-cap Indian stocks where Yahoo coverage
// is poor or stale. For mid/large caps we still prefer Yahoo → Screener → Google.

const GROWW_TOKEN = Deno.env.get('GROWW_API_TOKEN') || '';

// Heuristic: ticker patterns that strongly indicate an SME listing.
// Real NSE SME suffix examples: ENVIRO_SM, BLSI-SM, ABC_SME. BSE SME often pure 6-digit codes
// in the 540000-545000 / 776000+ ranges, but we keep this conservative — code-based detection
// happens server-side after we know the marketCap.
const SME_NAME_RE = /(_SM|-SM|_SME|-SME|SME$)/i;

function isLikelySmeTicker(t: string): boolean {
  return SME_NAME_RE.test(t);
}

// Small-cap threshold in raw INR: 5,000 Cr = 5e10
const SMALL_CAP_THRESHOLD_RAW = 5e10;

async function fetchGrowwQuote(
  ticker: string,
  exchange: 'NSE' | 'BSE',
): Promise<Record<string, number> | null> {
  if (!GROWW_TOKEN) return null;
  try {
    const u = new URL('https://api.groww.in/v1/live-data/quote');
    u.searchParams.set('exchange', exchange);
    u.searchParams.set('segment', 'CASH');
    u.searchParams.set('trading_symbol', ticker);

    const res = await fetch(u.toString(), {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${GROWW_TOKEN}`,
        'X-API-VERSION': '1.0',
      },
    });
    if (!res.ok) {
      console.log(`Groww ${exchange}:${ticker} -> ${res.status}`);
      return null;
    }
    const json = await res.json();
    // Groww v1 quote response shape: { status, payload: { last_price, day_change, ohlc:{...}, volume, market_cap, ... } }
    const p = json?.payload ?? json?.data ?? json;
    const ltp = Number(p?.last_price ?? p?.ltp ?? 0);
    if (!ltp || isNaN(ltp) || ltp <= 0) return null;

    const ohlc = p?.ohlc ?? {};
    const open = Number(ohlc?.open ?? p?.open ?? ltp);
    const high = Number(ohlc?.high ?? p?.high ?? ltp);
    const low = Number(ohlc?.low ?? p?.low ?? ltp);
    const close = Number(ohlc?.close ?? p?.close ?? p?.previous_close ?? ltp);
    const volume = Math.round(Number(p?.volume ?? p?.day_volume ?? 0));
    // Groww returns market_cap in INR (raw). Some responses are in Cr — normalise to raw.
    let marketCap = Number(p?.market_cap ?? p?.marketCap ?? 0);
    if (marketCap > 0 && marketCap < 1e7) marketCap = marketCap * 1e7; // looked like Cr
    const pe = Number(p?.pe_ratio ?? p?.pe ?? 0);

    console.log(`Groww OK ${exchange}:${ticker} ltp=${ltp} mcap=${marketCap} vol=${volume}`);
    return { ltp, open, high, low, close, volume, marketCap, pe: isNaN(pe) ? 0 : pe };
  } catch (err) {
    console.error(`Groww error ${exchange}:${ticker}:`, (err as Error).message);
    return null;
  }
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

  // Public endpoint: stock prices are public market data, no user-specific info exposed.
  // Guest users on the dashboard need access to live prices.

  try {
    const { symbols } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ error: 'symbols array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── Step 0a: Resolve INDEX tickers up-front ────────────────────────
    // Indices have no Yahoo `.NS`/`.BO` suffix and Groww doesn't serve them.
    // We hit BSE IndexMovers / NSE allIndices feeds and route accordingly.
    const result: Record<string, Record<string, number>> = {};
    const resolvedKeys = new Set<string>();

    const indexTargets = symbols.filter(
      (s: { ticker: string; exchange: string; yahooSymbol?: string; isIndex?: boolean }) =>
        s.isIndex || looksLikeIndex(s.ticker, s.yahooSymbol),
    );

    if (indexTargets.length > 0) {
      await Promise.all(
        indexTargets.map(async (s: { ticker: string; exchange: string }) => {
          const idx = await withTimeout(fetchIndexQuote(s.ticker, s.exchange), 5000).catch(() => null);
          if (idx) {
            const key = `${s.exchange}_${s.ticker}`;
            result[key] = {
              ltp: idx.ltp,
              open: idx.open ?? idx.ltp,
              high: idx.high ?? idx.ltp,
              low: idx.low ?? idx.ltp,
              close: idx.close ?? idx.ltp,
              volume: idx.volume ?? 0,
              marketCap: idx.marketCap ?? 0,
              pe: idx.pe ?? 0,
            };
            resolvedKeys.add(key);
          }
        }),
      );
    }

    // ── Step 0b: Groww as PRIMARY for SME-named tickers ────────────────
    // Yahoo coverage of NSE/BSE SME boards is poor and often returns stale or zero data.
    // For tickers whose symbol matches an SME pattern we hit Groww first; everything
    // else still goes through the Yahoo → Screener → Google chain unchanged.
    const growwPrimaryTargets = symbols.filter(
      (s: { ticker: string; exchange: string; isIndex?: boolean }) =>
        !resolvedKeys.has(`${s.exchange}_${s.ticker}`) &&
        !s.isIndex && !looksLikeIndex(s.ticker) &&
        (s.exchange === 'NSE' || s.exchange === 'BSE') && isLikelySmeTicker(s.ticker),
    );

    if (GROWW_TOKEN && growwPrimaryTargets.length > 0) {
      await Promise.all(
        growwPrimaryTargets.map(async (s: { ticker: string; exchange: 'NSE' | 'BSE' }) => {
          const data = await withTimeout(fetchGrowwQuote(s.ticker, s.exchange), 4000).catch(() => null);
          if (data) {
            const key = `${s.exchange}_${s.ticker}`;
            result[key] = data;
            resolvedKeys.add(key);
          }
        }),
      );
    }

    // Build the Yahoo batch only for tickers Groww didn't already resolve.
    const yahooTargets = symbols.filter(
      (s: { ticker: string; exchange: string }) => !resolvedKeys.has(`${s.exchange}_${s.ticker}`),
    );

    // Known-index → Yahoo "^" symbol fallback. Ensures indices the BSE/NSE
    // feeds couldn't match still get a live price from Yahoo.
    const INDEX_YAHOO_FALLBACK: Record<string, string> = {
      NIFTY: '^NSEI', NIFTY50: '^NSEI',
      NIFTYBANK: '^NSEBANK', BANKNIFTY: '^NSEBANK',
      NIFTYIT: '^CNXIT', NIFTYMIDCAP100: '^CNXMIDCAP',
      NIFTYNEXT50: '^NSMIDCP', NIFTY500: '^CRSLDX',
      SENSEX: '^BSESN', BSESENSEX: '^BSESN',
      BSE100: '^BSE100', BSE200: '^BSE200', BSE500: '^BSE500',
      BSEBANKEX: '^BSEBANK',
    };

    const yahooSymbols = yahooTargets.map((s: { ticker: string; exchange: string; yahooSymbol?: string; isIndex?: boolean }) => {
      if (s.yahooSymbol) return s.yahooSymbol;
      if (s.isIndex || looksLikeIndex(s.ticker)) {
        const key = (s.ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
        const mapped = INDEX_YAHOO_FALLBACK[key];
        if (mapped) return mapped;
      }
      const suffix = s.exchange === 'BSE' ? '.BO' : '.NS';
      return `${s.ticker}${suffix}`;
    }).join(',');

    let data: any = null;
    if (yahooTargets.length > 0) {
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
          // Don't bail — Groww may already have resolved SME tickers, and the
          // fallback chain below will handle the rest.
          data = { quoteResponse: { result: [] } };
          break;
        }

        data = await response.json();
        break;
      }
    } else {
      data = { quoteResponse: { result: [] } };
    }

    const quotes = data?.quoteResponse?.result || [];

    const yahooToKey = new Map<string, string>();
    yahooTargets.forEach((s: { ticker: string; exchange: string; yahooSymbol?: string }) => {
      if (s.yahooSymbol) yahooToKey.set(s.yahooSymbol, `${s.exchange}_${s.ticker}`);
    });

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

    // Remaining missing after alt-exchange retry — exclude indices (no Yahoo/Groww/Screener coverage).
    const stillMissing = symbols.filter((s: { ticker: string; exchange: string; isIndex?: boolean; yahooSymbol?: string }) => {
      if (resolvedKeys.has(`${s.exchange}_${s.ticker}`)) return false;
      return !(s.isIndex || looksLikeIndex(s.ticker, s.yahooSymbol));
    });

    // Identify resolved tickers that need enrichment (marketCap=0, volume=0, or pe=0).
    // Skip indices — they legitimately have no marketCap / PE / per-day volume.
    const needsEnrichment = symbols.filter((s: { ticker: string; exchange: string; isIndex?: boolean; yahooSymbol?: string }) => {
      const key = `${s.exchange}_${s.ticker}`;
      if (!resolvedKeys.has(key)) return false;
      if (s.isIndex || looksLikeIndex(s.ticker, s.yahooSymbol)) return false;
      const d = result[key];
      return (d.marketCap === 0 || d.volume === 0 || d.pe === 0);
    });

    const SCRAPE_TIMEOUT = 4000; // 4s timeout per scrape

    // ── Step A: For tickers Yahoo couldn't resolve, try Groww FIRST (best Indian
    // small-cap/SME coverage), then fall back to Screener+Google for whatever remains.
    const stillMissingAfterGroww: { ticker: string; exchange: 'NSE' | 'BSE' }[] = [];
    if (GROWW_TOKEN && stillMissing.length > 0) {
      await Promise.all(
        stillMissing.map(async (s: { ticker: string; exchange: 'NSE' | 'BSE' }) => {
          const data = await withTimeout(fetchGrowwQuote(s.ticker, s.exchange), SCRAPE_TIMEOUT).catch(() => null);
          if (data) {
            result[`${s.exchange}_${s.ticker}`] = data;
            resolvedKeys.add(`${s.exchange}_${s.ticker}`);
          } else {
            stillMissingAfterGroww.push(s);
          }
        }),
      );
    } else {
      stillMissingAfterGroww.push(...stillMissing);
    }

    // Run both fallback and enrichment in parallel
    await Promise.all([
      // Full fallback for still-missing stocks — race Screener vs Google Finance
      ...stillMissingAfterGroww.map(async (s: { ticker: string; exchange: string }) => {
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
      // Enrichment for stocks with missing marketCap, volume, or P/E.
      // For SME-named or detected small-cap (<5,000 Cr) tickers we prefer Groww
      // for enrichment; otherwise we keep the existing Screener+Google race.
      ...needsEnrichment.map(async (s: { ticker: string; exchange: 'NSE' | 'BSE' }) => {
        const key = `${s.exchange}_${s.ticker}`;
        const current = result[key];
        const isSmallCap =
          isLikelySmeTicker(s.ticker) ||
          (current?.marketCap > 0 && current.marketCap < SMALL_CAP_THRESHOLD_RAW);

        try {
          if (GROWW_TOKEN && isSmallCap) {
            const g = await withTimeout(fetchGrowwQuote(s.ticker, s.exchange), SCRAPE_TIMEOUT).catch(() => null);
            if (g) {
              if (current.marketCap === 0 && g.marketCap) current.marketCap = g.marketCap;
              if (current.volume === 0 && g.volume) current.volume = g.volume;
              if (current.pe === 0 && g.pe) current.pe = g.pe;
              if (current.marketCap > 0 && current.volume > 0 && current.pe > 0) return;
            }
          }

          const [screener, gf] = await Promise.allSettled([
            withTimeout(fetchScreenerEnrichment(s.ticker), SCRAPE_TIMEOUT),
            withTimeout(fetchGoogleFinanceMarketCap(s.ticker, s.exchange), SCRAPE_TIMEOUT),
          ]);
          const sData = screener.status === 'fulfilled' ? screener.value : null;
          const gData = gf.status === 'fulfilled' ? gf.value : null;
          if (current.marketCap === 0) {
            current.marketCap = sData?.marketCap || gData?.marketCap || 0;
          }
          if (current.volume === 0) {
            current.volume = sData?.volume || gData?.volume || 0;
          }
          if (current.pe === 0) {
            current.pe = sData?.pe || gData?.pe || 0;
          }
        } catch { /* timed out */ }
      }),
    ]);

    // ── Final OHLC enrichment ─────────────────────────────────────────
    // Several fallbacks (Screener, Google Finance) only give us a price and
    // synthesise open/high/low/close = price as a placeholder. The same
    // sources never carry per-day volume or previous close for SME / newly
    // listed scrips (e.g. C2C, BCCFUBA, ONIXSOLAR, AVAX). For each resolved
    // entry that still has placeholder OHLC or volume=0 / previousClose=ltp,
    // hit the exchange's own quote API (NSE for NSE, BSE for BSE) which
    // exposes proper intraday open/high/low + total traded volume + actual
    // previous close, and merge the missing fields in.
    const ohlcCandidates = symbols.filter((s: { ticker: string; exchange: string; isIndex?: boolean; yahooSymbol?: string }) => {
      // Skip indices — they don't have a quote-equity endpoint, and their
      // open/close come from the index feed already.
      if (s.isIndex || looksLikeIndex(s.ticker, s.yahooSymbol)) return false;
      const d = result[`${s.exchange}_${s.ticker}`];
      if (!d || !d.ltp) return false;
      const flatOhlc = d.open === d.ltp && d.high === d.ltp && d.low === d.ltp;
      const flatPrev = !d.close || d.close === d.ltp;
      return flatOhlc || flatPrev || d.volume === 0;
    });

    if (ohlcCandidates.length > 0) {
      await Promise.all(
        ohlcCandidates.map(async (s: { ticker: string; exchange: string }) => {
          const key = `${s.exchange}_${s.ticker}`;
          const current = result[key];
          const ohlc = await withTimeout(fetchExchangeOhlc(s.ticker, s.exchange), SCRAPE_TIMEOUT).catch(() => null);
          if (!ohlc) return;
          // Only overwrite obviously placeholder / missing fields so we don't
          // clobber better data from Yahoo or Groww.
          if (ohlc.open && (current.open === current.ltp || !current.open)) current.open = ohlc.open;
          if (ohlc.high && (current.high === current.ltp || !current.high)) current.high = ohlc.high;
          if (ohlc.low && (current.low === current.ltp || !current.low)) current.low = ohlc.low;
          if (ohlc.close && (!current.close || current.close === current.ltp)) current.close = ohlc.close;
          if (ohlc.volume && (!current.volume || current.volume === 0)) current.volume = ohlc.volume;
        }),
      );
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
