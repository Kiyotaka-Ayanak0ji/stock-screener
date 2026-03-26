import { useState, useEffect, useCallback } from "react";
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

  const fetchHoldings = useCallback(async () => {
    if (!user) { setHoldings([]); setLoading(false); return; }
    setLoading(true);
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
    setHoldings((data || []) as Holding[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchHoldings(); }, [fetchHoldings]);

  // Enrich with live prices
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
          const live = prices[h.ticker];
          const currentPrice = live?.ltp || 0;
          const investedValue = h.buy_price * h.quantity;
          const currentValue = currentPrice * h.quantity;
          return {
            ...h,
            currentPrice,
            currentValue,
            investedValue,
            gainLoss: currentValue - investedValue,
            gainLossPercent: investedValue > 0
              ? ((currentValue - investedValue) / investedValue) * 100
              : 0,
          };
        })
      );
    } catch (err) {
      console.error("Failed to enrich prices:", err);
    }
    setEnriching(false);
  }, [holdings.length]);

  useEffect(() => {
    if (holdings.length > 0 && !holdings[0].currentPrice) {
      enrichWithLivePrices();
    }
  }, [holdings.length]);

  // Fetch sectors for holdings missing sector data
  const enrichSectors = useCallback(async () => {
    const missing = holdings.filter(h => !h.sector);
    if (missing.length === 0) return;

    try {
      const { data, error } = await supabase.functions.invoke("sector-lookup", {
        body: { tickers: missing.map(h => h.ticker) },
      });
      if (error || !data) return;

      // Update DB and local state
      for (const h of missing) {
        const sector = data[h.ticker];
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
          sector: data[h.ticker] || h.sector,
        }))
      );
    } catch (err) {
      console.error("Sector enrichment failed:", err);
    }
  }, [holdings]);

  useEffect(() => {
    if (holdings.length > 0) enrichSectors();
  }, [holdings.length]);

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

  const diversityScore = (() => {
    if (sectorAllocation.length === 0) return 0;
    // Herfindahl-Hirschman Index based diversity (inverted, 0-100)
    const hhi = sectorAllocation.reduce((sum, s) => sum + Math.pow(s.percentage / 100, 2), 0);
    return Math.round((1 - hhi) * 100);
  })();

  return {
    holdings, loading, enriching,
    addHolding, removeHolding, fetchHoldings, enrichWithLivePrices,
    totalInvested, totalCurrent, totalGainLoss, totalGainLossPercent,
    sectorAllocation, diversityScore,
  };
}
