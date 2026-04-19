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

const CACHE_KEY_PREFIX = "el_sub_cache_v1:";
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12h — re-validated in background

interface CachedEntry {
  subscription: Subscription | null;
  cachedAt: number;
}

function readCache(userId: string): CachedEntry | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY_PREFIX + userId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedEntry;
    if (!parsed || typeof parsed.cachedAt !== "number") return null;
    if (Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(userId: string, subscription: Subscription | null) {
  try {
    const entry: CachedEntry = { subscription, cachedAt: Date.now() };
    localStorage.setItem(CACHE_KEY_PREFIX + userId, JSON.stringify(entry));
  } catch {
    /* ignore quota errors */
  }
}

export function useSubscription() {
  const { user } = useAuth();

  // Hydrate from localStorage synchronously so returning Lifetime / Premium
  // users never see the SubscriptionGate flash on initial load.
  const initialCached = user ? readCache(user.id) : null;

  const [subscription, setSubscription] = useState<Subscription | null>(
    initialCached?.subscription ?? null,
  );
  // If we already have a fresh cached entry, skip the loading state entirely.
  const [loading, setLoading] = useState(!initialCached);

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
    const next = (data as Subscription | null) ?? null;
    setSubscription(next);
    writeCache(user.id, next);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) {
      setSubscription(null);
      setLoading(false);
      return;
    }
    // Re-hydrate from cache when user changes (e.g. after sign-in)
    const cached = readCache(user.id);
    if (cached) {
      setSubscription(cached.subscription);
      setLoading(false);
    }
    // Always re-validate in background so changes are picked up
    fetchSubscription();
  }, [user, fetchSubscription]);

  const isActive = (() => {
    if (!subscription) return false;
    // Lifetime plan is always active regardless of dates
    if (subscription.plan === 'lifetime') return true;
    if (subscription.status === 'lifetime') return true;
    if (subscription.status === 'active') {
      // Active with no end date (e.g. lifetime) is always active
      if (!subscription.subscription_ends_at) return true;
      if (new Date(subscription.subscription_ends_at) > new Date()) return true;
    }
    if (subscription.status === 'trial') {
      if (subscription.trial_ends_at && new Date(subscription.trial_ends_at) > new Date()) return true;
    }
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
    if (p === 'premium_plus_monthly' || p === 'premium_plus_yearly' || p === 'lifetime') return "premium_plus";
    if (p === 'premium_monthly' || p === 'premium_yearly' || p === 'yearly' || p === 'annual') return "premium";
    if (p === 'monthly' || p === 'pro_monthly' || p === 'pro_yearly') return "pro";
    // Trial users get pro-level access
    if (subscription.status === 'trial') return "pro";
    if (subscription.status === 'lifetime') return "premium_plus";
    return "free";
  })();

  const isPremiumPlus = planTier === "premium_plus";
  const isPro = planTier === "pro" || planTier === "premium" || isPremiumPlus;
  const isPremium = planTier === "premium" || isPremiumPlus;

  // Plan limits
  const maxWatchlists = isPremiumPlus ? Infinity : isPremium ? 20 : isPro ? 5 : 1;
  const maxStocksPerWatchlist = isPremiumPlus ? Infinity : isPremium ? 50 : isPro ? 20 : 20;

  return {
    subscription, loading, isActive, trialDaysLeft,
    planTier, isPro, isPremium, isPremiumPlus,
    maxWatchlists, maxStocksPerWatchlist,
    refetch: fetchSubscription,
  };
}
