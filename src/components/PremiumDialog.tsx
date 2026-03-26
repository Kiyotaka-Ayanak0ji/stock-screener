import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Sparkles, X } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
  requiresPremium?: boolean; // true = needs yearly/Premium plan specifically
}

const PremiumDialog = ({ open, onOpenChange, featureName, requiresPremium }: PremiumDialogProps) => {
  const navigate = useNavigate();

  const proFeatures = [
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

  const premiumExtras = [
    "Stock comparison tool (up to 3 stocks)",
    "Portfolio performance dashboard",
    "Sector allocation & diversity metrics",
    "Stock-wise P&L charts",
  ];

  const isPremiumFeature = requiresPremium || 
    featureName?.toLowerCase().includes("compar") || 
    featureName?.toLowerCase().includes("portfolio");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Crown className="h-5 w-5 text-amber-500" />
            {isPremiumFeature ? "Premium Feature" : "Upgrade to EquityIQ Pro"}
          </DialogTitle>
          <DialogDescription>
            {featureName
              ? isPremiumFeature
                ? `"${featureName}" requires the Premium (Yearly) plan at $20/year.`
                : `"${featureName}" requires a Pro or Premium subscription.`
              : "Unlock all features to supercharge your stock tracking."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {isPremiumFeature ? "Premium plan includes:" : "Pro plan includes:"}
          </p>
          {(isPremiumFeature ? [...proFeatures, ...premiumExtras] : proFeatures).map((feature) => (
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
            {isPremiumFeature ? "Get Premium ($20/year)" : "View Plans"}
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
  const [requiresPremium, setRequiresPremium] = useState(false);

  const requirePremium = (feature: string, needsPremiumPlan = false): boolean => {
    setFeatureName(feature);
    setRequiresPremium(needsPremiumPlan);
    setPremiumOpen(true);
    return false;
  };

  return { premiumOpen, setPremiumOpen, featureName, requirePremium, requiresPremium };
}
