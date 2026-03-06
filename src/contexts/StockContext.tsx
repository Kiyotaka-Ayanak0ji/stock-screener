import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Stock, StockNote, StockEvent, SAMPLE_STOCKS, simulatePriceUpdate, generateStockData, ALL_AVAILABLE_STOCKS, encrypt, decrypt } from "@/lib/stockData";
import { fetchLivePrices, applyLiveData } from "@/lib/growwApi";

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
}

const StockContext = createContext<StockContextType | undefined>(undefined);

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
  const [stocks, setStocks] = useState<Stock[]>(SAMPLE_STOCKS);
  const [notes, setNotes] = useState<StockNote[]>(() => loadEncrypted("st_notes", []));
  const [events, setEvents] = useState<StockEvent[]>(() => loadEncrypted("st_events", []));
  const [watchlist, setWatchlist] = useState<string[]>(() =>
    loadEncrypted("st_watchlist", SAMPLE_STOCKS.map(s => s.ticker))
  );
  const [isMarketOpen] = useState(true);
  const [lastFlash, setLastFlash] = useState<Record<string, "up" | "down" | null>>({});
  const prevPrices = useRef<Record<string, number>>({});

  // Column visibility
  const [columnVisibility, setColumnVisibility] = useState<Record<string, boolean>>(() =>
    loadEncrypted("st_col_vis", {})
  );

  // Custom columns
  const [customColumns, setCustomColumns] = useState<CustomColumn[]>(() =>
    loadEncrypted("st_custom_cols", [])
  );

  // Custom column data: { [ticker]: { [columnId]: number | null } }
  const [customColumnData, setCustomColumnData] = useState<Record<string, Record<string, number | null>>>(() =>
    loadEncrypted("st_custom_data", {})
  );

  // Save preferences encrypted
  useEffect(() => { saveEncrypted("st_notes", notes); }, [notes]);
  useEffect(() => { saveEncrypted("st_events", events); }, [events]);
  useEffect(() => { saveEncrypted("st_watchlist", watchlist); }, [watchlist]);
  useEffect(() => { saveEncrypted("st_col_vis", columnVisibility); }, [columnVisibility]);
  useEffect(() => { saveEncrypted("st_custom_cols", customColumns); }, [customColumns]);
  useEffect(() => { saveEncrypted("st_custom_data", customColumnData); }, [customColumnData]);

  const [useLiveData, setUseLiveData] = useState(true);
  const liveDataFailed = useRef(false);

  // Fetch live data from Groww API
  useEffect(() => {
    if (!isMarketOpen) return;

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
        const tickerInfo = stocks
          .filter(s => watchlist.includes(s.ticker))
          .map(s => ({ ticker: s.ticker, exchange: s.exchange }));

        const liveData = await fetchLivePrices(tickerInfo);
        
        if (!liveData || Object.keys(liveData).length === 0) {
          console.warn("No live data received, falling back to simulation");
          liveDataFailed.current = true;
          return;
        }

        setStocks(prev => {
          const updated = prev.map(s => {
            const key = `${s.exchange}_${s.ticker}`;
            const live = liveData[key];
            if (live) {
              return applyLiveData(s, live);
            }
            return simulatePriceUpdate(s);
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
        liveDataFailed.current = true;
      }
    };

    fetchLive();
    const interval = setInterval(fetchLive, 5000);
    return () => clearInterval(interval);
  }, [isMarketOpen, watchlist]);

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
    // Default visible
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

  const filteredStocks = stocks.filter(s => watchlist.includes(s.ticker));

  return (
    <StockContext.Provider value={{
      stocks: filteredStocks, notes, events, watchlist,
      addStock, removeStock, updateNote, updateEvent,
      isMarketOpen, lastFlash,
      columnVisibility, toggleColumnVisibility,
      customColumns, addCustomColumn, removeCustomColumn,
      customColumnData, updateCustomColumnData,
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
