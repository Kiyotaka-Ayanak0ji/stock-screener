import { supabase } from "@/integrations/supabase/client";
import { Stock } from "./stockData";

interface GrowwLtpResponse {
  [key: string]: {
    ltp: number;
    open?: number;
    high?: number;
    low?: number;
    close?: number;
    volume?: number;
  };
}

export async function fetchLivePrices(
  tickers: { ticker: string; exchange: "NSE" | "BSE" }[]
): Promise<Partial<Record<string, { ltp: number; open?: number; high?: number; low?: number; close?: number; volume?: number }>>> {
  if (tickers.length === 0) return {};

  // Build exchange_symbols like "NSE_RELIANCE,NSE_TCS,BSE_ADANIPOWER"
  const exchangeSymbols = tickers
    .map((t) => `${t.exchange}_${t.ticker}`)
    .join(",");

  try {
    const { data, error } = await supabase.functions.invoke("groww-proxy", {
      body: {
        action: "ltp",
        params: {
          segment: "CASH",
          exchange_symbols: exchangeSymbols,
        },
      },
    });

    if (error) {
      console.error("Groww proxy error:", error);
      return {};
    }

    return data as GrowwLtpResponse;
  } catch (err) {
    console.error("Failed to fetch live prices:", err);
    return {};
  }
}

export function applyLiveData(
  stock: Stock,
  liveData: { ltp: number; open?: number; high?: number; low?: number; close?: number; volume?: number }
): Stock {
  const previousClose = liveData.close ?? stock.previousClose;
  const price = liveData.ltp;
  const change = Math.round((price - previousClose) * 100) / 100;
  const changePercent = Math.round((change / previousClose) * 10000) / 100;

  return {
    ...stock,
    price,
    previousClose,
    change,
    changePercent,
    high: liveData.high ?? stock.high,
    low: liveData.low ?? stock.low,
    open: liveData.open ?? stock.open,
    volume: liveData.volume ?? stock.volume,
    lastUpdated: new Date(),
  };
}
