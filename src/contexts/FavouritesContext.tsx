import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export interface Favourite {
  id: string;
  ticker: string;
  name: string | null;
  exchange: "NSE" | "BSE";
  is_index: boolean;
  yahoo_symbol: string | null;
  screener_code: string | null;
  created_at: string;
}

export interface FavouriteInput {
  ticker: string;
  name?: string | null;
  exchange?: "NSE" | "BSE";
  isIndex?: boolean;
  yahooSymbol?: string | null;
  screenerCode?: string | null;
}

interface FavouritesContextType {
  favourites: Favourite[];
  favouriteTickers: Set<string>;
  isFavourite: (ticker: string) => boolean;
  toggleFavourite: (input: FavouriteInput) => Promise<void>;
  removeFavourite: (ticker: string) => Promise<void>;
  pendingTickers: Set<string>;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const FavouritesContext = createContext<FavouritesContextType | undefined>(undefined);

export const FavouritesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [favourites, setFavourites] = useState<Favourite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingTickers, setPendingTickers] = useState<Set<string>>(new Set());

  const setPending = useCallback((ticker: string, on: boolean) => {
    setPendingTickers(prev => {
      const next = new Set(prev);
      if (on) next.add(ticker); else next.delete(ticker);
      return next;
    });
  }, []);

  const refresh = useCallback(async () => {
    if (!user) {
      setFavourites([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    const { data, error: err } = await supabase
      .from("user_favourites")
      .select("id, ticker, name, exchange, is_index, yahoo_symbol, screener_code, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (err) {
      setError(err.message);
      setLoading(false);
      return;
    }
    setFavourites((data ?? []) as Favourite[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (authLoading) return;
    refresh();
  }, [authLoading, refresh]);

  const favouriteTickers = useMemo(
    () => new Set(favourites.map(f => f.ticker)),
    [favourites],
  );

  const isFavourite = useCallback(
    (ticker: string) => favouriteTickers.has(ticker),
    [favouriteTickers],
  );

  const removeFavourite = useCallback(async (ticker: string) => {
    if (!user) return;
    const previous = favourites;
    setPending(ticker, true);
    setFavourites(prev => prev.filter(f => f.ticker !== ticker));
    const { error: err } = await supabase
      .from("user_favourites")
      .delete()
      .eq("user_id", user.id)
      .eq("ticker", ticker);
    setPending(ticker, false);
    if (err) {
      setFavourites(previous); // rollback
      toast.error("Couldn't remove favourite", { description: err.message });
      return;
    }
    toast.success(`${ticker} removed from favourites`);
  }, [user, favourites, setPending]);

  const toggleFavourite = useCallback(async (input: FavouriteInput) => {
    if (!user) {
      toast.error("Sign in to save favourites");
      return;
    }
    const ticker = input.ticker;
    if (favouriteTickers.has(ticker)) {
      await removeFavourite(ticker);
      return;
    }

    const optimistic: Favourite = {
      id: `optimistic-${ticker}`,
      ticker,
      name: input.name ?? null,
      exchange: input.exchange ?? "NSE",
      is_index: !!input.isIndex,
      yahoo_symbol: input.yahooSymbol ?? null,
      screener_code: input.screenerCode ?? null,
      created_at: new Date().toISOString(),
    };
    const previous = favourites;
    setPending(ticker, true);
    setFavourites(prev => [optimistic, ...prev]);

    const { data, error: err } = await supabase
      .from("user_favourites")
      .upsert({
        user_id: user.id,
        ticker,
        name: input.name ?? null,
        exchange: input.exchange ?? "NSE",
        is_index: !!input.isIndex,
        yahoo_symbol: input.yahooSymbol ?? null,
        screener_code: input.screenerCode ?? null,
      }, { onConflict: "user_id,ticker" })
      .select("id, ticker, name, exchange, is_index, yahoo_symbol, screener_code, created_at")
      .single();

    setPending(ticker, false);

    if (err) {
      setFavourites(previous); // rollback
      toast.error("Couldn't add favourite", { description: err.message });
      return;
    }
    setFavourites(prev => prev.map(f => (f.ticker === ticker ? (data as Favourite) : f)));
    toast.success(`${ticker} added to favourites`);
  }, [user, favourites, favouriteTickers, removeFavourite, setPending]);

  return (
    <FavouritesContext.Provider
      value={{
        favourites,
        favouriteTickers,
        isFavourite,
        toggleFavourite,
        removeFavourite,
        pendingTickers,
        loading,
        error,
        refresh,
      }}
    >
      {children}
    </FavouritesContext.Provider>
  );
};

export const useFavourites = () => {
  const ctx = useContext(FavouritesContext);
  if (!ctx) throw new Error("useFavourites must be used within FavouritesProvider");
  return ctx;
};
