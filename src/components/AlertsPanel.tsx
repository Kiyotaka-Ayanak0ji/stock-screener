import { useState, useCallback } from "react";
import { Bell, Trash2, X, TrendingUp, TrendingDown, Volume2, Zap, Lock } from "lucide-react";
import { useStocks } from "@/contexts/StockContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { motion, AnimatePresence } from "framer-motion";
import { useSmartAlerts, SmartAlert } from "@/components/SmartAlerts";
import { useSubscription } from "@/hooks/useSubscription";
import { Link } from "react-router-dom";

const AlertsPanel = () => {
  const { triggeredAlerts, clearAlert, clearAllAlerts, priceTriggers } = useStocks();
  const { isPro } = useSubscription();
  const [smartAlerts, setSmartAlerts] = useState<SmartAlert[]>([]);

  const handleSmartAlert = useCallback((alert: SmartAlert) => {
    setSmartAlerts(prev => [alert, ...prev].slice(0, 50));
  }, []);

  // Only run smart-alert detection for Pro+ subscribers
  const { sendSmartAlertEmail } = useSmartAlerts((alert) => {
    if (!isPro) return;
    handleSmartAlert(alert);
    sendSmartAlertEmail(alert);
  });

  const clearSmartAlert = (id: string) => {
    setSmartAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearAllSmartAlerts = () => setSmartAlerts([]);

  const activeTriggerCount = Object.keys(priceTriggers).length;
  const priceAlertCount = triggeredAlerts.length;
  const smartAlertCount = smartAlerts.length;
  const totalCount = priceAlertCount + smartAlertCount;

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString("en-IN", {
      day: "2-digit", month: "short", hour: "2-digit",
      minute: "2-digit", second: "2-digit", hour12: true,
    });
  };

  const getSmartAlertIcon = (type: SmartAlert["type"]) => {
    switch (type) {
      case "52w_high": return <TrendingUp className="h-3 w-3 text-gain" />;
      case "52w_low": return <TrendingDown className="h-3 w-3 text-loss" />;
      case "volume_spike": return <Volume2 className="h-3 w-3 text-primary" />;
    }
  };

  const getSmartAlertColor = (type: SmartAlert["type"]) => {
    switch (type) {
      case "52w_high": return "bg-gain/10 text-gain border-gain/20";
      case "52w_low": return "bg-loss/10 text-loss border-loss/20";
      case "volume_spike": return "bg-primary/10 text-primary border-primary/20";
    }
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full h-9 w-9 relative"
          title="Alerts"
        >
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center"
            >
              {totalCount > 9 ? "9+" : totalCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] p-0" align="end">
        <Tabs defaultValue="price" className="w-full">
          <div className="p-3 pb-0">
            <TabsList className="w-full h-8 bg-secondary/50 p-0.5 rounded-lg">
              <TabsTrigger
                value="price"
                className="flex-1 h-7 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md transition-all"
              >
                Price
                {priceAlertCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] bg-destructive/10 text-destructive">
                    {priceAlertCount}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger
                value="smart"
                className="flex-1 h-7 text-[11px] font-medium data-[state=active]:bg-card data-[state=active]:shadow-sm rounded-md transition-all"
              >
                <Zap className="h-3 w-3 mr-1" />
                Smart
                {!isPro && (
                  <Lock className="h-2.5 w-2.5 ml-1 text-muted-foreground/60" />
                )}
                {isPro && smartAlertCount > 0 && (
                  <Badge variant="secondary" className="ml-1 h-4 px-1 text-[9px] bg-primary/10 text-primary">
                    {smartAlertCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Price Alerts Tab */}
          <TabsContent value="price" className="mt-0">
            <div className="p-3 pb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {activeTriggerCount} trigger{activeTriggerCount !== 1 ? "s" : ""} · {priceAlertCount} alert{priceAlertCount !== 1 ? "s" : ""}
              </p>
              {priceAlertCount > 0 && (
                <Button size="sm" variant="ghost" className="text-xs gap-1 h-6 px-2" onClick={clearAllAlerts}>
                  <Trash2 className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
            <div className="border-t border-border" />
            <ScrollArea className="max-h-72">
              {priceAlertCount === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Bell className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No price alerts</p>
                  <p className="text-[10px] mt-1 opacity-60">Set triggers in the table</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  <AnimatePresence>
                    {triggeredAlerts.map(alert => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-start justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-mono">
                              {alert.ticker}
                            </Badge>
                            <span className="text-xs font-mono text-primary font-semibold">
                              ₹{alert.hitPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Target: ₹{alert.triggerPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })} · {formatTime(alert.timestamp)}
                          </p>
                        </div>
                        <Button
                          size="icon" variant="ghost"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss"
                          onClick={() => clearAlert(alert.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* Smart Alerts Tab */}
          <TabsContent value="smart" className="mt-0">
            <div className="p-3 pb-2 flex items-center justify-between">
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                Session highs, lows & volume spikes
                {!isPro && <Lock className="h-3 w-3 text-muted-foreground/60" />}
              </p>
              {isPro && smartAlertCount > 0 && (
                <Button size="sm" variant="ghost" className="text-xs gap-1 h-6 px-2" onClick={clearAllSmartAlerts}>
                  <Trash2 className="h-3 w-3" />
                  Clear
                </Button>
              )}
            </div>
            <div className="border-t border-border" />
            <ScrollArea className="max-h-72">
              {!isPro ? (
                <div className="py-6 text-center text-muted-foreground">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">Smart alerts preview</p>
                  <p className="text-[10px] mt-1 opacity-60 px-6">
                    Auto-detect 52-week highs, lows & volume spikes during market hours
                  </p>
                </div>
              ) : smartAlertCount === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <Zap className="h-8 w-8 mx-auto mb-2 opacity-20" />
                  <p className="text-xs">No smart alerts yet</p>
                  <p className="text-[10px] mt-1 opacity-60">Auto-detected during market hours</p>
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  <AnimatePresence>
                    {smartAlerts.map(alert => (
                      <motion.div
                        key={alert.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="flex items-start gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <div className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 ${getSmartAlertColor(alert.type)}`}>
                          {getSmartAlertIcon(alert.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold text-foreground">{alert.message}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{alert.detail}</p>
                          <p className="text-[9px] text-muted-foreground/60 mt-0.5">{formatTime(alert.timestamp)}</p>
                        </div>
                        <Button
                          size="icon" variant="ghost"
                          className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss"
                          onClick={() => clearSmartAlert(alert.id)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              )}
            </ScrollArea>
            {!isPro && (
              <div className="border-t border-border p-2.5 flex items-center justify-between gap-2 bg-muted/30">
                <p className="text-[10px] text-muted-foreground">Unlock with Pro</p>
                <Button asChild size="sm" className="h-6 text-[10px] px-2.5">
                  <Link to="/subscribe">Upgrade</Link>
                </Button>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
};

export default AlertsPanel;
