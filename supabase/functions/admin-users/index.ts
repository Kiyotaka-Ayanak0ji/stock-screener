import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify the caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check admin role
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (req.method === "GET" && action === "list") {
      // List all users from auth
      const { data: { users }, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
      if (error) throw error;

      // Get profiles
      const { data: profiles } = await supabaseAdmin.from("profiles").select("user_id, display_name, email_opt_in, created_at");
      const { data: subscriptions } = await supabaseAdmin.from("user_subscriptions").select("user_id, plan, status, trial_ends_at, subscription_ends_at");
      const { data: watchlists } = await supabaseAdmin.from("user_watchlists").select("user_id, id");
      const { data: preferences } = await supabaseAdmin.from("user_preferences").select("user_id, updated_at");
      const { data: roles } = await supabaseAdmin.from("user_roles").select("user_id, role").eq("role", "admin");

      const profileMap = new Map((profiles || []).map(p => [p.user_id, p]));
      const subMap = new Map((subscriptions || []).map(s => [s.user_id, s]));
      const watchlistCounts = new Map<string, number>();
      (watchlists || []).forEach(w => {
        watchlistCounts.set(w.user_id, (watchlistCounts.get(w.user_id) || 0) + 1);
      });
      const prefMap = new Map((preferences || []).map(p => [p.user_id, p]));
      const adminSet = new Set((roles || []).map(r => r.user_id));

      const enrichedUsers = users.map(u => {
        const profile = profileMap.get(u.id);
        const sub = subMap.get(u.id);
        const pref = prefMap.get(u.id);
        const isAdmin = adminSet.has(u.id);
        return {
          id: u.id,
          email: u.email,
          display_name: profile?.display_name || null,
          email_confirmed_at: u.email_confirmed_at,
          created_at: u.created_at,
          last_sign_in_at: u.last_sign_in_at,
          email_opt_in: profile?.email_opt_in ?? false,
          // Surface "admin" as a synthetic plan so the UI can show + select it.
          subscription_plan: isAdmin ? "admin" : (sub?.plan || "free"),
          subscription_status: sub?.status || "none",
          is_admin: isAdmin,
          trial_ends_at: sub?.trial_ends_at || null,
          subscription_ends_at: sub?.subscription_ends_at || null,
          watchlist_count: watchlistCounts.get(u.id) || 0,
          last_active: pref?.updated_at || u.last_sign_in_at || u.created_at,
        };
      });

      return new Response(JSON.stringify({ users: enrichedUsers }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && action === "delete") {
      const { userId } = await req.json();
      if (!userId || userId === user.id) {
        return new Response(JSON.stringify({ error: "Invalid user ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (req.method === "POST" && action === "update-subscription") {
      const { userId, plan, status } = await req.json();
      if (!userId) {
        return new Response(JSON.stringify({ error: "Invalid user ID" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const validPlans = [
        "free",
        "monthly", "pro_monthly", "pro_yearly",
        "premium_monthly", "premium_yearly",
        "premium_plus_monthly", "premium_plus_yearly",
        "lifetime",
        "admin",
      ];
      const validStatuses = ["trial", "active", "expired", "cancelled", "lifetime"];
      if (!validPlans.includes(plan) || !validStatuses.includes(status)) {
        return new Response(JSON.stringify({ error: "Invalid plan or status" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      // === Special handling: ADMIN ===
      // Admin = full feature access (mapped to premium_plus_yearly + active) PLUS user_roles.admin entry.
      if (plan === "admin") {
        // Grant admin role (idempotent)
        const { data: existingRole } = await supabaseAdmin
          .from("user_roles")
          .select("id")
          .eq("user_id", userId)
          .eq("role", "admin")
          .maybeSingle();
        if (!existingRole) {
          const { error: roleErr } = await supabaseAdmin
            .from("user_roles")
            .insert({ user_id: userId, role: "admin" });
          if (roleErr) throw roleErr;
        }

        // Give them top-tier subscription so feature gates pass everywhere.
        const { error: subErr } = await supabaseAdmin
          .from("user_subscriptions")
          .update({
            plan: "premium_plus_yearly",
            status: "active",
            subscription_starts_at: new Date().toISOString(),
            subscription_ends_at: null,
            trial_ends_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("user_id", userId);
        if (subErr) throw subErr;

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // For any non-admin plan change, revoke admin role if present.
      // (Lifetime users explicitly do NOT receive admin privileges.)
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", "admin");

      const updateData: Record<string, unknown> = { plan, status, updated_at: new Date().toISOString() };

      const monthlyPlans = ["monthly", "pro_monthly", "premium_monthly", "premium_plus_monthly"];
      const yearlyPlans = ["pro_yearly", "premium_yearly", "premium_plus_yearly"];

      if (status === "active" && plan !== "lifetime") {
        const now = new Date();
        updateData.subscription_starts_at = now.toISOString();
        if (monthlyPlans.includes(plan)) {
          updateData.subscription_ends_at = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();
        } else if (yearlyPlans.includes(plan)) {
          updateData.subscription_ends_at = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000).toISOString();
        }
      }
      if (plan === "lifetime") {
        updateData.subscription_ends_at = null;
        updateData.trial_ends_at = null;
      }

      const { error } = await supabaseAdmin
        .from("user_subscriptions")
        .update(updateData)
        .eq("user_id", userId);

      if (error) throw error;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("admin-users error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
