import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePortfolio, Holding } from "@/hooks/usePortfolio";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, TrendingUp, TrendingDown, PieChartIcon, BarChart3, Shield, Lock, RefreshCw, ArrowLeft, Clock, Zap, Award, AlertTriangle, Activity, Search, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";

interface StockSearchResult {
  ticker: string;
  name: string;
  exchange: "NSE" | "BSE";
  isIndex?: boolean;
}

const StockAutocomplete = ({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (ticker: string, exchange: string) => void;
}) => {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<StockSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setQuery(value); }, [value]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const search = useCallback((q: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (q.trim().length < 2) { setResults([]); setShowDropdown(false); return; }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const { data, error } = await supabase.functions.invoke("screener-search", { body: { query: q.trim() } });
        if (!error && data?.results) {
          setResults(data.results.filter((r: StockSearchResult) => !r.isIndex).slice(0, 20));
          setShowDropdown(true);
        }
      } catch (err) { console.error("Search failed:", err); }
      finally { setIsSearching(false); }
    }, 350);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          placeholder="Search stock name or ticker..."
          value={query}
          onChange={e => { setQuery(e.target.value); search(e.target.value); }}
          onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
          className="pl-8 pr-8"
        />
        {isSearching && <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />}
      </div>
      {showDropdown && results.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
          {results.map(stock => (
            <button
              key={stock.ticker}
              type="button"
              onClick={() => {
                setQuery(stock.ticker);
                onSelect(stock.ticker, stock.exchange);
                setShowDropdown(false);
              }}
              className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent transition-colors"
            >
              <div className="truncate">
                <span className="font-mono font-semibold">{stock.ticker}</span>
                <span className="text-muted-foreground ml-2 text-xs">{stock.name}</span>
              </div>
              <Badge variant="outline" className="text-[10px] ml-2 shrink-0">{stock.exchange}</Badge>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const SECTOR_COLORS = [
  "hsl(190, 80%, 42%)", "hsl(145, 63%, 42%)", "hsl(35, 90%, 55%)",
  "hsl(270, 60%, 55%)", "hsl(0, 72%, 51%)", "hsl(200, 70%, 50%)",
  "hsl(320, 65%, 50%)", "hsl(60, 70%, 45%)", "hsl(160, 50%, 40%)",
  "hsl(20, 80%, 50%)",
];

function formatMarketCap(raw: number): string {
  if (!raw || raw === 0) return "—";
  const cr = raw / 1e7;
  if (cr >= 100) return `₹${(cr / 100).toFixed(1)}K Cr`;
  return `₹${cr.toFixed(0)} Cr`;
}

function formatVolume(vol: number): string {
  if (!vol || vol === 0) return "—";
  if (vol >= 1e7) return `${(vol / 1e7).toFixed(2)} Cr`;
  if (vol >= 1e5) return `${(vol / 1e5).toFixed(2)} L`;
  if (vol >= 1e3) return `${(vol / 1e3).toFixed(1)}K`;
  return vol.toString();
}

function timeAgo(date?: Date): string {
  if (!date) return "";
  const diff = (Date.now() - date.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const Portfolio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const {
    holdings, loading, enriching, addHolding, removeHolding, enrichWithLivePrices,
    totalInvested, totalCurrent, totalGainLoss, totalGainLossPercent,
    totalDayChange, topGainer, topLoser,
    sectorAllocation,
  } = usePortfolio();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ticker: "", exchange: "NSE", buy_price: "", quantity: "", buy_date: new Date().toISOString().split("T")[0] });
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  const isPremiumPlan = subscription?.plan === "premium_monthly" || subscription?.plan === "premium_yearly" || subscription?.plan === "lifetime" || subscription?.plan === "annual" || subscription?.plan === "yearly";

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <Lock className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-2xl font-bold mb-2">Sign in Required</h2>
          <p className="text-muted-foreground mb-6">Please sign in to access the portfolio dashboard.</p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (!isPremiumPlan) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <Shield className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Premium Feature</h2>
          <p className="text-muted-foreground mb-2">
            Portfolio Dashboard is available exclusively for <strong>Premium</strong> and <strong>Lifetime</strong> plan subscribers.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Track your holdings, view sector allocation, diversity metrics, and gain/loss charts.
          </p>
          <div className="flex gap-3 justify-center">
            <Button variant="outline" onClick={() => navigate("/dashboard")} className="gap-1.5">
              <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Button>
            <Button onClick={() => navigate("/subscribe")} className="gap-2">
              <TrendingUp className="h-4 w-4" /> Upgrade Now
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const handleAdd = async () => {
    if (!form.ticker || !form.buy_price || !form.quantity) return;
    await addHolding({
      ticker: form.ticker.toUpperCase().trim(),
      exchange: form.exchange,
      buy_price: parseFloat(form.buy_price),
      quantity: parseFloat(form.quantity),
      buy_date: form.buy_date,
    });
    setForm({ ticker: "", exchange: "NSE", buy_price: "", quantity: "", buy_date: new Date().toISOString().split("T")[0] });
    setAddOpen(false);
  };

  const filteredHoldings = selectedSector
    ? holdings.filter(h => (h.sector || "Unknown") === selectedSector)
    : holdings;

  const pieChartConfig = Object.fromEntries(
    sectorAllocation.map((s, i) => [s.sector, { label: s.sector, color: SECTOR_COLORS[i % SECTOR_COLORS.length] }])
  );

  const barData = holdings
    .filter(h => h.gainLossPercent !== undefined)
    .sort((a, b) => (b.gainLossPercent || 0) - (a.gainLossPercent || 0))
    .slice(0, 15)
    .map(h => ({
      ticker: h.ticker,
      gainLoss: Math.round((h.gainLossPercent || 0) * 100) / 100,
      fill: (h.gainLossPercent || 0) >= 0 ? "hsl(var(--gain))" : "hsl(var(--loss))",
    }));

  const barChartConfig = { gainLoss: { label: "Gain/Loss %", color: "hsl(var(--primary))" } };

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="container mx-auto px-4 py-6 space-y-6">
        {/* Back nav + Title Row */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>

          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold">Portfolio Dashboard</h2>
              <p className="text-sm text-muted-foreground">Track performance, allocation & diversity</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={enrichWithLivePrices} disabled={enriching} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${enriching ? "animate-spin" : ""}`} />
                {enriching ? "Refreshing..." : "Refresh Prices"}
              </Button>
              <Dialog open={addOpen} onOpenChange={setAddOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Holding</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Stock Holding</DialogTitle></DialogHeader>
                  <div className="grid gap-4 py-2">
                    <StockAutocomplete
                      value={form.ticker}
                      onSelect={(ticker, exchange) => setForm(f => ({ ...f, ticker, exchange }))}
                    />
                    <div className="grid grid-cols-3 gap-3">
                      <Input type="number" placeholder="Buy Price" value={form.buy_price} onChange={e => setForm(f => ({ ...f, buy_price: e.target.value }))} />
                      <Input type="number" placeholder="Qty" value={form.quantity} onChange={e => setForm(f => ({ ...f, quantity: e.target.value }))} />
                      <Input type="date" value={form.buy_date} onChange={e => setForm(f => ({ ...f, buy_date: e.target.value }))} />
                    </div>
                    <Button onClick={handleAdd} disabled={!form.ticker || !form.buy_price || !form.quantity}>Add to Portfolio</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">Total Invested</p>
                <p className="text-xl font-bold font-mono">₹{totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                <Badge variant="secondary" className="text-[10px] mt-1.5">{holdings.length} stocks</Badge>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">Current Value</p>
                <p className="text-xl font-bold font-mono">₹{totalCurrent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
                <div className="flex gap-1.5 mt-1.5">
                  <Badge variant="secondary" className="text-[10px]">
                    <Activity className="h-2.5 w-2.5 mr-0.5" />
                    Day: {totalDayChange >= 0 ? "+" : ""}₹{Math.abs(totalDayChange).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">Total P&L</p>
                <p className={`text-xl font-bold font-mono ${totalGainLoss >= 0 ? "text-gain" : "text-loss"}`}>
                  {totalGainLoss >= 0 ? "+" : ""}₹{Math.abs(totalGainLoss).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                </p>
                <Badge variant={totalGainLossPercent >= 0 ? "default" : "destructive"} className="text-[10px] mt-1.5">
                  {totalGainLossPercent >= 0 ? <TrendingUp className="h-2.5 w-2.5 mr-0.5" /> : <TrendingDown className="h-2.5 w-2.5 mr-0.5" />}
                  {totalGainLossPercent >= 0 ? "+" : ""}{totalGainLossPercent.toFixed(2)}%
                </Badge>
              </CardContent>
            </Card>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <Card>
              <CardContent className="pt-5 pb-4">
                <p className="text-xs text-muted-foreground font-medium mb-1">Portfolio Snapshot</p>
                <div className="flex flex-wrap gap-1.5 mt-1">
                  <Badge variant="secondary" className="text-[10px]">
                    <PieChartIcon className="h-2.5 w-2.5 mr-0.5" />
                    {sectorAllocation.length} Sectors
                  </Badge>
                  {sectorAllocation.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      Top: {sectorAllocation[0].sector} ({sectorAllocation[0].percentage.toFixed(0)}%)
                    </Badge>
                  )}
                  {holdings.length > 0 && (
                    <Badge variant="outline" className="text-[10px]">
                      Avg Buy: ₹{(totalInvested / Math.max(holdings.reduce((s, h) => s + h.quantity, 0), 1)).toFixed(0)}
                    </Badge>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Key Insights Row */}
        {holdings.length > 0 && (topGainer || topLoser) && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }} className="flex flex-wrap gap-2">
            {topGainer && (topGainer.gainLossPercent || 0) > 0 && (
              <Badge variant="secondary" className="text-xs py-1 px-2.5 gap-1">
                <TrendingUp className="h-3 w-3 text-gain" />
                Top Gainer: <span className="font-mono font-bold">{topGainer.ticker}</span>
                <span className="text-gain font-mono">+{(topGainer.gainLossPercent || 0).toFixed(1)}%</span>
              </Badge>
            )}
            {topLoser && (topLoser.gainLossPercent || 0) < 0 && (
              <Badge variant="secondary" className="text-xs py-1 px-2.5 gap-1">
                <TrendingDown className="h-3 w-3 text-loss" />
                Top Loser: <span className="font-mono font-bold">{topLoser.ticker}</span>
                <span className="text-loss font-mono">{(topLoser.gainLossPercent || 0).toFixed(1)}%</span>
              </Badge>
            )}
            {sectorAllocation.length > 0 && (
              <Badge variant="secondary" className="text-xs py-1 px-2.5 gap-1">
                <PieChartIcon className="h-3 w-3" />
                {sectorAllocation.length} Sectors
              </Badge>
            )}
            {holdings.some(h => h.priceSource) && (
              <Badge variant="outline" className="text-xs py-1 px-2.5 gap-1">
                <Clock className="h-3 w-3" />
                Updated {timeAgo(holdings.find(h => h.lastUpdated)?.lastUpdated)}
              </Badge>
            )}
          </motion.div>
        )}

        {/* Sector Filter Tags */}
        {sectorAllocation.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex flex-wrap gap-1.5">
            <Badge
              variant={selectedSector === null ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setSelectedSector(null)}
            >
              All ({holdings.length})
            </Badge>
            {sectorAllocation.map((s, i) => (
              <Badge
                key={s.sector}
                variant={selectedSector === s.sector ? "default" : "outline"}
                className="cursor-pointer text-xs gap-1"
                onClick={() => setSelectedSector(selectedSector === s.sector ? null : s.sector)}
              >
                <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                {s.sector} ({s.count}) · {s.percentage.toFixed(0)}%
              </Badge>
            ))}
          </motion.div>
        )}

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <PieChartIcon className="h-4 w-4 text-primary" /> Sector Allocation
              </CardTitle>
              <CardDescription>{sectorAllocation.length} sectors</CardDescription>
            </CardHeader>
            <CardContent>
              {sectorAllocation.length > 0 ? (
                <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[280px]">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Pie data={sectorAllocation} dataKey="percentage" nameKey="sector" cx="50%" cy="50%" outerRadius={100} label={({ sector, percentage }) => `${sector} ${percentage.toFixed(1)}%`} labelLine={false}>
                      {sectorAllocation.map((_, i) => (
                        <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>
              ) : (
                <p className="text-center text-muted-foreground py-10">Add holdings to see allocation</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" /> Stock-wise P&L (%)
              </CardTitle>
              <CardDescription>Top holdings by return</CardDescription>
            </CardHeader>
            <CardContent>
              {barData.length > 0 ? (
                <ChartContainer config={barChartConfig} className="aspect-video max-h-[280px]">
                  <BarChart data={barData} layout="vertical" margin={{ left: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
                    <XAxis type="number" tickFormatter={v => `${v}%`} className="text-xs" />
                    <YAxis type="category" dataKey="ticker" className="text-xs" width={55} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="gainLoss" radius={[0, 4, 4, 0]}>
                      {barData.map((entry, i) => (
                        <Cell key={i} fill={entry.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              ) : (
                <p className="text-center text-muted-foreground py-10">Add holdings to see P&L chart</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Holdings Table */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                Holdings ({filteredHoldings.length}{selectedSector ? ` in ${selectedSector}` : ""})
              </CardTitle>
              {selectedSector && (
                <Button variant="ghost" size="sm" onClick={() => setSelectedSector(null)} className="text-xs h-7">
                  Clear filter
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-muted-foreground py-8">Loading holdings...</p>
            ) : holdings.length === 0 ? (
              <div className="text-center py-10">
                <p className="text-muted-foreground mb-4">No holdings yet. Add your first stock to get started.</p>
                <Button size="sm" onClick={() => setAddOpen(true)} className="gap-1.5">
                  <Plus className="h-3.5 w-3.5" /> Add Holding
                </Button>
              </div>
            ) : (
              <TooltipProvider>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ticker</TableHead>
                        <TableHead>Sector</TableHead>
                        <TableHead className="text-right">Qty</TableHead>
                        <TableHead className="text-right">Buy Price</TableHead>
                        <TableHead className="text-right">CMP</TableHead>
                        <TableHead className="text-right">Day Chg</TableHead>
                        <TableHead className="text-right">Invested</TableHead>
                        <TableHead className="text-right">Current</TableHead>
                        <TableHead className="text-right">P&L</TableHead>
                        <TableHead className="text-right">P&L %</TableHead>
                        <TableHead></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      <AnimatePresence>
                        {filteredHoldings.map(h => (
                          <motion.tr
                            key={h.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="border-b transition-colors hover:bg-muted/50"
                          >
                            <TableCell className="font-medium">
                              <div className="flex flex-col">
                                <span className="font-mono">{h.ticker}</span>
                                <div className="flex gap-1 mt-0.5">
                                  <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">{h.exchange}</Badge>
                                  {h.marketCap && h.marketCap > 0 && (
                                    <Tooltip>
                                      <TooltipTrigger>
                                        <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">MCap: {formatMarketCap(h.marketCap)}</Badge>
                                      </TooltipTrigger>
                                      <TooltipContent>Market Cap: ₹{(h.marketCap / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {h.volume && h.volume > 0 && (
                                    <Badge variant="outline" className="text-[9px] px-1 py-0 h-4">Vol: {formatVolume(h.volume)}</Badge>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              {h.sector ? (
                                <Badge
                                  variant="secondary"
                                  className="text-[10px] cursor-pointer"
                                  onClick={() => setSelectedSector(selectedSector === h.sector ? null : h.sector)}
                                >
                                  {h.sector}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground text-xs">—</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right font-mono">{h.quantity}</TableCell>
                            <TableCell className="text-right font-mono">₹{h.buy_price.toLocaleString("en-IN")}</TableCell>
                            <TableCell className="text-right font-mono">
                              {h.currentPrice ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <span>₹{h.currentPrice.toLocaleString("en-IN")}</span>
                                  </TooltipTrigger>
                                  <TooltipContent className="text-xs">
                                    {h.priceSource && <span className="capitalize">{h.priceSource}</span>}
                                    {h.lastUpdated && <span> · {timeAgo(h.lastUpdated)}</span>}
                                    {h.high ? <><br />H: ₹{h.high.toLocaleString("en-IN")} · L: ₹{(h.low || 0).toLocaleString("en-IN")}</> : null}
                                  </TooltipContent>
                                </Tooltip>
                              ) : "—"}
                            </TableCell>
                            <TableCell className={`text-right font-mono text-xs ${(h.dayChangePercent || 0) >= 0 ? "text-gain" : "text-loss"}`}>
                              {h.dayChangePercent !== undefined && h.dayChangePercent !== 0
                                ? `${h.dayChangePercent >= 0 ? "+" : ""}${h.dayChangePercent.toFixed(2)}%`
                                : "—"}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              ₹{(h.investedValue || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {h.currentValue ? `₹${h.currentValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}` : "—"}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-medium ${(h.gainLoss || 0) >= 0 ? "text-gain" : "text-loss"}`}>
                              {h.gainLoss !== undefined ? (
                                <span className="flex items-center justify-end gap-1">
                                  {h.gainLoss >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  ₹{Math.abs(h.gainLoss).toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                                </span>
                              ) : "—"}
                            </TableCell>
                            <TableCell className={`text-right font-mono font-medium ${(h.gainLossPercent || 0) >= 0 ? "text-gain" : "text-loss"}`}>
                              {h.gainLossPercent !== undefined ? `${h.gainLossPercent >= 0 ? "+" : ""}${h.gainLossPercent.toFixed(2)}%` : "—"}
                            </TableCell>
                            <TableCell>
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeHolding(h.id)}>
                                <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                              </Button>
                            </TableCell>
                          </motion.tr>
                        ))}
                      </AnimatePresence>
                    </TableBody>
                  </Table>
                </div>
              </TooltipProvider>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Portfolio;
