import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import { Stock, StockNote, StockEvent, SAMPLE_STOCKS, simulatePriceUpdate, generateStockData, ALL_AVAILABLE_STOCKS, encrypt, decrypt } from "@/lib/stockData";
import { fetchLivePrices, applyLiveData } from "@/lib/growwApi";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useWatchlists, Watchlist } from "@/hooks/useWatchlists";

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

export interface TriggeredAlert {
  id: string;
  ticker: string;
  triggerPrice: number;
  hitPrice: number;
  timestamp: Date;
}

interface StockContextType {
  stocks: Stock[];
  notes: StockNote[];
  events: StockEvent[];
  watchlist: string[];
  addStock: (ticker: string, name?: string, exchange?: "NSE" | "BSE", options?: { yahooSymbol?: string; isIndex?: boolean; screenerCode?: string }) => void;
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
  pricesLoaded: boolean;
  loadedTickers: Set<string>;
  refreshPrices: () => Promise<void>;
  isRefreshing: boolean;
  // Price triggers
  priceTriggers: Record<string, { price: number; createdAt: number }>;
  setPriceTrigger: (ticker: string, price: number | null) => void;
  triggeredAlerts: TriggeredAlert[];
  clearAlert: (id: string) => void;
  clearAllAlerts: () => void;
  // Multi-watchlist support
  userWatchlists: Watchlist[];
  activeWatchlist: Watchlist | null;
  activeWatchlistId: string | null;
  setActiveWatchlistId: (id: string) => void;
  createWatchlist: (name: string) => Promise<Watchlist | null>;
  renameWatchlist: (id: string, name: string) => Promise<void>;
  deleteWatchlist: (id: string) => Promise<void>;
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
  const {
    watchlists: userWatchlists,
    activeWatchlist,
    activeWatchlistId,
    setActiveWatchlistId,
    createWatchlist: createWl,
    updateWatchlistTickers,
    renameWatchlist,
    deleteWatchlist,
    loaded: watchlistsLoaded,
  } = useWatchlists();

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
  const [pricesLoaded, setPricesLoaded] = useState(false);
  const [loadedTickers, setLoadedTickers] = useState<Set<string>>(new Set());
  const [priceTriggers, setPriceTriggers] = useState<Record<string, { price: number; createdAt: number }>>({});
  const [triggeredAlerts, setTriggeredAlerts] = useState<TriggeredAlert[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistent ticker metadata (screenerCode, yahooSymbol, isIndex) — survives reloads
  const tickerMetaRef = useRef<Record<string, { screenerCode?: string; yahooSymbol?: string; isIndex?: boolean }>>(
    loadEncrypted("st_ticker_meta", {})
  );
  const saveTickerMeta = (ticker: string, meta: { screenerCode?: string; yahooSymbol?: string; isIndex?: boolean }) => {
    tickerMetaRef.current = { ...tickerMetaRef.current, [ticker]: meta };
    saveEncrypted("st_ticker_meta", tickerMetaRef.current);
  };
  const getTickerMeta = (ticker: string) => tickerMetaRef.current[ticker];

  // Refs to hold latest state for debounced save (avoids stale closures)
  const latestState = useRef({ notes, events, watchlist, columnVisibility, customColumns, customColumnData, priceTriggers });
  useEffect(() => {
    latestState.current = { notes, events, watchlist, columnVisibility, customColumns, customColumnData, priceTriggers };
  }, [notes, events, watchlist, columnVisibility, customColumns, customColumnData, priceTriggers]);

  // --- Cached price helpers ---
  const saveCachedPrices = useCallback(async (stocksToCache: Stock[]) => {
    try {
      const rows = stocksToCache.map(s => ({
        ticker: s.ticker,
        exchange: s.exchange,
        name: s.name,
        price: s.price,
        previous_close: s.previousClose,
        change: s.change,
        change_percent: s.changePercent,
        high: s.high,
        low: s.low,
        open_price: s.open,
        volume: s.volume,
        market_cap: s.marketCap,
        updated_at: new Date().toISOString(),
      }));

      const { error } = await supabase
        .from("cached_stock_prices")
        .upsert(rows, { onConflict: "ticker,exchange" });

      if (error) console.error("Failed to cache prices:", error);
    } catch (err) {
      console.error("Error saving cached prices:", err);
    }
  }, []);

  const loadCachedPrices = useCallback(async (tickers?: string[]) => {
    try {
      let query = supabase.from("cached_stock_prices").select("*");
      
      // Filter by specific tickers if provided, to avoid fetching all rows
      if (tickers && tickers.length > 0) {
        query = query.in("ticker", tickers);
      }

      const { data, error } = await query;

      if (error || !data || data.length === 0) {
        setPricesLoaded(true);
        return;
      }

      setStocks(prev => {
        const cacheMap = new Map(data.map((d: any) => [d.ticker, d]));
        const tickersWithData = new Set<string>();
        const updated = prev.map(s => {
          const cached = cacheMap.get(s.ticker);
          if (cached) {
            // Only mark as loaded if the cached price is non-zero
            if (Number(cached.price) !== 0) {
              tickersWithData.add(s.ticker);
            }
            return {
              ...s,
              price: Number(cached.price),
              previousClose: Number(cached.previous_close),
              change: Number(cached.change),
              changePercent: Number(cached.change_percent),
              high: Number(cached.high),
              low: Number(cached.low),
              open: Number(cached.open_price),
              volume: Number(cached.volume),
              marketCap: Number(cached.market_cap),
              lastUpdated: new Date(cached.updated_at),
            };
          }
          return s;
        });
        setLoadedTickers(prev => {
          const next = new Set(prev);
          tickersWithData.forEach(t => next.add(t));
          return next;
        });
        return updated;
      });
    } catch (err) {
      console.error("Error loading cached prices:", err);
    } finally {
      setPricesLoaded(true);
    }
  }, []);

  // Load preferences based on auth state
  useEffect(() => {
    if (authLoading) return;

    if (user) {
      loadFromDatabase();
    } else {
      loadFromLocalStorage();
    }
  }, [user, authLoading]);

  // Load cached prices for any new tickers added to watchlist
  const cachedPricesFetched = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!prefsLoaded) return;
    const uncached = watchlist.filter(t => !cachedPricesFetched.current.has(t));
    if (uncached.length === 0) return;
    uncached.forEach(t => cachedPricesFetched.current.add(t));
    loadCachedPrices(uncached);
  }, [prefsLoaded, watchlist, loadCachedPrices]);

  const loadFromLocalStorage = () => {
    setNotes(loadEncrypted("st_notes", []));
    setEvents(loadEncrypted("st_events", []));
    setWatchlist(loadEncrypted("st_watchlist", defaultWatchlist));
    setColumnVisibility(loadEncrypted("st_col_vis", {}));
    setCustomColumns(loadEncrypted("st_custom_cols", []));
    setCustomColumnData(loadEncrypted("st_custom_data", {}));
    setPriceTriggers(loadEncrypted("st_price_triggers", {}));
    setTriggeredAlerts(loadEncrypted<TriggeredAlert[]>("st_triggered_alerts", []).map(a => ({ ...a, timestamp: new Date(a.timestamp) })));
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
        // Price triggers stored in localStorage for all users
        saveEncrypted("st_price_triggers", s.priceTriggers);
      } else {
        // Save to localStorage
        saveEncrypted("st_notes", s.notes);
        saveEncrypted("st_events", s.events);
        saveEncrypted("st_watchlist", s.watchlist);
        saveEncrypted("st_col_vis", s.columnVisibility);
        saveEncrypted("st_custom_cols", s.customColumns);
        saveEncrypted("st_custom_data", s.customColumnData);
        saveEncrypted("st_price_triggers", s.priceTriggers);
      }
    }, 500);
  }, [user, prefsLoaded]);

  // Trigger save when preferences change
  useEffect(() => { savePreferences(); }, [notes, events, watchlist, columnVisibility, customColumns, customColumnData, priceTriggers]);

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
          setLoadedTickers(prev => {
            const next = new Set(prev);
            updated.forEach(s => next.add(s.ticker));
            return next;
          });
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
          .map(s => ({ ticker: s.ticker, exchange: s.exchange, yahooSymbol: s.yahooSymbol }));

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
          const newlyLoaded = new Set<string>();
          const updated = prev.map(s => {
            const key = `${s.exchange}_${s.ticker}`;
            const live = liveData[key];
            if (live) {
              newlyLoaded.add(s.ticker);
              return applyLiveData(s, live);
            }
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
          if (newlyLoaded.size > 0) {
            setLoadedTickers(prev => {
              const next = new Set(prev);
              newlyLoaded.forEach(t => next.add(t));
              return next;
            });
          }
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

  // Sync active watchlist tickers → local watchlist state (for logged-in users)
  useEffect(() => {
    if (user && activeWatchlist) {
      setWatchlist(activeWatchlist.tickers);
    }
  }, [user, activeWatchlist]);

  // Auto-resolve numeric BSE tickers to their trading symbols
  const resolvedNumericTickers = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!prefsLoaded) return;

    const numericTickers = watchlist.filter(t => /^\d+$/.test(t) && !resolvedNumericTickers.current.has(t));
    if (numericTickers.length === 0) return;

    // Mark as being resolved to prevent re-runs
    numericTickers.forEach(t => resolvedNumericTickers.current.add(t));

    const resolveAll = async () => {
      for (const numTicker of numericTickers) {
        try {
          const { data, error } = await supabase.functions.invoke("screener-search", {
            body: { query: numTicker },
          });
          if (error || !data?.results?.length) continue;

          // Find the resolved result (non-numeric ticker, or an index with yahooSymbol)
          const resolved = data.results.find((r: any) => !/^\d+$/.test(r.ticker) || (r.isIndex && r.yahooSymbol));
          if (!resolved) continue;

          console.log(`Auto-resolved numeric ticker ${numTicker} → ${resolved.ticker} (${resolved.exchange})${resolved.isIndex ? ' [INDEX]' : ''}`);

          // Replace in watchlist
          setWatchlist(prev => {
            const updated = prev.map(t => t === numTicker ? resolved.ticker : t);
            // Persist
            if (user && activeWatchlistId) {
              updateWatchlistTickers(activeWatchlistId, updated);
            }
            return updated;
          });

          // Replace in stocks array
          setStocks(prev => {
            const filtered = prev.filter(s => s.ticker !== numTicker);
            const exists = filtered.some(s => s.ticker === resolved.ticker);
            if (!exists) {
               filtered.push(generateStockData(resolved.ticker, resolved.name, resolved.exchange, {
                yahooSymbol: resolved.yahooSymbol,
                isIndex: resolved.isIndex,
                screenerCode: resolved.screenerCode,
              }));
            }
            return filtered;
          });

          // Persist ticker metadata for reload
          saveTickerMeta(resolved.ticker, {
            screenerCode: resolved.screenerCode,
            yahooSymbol: resolved.yahooSymbol,
            isIndex: resolved.isIndex,
          });

          // Migrate notes/events from old ticker to new
          setNotes(prev => prev.map(n => n.ticker === numTicker ? { ...n, ticker: resolved.ticker } : n));
          setEvents(prev => prev.map(e => e.ticker === numTicker ? { ...e, ticker: resolved.ticker } : e));
          setCustomColumnData(prev => {
            if (!prev[numTicker]) return prev;
            const next = { ...prev, [resolved.ticker]: prev[numTicker] };
            delete next[numTicker];
            return next;
          });
          setPriceTriggers(prev => {
            if (!prev[numTicker]) return prev;
            const next = { ...prev, [resolved.ticker]: prev[numTicker] };
            delete next[numTicker];
            return next;
          });

          toast.success(`Resolved ${numTicker} → ${resolved.ticker}`, { description: resolved.name });
        } catch (err) {
          console.error(`Failed to resolve numeric ticker ${numTicker}:`, err);
        }
      }
    };

    resolveAll();
  }, [watchlist, prefsLoaded, user, activeWatchlistId, updateWatchlistTickers]);

  // Auto-resolve missing metadata (screenerCode) for all watchlist tickers
  const resolvedMetaTickers = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!prefsLoaded) return;

    // Find tickers that don't have screenerCode in metadata and haven't been resolved yet
    const needsResolution = watchlist.filter(t => {
      if (resolvedMetaTickers.current.has(t)) return false;
      if (/^\d+$/.test(t)) return false; // numeric tickers handled by the other resolver
      const meta = getTickerMeta(t);
      return !meta?.screenerCode;
    });

    if (needsResolution.length === 0) return;

    // Mark as being resolved
    needsResolution.forEach(t => resolvedMetaTickers.current.add(t));

    const resolveMetadata = async () => {
      for (const ticker of needsResolution) {
        try {
          const { data, error } = await supabase.functions.invoke("screener-search", {
            body: { query: ticker },
          });
          if (error || !data?.results?.length) continue;

          // Find the matching result
          const match = data.results.find((r: any) =>
            r.ticker === ticker || r.ticker?.toUpperCase() === ticker.toUpperCase()
          );

          if (match) {
            const meta: { screenerCode?: string; yahooSymbol?: string; isIndex?: boolean } = {};
            if (match.screenerCode) meta.screenerCode = match.screenerCode;
            if (match.yahooSymbol) meta.yahooSymbol = match.yahooSymbol;
            if (match.isIndex) meta.isIndex = match.isIndex;

            if (Object.keys(meta).length > 0) {
              saveTickerMeta(ticker, meta);
              // Update existing stock object with the metadata
              setStocks(prev => prev.map(s => {
                if (s.ticker === ticker) {
                  return { ...s, ...meta };
                }
                return s;
              }));
              console.log(`Resolved metadata for ${ticker}:`, meta);
            }
          } else {
            // No exact match — for regular stocks, the Screener slug IS the ticker
            // Just verify it works by checking if Screener has a page for it
            // Store ticker itself as a "verified" marker so we don't re-query
            saveTickerMeta(ticker, {});
          }
        } catch (err) {
          console.error(`Failed to resolve metadata for ${ticker}:`, err);
        }
      }
    };

    resolveMetadata();
  }, [watchlist, prefsLoaded]);

  // Ensure all watchlist tickers have corresponding stock entries
  useEffect(() => {
    if (!prefsLoaded) return;
    setStocks(prev => {
      const existingTickers = new Set(prev.map(s => s.ticker));
      const missing = watchlist.filter(t => !existingTickers.has(t));
      if (missing.length === 0) return prev;
      const newStocks = missing.map(ticker => {
        const info = ALL_AVAILABLE_STOCKS.find(s => s.ticker === ticker);
        const meta = getTickerMeta(ticker);
        return generateStockData(ticker, info?.name || ticker, info?.exchange || "NSE", meta);
      });
      return [...prev, ...newStocks];
    });
  }, [watchlist, prefsLoaded]);

  const addStock = useCallback((ticker: string, name?: string, exchange?: "NSE" | "BSE", options?: { yahooSymbol?: string; isIndex?: boolean; screenerCode?: string }) => {
    if (watchlist.includes(ticker)) return;
    const info = ALL_AVAILABLE_STOCKS.find(s => s.ticker === ticker);
    const stockName = info?.name || name || ticker;
    const stockExchange = info?.exchange || exchange || "NSE";
    const existing = stocks.find(s => s.ticker === ticker);
    if (!existing) {
      setStocks(prev => [...prev, generateStockData(ticker, stockName, stockExchange, options)]);
    }
    // Persist ticker metadata
    if (options?.screenerCode || options?.yahooSymbol || options?.isIndex) {
      saveTickerMeta(ticker, { screenerCode: options.screenerCode, yahooSymbol: options.yahooSymbol, isIndex: options.isIndex });
    }
    const newWatchlist = [...watchlist, ticker];
    setWatchlist(newWatchlist);
    // Persist to active watchlist in DB
    if (user && activeWatchlistId) {
      updateWatchlistTickers(activeWatchlistId, newWatchlist);
    }
  }, [watchlist, stocks, user, activeWatchlistId, updateWatchlistTickers]);

  const removeStock = useCallback((ticker: string) => {
    const newWatchlist = watchlist.filter(t => t !== ticker);
    setWatchlist(newWatchlist);
    // Persist to active watchlist in DB
    if (user && activeWatchlistId) {
      updateWatchlistTickers(activeWatchlistId, newWatchlist);
    }
  }, [watchlist, user, activeWatchlistId, updateWatchlistTickers]);

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
        .map(s => ({ ticker: s.ticker, exchange: s.exchange, yahooSymbol: s.yahooSymbol }));

      if (tickerInfo.length === 0) {
        setIsRefreshing(false);
        return;
      }

      const liveData = await fetchLivePrices(tickerInfo);

      if (liveData && Object.keys(liveData).length > 0) {
        // Compute updated stocks synchronously from current ref
        const updatedStocks = currentStocks.map(s => {
          const key = `${s.exchange}_${s.ticker}`;
          const live = liveData[key];
          if (live) return applyLiveData(s, live);
          return s;
        });

        // Update flash indicators
        const flashes: Record<string, "up" | "down" | null> = {};
        updatedStocks.forEach(s => {
          const prevPrice = prevPrices.current[s.ticker] || s.price;
          if (s.price > prevPrice) flashes[s.ticker] = "up";
          else if (s.price < prevPrice) flashes[s.ticker] = "down";
          else flashes[s.ticker] = null;
          prevPrices.current[s.ticker] = s.price;
        });
        setLastFlash(flashes);
        setStocks(updatedStocks);

        // Persist refreshed prices to the database cache
        const watchlistStocks = updatedStocks.filter(s => currentWatchlist.includes(s.ticker));
        if (watchlistStocks.length > 0) {
          await saveCachedPrices(watchlistStocks);
        }
        toast.success("Prices refreshed and saved");
      } else {
        toast.info("No live data available right now");
      }
    } catch (err) {
      console.error("Manual refresh failed:", err);
      toast.error("Failed to refresh prices");
    } finally {
      setIsRefreshing(false);
    }
  }, [saveCachedPrices]);

  // Wrapper for createWatchlist that copies current watchlist tickers
  const createWatchlist = useCallback(async (name: string) => {
    return createWl(name, []);
  }, [createWl]);

  // Auto-refresh for registered users every 10 seconds
  useEffect(() => {
    if (!user || !prefsLoaded) return;

    const autoRefresh = async () => {
      try {
        const currentStocks = stocksRef.current;
        const currentWatchlist = watchlistRef.current;
        const tickerInfo = currentStocks
          .filter(s => currentWatchlist.includes(s.ticker))
          .map(s => ({ ticker: s.ticker, exchange: s.exchange, yahooSymbol: s.yahooSymbol }));

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

            // Save to cache
            const watchlistStocks = updated.filter(s => currentWatchlist.includes(s.ticker));
            saveCachedPrices(watchlistStocks);

            return updated;
          });
        }
      } catch (err) {
        console.error("Auto-refresh failed:", err);
      }
    };

    // Initial fetch
    autoRefresh();
    const interval = setInterval(autoRefresh, 10000);
    return () => clearInterval(interval);
  }, [user, prefsLoaded, saveCachedPrices]);

  // --- Price Trigger logic ---
  const priceTriggersRef = useRef(priceTriggers);
  useEffect(() => { priceTriggersRef.current = priceTriggers; }, [priceTriggers]);

  const setPriceTrigger = useCallback((ticker: string, price: number | null) => {
    setPriceTriggers(prev => {
      if (price === null) {
        const next = { ...prev };
        delete next[ticker];
        return next;
      }
      return { ...prev, [ticker]: { price, createdAt: Date.now() } };
    });
  }, []);

  const clearAlert = useCallback((id: string) => {
    setTriggeredAlerts(prev => {
      const next = prev.filter(a => a.id !== id);
      saveEncrypted("st_triggered_alerts", next);
      return next;
    });
  }, []);

  const clearAllAlerts = useCallback(() => {
    setTriggeredAlerts([]);
    saveEncrypted("st_triggered_alerts", []);
  }, []);

  // Check triggers on every stock price update & auto-delete after 20 min
  useEffect(() => {
    if (!prefsLoaded) return;
    const triggers = priceTriggersRef.current;
    const now = Date.now();
    const TWENTY_MINUTES = 20 * 60 * 1000;
    let changed = false;
    const nextTriggers = { ...triggers };

    for (const [ticker, trigger] of Object.entries(triggers)) {
      // Auto-delete after 20 minutes
      if (now - trigger.createdAt >= TWENTY_MINUTES) {
        delete nextTriggers[ticker];
        changed = true;
        continue;
      }
      // Check if current price matches trigger price
      const stock = stocks.find(s => s.ticker === ticker);
      if (stock && Math.abs(stock.price - trigger.price) < 0.01) {
        const alert: TriggeredAlert = {
          id: `${ticker}_${now}_${Math.random().toString(36).slice(2, 6)}`,
          ticker,
          triggerPrice: trigger.price,
          hitPrice: stock.price,
          timestamp: new Date(),
        };
        setTriggeredAlerts(prev => {
          const next = [alert, ...prev];
          saveEncrypted("st_triggered_alerts", next);
          return next;
        });
        toast.success(`🔔 Price trigger hit! ${ticker} reached ₹${stock.price.toFixed(2)}`);
        
        // Send price trigger email digest for authenticated users
        if (user?.email && user.email_confirmed_at) {
          supabase.functions.invoke('send-transactional-email', {
            body: {
              template: 'price_trigger_digest',
              props: {
                displayName: user.user_metadata?.display_name || user.email,
                alerts: [{
                  ticker,
                  triggerPrice: trigger.price,
                  hitPrice: stock.price,
                  timestamp: new Date().toLocaleString('en-IN', {
                    day: '2-digit', month: 'short', hour: '2-digit',
                    minute: '2-digit', hour12: true,
                  }),
                }],
              },
            },
          }).catch(err => console.error('Failed to send price trigger email:', err));
        }
        
        // Remove the trigger after it fires
        delete nextTriggers[ticker];
        changed = true;
      }
    }

    if (changed) {
      setPriceTriggers(nextTriggers);
    }
  }, [stocks, prefsLoaded]);

  const filteredStocks = stocks.filter(s => watchlist.includes(s.ticker));

  return (
    <StockContext.Provider value={{
      stocks: filteredStocks, notes, events, watchlist,
      addStock, removeStock, updateNote, updateEvent,
      isMarketOpen, lastFlash,
      columnVisibility, toggleColumnVisibility,
      customColumns, addCustomColumn, removeCustomColumn,
      customColumnData, updateCustomColumnData,
      prefsLoaded, pricesLoaded, loadedTickers, refreshPrices, isRefreshing,
      priceTriggers, setPriceTrigger, triggeredAlerts, clearAlert, clearAllAlerts,
      userWatchlists, activeWatchlist, activeWatchlistId,
      setActiveWatchlistId, createWatchlist, renameWatchlist, deleteWatchlist,
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
