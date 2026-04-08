import { useState, useRef } from "react";
import { Filter } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface FilterPopoverProps {
  label: string;
  min: string;
  max: string;
  setMin: (v: string) => void;
  setMax: (v: string) => void;
}

const FilterPopover = ({ label, min, max, setMin, setMax }: FilterPopoverProps) => {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startCloseTimer = () => {
    closeTimer.current = setTimeout(() => setOpen(false), 10000);
  };
  const clearCloseTimer = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };

  return (
    <Popover open={open} onOpenChange={() => {}}>
      <PopoverTrigger asChild>
        <button
          className="ml-0.5 hover:text-primary transition-colors"
          onClick={e => { e.stopPropagation(); e.preventDefault(); clearCloseTimer(); setOpen(prev => !prev); }}
          onPointerDown={e => e.stopPropagation()}
        >
          <Filter className={`h-3 w-3 ${min || max ? "text-primary" : "opacity-40"}`} />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-56 p-3"
        align="end"
        onClick={e => e.stopPropagation()}
        onPointerDown={e => e.stopPropagation()}
        onPointerDownOutside={e => e.preventDefault()}
        onInteractOutside={e => e.preventDefault()}
        onFocusOutside={e => e.preventDefault()}
        onMouseEnter={clearCloseTimer}
        onMouseLeave={startCloseTimer}
      >
        <p className="text-xs font-medium mb-2">Filter by {label}</p>
        <div className="flex items-center gap-2">
          <Input type="number" placeholder="Min" value={min} onChange={e => setMin(e.target.value)} className="h-8 text-xs" step="any" onFocus={clearCloseTimer} />
          <span className="text-xs text-muted-foreground">—</span>
          <Input type="number" placeholder="Max" value={max} onChange={e => setMax(e.target.value)} className="h-8 text-xs" step="any" onFocus={clearCloseTimer} />
        </div>
        <div className="flex gap-2 mt-2">
          {(min || max) && (
            <Button size="sm" variant="ghost" className="flex-1 text-xs h-7" onClick={() => { setMin(""); setMax(""); }}>
              Clear
            </Button>
          )}
          <Button size="sm" variant="default" className="flex-1 text-xs h-7" onClick={() => { clearCloseTimer(); setOpen(false); }}>
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default FilterPopover;
