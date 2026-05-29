import { useEffect } from "react";
import BottomNav from "@/components/BottomNav";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Crown, Calendar, CreditCard, Loader2, Sparkles, CheckCircle2, Clock, AlertTriangle, ArrowUpRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

const PLAN_LABELS: Record<string, string> = {
  free: "Free",
  monthly: "Pro Monthly",
  yearly: "Pro Yearly",
  pro_monthly: "Pro Monthly",
  pro_yearly: "Pro Yearly",
  premium_monthly: "Premium Monthly",
  premium_yearly: "Premium Yearly",
  premium_plus_monthly: "Premium Plus Monthly",
  premium_plus_yearly: "Premium Plus Yearly",
  lifetime: "Lifetime",
};

const formatDate = (s?: string | null) =>
  s ? new Date(s).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "—";

const ProfileSubscription = () => {
  const { user } = useAuth();
  const { subscription, loading, isActive, trialDaysLeft, planTier, isPremiumPlus, isPremium, isPro } = useSubscription();
  const navigate = useNavigate();

  useEffect(() => { if (!user) navigate("/auth"); }, [user, navigate]);

  if (loading) {
    return <div className="min-h-screen bg-background flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const planLabel = subscription ? (PLAN_LABELS[subscription.plan] || subscription.plan) : "Free";
  const status = subscription?.status || "free";
  const isTrial = status === "trial";
  const isLifetime = subscription?.plan === "lifetime" || status === "lifetime";

  const statusBadge = isLifetime ? (
    <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0"><Crown className="h-3 w-3 mr-1" /> Lifetime</Badge>
  ) : isActive ? (
    <Badge className="bg-gain/15 text-gain border-0"><CheckCircle2 className="h-3 w-3 mr-1" /> Active</Badge>
  ) : isTrial && trialDaysLeft > 0 ? (
    <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0"><Clock className="h-3 w-3 mr-1" /> Trial</Badge>
  ) : (
    <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" /> Inactive</Badge>
  );

  return (
    <div className="min-h-screen bg-background pb-bottom-nav">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        <Button variant="ghost" onClick={() => navigate("/profile")} className="mb-4 sm:mb-6 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Profile
        </Button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }} className="space-y-5">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground mb-1">My Subscription</h1>
            <p className="text-muted-foreground text-sm">View your current plan and manage your subscription</p>
          </div>

          {/* Current Plan */}
          <Card className={`shadow-sm hover:shadow-md transition-shadow ${isPremiumPlus || isLifetime ? "border-primary/40 bg-gradient-to-br from-primary/5 to-amber-500/5" : "border-border"}`}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <CardTitle className="flex items-center gap-2 text-foreground text-base">
                    <div className="p-1.5 rounded-lg bg-primary/10"><Crown className="h-4 w-4 text-primary" /></div>
                    Current Plan
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">Your active subscription tier</CardDescription>
                </div>
                {statusBadge}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-bold text-foreground">{planLabel}</span>
                <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">{planTier.replace("_", " ")}</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                {isTrial && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Clock className="h-3.5 w-3.5" /> Trial Ends</div>
                    <div className="text-sm font-medium text-foreground">{formatDate(subscription?.trial_ends_at)}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{trialDaysLeft > 0 ? `${trialDaysLeft} day${trialDaysLeft === 1 ? "" : "s"} left` : "Expired"}</div>
                  </div>
                )}
                {!isLifetime && subscription?.subscription_starts_at && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Calendar className="h-3.5 w-3.5" /> Started</div>
                    <div className="text-sm font-medium text-foreground">{formatDate(subscription.subscription_starts_at)}</div>
                  </div>
                )}
                {!isLifetime && subscription?.subscription_ends_at && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><Calendar className="h-3.5 w-3.5" /> Renews / Expires</div>
                    <div className="text-sm font-medium text-foreground">{formatDate(subscription.subscription_ends_at)}</div>
                  </div>
                )}
                {subscription?.payment_method && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><CreditCard className="h-3.5 w-3.5" /> Payment Method</div>
                    <div className="text-sm font-medium text-foreground capitalize">{subscription.payment_method}</div>
                  </div>
                )}
                {(subscription?.amount_usd || subscription?.amount_inr) && (
                  <div className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1"><CreditCard className="h-3.5 w-3.5" /> Last Paid</div>
                    <div className="text-sm font-medium text-foreground">
                      {subscription.amount_usd ? `$${subscription.amount_usd}` : `₹${subscription.amount_inr}`}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Manage / Upgrade actions */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-foreground text-base">
                <div className="p-1.5 rounded-lg bg-primary/10"><Sparkles className="h-4 w-4 text-primary" /></div>
                Manage Subscription
              </CardTitle>
              <CardDescription className="text-xs">
                {isLifetime
                  ? "You have lifetime access — no further action needed."
                  : isPremiumPlus
                  ? "You're on the highest tier. Renew or extend anytime."
                  : "Upgrade to unlock more watchlists, alerts, and Premium Plus features."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {!isLifetime && (
                <Button onClick={() => navigate("/subscribe")} className="w-full active:scale-[0.98] transition-all">
                  <ArrowUpRight className="mr-2 h-4 w-4" />
                  {isActive ? (isPremiumPlus ? "Renew / Extend Plan" : "Upgrade Plan") : "Choose a Plan"}
                </Button>
              )}
              <Button variant="outline" onClick={() => navigate("/subscribe")} className="w-full active:scale-[0.98] transition-all">
                Compare All Plans
              </Button>
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                Payments are processed securely via Razorpay. Subscriptions don't auto-renew — you choose when to extend.
              </p>
            </CardContent>
          </Card>

          {/* Tier summary */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-foreground text-base">What You Get</CardTitle>
              <CardDescription className="text-xs">Your current plan benefits</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-foreground space-y-2">
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-gain mt-0.5 shrink-0" /> {isPremiumPlus ? "50" : isPremium ? "20" : isPro ? "5" : "1"} watchlist{(isPremiumPlus || isPremium || isPro) ? "s" : ""}</li>
                <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-gain mt-0.5 shrink-0" /> {isPremiumPlus ? "100" : isPremium ? "50" : "20"} stocks per watchlist</li>
                {isPro && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-gain mt-0.5 shrink-0" /> Price alerts & email notifications</li>}
                {isPremium && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-gain mt-0.5 shrink-0" /> Portfolio dashboard & smart alerts</li>}
                {isPremiumPlus && <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 text-gain mt-0.5 shrink-0" /> Auto-refresh on load & priority data</li>}
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
      <BottomNav />
    </div>
  );
};

export default ProfileSubscription;
