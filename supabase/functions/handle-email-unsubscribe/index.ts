import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = await req.json();

    // ── Re-subscribe flow (called from Profile page) ──
    if (body.action === "resubscribe" && body.user_id) {
      // Verify the caller is the same user (check auth header)
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: { user }, error: authError } = await createClient(
        supabaseUrl,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      ).auth.getUser();

      if (authError || !user || user.id !== body.user_id) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const email = user.email;
      if (!email) {
        return new Response(JSON.stringify({ error: "No email found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Remove from suppressed emails
      await supabase.from("suppressed_emails").delete().eq("email", email);

      // Reset unsubscribe token (clear used_at so the link works again if they unsubscribe later)
      await supabase
        .from("email_unsubscribe_tokens")
        .update({ used_at: null })
        .eq("email", email);

      return new Response(
        JSON.stringify({ success: true, message: "Successfully re-subscribed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Unsubscribe flow ──
    const { token } = body;

    if (!token) {
      return new Response(JSON.stringify({ error: "Token is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up the token
    const { data: tokenRecord, error: lookupError } = await supabase
      .from("email_unsubscribe_tokens")
      .select("*")
      .eq("token", token)
      .single();

    if (lookupError || !tokenRecord) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validation only (no confirm flag)
    if (!body.confirm) {
      return new Response(
        JSON.stringify({
          valid: true,
          alreadyUnsubscribed: !!tokenRecord.used_at,
          email: tokenRecord.email,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Already unsubscribed
    if (tokenRecord.used_at) {
      return new Response(
        JSON.stringify({ alreadyUnsubscribed: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mark token as used
    await supabase
      .from("email_unsubscribe_tokens")
      .update({ used_at: new Date().toISOString() })
      .eq("id", tokenRecord.id);

    // Add to suppressed emails
    await supabase.from("suppressed_emails").upsert(
      {
        email: tokenRecord.email,
        reason: "unsubscribe",
        metadata: { token, unsubscribed_at: new Date().toISOString() },
      },
      { onConflict: "email" }
    );

    // Also update user profile email_opt_in = false
    const { data: authUsers } = await supabase.auth.admin.listUsers();
    const matchingUser = authUsers?.users?.find(
      (u: any) => u.email === tokenRecord.email
    );
    if (matchingUser) {
      await supabase
        .from("profiles")
        .update({ email_opt_in: false })
        .eq("user_id", matchingUser.id);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Successfully unsubscribed" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
