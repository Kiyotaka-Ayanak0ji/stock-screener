import { supabase } from "@/integrations/supabase/client";
import { Stock } from "./stockData";

interface StockQuote {
  ltp: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  volume?: number;
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
  const change = Math.round((price - previousClose) * 100) / 100;
  const changePercent = previousClose > 0 ? Math.round((change / previousClose) * 10000) / 100 : 0;

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
