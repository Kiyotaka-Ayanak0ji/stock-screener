import { Lock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FilterLockBadgeProps {
  label: string;
  onClick: () => void;
}

const FilterLockBadge = ({ label, onClick }: FilterLockBadgeProps) => {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          aria-label={`${label} filter — Premium feature`}
          className="ml-0.5 inline-flex items-center justify-center rounded-sm p-0.5 text-muted-foreground/50 hover:text-primary hover:bg-primary/10 transition-colors"
          onClick={e => { e.stopPropagation(); e.preventDefault(); onClick(); }}
          onPointerDown={e => e.stopPropagation()}
        >
          <Lock className="h-3 w-3" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Filter by {label} — Premium
      </TooltipContent>
    </Tooltip>
  );
};

export default FilterLockBadge;
