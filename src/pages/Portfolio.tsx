import { useState } from "react";
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
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer } from "recharts";
import { Plus, Trash2, TrendingUp, TrendingDown, PieChartIcon, BarChart3, Shield, Lock, RefreshCw } from "lucide-react";
import { motion } from "framer-motion";

const SECTOR_COLORS = [
  "hsl(190, 80%, 42%)", "hsl(145, 63%, 42%)", "hsl(35, 90%, 55%)",
  "hsl(270, 60%, 55%)", "hsl(0, 72%, 51%)", "hsl(200, 70%, 50%)",
  "hsl(320, 65%, 50%)", "hsl(60, 70%, 45%)", "hsl(160, 50%, 40%)",
  "hsl(20, 80%, 50%)",
];

const Portfolio = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { subscription, isActive } = useSubscription();
  const {
    holdings, loading, enriching, addHolding, removeHolding, enrichWithLivePrices,
    totalInvested, totalCurrent, totalGainLoss, totalGainLossPercent,
    sectorAllocation, diversityScore,
  } = usePortfolio();

  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ticker: "", exchange: "NSE", buy_price: "", quantity: "", buy_date: new Date().toISOString().split("T")[0] });

  // Gate: only lifetime or annual plan
  const isPremiumPlan = subscription?.plan === "lifetime" || subscription?.plan === "annual" || subscription?.plan === "yearly";

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
            Portfolio Dashboard is available exclusively for <strong>Annual</strong> and <strong>Lifetime</strong> plan subscribers.
          </p>
          <p className="text-sm text-muted-foreground mb-6">
            Track your holdings, view sector allocation, diversity metrics, and gain/loss charts.
          </p>
          <Button onClick={() => navigate("/subscribe")} className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Upgrade Now
          </Button>
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
        {/* Title Row */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div>
            <h2 className="text-2xl font-bold">Portfolio Dashboard</h2>
            <p className="text-sm text-muted-foreground">Track performance, allocation & diversity</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={enrichWithLivePrices} disabled={enriching} className="gap-1.5">
              <RefreshCw className={`h-3.5 w-3.5 ${enriching ? "animate-spin" : ""}`} />
              Refresh
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="gap-1.5"><Plus className="h-3.5 w-3.5" /> Add Holding</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Stock Holding</DialogTitle></DialogHeader>
                <div className="grid gap-4 py-2">
                  <div className="grid grid-cols-2 gap-3">
                    <Input placeholder="Ticker (e.g. RELIANCE)" value={form.ticker} onChange={e => setForm(f => ({ ...f, ticker: e.target.value }))} />
                    <Select value={form.exchange} onValueChange={v => setForm(f => ({ ...f, exchange: v }))}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="NSE">NSE</SelectItem>
                        <SelectItem value="BSE">BSE</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
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
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground font-medium">Total Invested</p>
              <p className="text-xl font-bold font-mono">₹{totalInvested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground font-medium">Current Value</p>
              <p className="text-xl font-bold font-mono">₹{totalCurrent.toLocaleString("en-IN", { maximumFractionDigits: 0 })}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground font-medium">Total P&L</p>
              <p className={`text-xl font-bold font-mono ${totalGainLoss >= 0 ? "text-gain" : "text-loss"}`}>
                {totalGainLoss >= 0 ? "+" : ""}₹{totalGainLoss.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                <span className="text-sm ml-1">({totalGainLossPercent.toFixed(2)}%)</span>
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground font-medium">Diversity Score</p>
              <div className="flex items-center gap-2">
                <p className="text-xl font-bold font-mono">{diversityScore}</p>
                <span className="text-xs text-muted-foreground">/100</span>
                <Badge variant="secondary" className="text-[10px]">
                  {diversityScore >= 70 ? "Well Diversified" : diversityScore >= 40 ? "Moderate" : "Concentrated"}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Row */}
        <div className="grid md:grid-cols-2 gap-6">
          {/* Sector Allocation Pie */}
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

          {/* Gain/Loss per stock Bar Chart */}
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
            <CardTitle className="text-base">Holdings ({holdings.length})</CardTitle>
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
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ticker</TableHead>
                      <TableHead>Sector</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead className="text-right">Buy Price</TableHead>
                      <TableHead className="text-right">CMP</TableHead>
                      <TableHead className="text-right">Invested</TableHead>
                      <TableHead className="text-right">Current</TableHead>
                      <TableHead className="text-right">P&L</TableHead>
                      <TableHead className="text-right">P&L %</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {holdings.map(h => (
                      <TableRow key={h.id}>
                        <TableCell className="font-medium font-mono">
                          {h.ticker}
                          <span className="text-[10px] text-muted-foreground ml-1">{h.exchange}</span>
                        </TableCell>
                        <TableCell>
                          {h.sector ? (
                            <Badge variant="secondary" className="text-[10px]">{h.sector}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right font-mono">{h.quantity}</TableCell>
                        <TableCell className="text-right font-mono">₹{h.buy_price.toLocaleString("en-IN")}</TableCell>
                        <TableCell className="text-right font-mono">
                          {h.currentPrice ? `₹${h.currentPrice.toLocaleString("en-IN")}` : "—"}
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
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Portfolio;
