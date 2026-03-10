import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Stock, StockNote, StockEvent, SAMPLE_STOCKS, simulatePriceUpdate, generateStockData, ALL_AVAILABLE_STOCKS, encrypt, decrypt } from "@/lib/stockData";
import { fetchLivePrices, applyLiveData } from "@/lib/growwApi";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

function checkMarketOpen(): boolean {
  const now = new Date();
  const istOffset = 5.5 * 60 * 60 * 1000;
  const ist = new Date(now.getTime() + istOffset + now.getTimezoneOffset() * 60 * 1000);
  const day = ist.getDay();
  if (day === 0 || day === 6) return false;
  const minutes = ist.getHours() * 60 + ist.getMinutes();
  return minutes >= 555 && minutes <= 930; // 9:15 AM - 3:30 PM IST
}


export interface CustomColumn {
  id: string;
  name: string;
}

interface StockContextType {
  stocks: Stock[];
  notes: StockNote[];
  events: StockEvent[];
  watchlist: string[];
  addStock: (ticker: string, name?: string, exchange?: "NSE" | "BSE") => void;
  removeStock: (ticker: string) => void;
  updateNote: (ticker: string, note: string) => void;
  updateEvent: (ticker: string, tags: string[]) => void;
  isMarketOpen: boolean;
  lastFlash: Record<string, "up" | "down" | null>;
  columnVisibility: Record<string, boolean>;
  toggleColumnVisibility: (key: string) => void;
  customColumns: CustomColumn[];
  addCustomColumn: (name: string) => void;
  removeCustomColumn: (id: string) => void;
  customColumnData: Record<string, Record<string, number | null>>;
  updateCustomColumnData: (ticker: string, columnId: string, value: number | null) => void;
  prefsLoaded: boolean;
  refreshPrices: () => Promise<void>;
  isRefreshing: boolean;
}

const StockContext = createContext<StockContextType | undefined>(undefined);

// --- localStorage helpers (guest mode) ---
function loadEncrypted<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    if (!stored) return fallback;
    return JSON.parse(decrypt(stored));
  } catch {
    return fallback;
  }
}

function saveEncrypted(key: string, data: unknown) {
  localStorage.setItem(key, encrypt(JSON.stringify(data)));
}

