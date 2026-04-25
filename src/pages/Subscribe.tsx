import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, CreditCard, Loader2, ArrowLeft, Zap, X, TrendingUp } from "lucide-react";

import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  PRO_FEATURES,
  PRO_LOCKED,
  PREMIUM_EXTRAS,
  PREMIUM_PLUS_EXTRAS,
} from "@/lib/planFeatures";

declare global {
  interface Window {
    Razorpay: any;
  }
}

type PlanKey = "monthly" | "yearly" | "premium_monthly" | "premium_yearly" | "premium_plus_monthly" | "premium_plus_yearly";

const PLAN_PRICES: Record<PlanKey, { usd: number; label: string }> = {
  monthly: { usd: 5, label: "Pro Monthly" },
  yearly: { usd: 50, label: "Pro Yearly" },
  premium_monthly: { usd: 20, label: "Premium Monthly" },
  premium_yearly: { usd: 200, label: "Premium Yearly" },
  premium_plus_monthly: { usd: 40, label: "Premium Plus Monthly" },
  premium_plus_yearly: { usd: 450, label: "Premium Plus Yearly" },
};

const Subscribe = () => {
  const { user } = useAuth();
  const { subscription, isActive, trialDaysLeft, refetch } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [selectedTier, setSelectedTier] = useState<"pro" | "premium" | "premium_plus">("premium");
  const [processing, setProcessing] = useState(false);
  const navigate = useNavigate();

  const selectedPlan: PlanKey = selectedTier === "pro"
    ? (billingCycle === "yearly" ? "yearly" : "monthly")
    : selectedTier === "premium_plus"
    ? (billingCycle === "yearly" ? "premium_plus_yearly" : "premium_plus_monthly")
    : (billingCycle === "yearly" ? "premium_yearly" : "premium_monthly");

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (window.Razorpay) { resolve(true); return; }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleRazorpayPayment = async () => {
    setProcessing(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error("Failed to load Razorpay SDK"); return; }

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { plan: selectedPlan },
      });
      if (error || !data) { toast.error("Failed to create order"); return; }

      const planInfo = PLAN_PRICES[selectedPlan];
      const options = {
        key: data.key_id,
        amount: data.amount_inr,
        currency: "INR",
        name: selectedTier === "premium_plus" ? "EquityIQ Premium Plus" : selectedTier === "premium" ? "EquityIQ Premium" : "EquityIQ Pro",
        description: `${planInfo.label} Subscription`,
        order_id: data.order_id,
        handler: async (response: any) => {
          const { error: verifyError } = await supabase.functions.invoke("razorpay-verify-payment", {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: selectedPlan,
              amount_usd: data.amount_usd,
              amount_inr: data.amount_inr / 100,
              payment_method: "razorpay",
            },
          });
          if (verifyError) {
            toast.error("Payment verification failed");
          } else {
            toast.success(`${planInfo.label} subscription activated!`);
            await refetch();
            navigate("/dashboard");
          }
        },
        prefill: { email: user?.email },
        theme: { color: "#0ea5e9" },
        modal: {
          ondismiss: () => { setProcessing(false); },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", (response: any) => {
        toast.error(`Payment failed: ${response.error.description}`);
        setProcessing(false);
      });
      rzp.open();
    } catch (err) {
      toast.error("Something went wrong");
      console.error(err);
    } finally {
      setProcessing(false);
    }
  };

  useEffect(() => {
    if (!user) navigate("/auth");
  }, [user, navigate]);

  if (!user) return null;

  if (isActive && subscription?.status === 'active') {
    const isPP = subscription.plan === 'premium_plus_monthly' || subscription.plan === 'premium_plus_yearly';
    const isPremium = !isPP && (subscription.plan === 'premium_monthly' || subscription.plan === 'premium_yearly' || subscription.plan === 'yearly');
    const tierLabel = isPP ? 'Premium Plus' : isPremium ? 'Premium' : 'Pro';
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Crown className="h-12 w-12 text-amber-500 mx-auto mb-2" />
            <CardTitle>You're a {tierLabel} Member!</CardTitle>
            <CardDescription>
              Your {tierLabel} plan is active
              {subscription.subscription_ends_at && (
                <> until {new Date(subscription.subscription_ends_at).toLocaleDateString()}</>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-3xl"
      >
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-3">
            <TrendingUp className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold tracking-tight">
              Equity<span className="text-primary">IQ</span>
            </span>
          </div>
          <Crown className="h-9 w-9 text-amber-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Choose Your Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick the plan that matches your investment style</p>
          {trialDaysLeft > 0 && (
            <Badge variant="secondary" className="mt-2">
              {trialDaysLeft} days left in your free trial
            </Badge>
          )}
        </div>

        {/* Billing Cycle Toggle */}
        <div className="flex items-center justify-center gap-2 mb-6">
          <button
            onClick={() => setBillingCycle("monthly")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              billingCycle === "monthly"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setBillingCycle("yearly")}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors flex items-center gap-1.5 ${
              billingCycle === "yearly"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-green-500/20 text-green-600 dark:text-green-400 border-0">
              Save 17%
            </Badge>
          </button>
        </div>

        {/* Plan Selection */}
        <div className="grid md:grid-cols-3 gap-4 mb-6">
          {/* Pro */}
          <button
            onClick={() => setSelectedTier("pro")}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              selectedTier === "pro"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Pro</h3>
              <Badge variant="outline" className="text-xs">{billingCycle === "yearly" ? "Yearly" : "Monthly"}</Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold">${billingCycle === "yearly" ? "50" : "5"}</span>
              <span className="text-muted-foreground text-sm">/{billingCycle === "yearly" ? "year" : "month"}</span>
            </div>
            {billingCycle === "yearly" && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-2">~$4.17/mo — save $10/year</p>
            )}
            <ul className="space-y-1.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <Check className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
              {PRO_LOCKED.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <X className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-muted-foreground/60">{f}</span>
                </li>
              ))}
            </ul>
          </button>

          {/* Premium */}
          <button
            onClick={() => setSelectedTier("premium")}
            className={`text-left p-5 rounded-xl border-2 transition-all relative ${
              selectedTier === "premium"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-1.5">
                Premium <Crown className="h-4 w-4 text-amber-500" />
              </h3>
              <Badge variant="outline" className="text-xs">{billingCycle === "yearly" ? "Yearly" : "Monthly"}</Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold">${billingCycle === "yearly" ? "200" : "20"}</span>
              <span className="text-muted-foreground text-sm">/{billingCycle === "yearly" ? "year" : "month"}</span>
            </div>
            {billingCycle === "yearly" && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-2">~$16.67/mo — save $40/year</p>
            )}
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs">
                <Check className="h-3 w-3 text-primary shrink-0" />
                <span className="text-muted-foreground font-medium">Everything in Pro, plus:</span>
              </li>
              {PREMIUM_EXTRAS.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <Check className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </button>

          {/* Premium Plus */}
          <button
            onClick={() => setSelectedTier("premium_plus")}
            className={`text-left p-5 rounded-xl border-2 transition-all relative md:col-span-1 ${
              selectedTier === "premium_plus"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <Badge className="absolute -top-2.5 right-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 text-[10px]">
              Unlimited
            </Badge>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-1.5">
                Premium Plus <Zap className="h-4 w-4 text-orange-500" />
              </h3>
              <Badge variant="outline" className="text-xs">{billingCycle === "yearly" ? "Yearly" : "Monthly"}</Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold">${billingCycle === "yearly" ? "450" : "40"}</span>
              <span className="text-muted-foreground text-sm">/{billingCycle === "yearly" ? "year" : "month"}</span>
            </div>
            {billingCycle === "yearly" && (
              <p className="text-xs text-green-600 dark:text-green-400 mb-2">~$37.50/mo — save $30/year</p>
            )}
            <ul className="space-y-1.5">
              <li className="flex items-center gap-2 text-xs">
                <Check className="h-3 w-3 text-primary shrink-0" />
                <span className="text-muted-foreground font-medium">Everything in Premium, plus:</span>
              </li>
              {PREMIUM_PLUS_EXTRAS.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <Check className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
            </ul>
          </button>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Actions */}
            <div className="space-y-2">
                <Button
                  className="w-full gap-2 h-auto min-h-11 py-2 whitespace-normal text-center leading-tight text-sm sm:text-base"
                  onClick={() => handleRazorpayPayment()}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin shrink-0" /> : <Crown className="h-4 w-4 shrink-0" />}
                  <span className="break-words">
                    Subscribe to {PLAN_PRICES[selectedPlan].label} (${PLAN_PRICES[selectedPlan].usd}/{billingCycle === "yearly" ? "yr" : "mo"})
                  </span>
                </Button>
            </div>

            <Button
              variant="ghost"
              className="w-full text-muted-foreground"
              onClick={() => navigate("/dashboard")}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              {isActive ? "Back to Dashboard" : "Continue with limited access"}
            </Button>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
};

export default Subscribe;
