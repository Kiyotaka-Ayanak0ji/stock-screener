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
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 404,
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
