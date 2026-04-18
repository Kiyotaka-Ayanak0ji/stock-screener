import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Check, Sparkles, Zap } from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  PRO_FEATURES,
  PREMIUM_EXTRAS,
  PREMIUM_PLUS_EXTRAS,
  inferRequiredTier,
  type RequiredTier,
} from "@/lib/planFeatures";

interface PremiumDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  featureName?: string;
  /**
   * Force a specific minimum-tier requirement. If omitted, the tier is
   * inferred from `featureName`. Back-compat: `requiresPremium=true` maps to
   * the Premium tier.
   */
  requiredTier?: RequiredTier;
  requiresPremium?: boolean;
}

const TIER_COPY: Record<RequiredTier, {
  title: string;
  cta: string;
  badgeIcon: typeof Crown;
  priceLabel: string;
}> = {
  pro: {
    title: "Upgrade to Pro",
    cta: "Get Pro (from $5/mo)",
    badgeIcon: Crown,
    priceLabel: "Pro plan ($5/mo or $50/yr)",
  },
  premium: {
    title: "Premium Feature",
    cta: "Get Premium (from $20/mo)",
    badgeIcon: Crown,
    priceLabel: "Premium plan ($20/mo or $200/yr)",
  },
  premium_plus: {
    title: "Premium Plus Feature",
    cta: "Get Premium Plus (from $40/mo)",
    badgeIcon: Zap,
    priceLabel: "Premium Plus plan ($40/mo or $450/yr)",
  },
};

const PremiumDialog = ({
  open,
  onOpenChange,
  featureName,
  requiredTier,
  requiresPremium,
}: PremiumDialogProps) => {
  const navigate = useNavigate();

  const tier: RequiredTier =
    requiredTier ?? (requiresPremium ? "premium" : inferRequiredTier(featureName));
  const copy = TIER_COPY[tier];
  const Icon = copy.badgeIcon;

  // Build the feature list shown — always show what the unlocked tier
  // includes (cumulatively).
  const featureList: readonly string[] =
    tier === "pro"
      ? PRO_FEATURES
      : tier === "premium"
      ? [...PRO_FEATURES, ...PREMIUM_EXTRAS]
      : [...PRO_FEATURES, ...PREMIUM_EXTRAS, ...PREMIUM_PLUS_EXTRAS];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Icon className="h-5 w-5 text-amber-500" />
            {copy.title}
          </DialogTitle>
          <DialogDescription>
            {featureName
              ? `"${featureName}" requires the ${copy.priceLabel}.`
              : `Unlock the ${copy.priceLabel} to supercharge your stock tracking.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 max-h-[50vh] overflow-y-auto pr-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            What you'll unlock:
          </p>
          {featureList.map((feature) => (
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
            {copy.cta}
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
