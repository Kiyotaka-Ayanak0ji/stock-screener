import { useState, useEffect, useRef } from "react";
import { Trash2, MessageSquare, Check, X, ExternalLink, Plus, Tag, Bell, BellOff } from "lucide-react";
import { Stock, getStockUrl } from "@/lib/stockData";
import { useStocks } from "@/contexts/StockContext";
import { CustomColumn } from "@/contexts/StockContext";
import { motion } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface StockRowProps {
  stock: Stock;
  index: number;
  visibleCustomColumns: CustomColumn[];
}

const PRESET_TAGS = ["Earnings", "Dividend", "Split", "Bonus", "IPO", "Rights", "AGM", "Buyback", "Watch", "Target Hit"];

const StockRow = ({ stock, index, visibleCustomColumns }: StockRowProps) => {
  const { notes, events, updateNote, updateEvent, removeStock, lastFlash, columnVisibility, customColumnData, updateCustomColumnData, priceTriggers, setPriceTrigger } = useStocks();
  const [editingNote, setEditingNote] = useState(false);
  const [noteValue, setNoteValue] = useState("");
  const [customTag, setCustomTag] = useState("");
  const [editingCustomCol, setEditingCustomCol] = useState<string | null>(null);
  const [customColValue, setCustomColValue] = useState("");
  const [editingTrigger, setEditingTrigger] = useState(false);
  const [triggerValue, setTriggerValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const customInputRef = useRef<HTMLInputElement>(null);
  const triggerInputRef = useRef<HTMLInputElement>(null);
  const [flashClass, setFlashClass] = useState("");

  const isVisible = (key: string) => columnVisibility[key] !== false;

  const note = notes.find(n => n.ticker === stock.ticker)?.note || "";
  const stockEvents = events.find(e => e.ticker === stock.ticker)?.tags || [];
  const flash = lastFlash[stock.ticker];
  const trigger = priceTriggers[stock.ticker];

  useEffect(() => {
    if (flash === "up") setFlashClass("price-flash-up");
    else if (flash === "down") setFlashClass("price-flash-down");
    const t = setTimeout(() => setFlashClass(""), 600);
    return () => clearTimeout(t);
  }, [flash, stock.price]);

  const startEdit = () => {
    setNoteValue(note);
    setEditingNote(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const saveNote = () => {
    updateNote(stock.ticker, noteValue);
    setEditingNote(false);
  };

  const cancelEdit = () => {
    setEditingNote(false);
    setNoteValue(note);
  };

  const addTag = (tag: string) => {
    if (!tag.trim() || stockEvents.includes(tag.trim())) return;
    updateEvent(stock.ticker, [...stockEvents, tag.trim()]);
    setCustomTag("");
  };

  const removeTag = (tag: string) => {
    updateEvent(stock.ticker, stockEvents.filter(t => t !== tag));
  };

  const startEditCustomCol = (colId: string) => {
    const current = customColumnData[stock.ticker]?.[colId];
    setCustomColValue(current != null ? String(current) : "");
    setEditingCustomCol(colId);
    setTimeout(() => customInputRef.current?.focus(), 50);
  };

  const saveCustomCol = (colId: string) => {
    const val = customColValue.trim();
    updateCustomColumnData(stock.ticker, colId, val === "" ? null : parseFloat(val));
    setEditingCustomCol(null);
  };

  const startEditTrigger = () => {
    setTriggerValue(trigger ? String(trigger.price) : "");
    setEditingTrigger(true);
    setTimeout(() => triggerInputRef.current?.focus(), 50);
  };

  const saveTrigger = () => {
    const val = triggerValue.trim();
    setPriceTrigger(stock.ticker, val === "" ? null : parseFloat(val));
    setEditingTrigger(false);
  };

  const isPositive = stock.change > 0;
  const isNegative = stock.change < 0;
  const changeColor = isPositive ? "text-gain" : isNegative ? "text-loss" : "text-unchanged";
  const changeBg = isPositive ? "bg-gain-subtle" : isNegative ? "bg-loss-subtle" : "";

  const formatVolume = (v: number) => {
    if (v >= 10000000) return (v / 10000000).toFixed(2) + " Cr";
    if (v >= 100000) return (v / 100000).toFixed(2) + " L";
    if (v >= 1000) return (v / 1000).toFixed(1) + "K";
    return v.toString();
  };

  const formatMarketCap = (mc: number) => {
    if (mc >= 100000) return (mc / 100000).toFixed(2) + " L Cr";
    if (mc >= 1000) return (mc / 1000).toFixed(1) + "K Cr";
    return mc.toFixed(0) + " Cr";
  };

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ delay: index * 0.03, duration: 0.3 }}
      className={`table-row-hover border-b border-border ${flashClass}`}
    >
      <td className="px-4 py-3">
        <div className="flex flex-col">
          <a
            href={getStockUrl(stock.ticker, stock.exchange)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono font-bold text-sm text-primary hover:underline inline-flex items-center gap-1 group w-fit"
          >
            {stock.ticker}
            <ExternalLink className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
          </a>
          <span className="text-xs text-muted-foreground truncate max-w-[140px]">{stock.name}</span>
        </div>
      </td>
      {isVisible("exchange") && (
        <td className="px-3 py-3 text-xs font-medium">
          <span className="px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
            {stock.exchange}
          </span>
        </td>
      )}
      {isVisible("price") && (
        <td className="px-4 py-3 text-right font-mono font-semibold text-sm">
          ₹{stock.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </td>
      )}
      {isVisible("change") && (
        <td className={`px-4 py-3 text-right font-mono text-sm ${changeColor}`}>
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded ${changeBg}`}>
            {isPositive ? "+" : ""}{stock.change.toFixed(2)}
            <span className="text-xs">
              ({isPositive ? "+" : ""}{stock.changePercent.toFixed(2)}%)
            </span>
          </span>
        </td>
      )}
      {isVisible("high") && (
        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden lg:table-cell">
          ₹{stock.high.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </td>
      )}
      {isVisible("low") && (
        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden lg:table-cell">
          ₹{stock.low.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
        </td>
      )}
      {isVisible("volume") && (
        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
          {formatVolume(stock.volume)}
        </td>
      )}
      {isVisible("marketCap") && (
        <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground hidden md:table-cell">
          ₹{formatMarketCap(stock.marketCap)}
        </td>
      )}
      {visibleCustomColumns.map(col => {
        const val = customColumnData[stock.ticker]?.[col.id];
        return (
          <td key={col.id} className="px-4 py-3 text-right font-mono text-xs text-muted-foreground min-w-[100px]">
            {editingCustomCol === col.id ? (
              <div className="flex items-center gap-1 justify-end">
                <Input
                  ref={customInputRef}
                  value={customColValue}
                  onChange={e => setCustomColValue(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") saveCustomCol(col.id); if (e.key === "Escape") setEditingCustomCol(null); }}
                  className="h-6 text-xs w-20 text-right"
                  type="number"
                  step="any"
                />
                <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => saveCustomCol(col.id)}>
                  <Check className="h-3 w-3 text-gain" />
                </Button>
              </div>
            ) : (
              <button
                onClick={() => startEditCustomCol(col.id)}
                className="hover:text-foreground transition-colors w-full text-right"
              >
                {val != null ? val.toLocaleString("en-IN") : "—"}
              </button>
            )}
          </td>
        );
      })}
      {isVisible("priceTrigger") && (
        <td className="px-4 py-3 text-right font-mono text-xs min-w-[120px]">
          {editingTrigger ? (
            <div className="flex items-center gap-1 justify-end">
              <Input
                ref={triggerInputRef}
                value={triggerValue}
                onChange={e => setTriggerValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveTrigger(); if (e.key === "Escape") setEditingTrigger(false); }}
                className="h-6 text-xs w-20 text-right"
                type="number"
                step="any"
                placeholder="₹ price"
              />
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={saveTrigger}>
                <Check className="h-3 w-3 text-gain" />
              </Button>
              <Button size="icon" variant="ghost" className="h-6 w-6 shrink-0" onClick={() => setEditingTrigger(false)}>
                <X className="h-3 w-3 text-loss" />
              </Button>
            </div>
          ) : (
            <button
              onClick={startEditTrigger}
              className={`hover:text-foreground transition-colors w-full text-right inline-flex items-center justify-end gap-1 ${trigger ? "text-primary" : "text-muted-foreground"}`}
            >
              {trigger ? (
                <>
                  <Bell className="h-3 w-3" />
                  ₹{trigger.price.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                </>
              ) : (
                <>
                  <BellOff className="h-3 w-3 opacity-50" />
                  Set trigger
                </>
              )}
            </button>
          )}
        </td>
      )}
      {isVisible("event") && (
        <td className="px-4 py-3 min-w-[160px]">
          <div className="flex items-center gap-1 flex-wrap">
            {stockEvents.map(tag => (
              <Badge
                key={tag}
                variant="secondary"
                className="text-[10px] px-1.5 py-0 cursor-pointer hover:bg-destructive/20 hover:text-destructive transition-colors"
                onClick={() => removeTag(tag)}
              >
                {tag} ×
              </Badge>
            ))}
            <Popover>
              <PopoverTrigger asChild>
                <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0">
                  <Plus className="h-3 w-3" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-2" align="start">
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Add Event Tag
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {PRESET_TAGS.filter(t => !stockEvents.includes(t)).map(tag => (
                      <Badge
                        key={tag}
                        variant="outline"
                        className="text-[10px] cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => addTag(tag)}
                      >
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <div className="flex gap-1">
                    <Input
                      value={customTag}
                      onChange={e => setCustomTag(e.target.value)}
                      onKeyDown={e => { if (e.key === "Enter") addTag(customTag); }}
                      className="h-6 text-xs"
                      placeholder="Custom tag..."
                    />
                    <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => addTag(customTag)}>
                      Add
                    </Button>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </td>
      )}
      {isVisible("notes") && (
        <td className="px-4 py-3 min-w-[180px]">
          {editingNote ? (
            <div className="flex items-center gap-1">
              <Input
                ref={inputRef}
                value={noteValue}
                onChange={e => setNoteValue(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") saveNote(); if (e.key === "Escape") cancelEdit(); }}
                className="h-7 text-xs"
                placeholder="Add a note..."
              />
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={saveNote}>
                <Check className="h-3 w-3 text-gain" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={cancelEdit}>
                <X className="h-3 w-3 text-loss" />
              </Button>
            </div>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors max-w-full"
                >
                  <MessageSquare className="h-3 w-3 shrink-0" />
                  <span className="truncate">{note || "Add note..."}</span>
                </button>
              </TooltipTrigger>
              {note && <TooltipContent side="top"><p className="max-w-xs">{note}</p></TooltipContent>}
            </Tooltip>
          )}
        </td>
      )}
      <td className="px-3 py-3">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-loss"
          onClick={() => removeStock(stock.ticker)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </td>
    </motion.tr>
  );
};

export default StockRow;
