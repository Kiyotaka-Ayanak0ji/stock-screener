import { useState } from "react";
import { Eye, EyeOff, Columns3, Plus, Trash2, Check, X } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useStocks } from "@/contexts/StockContext";

const ColumnVisibilityDropdown = () => {
  const { columnVisibility, toggleColumnVisibility, customColumns, addCustomColumn, removeCustomColumn } = useStocks();
  const [newColName, setNewColName] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);

  const builtInColumns: { key: string; label: string }[] = [
    { key: "exchange", label: "Exchange" },
    { key: "price", label: "Price" },
    { key: "change", label: "Change" },
    { key: "high", label: "High" },
    { key: "low", label: "Low" },
    { key: "volume", label: "Volume" },
    { key: "marketCap", label: "Market Cap" },
    { key: "priceTrigger", label: "Price Trigger" },
    { key: "event", label: "Event" },
    { key: "notes", label: "Notes" },
  ];

  const handleAddColumn = () => {
    const name = newColName.trim();
    if (!name) return;
    addCustomColumn(name);
    setNewColName("");
    setShowAddForm(false);
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button size="sm" variant="outline" className="gap-2">
          <Columns3 className="h-4 w-4" />
          Columns
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="end">
        <div className="p-3 pb-2">
          <p className="text-sm font-semibold">Toggle Columns</p>
          <p className="text-xs text-muted-foreground">Show or hide table columns</p>
        </div>
        <Separator />
        <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
          {builtInColumns.map(col => {
            const visible = columnVisibility[col.key] !== false;
            return (
              <button
                key={col.key}
                onClick={() => toggleColumnVisibility(col.key)}
                className="w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {visible ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                  {col.label}
                </span>
                <Switch checked={visible} className="pointer-events-none scale-75" />
              </button>
            );
          })}

          {customColumns.length > 0 && (
            <>
              <Separator className="my-1" />
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 pt-1">Custom Columns</p>
              {customColumns.map(col => {
                const visible = columnVisibility[`custom_${col.id}`] !== false;
                return (
                  <div key={col.id} className="flex items-center justify-between px-2 py-1.5 rounded-md text-sm hover:bg-muted/50 group">
                    <button
                      onClick={() => toggleColumnVisibility(`custom_${col.id}`)}
                      className="flex items-center gap-2 flex-1"
                    >
                      {visible ? <Eye className="h-3.5 w-3.5 text-primary" /> : <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />}
                      {col.name}
                    </button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-loss"
                      onClick={() => removeCustomColumn(col.id)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                );
              })}
            </>
          )}
        </div>

        <Separator />
        <div className="p-2">
          {showAddForm ? (
            <div className="flex items-center gap-1">
              <Input
                value={newColName}
                onChange={e => setNewColName(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") handleAddColumn(); if (e.key === "Escape") setShowAddForm(false); }}
                placeholder="Column name..."
                className="h-7 text-xs"
                autoFocus
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={handleAddColumn}>
                <Check className="h-3 w-3 text-gain" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => { setShowAddForm(false); setNewColName(""); }}>
                <X className="h-3 w-3 text-loss" />
              </Button>
            </div>
          ) : (
            <Button
              size="sm"
              variant="ghost"
              className="w-full gap-2 text-xs justify-start"
              onClick={() => setShowAddForm(true)}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Custom Column
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ColumnVisibilityDropdown;
