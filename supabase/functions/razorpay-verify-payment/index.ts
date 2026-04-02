import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.168.0/crypto/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function verifySignature(orderId: string, paymentId: string, signature: string, secret: string): Promise<boolean> {
  const body = `${orderId}|${paymentId}`;
  const key = new TextEncoder().encode(secret);
  const data = new TextEncoder().encode(body);
  const cryptoKey = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', cryptoKey, data);
  const hexSig = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return hexSig === signature;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnon = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify user with anon key
    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } }
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, amount_usd, amount_inr, payment_method, is_test } = await req.json();

    const RAZORPAY_KEY_SECRET = Deno.env.get('RAZORPAY_KEY_SECRET');
    if (!RAZORPAY_KEY_SECRET) {
      return new Response(JSON.stringify({ error: 'Razorpay not configured' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Verify payment signature
    const isValid = await verifySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature, RAZORPAY_KEY_SECRET);
    if (!isValid) {
      return new Response(JSON.stringify({ error: 'Invalid payment signature' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Use service role to update subscription
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    if (is_test) {
      // Test payment - just log success, don't activate subscription
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Test payment verified successfully! Gateway is working.',
        is_test: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const isYearly = plan === 'yearly' || plan === 'premium_yearly' || plan === 'premium_plus_yearly';
    const subscriptionEnds = new Date(Date.now() + (isYearly ? 365 : 30) * 24 * 60 * 60 * 1000);

    const { error: upsertError } = await adminClient
      .from('user_subscriptions')
      .upsert({
        user_id: user.id,
        plan,
        status: 'active',
        subscription_starts_at: new Date().toISOString(),
        subscription_ends_at: subscriptionEnds.toISOString(),
        razorpay_payment_id,
        razorpay_order_id,
        payment_method: payment_method || 'razorpay',
        amount_usd,
        amount_inr,
        trial_ends_at: null,
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error('Subscription update error:', upsertError);
      return new Response(JSON.stringify({ error: 'Failed to update subscription' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({ success: true, plan, subscription_ends_at: subscriptionEnds.toISOString() }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('Error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
