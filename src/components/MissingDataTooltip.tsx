import { ReactNode } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertCircle } from "lucide-react";

interface MissingDataTooltipProps {
  /** When true, show the missing-data tooltip wrapped around the placeholder */
  missing: boolean;
  /** What metric is missing (e.g. "Price", "Volume") */
  label: string;
  /** Extra hint shown after the standard message (optional) */
  hint?: string;
  /** Trigger content (the rendered value, e.g. "0", "—") */
  children: ReactNode;
  /** Side for the tooltip */
  side?: "top" | "bottom" | "left" | "right";
  /** Optional className on the wrapping span */
  className?: string;
}

/**
 * Wraps a placeholder/zero value with an informative tooltip explaining that
 * the data could not be fetched from the upstream provider. When `missing` is
 * false, renders children unchanged.
 */
const MissingDataTooltip = ({
  missing,
  label,
  hint,
  children,
  side = "top",
  className,
}: MissingDataTooltipProps) => {
  if (!missing) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={
            "inline-flex items-center gap-1 text-muted-foreground/60 cursor-help underline decoration-dotted underline-offset-2 " +
            (className || "")
          }
        >
          <AlertCircle className="h-3 w-3" aria-hidden="true" />
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side={side} className="max-w-[240px] text-xs">
        <p className="font-medium">{label} data unavailable</p>
        <p className="mt-1 opacity-90">
          We couldn’t fetch {label.toLowerCase()} from the upstream provider. Showing
          a placeholder. Try the verify button (↻) to refresh from Screener.
          {hint ? ` ${hint}` : ""}
        </p>
      </TooltipContent>
    </Tooltip>
  );
};

export default MissingDataTooltip;
