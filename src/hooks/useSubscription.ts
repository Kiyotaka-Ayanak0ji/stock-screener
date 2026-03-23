import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface Subscription {
  plan: string;
  status: string;
  trial_ends_at: string | null;
  subscription_ends_at: string | null;
}

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
    return false;
  })();

  const trialDaysLeft = (() => {
    if (!subscription?.trial_ends_at || subscription.status !== 'trial') return 0;
    const diff = new Date(subscription.trial_ends_at).getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  })();

  return { subscription, loading, isActive, trialDaysLeft, refetch: fetchSubscription };
}
