import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
}

const PremiumDialog = ({ open, onOpenChange, featureName }: PremiumDialogProps) => {
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const navigate = useNavigate();

  const features = [
    "Unlimited stocks in watchlist",
    "Column visibility customization",
    "Price trigger alerts with email notifications",
    "Event tagging & tracking",
    "Notes on stocks",
    "Export as Image & PDF",
    "Shareable watchlist links",
    "Multiple watchlists",
    "Real-time price updates",
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-amber-500" />
            Upgrade to StockSense Premium
          </DialogTitle>
          <DialogDescription>
            {featureName
              ? `"${featureName}" is a premium feature. Sign up to unlock all premium features.`
              : "Unlock all premium features to supercharge your stock tracking."}
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2 p-1 bg-muted rounded-lg mt-2">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              billingCycle === "monthly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
              billingCycle === "yearly"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <span className="ml-1 text-[10px] text-green-500 font-bold">SAVE 67%</span>
          </button>
        </div>

        <div className="text-center py-4">
          <div className="flex items-baseline justify-center gap-1">
            <span className="text-4xl font-bold text-foreground">
              ${billingCycle === "monthly" ? "5" : "20"}
            </span>
            <span className="text-muted-foreground text-sm">
              /{billingCycle === "monthly" ? "month" : "year"}
            </span>
          </div>
          {billingCycle === "yearly" && (
            <p className="text-xs text-muted-foreground mt-1">
              That's just $1.67/month
            </p>
          )}
        </div>

        <div className="space-y-2">
          {features.map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500 shrink-0" />
              <span className="text-foreground">{feature}</span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 mt-4">
          <Button
            className="w-full gap-2"
            onClick={() => {
              onOpenChange(false);
              navigate("/subscribe");
            }}
          >
            <Sparkles className="h-4 w-4" />
            Subscribe Now
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground text-xs"
            onClick={() => onOpenChange(false)}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PremiumDialog;

// Hook for easy premium gating
export function usePremiumGate() {
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [featureName, setFeatureName] = useState<string | undefined>();

  const requirePremium = (feature: string): boolean => {
    setFeatureName(feature);
    setPremiumOpen(true);
    return false;
  };

  return { premiumOpen, setPremiumOpen, featureName, requirePremium };
}
