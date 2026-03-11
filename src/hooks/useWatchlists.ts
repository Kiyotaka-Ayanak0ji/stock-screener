import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { encrypt, decrypt } from "@/lib/stockData";
import { toast } from "sonner";

export interface Watchlist {
  id: string;
  name: string;
  tickers: string[];
  isDefault: boolean;
}

export function useWatchlists() {
  const { user, isLoading: authLoading } = useAuth();
  const [watchlists, setWatchlists] = useState<Watchlist[]>([]);
  const [activeWatchlistId, setActiveWatchlistId] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  // Load watchlists from database
  const loadWatchlists = useCallback(async () => {
    if (!user) {
      setWatchlists([]);
      setActiveWatchlistId(null);
      setLoaded(true);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("user_watchlists")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Failed to load watchlists:", error);
        setLoaded(true);
        return;
      }

      if (data && data.length > 0) {
        const parsed: Watchlist[] = data.map((row: any) => ({
          id: row.id,
          name: row.name,
          tickers: JSON.parse(decrypt(row.tickers)),
          isDefault: row.is_default,
        }));
        setWatchlists(parsed);
        // Set active to default or first
        const defaultList = parsed.find(w => w.isDefault) || parsed[0];
        if (!activeWatchlistId || !parsed.find(w => w.id === activeWatchlistId)) {
          setActiveWatchlistId(defaultList.id);
        }
      }
    } catch (err) {
      console.error("Error loading watchlists:", err);
    }
    setLoaded(true);
  }, [user]);

  useEffect(() => {
    if (!authLoading) loadWatchlists();
  }, [user, authLoading, loadWatchlists]);

  const createWatchlist = useCallback(async (name: string, tickers: string[] = []) => {
    if (!user) return null;

    const encryptedTickers = encrypt(JSON.stringify(tickers));
    const { data, error } = await supabase
      .from("user_watchlists")
      .insert({
        user_id: user.id,
        name,
        tickers: encryptedTickers,
        is_default: watchlists.length === 0,
      })
      .select()
      .single();

    if (error) {
      console.error("Failed to create watchlist:", error);
      toast.error("Failed to create watchlist");
      return null;
    }

    const newList: Watchlist = {
      id: data.id,
      name: data.name,
      tickers,
      isDefault: data.is_default,
    };
    setWatchlists(prev => [...prev, newList]);
    if (watchlists.length === 0) setActiveWatchlistId(newList.id);
    toast.success(`Watchlist "${name}" created`);
    return newList;
  }, [user, watchlists.length]);

  const updateWatchlistTickers = useCallback(async (id: string, tickers: string[]) => {
    if (!user) return;

    const encryptedTickers = encrypt(JSON.stringify(tickers));
    const { error } = await supabase
      .from("user_watchlists")
      .update({ tickers: encryptedTickers })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to update watchlist:", error);
      return;
    }

    setWatchlists(prev => prev.map(w => w.id === id ? { ...w, tickers } : w));
  }, [user]);

  const renameWatchlist = useCallback(async (id: string, name: string) => {
    if (!user) return;

    const { error } = await supabase
      .from("user_watchlists")
      .update({ name })
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to rename watchlist:", error);
      toast.error("Failed to rename watchlist");
      return;
    }

    setWatchlists(prev => prev.map(w => w.id === id ? { ...w, name } : w));
    toast.success(`Watchlist renamed to "${name}"`);
  }, [user]);

  const deleteWatchlist = useCallback(async (id: string) => {
    if (!user) return;
    if (watchlists.length <= 1) {
      toast.error("Cannot delete your only watchlist");
      return;
    }

    const { error } = await supabase
      .from("user_watchlists")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      console.error("Failed to delete watchlist:", error);
      toast.error("Failed to delete watchlist");
      return;
    }

    const remaining = watchlists.filter(w => w.id !== id);
    setWatchlists(remaining);
    if (activeWatchlistId === id) {
      setActiveWatchlistId(remaining[0]?.id || null);
    }
    toast.success("Watchlist deleted");
  }, [user, watchlists, activeWatchlistId]);

  const activeWatchlist = watchlists.find(w => w.id === activeWatchlistId) || null;

  return {
    watchlists,
    activeWatchlist,
    activeWatchlistId,
    setActiveWatchlistId,
    createWatchlist,
    updateWatchlistTickers,
    renameWatchlist,
    deleteWatchlist,
    loaded,
  };
}
