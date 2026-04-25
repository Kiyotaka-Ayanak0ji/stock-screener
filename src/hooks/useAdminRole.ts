import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

// Module-level dedup so multiple components calling this hook share one
// network request (Header + BottomNav + page-level checks all mount together).
const adminCache = new Map<string, boolean>();
const inflight = new Map<string, Promise<boolean>>();
type Listener = (v: boolean) => void;
const listeners = new Map<string, Set<Listener>>();

async function checkAdminShared(userId: string): Promise<boolean> {
  if (adminCache.has(userId)) return adminCache.get(userId)!;
  const existing = inflight.get(userId);
  if (existing) return existing;
  const promise = (async () => {
    const { data } = await supabase
      .from("user_roles" as any)
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    const isAdmin = !!data;
    adminCache.set(userId, isAdmin);
    listeners.get(userId)?.forEach((l) => l(isAdmin));
    return isAdmin;
  })().finally(() => {
    inflight.delete(userId);
  });
  inflight.set(userId, promise);
  return promise;
}

export function useAdminRole() {
  const { user } = useAuth();
  const cached = user ? adminCache.get(user.id) : undefined;
  const [isAdmin, setIsAdmin] = useState(cached ?? false);
  const [loading, setLoading] = useState(cached === undefined && !!user);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const set = listeners.get(user.id) ?? new Set<Listener>();
    const listener: Listener = (v) => {
      setIsAdmin(v);
      setLoading(false);
    };
    set.add(listener);
    listeners.set(user.id, set);

    checkAdminShared(user.id).then((v) => {
      setIsAdmin(v);
      setLoading(false);
    });

    return () => {
      set.delete(listener);
      if (set.size === 0) listeners.delete(user.id);
    };
  }, [user]);

  return { isAdmin, loading };
}
