import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface Subscription {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}

export type PlanTier = "free" | "pro" | "premium" | "premium_plus";

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from("user_subscriptions")
      .select("plan, status, trial_ends_at, subscription_ends_at")
      .eq("user_id", user.id)
      .single();
    setSubscription(data as Subscription | null);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchSubscription();
  }, [fetchSubscription]);

  const isActive = (() => {
    if (!subscription) return false;
    if (subscription.status === 'active') {
      if (subscription.subscription_ends_at && new Date(subscription.subscription_ends_at) > new Date()) return true;
    }
    if (subscription.status === 'trial') {
      if (subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date()) return true;
    }
    if (subscription.status === 'lifetime') return true;
    return false;
  })();

  const trialDaysLeft = (() => {
    if (!subscription?.trial_ends_at || subscription.status !== 'trial') return 0;
    const diff = new Date(subscription.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  const planTier: PlanTier = (() => {
    if (!subscription || !isActive) return "free";
    const p = subscription.plan;
    if (p === 'premium_monthly' || p === 'premium_yearly' || p === 'yearly' || p === 'annual') return "premium";
    if (p === 'monthly' || p === 'pro_monthly' || p === 'pro_yearly') return "pro";
    // Trial users get pro-level access
    if (subscription.status === 'trial') return "pro";
    if (subscription.status === 'lifetime') return "premium";
    return "free";
  })();

  const isPro = planTier === "pro" || planTier === "premium";
  const isPremium = planTier === "premium";

  // Plan limits
  const maxWatchlists = isPremium ? 20 : isPro ? 5 : 1;
  const maxStocksPerWatchlist = isPremium ? 50 : isPro ? 20 : 20;

  return {
    subscription, loading, isActive, trialDaysLeft,
    planTier, isPro, isPremium,
    maxWatchlists, maxStocksPerWatchlist,
    refetch: fetchSubscription,
  };
}
