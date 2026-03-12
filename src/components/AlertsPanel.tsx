import { Bell, Trash2, X } from "lucide-react";
import { useStocks } from "@/contexts/StockContext";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";

const AlertsPanel = () => {
  const { triggeredAlerts, clearAlert, clearAllAlerts, priceTriggers } = useStocks();

  const activeTriggerCount = Object.keys(priceTriggers).length;
  const alertCount = triggeredAlerts.length;

  const formatTime = (date: Date) => {
    const d = new Date(date);
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="rounded-full h-9 w-9 relative"
          title="Price Alerts"
        >
          <Bell className="h-4 w-4" />
          {alertCount > 0 && (
            <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {alertCount > 9 ? "9+" : alertCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="p-3 pb-2 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">Price Alerts</p>
            <p className="text-xs text-muted-foreground">
              {activeTriggerCount} active trigger{activeTriggerCount !== 1 ? "s" : ""} · {alertCount} alert{alertCount !== 1 ? "s" : ""}
            </p>
          </div>
          {alertCount > 0 && (
            <Button size="sm" variant="ghost" className="text-xs gap-1 h-7" onClick={clearAllAlerts}>
              <Trash2 className="h-3 w-3" />
              Clear all
            </Button>
          )}
        </div>
        <div className="border-t border-border" />
        <ScrollArea className="max-h-80">
          {alertCount === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">No triggered alerts yet</p>
              <p className="text-[10px] mt-1">Set price triggers in the table to get notified</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {triggeredAlerts.map(alert => (
                <div
                  key={alert.id}
                  className="flex items-start justify-between p-2 rounded-md hover:bg-muted/50 transition-colors group"
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
                      Trigger: ₹{alert.triggerPrice.toLocaleString("en-IN", { minimumFractionDigits: 2 })} · {formatTime(alert.timestamp)}
                    </p>
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss"
                    onClick={() => clearAlert(alert.id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
};

export default AlertsPanel;
