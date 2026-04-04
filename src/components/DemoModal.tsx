import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight, ArrowLeft, TrendingUp, TrendingDown, Bell, Tag,
  Layers, Share2, BarChart3, Plus, Search, Eye, Check, Star, X, Trash2
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface DemoModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const DEMO_STOCKS = [
  { ticker: "RELIANCE", name: "Reliance Industries", exchange: "NSE", price: 2945.50, change: 32.10, changePercent: 1.10, high: 2960, low: 2910, volume: "12.4M" },
  { ticker: "TCS", name: "Tata Consultancy Services", exchange: "NSE", price: 3812.75, change: -18.40, changePercent: -0.48, high: 3840, low: 3800, volume: "5.2M" },
  { ticker: "INFY", name: "Infosys Ltd", exchange: "NSE", price: 1520.30, change: 8.55, changePercent: 0.57, high: 1528, low: 1508, volume: "8.7M" },
  { ticker: "POLYCAB", name: "Polycab India Ltd", exchange: "NSE", price: 5620.40, change: 85.30, changePercent: 1.54, high: 5650, low: 5530, volume: "1.8M" },
  { ticker: "TATAMOTORS", name: "Tata Motors Ltd", exchange: "NSE", price: 985.40, change: 22.75, changePercent: 2.36, high: 990, low: 960, volume: "15.8M" },
  { ticker: "HDFCBANK", name: "HDFC Bank Ltd", exchange: "NSE", price: 1645.80, change: -5.20, changePercent: -0.32, high: 1660, low: 1638, volume: "6.1M" },
  { ticker: "RPSGVENT", name: "RPSG Ventures Ltd", exchange: "BSE", price: 312.55, change: 6.80, changePercent: 2.22, high: 315, low: 304, volume: "82K" },
  { ticker: "GANDHAR", name: "Gandhar Oil Refinery", exchange: "NSE", price: 198.70, change: -3.45, changePercent: -1.71, high: 204, low: 196, volume: "145K" },
  { ticker: "KFINTECH", name: "KFin Technologies", exchange: "NSE", price: 875.20, change: 12.90, changePercent: 1.50, high: 880, low: 858, volume: "420K" },
];

const DEMO_STEPS = [
  {
    id: "watchlist",
    title: "📊 Your Stock Watchlist",
    description: "Track all your stocks in one place with real-time price data, change percentages, and volume.",
  },
  {
    id: "add-stock",
    title: "➕ Add Stocks Easily",
    description: "Search from 5,000+ NSE & BSE stocks and add them to your watchlist instantly.",
  },
  {
    id: "triggers",
    title: "🔔 Price Trigger Alerts",
    description: "Set upper/lower price alerts and get notified via email when your target is hit.",
  },
  {
    id: "tags",
    title: "🏷️ Event Tags & Notes",
    description: "Tag stocks with custom labels and add personal notes for quick reference.",
  },
  {
    id: "share",
    title: "📤 Share & Export",
    description: "Generate shareable links or export your watchlist as a professional PDF or image.",
  },
  {
    id: "portfolio",
    title: "💼 Portfolio Dashboard",
    description: "Track actual holdings with buy price, quantity, real-time P&L, and sector allocation.",
  },
];

