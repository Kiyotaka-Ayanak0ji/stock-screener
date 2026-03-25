import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, CreditCard, Building2, Smartphone, Loader2, ArrowLeft, Zap } from "lucide-react";
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

const Subscribe = () => {
  const { user } = useAuth();
  const { subscription, isActive, trialDaysLeft, refetch } = useSubscription();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("yearly");
  const [paymentMethod, setPaymentMethod] = useState<"razorpay" | "bank">("razorpay");
  const [processing, setProcessing] = useState(false);
  const [showBankDetails, setShowBankDetails] = useState(false);
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
        body: { plan: billingCycle, is_test: isTest },
      });
      if (error || !data) { toast.error("Failed to create order"); return; }

      const options = {
        key: data.key_id,
        amount: data.amount_inr,
        currency: "INR",
        name: "EquityIQ Premium",
        description: isTest ? "Test Payment (1 cent)" : `${billingCycle === 'yearly' ? 'Yearly' : 'Monthly'} Subscription`,
        order_id: data.order_id,
        handler: async (response: any) => {
          const { error: verifyError } = await supabase.functions.invoke("razorpay-verify-payment", {
            body: {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan: billingCycle,
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
              toast.success("Subscription activated! Welcome to Premium.");
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
            <CardTitle>You're a Premium Member!</CardTitle>
            <CardDescription>
              Your {subscription.plan} plan is active
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
        className="w-full max-w-lg"
      >
        <div className="text-center mb-6">
          <Crown className="h-10 w-10 text-amber-500 mx-auto mb-2" />
          <h1 className="text-2xl font-bold">Upgrade to Premium</h1>
          {trialDaysLeft > 0 && (
            <Badge variant="secondary" className="mt-2">
              {trialDaysLeft} days left in your free trial
            </Badge>
          )}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-6">
            {/* Billing toggle */}
            <div className="flex gap-2 p-1 bg-muted rounded-lg">
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

            {/* Price */}
            <div className="text-center">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-4xl font-bold">
                  ${billingCycle === "monthly" ? "5" : "20"}
                </span>
                <span className="text-muted-foreground text-sm">
                  /{billingCycle === "monthly" ? "month" : "year"}
                </span>
              </div>
              {billingCycle === "yearly" && (
                <p className="text-xs text-muted-foreground mt-1">That's just $1.67/month</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                Charged in INR at current exchange rate
              </p>
            </div>

            {/* Features */}
            <div className="space-y-2">
              {features.map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-green-500 shrink-0" />
                  <span>{f}</span>
                </div>
              ))}
            </div>

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
                  Subscribe Now
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
              onClick={() => navigate("/")}
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