export const StockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();

  const defaultWatchlist = SAMPLE_STOCKS.map(s => s.ticker);

  const [stocks, setStocks] = useState<Stock[]>(SAMPLE_STOCKS);
  const [notes, setNotes] = useState<StockNote[]>([]);
  const [events, setEvents] = useState<StockEvent[]>([]);
  const [watchlist, setWatchlist] = useState<string[]>(defaultWatchlist);
  const [isMarketOpen, setIsMarketOpen] = useState(() => checkMarketOpen());

  // Update market status every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => setIsMarketOpen(checkMarketOpen()), 30000);
    return () => clearInterval(interval);
  }, []);

  const [lastFlash, setLastFlash] = useState<Record<string, "up" | "down" | null>>({});
  const prevPrices = useRef<Record<string, number>>({});
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>({});
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>([]);
  const [customColumnData, setCustomColumnData] = useState<Record<string, Record<string, number | null>>>({});
  const [prefsLoaded, setPrefsLoaded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Refs to hold latest state for debounced save (avoids stale closures)
  const latestState = useRef({ notes, events, watchlist, columnVisibility, customColumns, customColumnData });
  useEffect(() => {
    latestState.current = { notes, events, watchlist, columnVisibility, customColumns, customColumnData };
  }, [notes, events, watchlist, columnVisibility, customColumns, customColumnData]);

  // Load preferences based on auth state
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      loadFromDatabase();
    } else {
      loadFromLocalStorage();
    }
  }, [user, authLoading]);

  const loadFromLocalStorage = () => {
    setNotes(loadEncrypted("st_notes", []));
    setEvents(loadEncrypted("st_events", []));
    setWatchlist(loadEncrypted("st_watchlist", defaultWatchlist));
    setColumnVisibility(loadEncrypted("st_col_vis", {}));
    setCustomColumns(loadEncrypted("st_custom_cols", []));
    setCustomColumnData(loadEncrypted("st_custom_data", {}));
    setPrefsLoaded(true);
  };

  const loadFromDatabase = async () => {
    try {
      const { data } = await supabase
        .from("user_preferences")
        .select("*")
        .eq("user_id", user!.id)
        .single();

      if (data) {
        setWatchlist(data.watchlist ? JSON.parse(decrypt(data.watchlist)) : defaultWatchlist);
        setNotes(data.notes ? JSON.parse(decrypt(data.notes)) : []);
        setEvents(data.events ? JSON.parse(decrypt(data.events)) : []);
        setColumnVisibility(data.column_visibility ? JSON.parse(decrypt(data.column_visibility)) : {});
        setCustomColumns(data.custom_columns ? JSON.parse(decrypt(data.custom_columns)) : []);
        setCustomColumnData(data.custom_column_data ? JSON.parse(decrypt(data.custom_column_data)) : {});
      }
    } catch (err) {
      console.error("Failed to load preferences from database:", err);
      loadFromLocalStorage(); // fallback
    }
    setPrefsLoaded(true);
  };

  // Save preferences with debounce
  const savePreferences = useCallback(() => {
    if (!prefsLoaded) return;

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const s = latestState.current;
      if (user) {
        // Save to database
        supabase
          .from("user_preferences")
          .update({
            watchlist: encrypt(JSON.stringify(s.watchlist)),
            notes: encrypt(JSON.stringify(s.notes)),
            events: encrypt(JSON.stringify(s.events)),
            column_visibility: encrypt(JSON.stringify(s.columnVisibility)),
            custom_columns: encrypt(JSON.stringify(s.customColumns)),
            custom_column_data: encrypt(JSON.stringify(s.customColumnData)),
          })
          .eq("user_id", user.id)
          .then(({ error }) => {
            if (error) console.error("Failed to save preferences to database:", error);
          });
      } else {
        // Save to localStorage
        saveEncrypted("st_notes", s.notes);
        saveEncrypted("st_events", s.events);
        saveEncrypted("st_watchlist", s.watchlist);
        saveEncrypted("st_col_vis", s.columnVisibility);
        saveEncrypted("st_custom_cols", s.customColumns);
        saveEncrypted("st_custom_data", s.customColumnData);
      }
    }, 500);
  }, [user, prefsLoaded]);

  // Trigger save when preferences change
  useEffect(() => { savePreferences(); }, [notes, events, watchlist, columnVisibility, customColumns, customColumnData]);

  const liveDataFailed = useRef(false);
  const stocksRef = useRef(stocks);
  const watchlistRef = useRef(watchlist);

  // Keep refs in sync
  useEffect(() => { stocksRef.current = stocks; }, [stocks]);
  useEffect(() => { watchlistRef.current = watchlist; }, [watchlist]);

  // Fetch live data from Yahoo Finance via proxy
  useEffect(() => {
    if (!isMarketOpen || !prefsLoaded) return;

    let consecutiveFailures = 0;
    const MAX_FAILURES = 3;

    const fetchLive = async () => {
      if (liveDataFailed.current) {
        setStocks(prev => {
          const updated = prev.map(s => simulatePriceUpdate(s));
          const flashes: Record<string, "up" | "down" | null> = {};
          updated.forEach(s => {
            const prevPrice = prevPrices.current[s.ticker] || s.price;
            if (s.price > prevPrice) flashes[s.ticker] = "up";
            else if (s.price < prevPrice) flashes[s.ticker] = "down";
            else flashes[s.ticker] = null;
            prevPrices.current[s.ticker] = s.price;
          });
          setLastFlash(flashes);
          return updated;
        });
        return;
      }

      try {
        // Use refs to always get latest stocks & watchlist (avoids stale closure)
        const currentStocks = stocksRef.current;
        const currentWatchlist = watchlistRef.current;
        const tickerInfo = currentStocks
          .filter(s => currentWatchlist.includes(s.ticker))
          .map(s => ({ ticker: s.ticker, exchange: s.exchange }));

        if (tickerInfo.length === 0) return;

        const liveData = await fetchLivePrices(tickerInfo);

        if (!liveData || Object.keys(liveData).length === 0) {
          consecutiveFailures++;
          console.warn(`No live data received (attempt ${consecutiveFailures}/${MAX_FAILURES})`);
          if (consecutiveFailures >= MAX_FAILURES) {
            console.warn("Too many failures, falling back to simulation");
            liveDataFailed.current = true;
          }
          return;
        }

        consecutiveFailures = 0; // Reset on success

        setStocks(prev => {
          const updated = prev.map(s => {
            const key = `${s.exchange}_${s.ticker}`;
            const live = liveData[key];
            if (live) return applyLiveData(s, live);
            return s; // Keep existing data instead of simulating
          });
          const flashes: Record<string, "up" | "down" | null> = {};
          updated.forEach(s => {
            const prevPrice = prevPrices.current[s.ticker] || s.price;
            if (s.price > prevPrice) flashes[s.ticker] = "up";
            else if (s.price < prevPrice) flashes[s.ticker] = "down";
            else flashes[s.ticker] = null;
            prevPrices.current[s.ticker] = s.price;
          });
          setLastFlash(flashes);
          return updated;
        });
      } catch (err) {
        console.error("Live data fetch failed:", err);
        consecutiveFailures++;
        if (consecutiveFailures >= MAX_FAILURES) {
          liveDataFailed.current = true;
        }
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [isMarketOpen, prefsLoaded]);

  const addStock = useCallback((ticker: string, name?: string, exchange?: "NSE" | "BSE") => {
    if (watchlist.includes(ticker)) return;
    const info = ALL_AVAILABLE_STOCKS.find(s => s.ticker === ticker);
    const stockName = info?.name || name || ticker;
    const stockExchange = info?.exchange || exchange || "NSE";
    const existing = stocks.find(s => s.ticker === ticker);
    if (!existing) {
      setStocks(prev => [...prev, generateStockData(ticker, stockName, stockExchange)]);
    }
    setWatchlist(prev => [...prev, ticker]);
  }, [watchlist, stocks]);

  const removeStock = useCallback((ticker: string) => {
    setWatchlist(prev => prev.filter(t => t !== ticker));
  }, []);

  const updateNote = useCallback((ticker: string, note: string) => {
    setNotes(prev => {
      const existing = prev.findIndex(n => n.ticker === ticker);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ticker, note };
        return updated;
      }
      return [...prev, { ticker, note }];
    });
  }, []);

  const updateEvent = useCallback((ticker: string, tags: string[]) => {
    setEvents(prev => {
      const existing = prev.findIndex(e => e.ticker === ticker);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { ticker, tags };
        return updated;
      }
      return [...prev, { ticker, tags }];
    });
  }, []);

  const toggleColumnVisibility = useCallback((key: string) => {
    setColumnVisibility(prev => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  }, []);

  const addCustomColumn = useCallback((name: string) => {
    const id = `col_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setCustomColumns(prev => [...prev, { id, name }]);
    setColumnVisibility(prev => ({ ...prev, [`custom_${id}`]: true }));
  }, []);

  const removeCustomColumn = useCallback((id: string) => {
    setCustomColumns(prev => prev.filter(c => c.id !== id));
    setColumnVisibility(prev => {
      const next = { ...prev };
      delete next[`custom_${id}`];
      return next;
    });
    setCustomColumnData(prev => {
      const next = { ...prev };
      for (const ticker of Object.keys(next)) {
        if (next[ticker]?.[id] !== undefined) {
          const tickerData = { ...next[ticker] };
          delete tickerData[id];
          next[ticker] = tickerData;
        }
      }
      return next;
    });
  }, []);

  const updateCustomColumnData = useCallback((ticker: string, columnId: string, value: number | null) => {
    setCustomColumnData(prev => ({
      ...prev,
      [ticker]: {
        ...(prev[ticker] || {}),
        [columnId]: value,
      },
    }));
  }, []);

  // Manual refresh: fetches live prices regardless of market status
  const refreshPrices = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const currentStocks = stocksRef.current;
      const currentWatchlist = watchlistRef.current;
      const tickerInfo = currentStocks
        .filter(s => currentWatchlist.includes(s.ticker))
        .map(s => ({ ticker: s.ticker, exchange: s.exchange }));

      if (tickerInfo.length === 0) return;

      const liveData = await fetchLivePrices(tickerInfo);

      if (liveData && Object.keys(liveData).length > 0) {
        setStocks(prev => {
          const updated = prev.map(s => {
            const key = `${s.exchange}_${s.ticker}`;
            const live = liveData[key];
            if (live) return applyLiveData(s, live);
            return s;
          });
          const flashes: Record<string, "up" | "down" | null> = {};
          updated.forEach(s => {
            const prevPrice = prevPrices.current[s.ticker] || s.price;
            if (s.price > prevPrice) flashes[s.ticker] = "up";
            else if (s.price < prevPrice) flashes[s.ticker] = "down";
            else flashes[s.ticker] = null;
            prevPrices.current[s.ticker] = s.price;
          });
          setLastFlash(flashes);
          return updated;
        });
      }
    } catch (err) {
      console.error("Manual refresh failed:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const filteredStocks = stocks.filter(s => watchlist.includes(s.ticker));

  return (
    <StockContext.Provider value={{
      stocks: filteredStocks, notes, events, watchlist,
      addStock, removeStock, updateNote, updateEvent,
      isMarketOpen, lastFlash,
      columnVisibility, toggleColumnVisibility,
      customColumns, addCustomColumn, removeCustomColumn,
      customColumnData, updateCustomColumnData,
      prefsLoaded, refreshPrices, isRefreshing,
    }}>
      {children}
    </StockContext.Provider>
  );
};

export const useStocks = () => {
  const ctx = useContext(StockContext);
  if (!ctx) throw new Error("useStocks must be used within StockProvider");
  return ctx;
};
