import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, CreditCard, Building2, Smartphone, Loader2, ArrowLeft, Zap, X } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

declare global {
  interface Window {
    Razorpay: any;
  }
}

const BANK_DETAILS = {
  bankName: "State Bank of India",
  accountName: "ANSIK ARYAN SAMAL",
  accountNumber: "39972895973",
  ifscCode: "SBIN0005321",
  upiId: "aryanansik@oksbi",
  note: "After payment, email your transaction ID to aryanansik69@gmail.com for activation.",
};

const PRO_FEATURES = [
  "Unlimited stocks in watchlist",
  "Column visibility customization",
  "Price trigger alerts with email",
  "Event tagging & tracking",
  "Notes on stocks",
  "Export as Image & PDF",
  "Shareable watchlist links",
  "Multiple watchlists",
  "Real-time price updates",
];

const PREMIUM_EXTRAS = [
  "Stock comparison tool (up to 3)",
  "Portfolio performance dashboard",
  "Sector allocation & diversity metrics",
  "Stock-wise P&L charts",
  "Priority email support",
  "Early access to new features",
];

const Subscribe = () => {
  const { user } = useAuth();
  const { subscription, isActive, trialDaysLeft, refetch } = useSubscription();
  const [selectedPlan, setSelectedPlan] = useState<"monthly" | "yearly">("yearly");
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "bank">("razorpay");
  const [processing, setProcessing] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
  const navigate = useNavigate();

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

  const handleRazorpayPayment = async (isTest = false) => {
    setProcessing(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) { toast.error("Failed to load Razorpay SDK"); return; }

      const { data, error } = await supabase.functions.invoke("razorpay-create-order", {
        body: { plan: selectedPlan, is_test: isTest },
      });
      if (error || !data) { toast.error("Failed to create order"); return; }

      const options = {
        key: data.key_id,
        amount: data.amount_inr,
        currency: "INR",
        name: selectedPlan === "yearly" ? "EquityIQ Premium" : "EquityIQ Pro",
        description: isTest ? "Test Payment (1 cent)" : `${selectedPlan === 'yearly' ? 'Premium (Yearly)' : 'Pro (Monthly)'} Subscription`,
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
              is_test: isTest,
            },
          });
          if (verifyError) {
            toast.error("Payment verification failed");
          } else {
            if (isTest) {
              toast.success("Test payment successful! Gateway is working.");
            } else {
              toast.success(`${selectedPlan === 'yearly' ? 'Premium' : 'Pro'} subscription activated!`);
              await refetch();
              navigate("/dashboard");
            }
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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <Crown className="h-12 w-12 text-amber-500 mx-auto mb-2" />
            <CardTitle>You're a {subscription.plan === 'yearly' ? 'Premium' : 'Pro'} Member!</CardTitle>
            <CardDescription>
              Your {subscription.plan === 'yearly' ? 'Premium (Yearly)' : 'Pro (Monthly)'} plan is active
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
          <Crown className="h-10 w-10 text-amber-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Choose Your Plan</h1>
          <p className="text-sm text-muted-foreground mt-1">Pick the plan that matches your investment style</p>
          {trialDaysLeft > 0 && (
            <Badge variant="secondary" className="mt-2">
              {trialDaysLeft} days left in your free trial
            </Badge>
          )}
        </div>

        {/* Plan Selection */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          {/* Pro */}
          <button
            onClick={() => setSelectedPlan("monthly")}
            className={`text-left p-5 rounded-xl border-2 transition-all ${
              selectedPlan === "monthly"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg">Pro</h3>
              <Badge variant="outline" className="text-xs">Monthly</Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold">$5</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
            <ul className="space-y-1.5">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <Check className="h-3 w-3 text-primary shrink-0" />
                  <span className="text-muted-foreground">{f}</span>
                </li>
              ))}
              {["Stock comparison", "Portfolio dashboard"].map((f) => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <X className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                  <span className="text-muted-foreground/60">{f}</span>
                </li>
              ))}
            </ul>
          </button>

          {/* Premium */}
          <button
            onClick={() => setSelectedPlan("yearly")}
            className={`text-left p-5 rounded-xl border-2 transition-all relative ${
              selectedPlan === "yearly"
                ? "border-primary bg-primary/5"
                : "border-border hover:border-primary/40"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-lg flex items-center gap-1.5">
                Premium <Crown className="h-4 w-4 text-amber-500" />
              </h3>
              <Badge variant="outline" className="text-xs">Monthly</Badge>
            </div>
            <div className="flex items-baseline gap-1 mb-3">
              <span className="text-3xl font-bold">$20</span>
              <span className="text-muted-foreground text-sm">/month</span>
            </div>
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
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            {/* Payment method */}
            <div className="space-y-2">
              <p className="text-sm font-medium">Payment Method</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setPaymentMethod("razorpay"); setShowBankDetails(false); }}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                    paymentMethod === "razorpay"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <CreditCard className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Razorpay</div>
                    <div className="text-[10px]">Card / UPI / Wallet</div>
                  </div>
                </button>
                <button
                  onClick={() => { setPaymentMethod("bank"); setShowBankDetails(true); }}
                  className={`flex items-center gap-2 p-3 rounded-lg border text-sm transition-colors ${
                    paymentMethod === "bank"
                      ? "border-primary bg-primary/5 text-foreground"
                      : "border-border text-muted-foreground hover:border-primary/50"
                  }`}
                >
                  <Building2 className="h-4 w-4" />
                  <div className="text-left">
                    <div className="font-medium">Bank Transfer</div>
                    <div className="text-[10px]">NEFT / IMPS / UPI</div>
                  </div>
                </button>
              </div>
            </div>

            {/* Bank details */}
            {showBankDetails && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="bg-muted rounded-lg p-4 space-y-2 text-sm"
              >
                <p className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" /> Bank Transfer Details
                </p>
                <div className="space-y-1.5 text-muted-foreground">
                  <p><span className="font-medium text-foreground">Bank:</span> {BANK_DETAILS.bankName}</p>
                  <p><span className="font-medium text-foreground">Account Name:</span> {BANK_DETAILS.accountName}</p>
                  <p><span className="font-medium text-foreground">Account No:</span> {BANK_DETAILS.accountNumber}</p>
                  <p><span className="font-medium text-foreground">IFSC:</span> {BANK_DETAILS.ifscCode}</p>
                  <div className="flex items-center gap-2 pt-1">
                    <Smartphone className="h-4 w-4" />
                    <p><span className="font-medium text-foreground">UPI:</span> {BANK_DETAILS.upiId}</p>
                  </div>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 bg-amber-500/10 p-2 rounded">
                  {BANK_DETAILS.note}
                </p>
              </motion.div>
            )}

            {/* Actions */}
            {paymentMethod === "razorpay" && (
              <div className="space-y-2">
                <Button
                  className="w-full gap-2"
                  onClick={() => handleRazorpayPayment(false)}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                  Subscribe to {selectedPlan === "yearly" ? "Premium ($20/mo)" : "Pro ($5/mo)"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full gap-2 text-xs"
                  onClick={() => handleRazorpayPayment(true)}
                  disabled={processing}
                >
                  <Zap className="h-3 w-3" />
                  Send 1¢ test payment to verify gateway
                </Button>
              </div>
            )}

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
