import { supabase } from "@/integrations/supabase/client";
import { Stock } from "./stockData";

interface StockQuote {
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  marketCap?: number;
  pe?: number;
}

export async function fetchLivePrices(
  tickers: { ticker: string; exchange: "NSE" | "BSE"; yahooSymbol?: string }[]
): Promise<Partial<Record<string, StockQuote>>> {
  if (tickers.length === 0) return {};

  try {
    const { data, error } = await supabase.functions.invoke("stock-proxy", {
      body: { symbols: tickers },
    });

    if (error) {
      console.error("Stock proxy error:", error);
      return {};
    }

    return data as Record<string, StockQuote>;
  } catch (err) {
    console.error("Failed to fetch live prices:", err);
    return {};
  }
}

/**
 * Mirrors the server-side `looksLikeIndex` heuristic in stock-proxy so the
 * client can apply index-aware logic even when the local Stock metadata
 * doesn't have isIndex set yet (e.g. legacy entries from before tracking).
 */
export function looksLikeIndexTicker(ticker: string, yahooSymbol?: string): boolean {
  if (yahooSymbol && yahooSymbol.startsWith("^")) return true;
  const t = (ticker || "").toUpperCase();
  return /(_INDEX$|^INDEX_|NIFTY|SENSEX|BSE_\d|BANKEX|MIDCAP|SMALLCAP|LARGECAP)/.test(t);
}

/**
 * Pick the new value if it's a valid positive number; otherwise keep the
 * previously-cached one. This prevents a partial proxy response (e.g. Yahoo
 * resolved LTP but Groww 403'd marketCap, or NSE OHLC returned vol=0 for an
 * illiquid SME) from clobbering good cached values with zeros.
 */
function preferNonZero(next: number | undefined | null, prev: number): number {
  if (typeof next === "number" && Number.isFinite(next) && next > 0) return next;
  return prev;
}

/**
 * Normalise market cap to Crores. The proxy usually returns raw INR (e.g.
 * Yahoo: 1.91e12) but some upstreams already deliver crores (e.g. cached rows
 * we wrote ourselves, or Groww in some responses). We use a wider heuristic:
 *   - values >= 1e7 (>=1 Cr in raw INR) are treated as raw INR
 *   - anything smaller is assumed to already be in Cr
 * This keeps small-caps (<1 Cr) rare-edge stable and prevents 100× spikes
 * where a cached Cr value got re-multiplied.
 */
function toCrores(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  if (raw >= 1e7) return Math.round(raw / 1e7);
  return Math.round(raw);
}

export function applyLiveData(
  stock: Stock,
  liveData: StockQuote
): Stock {
  // Skip if proxy returned no real data at all
  if (!liveData.ltp || liveData.ltp === 0) return stock;

  const previousClose = liveData.close && liveData.close > 0 ? liveData.close : stock.previousClose;
  const price = liveData.ltp;
  const change = Math.round((price - previousClose) * 100) / 100;
  const changePercent = previousClose > 0 ? Math.round((change / previousClose) * 10000) / 100 : 0;

  // Indices genuinely don't have volume / pe / marketCap — don't try to
  // preserve "old" values for them, just keep zero. Also covers indices added
  // before isIndex metadata was tracked (BSE_250_LARGEMIDCAP_INDEX, NIFTY*, etc.).
  const isIdx = !!stock.isIndex || looksLikeIndexTicker(stock.ticker, stock.yahooSymbol);

  return {
    ...stock,
    price,
    previousClose,
    change,
    changePercent,
    high: preferNonZero(liveData.high, stock.high),
    low: preferNonZero(liveData.low, stock.low),
    open: preferNonZero(liveData.open, stock.open),
    volume: isIdx ? 0 : preferNonZero(liveData.volume, stock.volume),
    marketCap: isIdx
      ? 0
      : (liveData.marketCap && liveData.marketCap > 0
          ? toCrores(liveData.marketCap)
          : stock.marketCap),
    pe: isIdx ? 0 : preferNonZero(liveData.pe, stock.pe),
    lastUpdated: new Date(),
  };
}