const DemoModal = ({ open, onOpenChange }: DemoModalProps) => {
  const [step, setStep] = useState(0);
  const [searchVal, setSearchVal] = useState("");
  const [addedStocks, setAddedStocks] = useState<string[]>(["RELIANCE", "TCS", "INFY"]);
  const [triggers, setTriggers] = useState<Record<string, number>>({});
  const [tags, setTags] = useState<Record<string, string[]>>({});
  const [notes, setNotes] = useState<Record<string, string>>({});

  const currentStep = DEMO_STEPS[step];

  const resetDemo = () => {
    setStep(0);
    setSearchVal("");
    setAddedStocks(["RELIANCE", "TCS", "INFY"]);
    setTriggers({});
    setTags({});
    setNotes({});
  };

  const handleOpenChange = (val: boolean) => {
    if (!val) resetDemo();
    onOpenChange(val);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-primary" />
            EquityLens Demo
            <Badge variant="secondary" className="text-[10px]">Interactive</Badge>
          </DialogTitle>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-1 mb-2">
          {DEMO_STEPS.map((_, i) => (
            <button
              key={i}
              onClick={() => setStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/40" : "w-4 bg-muted"
              }`}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            <div className="mb-3">
              <h3 className="text-lg font-semibold">{currentStep.title}</h3>
              <p className="text-sm text-muted-foreground">{currentStep.description}</p>
            </div>

            {/* Step-specific interactive content */}
            {currentStep.id === "watchlist" && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-muted/50 px-3 py-2 text-xs font-medium text-muted-foreground grid grid-cols-7 gap-2">
                  <span className="col-span-2">Stock</span>
                  <span className="text-right">Price</span>
                  <span className="text-right">Change</span>
                  <span className="text-right">High/Low</span>
                  <span className="text-right">Volume</span>
                  <span className="text-right"></span>
                </div>
                {DEMO_STOCKS.filter(s => addedStocks.includes(s.ticker)).map(s => (
                  <div key={s.ticker} className="px-3 py-2.5 border-t grid grid-cols-7 gap-2 items-center hover:bg-muted/30 transition-colors text-sm group">
                    <div className="col-span-2">
                      <span className="font-mono font-semibold">{s.ticker}</span>
                      <span className="text-xs text-muted-foreground ml-1.5 hidden sm:inline">{s.name}</span>
                    </div>
                    <span className="text-right font-medium">₹{s.price.toLocaleString()}</span>
                    <span className={`text-right flex items-center justify-end gap-0.5 ${s.change >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                      {s.change >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                      {s.changePercent > 0 ? "+" : ""}{s.changePercent.toFixed(2)}%
                    </span>
                    <span className="text-right text-xs text-muted-foreground">{s.low}-{s.high}</span>
                    <span className="text-right text-xs text-muted-foreground">{s.volume}</span>
                    <div className="text-right">
                      <button
                        onClick={() => setAddedStocks(prev => prev.filter(t => t !== s.ticker))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                        title={`Remove ${s.ticker}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
                {addedStocks.length === 0 && (
                  <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                    No stocks in watchlist. Go to "Add Stocks" to add some!
                  </div>
                )}
              </div>
            )}

            {currentStep.id === "triggers" && (
              <div className="space-y-2">
                {addedStocks.slice(0, 3).map(ticker => {
                  const stock = DEMO_STOCKS.find(s => s.ticker === ticker)!;
                  return (
                    <div key={ticker} className="flex items-center gap-3 p-3 border rounded-lg">
                      <div className="flex-1">
                        <span className="font-mono font-semibold text-sm">{ticker}</span>
                        <span className="text-xs text-muted-foreground ml-2">₹{stock.price}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bell className={`h-4 w-4 ${triggers[ticker] ? "text-primary" : "text-muted-foreground"}`} />
                        <input
                          type="number"
                          placeholder="Target ₹"
                          className="w-24 px-2 py-1 text-sm border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                          value={triggers[ticker] || ""}
                          onChange={e => setTriggers(prev => ({ ...prev, [ticker]: Number(e.target.value) }))}
                        />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-muted-foreground text-center mt-2">
                  💡 In the real app, you'll receive email alerts when your target price is hit
                </p>
              </div>
            )}

            {currentStep.id === "tags" && (
              <div className="space-y-3">
                {addedStocks.slice(0, 3).map(ticker => {
                  const stockTags = tags[ticker] || [];
                  const availableTags = ["Earnings Soon", "Breakout Watch", "Long-term Hold", "Dividend", "High Risk"];
                  return (
                    <div key={ticker} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-sm">{ticker}</span>
                        <Tag className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {availableTags.map(tag => (
                          <button
                            key={tag}
                            onClick={() => {
                              setTags(prev => {
                                const current = prev[ticker] || [];
                                return {
                                  ...prev,
                                  [ticker]: current.includes(tag)
                                    ? current.filter(t => t !== tag)
                                    : [...current, tag],
                                };
                              });
                            }}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-colors ${
                              stockTags.includes(tag)
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
                            }`}
                          >
                            {tag}
                          </button>
                        ))}
                      </div>
                      <input
                        placeholder="Add a note..."
                        className="w-full text-xs px-2 py-1.5 border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                        value={notes[ticker] || ""}
                        onChange={e => setNotes(prev => ({ ...prev, [ticker]: e.target.value }))}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {currentStep.id === "share" && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { icon: Share2, label: "Copy Share Link", desc: "Generate a unique URL" },
                    { icon: Eye, label: "Export as Image", desc: "High-quality PNG" },
                    { icon: Star, label: "Export as PDF", desc: "Professional report" },
                  ].map(item => (
                    <button
                      key={item.label}
                      className="p-4 border rounded-lg hover:border-primary/40 hover:bg-muted/30 transition-all text-center group"
                      onClick={() => {}}
                    >
                      <item.icon className="h-6 w-6 mx-auto mb-2 text-muted-foreground group-hover:text-primary transition-colors" />
                      <p className="text-xs font-medium">{item.label}</p>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </button>
                  ))}
                </div>
                <div className="bg-muted/50 rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    <strong>Share link preview:</strong>{" "}
                    <code className="bg-background px-1.5 py-0.5 rounded text-[10px]">
                      equitylens.app/shared/abc123xyz
                    </code>
                  </p>
                </div>
              </div>
            )}

            {currentStep.id === "portfolio" && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-3">
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total Invested</p>
                      <p className="text-lg font-bold">₹5,42,800</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Current Value</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">₹6,18,350</p>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="p-3 text-center">
                      <p className="text-xs text-muted-foreground">Total P&L</p>
                      <p className="text-lg font-bold text-green-600 dark:text-green-400">+₹75,550</p>
                      <p className="text-[10px] text-green-600 dark:text-green-400">+13.92%</p>
                    </CardContent>
                  </Card>
                </div>
                <div className="border rounded-lg p-3">
                  <p className="text-xs font-medium mb-2">Sector Allocation</p>
                  <div className="space-y-1.5">
                    {[
                      { sector: "Technology", pct: 40, color: "bg-blue-500" },
                      { sector: "Banking", pct: 25, color: "bg-green-500" },
                      { sector: "Energy", pct: 20, color: "bg-amber-500" },
                      { sector: "Auto", pct: 15, color: "bg-purple-500" },
                    ].map(s => (
                      <div key={s.sector} className="flex items-center gap-2 text-xs">
                        <span className="w-20 text-muted-foreground">{s.sector}</span>
                        <div className="flex-1 bg-muted rounded-full h-2 overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full`} style={{ width: `${s.pct}%` }} />
                        </div>
                        <span className="w-8 text-right text-muted-foreground">{s.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-2 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setStep(prev => prev - 1)}
            disabled={step === 0}
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <span className="text-xs text-muted-foreground">{step + 1} / {DEMO_STEPS.length}</span>
          {step < DEMO_STEPS.length - 1 ? (
            <Button size="sm" onClick={() => setStep(prev => prev + 1)}>
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button size="sm" onClick={() => handleOpenChange(false)}>
              Get Started <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DemoModal;
