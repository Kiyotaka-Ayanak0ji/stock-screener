import { supabase } from "@/integrations/supabase/client";
import { Stock } from "./stockData";

interface StockQuote {
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
  change?: number;
  changePercent?: number;
  marketCap?: number;
}

export async function fetchLivePrices(
  tickers: { ticker: string; exchange: "NSE" | "BSE" }[]
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

export function applyLiveData(
  stock: Stock,
  liveData: StockQuote
): Stock {
  const previousClose = liveData.close ?? stock.previousClose;
  const price = liveData.ltp;
  const change = liveData.change ?? Math.round((price - previousClose) * 100) / 100;
  const changePercent = liveData.changePercent ?? Math.round((change / previousClose) * 10000) / 100;

  return {
    ...stock,
    price,
    previousClose,
    change: Math.round(change * 100) / 100,
    changePercent: Math.round(changePercent * 100) / 100,
    high: liveData.high ?? stock.high,
    low: liveData.low ?? stock.low,
    open: liveData.open ?? stock.open,
    volume: liveData.volume ?? stock.volume,
    marketCap: liveData.marketCap ? Math.round(liveData.marketCap / 10000000) : stock.marketCap, // Convert to Cr
    lastUpdated: new Date(),
  };
}
