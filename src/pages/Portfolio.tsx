import { useState, useRef, useEffect, useCallback } from "react";
import BottomNav from "@/components/BottomNav";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { usePortfolio, Holding } from "@/hooks/usePortfolio";
import Header from "@/components/Header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Plus, Trash2, TrendingUp, TrendingDown, PieChartIcon, BarChart3, Shield, Lock, RefreshCw, ArrowLeft, Clock, Zap, Award, AlertTriangle, Activity, Search, Loader2, Wallet, Target, Flame, BarChart2 } from "lucide-react";
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
              className="w-full flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent/10 transition-colors"
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
  "hsl(20, 80%, 50%)", "hsl(240, 55%, 55%)", "hsl(100, 60%, 40%)",
];

function formatCurrency(val: number): string {
  return `₹${val.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
}

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

/* ---------- Stat Card Component ---------- */
const StatCard = ({ icon: Icon, label, value, subValue, subColor, delay, gradient }: {
  icon: any; label: string; value: string; subValue?: React.ReactNode; subColor?: string; delay: number; gradient?: string;
}) => (
  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay, duration: 0.4 }}>
    <Card className={`relative overflow-hidden border-0 shadow-md hover:shadow-lg transition-shadow ${gradient || ""}`}>
      <div className="absolute top-0 right-0 w-20 h-20 opacity-[0.07]">
        <Icon className="w-full h-full" />
      </div>
      <CardContent className="pt-5 pb-4 relative z-10">
        <div className="flex items-center gap-2 mb-2">
          <div className="p-1.5 rounded-lg bg-primary/10">
            <Icon className="h-3.5 w-3.5 text-primary" />
          </div>
          <p className="text-xs text-muted-foreground font-medium">{label}</p>
        </div>
        <p className="text-2xl font-bold font-mono tracking-tight">{value}</p>
        {subValue && <div className="mt-1.5">{subValue}</div>}
      </CardContent>
    </Card>
  </motion.div>
);

const Portfolio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { isPremium, isPremiumPlus, subscription } = useSubscription();
  const {
    holdings, loading, enriching, addHolding, removeHolding, refreshAll,
    totalInvested, totalCurrent, totalGainLoss, totalGainLossPercent,
    totalDayChange, topGainer, topLoser,
    sectorAllocation,
  } = usePortfolio();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ticker: "", exchange: "NSE", buy_price: "", quantity: "", buy_date: new Date().toISOString().split("T")[0] });
  const [selectedSector, setSelectedSector] = useState<string | null>(null);

  // Lifetime, Premium, or Premium Plus users can access
  const hasAccess = isPremium || isPremiumPlus || subscription?.status === "lifetime";

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

  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <div className="container mx-auto px-4 py-20 text-center">
          <Shield className="h-16 w-16 mx-auto text-primary mb-4" />
          <h2 className="text-2xl font-bold mb-2">Premium Feature</h2>
          <p className="text-muted-foreground mb-2">
            Portfolio Dashboard is available for <strong>Premium</strong>, <strong>Premium Plus</strong> and <strong>Lifetime</strong> subscribers.
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

  const diversityScore = Math.min(100, sectorAllocation.length * 15 + Math.min(holdings.length, 10) * 2);

  return (
    <div className="min-h-screen bg-background pb-bottom-nav">
      <Header />
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 max-w-7xl space-y-4 sm:space-y-6">
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/dashboard")}
            className="gap-1.5 text-muted-foreground hover:text-foreground -ml-2"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </Button>

          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Portfolio Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">Real-time performance tracking & sector analysis</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={refreshAll} disabled={enriching} className="gap-1.5">
                <RefreshCw className={`h-3.5 w-3.5 ${enriching ? "animate-spin" : ""}`} />
                {enriching ? "Refreshing..." : "Refresh All"}
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
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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

        {/* Summary Stat Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatCard
            icon={Wallet}
            label="Total Invested"
            value={formatCurrency(totalInvested)}
            subValue={<Badge variant="secondary" className="text-[10px]">{holdings.length} stocks</Badge>}
            delay={0.05}
          />
          <StatCard
            icon={Target}
            label="Current Value"
            value={formatCurrency(totalCurrent)}
            subValue={
              <Badge variant="secondary" className="text-[10px]">
                <Activity className="h-2.5 w-2.5 mr-0.5" />
                Day: {totalDayChange >= 0 ? "+" : ""}{formatCurrency(Math.abs(totalDayChange))}
              </Badge>
            }
            delay={0.1}
          />
          <StatCard
            icon={totalGainLoss >= 0 ? TrendingUp : TrendingDown}
            label="Total P&L"
            value={`${totalGainLoss >= 0 ? "+" : ""}${formatCurrency(Math.abs(totalGainLoss))}`}
            subValue={
              <Badge variant={totalGainLossPercent >= 0 ? "default" : "destructive"} className="text-[10px]">
                {totalGainLossPercent >= 0 ? "+" : ""}{totalGainLossPercent.toFixed(2)}%
              </Badge>
            }
            delay={0.15}
          />
          <StatCard
            icon={Flame}
            label="Top Performer"
            value={topGainer?.ticker || "—"}
            subValue={topGainer && (topGainer.gainLossPercent || 0) > 0 ? (
              <Badge className="text-[10px] bg-gain/10 text-gain border-gain/20">
                +{(topGainer.gainLossPercent || 0).toFixed(1)}%
              </Badge>
            ) : null}
            delay={0.2}
          />
          <StatCard
            icon={BarChart2}
            label="Diversity Score"
            value={`${diversityScore}/100`}
            subValue={
              <div className="flex gap-1.5">
                <Badge variant="secondary" className="text-[10px]">{sectorAllocation.length} sectors</Badge>
              </div>
            }
            delay={0.25}
          />
        </div>

        {/* Key Insights Row */}
        {holdings.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <Card className="border-0 shadow-sm bg-muted/30">
              <CardContent className="py-3 px-4 flex flex-wrap items-center gap-2">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground mr-1">Quick Insights:</span>
                {topGainer && (topGainer.gainLossPercent || 0) > 0 && (
                  <Badge variant="outline" className="text-xs py-0.5 gap-1 bg-gain/5 border-gain/20">
                    <TrendingUp className="h-3 w-3 text-gain" />
                    Best: <span className="font-mono font-bold">{topGainer.ticker}</span>
                    <span className="text-gain font-mono">+{(topGainer.gainLossPercent || 0).toFixed(1)}%</span>
                  </Badge>
                )}
                {topLoser && (topLoser.gainLossPercent || 0) < 0 && (
                  <Badge variant="outline" className="text-xs py-0.5 gap-1 bg-loss/5 border-loss/20">
                    <TrendingDown className="h-3 w-3 text-loss" />
                    Worst: <span className="font-mono font-bold">{topLoser.ticker}</span>
                    <span className="text-loss font-mono">{(topLoser.gainLossPercent || 0).toFixed(1)}%</span>
                  </Badge>
                )}
                {holdings.some(h => h.priceSource) && (
                  <Badge variant="outline" className="text-xs py-0.5 gap-1">
                    <Clock className="h-3 w-3" />
                    Updated {timeAgo(holdings.find(h => h.lastUpdated)?.lastUpdated)}
                  </Badge>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Sector Filter Tags */}
        {/* Sector Filter Pills */}
        {sectorAllocation.length > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }} className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedSector(null)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                selectedSector === null
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              All
              <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                selectedSector === null ? "bg-primary-foreground/20" : "bg-background"
              }`}>{holdings.length}</span>
            </button>
            {sectorAllocation.map((s, i) => (
              <button
                key={s.sector}
                onClick={() => setSelectedSector(selectedSector === s.sector ? null : s.sector)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                  selectedSector === s.sector
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                {s.sector}
                <span className={`font-mono text-[10px] px-1.5 py-0.5 rounded-full ${
                  selectedSector === s.sector ? "bg-primary-foreground/20" : "bg-background"
                }`}>{s.count}</span>
                <span className="font-mono text-[10px] opacity-70">{s.percentage.toFixed(1)}%</span>
              </button>
            ))}
          </motion.div>
        )}

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}>
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <PieChartIcon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Sector Allocation</CardTitle>
                    <CardDescription>{sectorAllocation.length} sectors · {holdings.length} stocks</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {sectorAllocation.length > 0 ? (
                  <div className="flex flex-col items-center">
                    <ChartContainer config={pieChartConfig} className="mx-auto aspect-square max-h-[260px]">
                      <PieChart>
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Pie
                          data={sectorAllocation}
                          dataKey="percentage"
                          nameKey="sector"
                          cx="50%"
                          cy="50%"
                          outerRadius={95}
                          innerRadius={45}
                          strokeWidth={2}
                          label={({ sector, percentage }) => `${percentage.toFixed(1)}%`}
                          labelLine={false}
                        >
                          {sectorAllocation.map((_, i) => (
                            <Cell key={i} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} className="drop-shadow-sm" />
                          ))}
                        </Pie>
                      </PieChart>
                    </ChartContainer>
                    <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-3 w-full max-w-xs">
                      {sectorAllocation.slice(0, 8).map((s, i) => (
                        <div key={s.sector} className="flex items-center gap-1.5 text-xs">
                          <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
                          <span className="truncate text-muted-foreground">{s.sector}</span>
                          <span className="font-mono font-medium ml-auto">{s.percentage.toFixed(1)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-10">Add holdings to see allocation</p>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.45 }}>
            <Card className="border-0 shadow-md">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <BarChart3 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Stock-wise P&L (%)</CardTitle>
                    <CardDescription>Top holdings by return</CardDescription>
                  </div>
                </div>
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
          </motion.div>
        </div>

        {/* Holdings Table */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
          <Card className="border-0 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-primary/10">
                    <BarChart2 className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-base">
                      Holdings ({filteredHoldings.length}{selectedSector ? ` in ${selectedSector}` : ""})
                    </CardTitle>
                    <CardDescription className="text-xs">Hover over market data for details</CardDescription>
                  </div>
                </div>
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
                <div className="text-center py-12">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-muted/50 flex items-center justify-center">
                    <Wallet className="h-8 w-8 text-muted-foreground/50" />
                  </div>
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
                        <TableRow className="border-b-2">
                          <TableHead className="w-[180px]">Stock</TableHead>
                          <TableHead>Market Data</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Buy Price</TableHead>
                          <TableHead className="text-right">CMP</TableHead>
                          <TableHead className="text-right">Day Chg</TableHead>
                          <TableHead className="text-right">Invested</TableHead>
                          <TableHead className="text-right">Current</TableHead>
                          <TableHead className="text-right">P&L</TableHead>
                          <TableHead className="text-right">P&L %</TableHead>
                          <TableHead className="w-[40px]"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        <AnimatePresence>
                          {filteredHoldings.map((h, idx) => (
                            <motion.tr
                              key={h.id}
                              initial={{ opacity: 0, y: 6 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, x: -10 }}
                              transition={{ delay: idx * 0.03, duration: 0.3 }}
                              className="border-b transition-colors hover:bg-muted/40 group"
                            >
                              {/* Stock: Ticker + Exchange + Sector */}
                              <TableCell>
                                <div className="flex items-center gap-2">
                                  <div className="flex flex-col">
                                    <div className="flex items-center gap-1.5">
                                      <span className="font-mono font-bold text-sm">{h.ticker}</span>
                                      <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted/60 px-1.5 py-0.5 rounded">{h.exchange}</span>
                                    </div>
                                    {h.sector && (
                                      <button
                                        onClick={() => setSelectedSector(selectedSector === h.sector ? null : h.sector)}
                                        className="text-[10px] text-muted-foreground hover:text-primary transition-colors text-left mt-0.5 truncate max-w-[140px]"
                                      >
                                        {h.sector}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </TableCell>

                              {/* Market Data: MCap, Volume, Day Range */}
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {h.marketCap && h.marketCap > 0 ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-primary/5 text-primary/80 border border-primary/10 px-2 py-0.5 rounded-md cursor-default">
                                          <Award className="h-2.5 w-2.5" />
                                          {formatMarketCap(h.marketCap)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs">
                                        Market Cap: ₹{(h.marketCap / 1e7).toLocaleString("en-IN", { maximumFractionDigits: 0 })} Cr
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/40">—</span>
                                  )}
                                  {h.volume && h.volume > 0 ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/80 text-muted-foreground border border-border/50 px-2 py-0.5 rounded-md cursor-default">
                                          <Activity className="h-2.5 w-2.5" />
                                          {formatVolume(h.volume)}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs">
                                        Volume: {h.volume.toLocaleString("en-IN")}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                  {h.high && h.low ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-medium bg-muted/80 text-muted-foreground border border-border/50 px-2 py-0.5 rounded-md cursor-default">
                                          ₹{h.low.toLocaleString("en-IN")}–{h.high.toLocaleString("en-IN")}
                                        </span>
                                      </TooltipTrigger>
                                      <TooltipContent className="text-xs">
                                        Day Range — Low: ₹{h.low.toLocaleString("en-IN")} · High: ₹{h.high.toLocaleString("en-IN")}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : null}
                                </div>
                              </TableCell>

                              <TableCell className="text-right font-mono text-sm">{h.quantity}</TableCell>
                              <TableCell className="text-right font-mono text-sm">₹{h.buy_price.toLocaleString("en-IN")}</TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {h.currentPrice ? (
                                  <Tooltip>
                                    <TooltipTrigger>
                                      <span>₹{h.currentPrice.toLocaleString("en-IN")}</span>
                                    </TooltipTrigger>
                                    <TooltipContent className="text-xs">
                                      {h.priceSource && <span className="capitalize">{h.priceSource}</span>}
                                      {h.lastUpdated && <span> · {timeAgo(h.lastUpdated)}</span>}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : "—"}
                              </TableCell>
                              <TableCell className={`text-right font-mono text-xs ${(h.dayChangePercent || 0) >= 0 ? "text-gain" : "text-loss"}`}>
                                {h.dayChangePercent !== undefined && h.dayChangePercent !== 0
                                  ? `${h.dayChangePercent >= 0 ? "+" : ""}${h.dayChangePercent.toFixed(2)}%`
                                  : "—"}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(h.investedValue || 0)}
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {h.currentValue ? formatCurrency(h.currentValue) : "—"}
                              </TableCell>
                              <TableCell className={`text-right font-mono font-medium text-sm ${(h.gainLoss || 0) >= 0 ? "text-gain" : "text-loss"}`}>
                                {h.gainLoss !== undefined ? (
                                  <span className="flex items-center justify-end gap-1">
                                    {h.gainLoss >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                    {formatCurrency(Math.abs(h.gainLoss))}
                                  </span>
                                ) : "—"}
                              </TableCell>
                              <TableCell className={`text-right font-mono font-semibold text-sm ${(h.gainLossPercent || 0) >= 0 ? "text-gain" : "text-loss"}`}>
                                {h.gainLossPercent !== undefined ? `${h.gainLossPercent >= 0 ? "+" : ""}${h.gainLossPercent.toFixed(2)}%` : "—"}
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                                  onClick={() => removeHolding(h.id)}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive transition-colors" />
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
        </motion.div>
      </div>
      <BottomNav />
  );
};

export default Portfolio;
