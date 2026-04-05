import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { fetchLivePrices } from "@/lib/growwApi";
import { toast } from "@/hooks/use-toast";

export interface Holding {
  id: string;
  ticker: string;
  exchange: string;
  buy_price: number;
  quantity: number;
  buy_date: string;
  sector: string | null;
  // Computed live
  currentPrice?: number;
  currentValue?: number;
  investedValue?: number;
  gainLoss?: number;
  gainLossPercent?: number;
  // Screener-verified metrics
  marketCap?: number;
  volume?: number;
  dayChange?: number;
  dayChangePercent?: number;
  high?: number;
  low?: number;
  open?: number;
  previousClose?: number;
  priceSource?: "yahoo" | "screener" | "google" | "cached";
  lastUpdated?: Date;
}

export interface SectorAllocation {
  sector: string;
  value: number;
  percentage: number;
  count: number;
}

export function usePortfolio() {
  const { user } = useAuth();
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [loading, setLoading] = useState(true);
  const [enriching, setEnriching] = useState(false);
  const enrichedRef = useRef(false);
  const sectorEnrichedRef = useRef(false);

  const fetchHoldings = useCallback(async () => {
    if (!user) { setHoldings([]); setLoading(false); return; }
    setLoading(true);
    enrichedRef.current = false;
    sectorEnrichedRef.current = false;
    const { data, error } = await supabase
      .from("portfolio_holdings")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Failed to fetch holdings:", error);
      setLoading(false);
      return;
    }

    // First try to load cached prices for instant display
    const holdingsData = (data || []) as Holding[];
    if (holdingsData.length > 0) {
      const tickers = holdingsData.map(h => h.ticker);
      const { data: cached } = await supabase
        .from("cached_stock_prices")
        .select("*")
        .in("ticker", tickers);

      if (cached && cached.length > 0) {
        const cacheMap = new Map(cached.map((c: any) => [`${c.exchange}_${c.ticker}`, c]));
        holdingsData.forEach(h => {
          const c = cacheMap.get(`${h.exchange}_${h.ticker}`);
          if (c && Number(c.price) > 0) {
            const currentPrice = Number(c.price);
            const investedValue = h.buy_price * h.quantity;
            const currentValue = currentPrice * h.quantity;
            h.currentPrice = currentPrice;
            h.currentValue = currentValue;
            h.investedValue = investedValue;
            h.gainLoss = currentValue - investedValue;
            h.gainLossPercent = investedValue > 0 ? ((currentValue - investedValue) / investedValue) * 100 : 0;
            h.marketCap = Number(c.market_cap) || 0;
            h.volume = Number(c.volume) || 0;
            h.high = Number(c.high) || 0;
            h.low = Number(c.low) || 0;
            h.open = Number(c.open_price) || 0;
            h.previousClose = Number(c.previous_close) || 0;
            h.dayChange = Number(c.change) || 0;
            h.dayChangePercent = Number(c.change_percent) || 0;
            h.priceSource = "cached";
            h.lastUpdated = new Date(c.updated_at);
          }
        });
      }
    }

    setHoldings(holdingsData);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  // Enrich with live prices — FIX: use exchange_ticker key format
  const enrichWithLivePrices = useCallback(async () => {
    if (holdings.length === 0) return;
    setEnriching(true);
    try {
      const tickers = holdings.map(h => ({
        ticker: h.ticker,
        exchange: h.exchange as "NSE" | "BSE",
      }));
      const prices = await fetchLivePrices(tickers);

      setHoldings(prev =>
        prev.map(h => {
          // stock-proxy returns keys as "EXCHANGE_TICKER"
          const key = `${h.exchange}_${h.ticker}`;
          const live = prices[key];
          if (!live || !live.ltp || live.ltp === 0) {
            // Keep existing cached data if live fetch fails
            return h;
          }
          const currentPrice = live.ltp;
          const investedValue = h.buy_price * h.quantity;
          const currentValue = currentPrice * h.quantity;
          const previousClose = live.close || h.previousClose || 0;
          return {
            ...h,
            currentPrice,
            currentValue,
            investedValue,
            gainLoss: currentValue - investedValue,
            gainLossPercent: investedValue > 0
              ? ((currentValue - investedValue) / investedValue) * 100
              : 0,
            marketCap: live.marketCap || h.marketCap || 0,
            volume: live.volume || h.volume || 0,
            high: live.high || h.high || 0,
            low: live.low || h.low || 0,
            open: live.open || h.open || 0,
            previousClose,
            dayChange: previousClose > 0 ? currentPrice - previousClose : 0,
            dayChangePercent: previousClose > 0 ? ((currentPrice - previousClose) / previousClose) * 100 : 0,
            priceSource: "yahoo" as const,
            lastUpdated: new Date(),
          };
        })
      );
    } catch (err) {
      console.error("Failed to enrich prices:", err);
    }
    setEnriching(false);
  }, [holdings]);

  // Auto-enrich on load (once)
  useEffect(() => {
    if (holdings.length > 0 && !enrichedRef.current) {
      enrichedRef.current = true;
      enrichWithLivePrices();
    }
  }, [holdings.length, enrichWithLivePrices]);

  // Fetch sectors for holdings missing sector data
  const enrichSectors = useCallback(async () => {
    const missing = holdings.filter(h => !h.sector);
    if (missing.length === 0) return;

    try {
      const missingTickers = missing.map(h => h.ticker);

      // Step 1: Check sector_cache table first
      const { data: cached } = await supabase
        .from("sector_cache")
        .select("ticker, sector")
        .in("ticker", missingTickers);

      const cachedMap = new Map((cached || []).map((c: any) => [c.ticker, c.sector]));
      const stillMissing = missingTickers.filter(t => !cachedMap.has(t));

      // Step 2: Call edge function only for truly uncached tickers
      let remoteSectors: Record<string, string> = {};
      if (stillMissing.length > 0) {
        const { data, error } = await supabase.functions.invoke("sector-lookup", {
          body: { tickers: stillMissing },
        });
        if (!error && data) {
          remoteSectors = data;
        }
      }

      // Merge cached + remote results
      const allSectors: Record<string, string> = {};
      for (const [ticker, sector] of cachedMap) allSectors[ticker] = sector;
      for (const [ticker, sector] of Object.entries(remoteSectors)) allSectors[ticker] = sector;

      // Update DB holdings with resolved sectors
      for (const h of missing) {
        const sector = allSectors[h.ticker];
        if (sector) {
          await supabase
            .from("portfolio_holdings")
            .update({ sector })
            .eq("id", h.id);
        }
      }

      setHoldings(prev =>
        prev.map(h => ({
          ...h,
          sector: allSectors[h.ticker] || h.sector,
        }))
      );
    } catch (err) {
      console.error("Sector enrichment failed:", err);
    }
  }, [holdings]);

  useEffect(() => {
    if (holdings.length > 0 && !sectorEnrichedRef.current) {
      sectorEnrichedRef.current = true;
      enrichSectors();
    }
  }, [holdings.length, enrichSectors]);

  const addHolding = async (holding: {
    ticker: string;
    exchange: string;
    buy_price: number;
    quantity: number;
    buy_date: string;
  }) => {
    if (!user) return;
    const { error } = await supabase.from("portfolio_holdings").insert({
      ...holding,
      user_id: user.id,
    });
    if (error) {
      toast({ title: "Error", description: "Failed to add holding", variant: "destructive" });
      return;
    }
    toast({ title: "Success", description: `${holding.ticker} added to portfolio` });
    await fetchHoldings();
  };

  const removeHolding = async (id: string) => {
    const { error } = await supabase.from("portfolio_holdings").delete().eq("id", id);
    if (error) {
      toast({ title: "Error", description: "Failed to remove holding", variant: "destructive" });
      return;
    }
    setHoldings(prev => prev.filter(h => h.id !== id));
  };

  // Derived metrics
  const totalInvested = holdings.reduce((sum, h) => sum + (h.investedValue || 0), 0);
  const totalCurrent = holdings.reduce((sum, h) => sum + (h.currentValue || 0), 0);
  const totalGainLoss = totalCurrent - totalInvested;
  const totalGainLossPercent = totalInvested > 0 ? (totalGainLoss / totalInvested) * 100 : 0;
  const totalDayChange = holdings.reduce((sum, h) => sum + ((h.dayChange || 0) * h.quantity), 0);

  const topGainer = holdings.length > 0
    ? holdings.reduce((best, h) => (h.gainLossPercent || 0) > (best.gainLossPercent || 0) ? h : best, holdings[0])
    : null;
  const topLoser = holdings.length > 0
    ? holdings.reduce((worst, h) => (h.gainLossPercent || 0) < (worst.gainLossPercent || 0) ? h : worst, holdings[0])
    : null;

  const sectorAllocation: SectorAllocation[] = (() => {
    const map = new Map<string, { value: number; count: number }>();
    for (const h of holdings) {
      const s = h.sector || "Unknown";
      const prev = map.get(s) || { value: 0, count: 0 };
      map.set(s, { value: prev.value + (h.currentValue || 0), count: prev.count + 1 });
    }
    const total = totalCurrent || 1;
    return Array.from(map.entries())
      .map(([sector, { value, count }]) => ({
        sector,
        value,
        percentage: (value / total) * 100,
        count,
      }))
      .sort((a, b) => b.value - a.value);
  })();

  const refreshAll = useCallback(async () => {
    await enrichWithLivePrices();
    sectorEnrichedRef.current = false;
    await enrichSectors();
  }, [enrichWithLivePrices, enrichSectors]);

  return {
    holdings, loading, enriching,
    addHolding, removeHolding, fetchHoldings, enrichWithLivePrices, enrichSectors, refreshAll,
    totalInvested, totalCurrent, totalGainLoss, totalGainLossPercent,
    totalDayChange, topGainer, topLoser,
    sectorAllocation,
  };
}
