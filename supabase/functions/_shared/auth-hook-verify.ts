// Verifies an inbound auth email webhook and normalises the payload.
//
// Two modes, chosen by which secret is present:
//
//  1. Self hosted (preferred): Supabase "Send Email" auth hook, signed with the
//     Standard Webhooks scheme. Set SEND_EMAIL_HOOK_SECRET (the `v1,whsec_...`
//     value from the auth hook configuration).
//  2. Legacy Lovable cloud: signed with LOVABLE_API_KEY. Only used when
//     SEND_EMAIL_HOOK_SECRET is absent, so existing deployments keep working.
//
// The returned shape is stable for both modes:
//   { version: '1', run_id, data: { action_type, email, new_email, url, token } }

const encoder = new TextEncoder();

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

async function hmacBase64(secret: Uint8Array, message: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', secret, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

async function verifyStandardWebhook(req: Request, rawBody: string, secret: string): Promise<void> {
  const id = req.headers.get('webhook-id');
  const timestamp = req.headers.get('webhook-timestamp');
  const signatureHeader = req.headers.get('webhook-signature');
  if (!id || !timestamp || !signatureHeader) throw new Error('Missing webhook signature headers');

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) throw new Error('Stale webhook timestamp');

  const base64Secret = secret.replace(/^v1,?/, '').replace(/^whsec_/, '');
  const keyBytes = Uint8Array.from(atob(base64Secret), (c) => c.charCodeAt(0));
  const expected = await hmacBase64(keyBytes, `${id}.${timestamp}.${rawBody}`);

  const provided = signatureHeader
    .split(' ')
    .map((part) => (part.includes(',') ? part.split(',')[1] : part));

  if (!provided.some((candidate) => timingSafeEqual(candidate, expected))) {
    throw new Error('Invalid webhook signature');
  }
}

export async function verifyAuthHookRequest(req: Request): Promise<Record<string, any>> {
  const hookSecret = Deno.env.get('SEND_EMAIL_HOOK_SECRET');

  if (hookSecret) {
    const rawBody = await req.text();
    await verifyStandardWebhook(req, rawBody, hookSecret);

    const body = JSON.parse(rawBody);
    const emailData = body.email_data ?? {};
    const siteUrl = (Deno.env.get('SITE_URL') ?? '').replace(/\/$/, '');
    const redirectTo = emailData.redirect_to ?? siteUrl;
    const verifyBase = `${Deno.env.get('SUPABASE_URL') ?? ''}/auth/v1/verify`;
    const url = emailData.token_hash
      ? `${verifyBase}?token=${emailData.token_hash}&type=${emailData.email_action_type}&redirect_to=${encodeURIComponent(redirectTo)}`
      : redirectTo;

    return {
      version: '1',
      run_id: crypto.randomUUID(),
      data: {
        action_type: emailData.email_action_type,
        email: body.user?.email,
        new_email: body.user?.new_email,
        url,
        token: emailData.token,
      },
    };
  }

  // Legacy Lovable cloud path, kept for backward compatibility.
  const apiKey = Deno.env.get('LOVABLE_API_KEY');
  if (!apiKey) throw new Error('No webhook secret configured');

  const { parseEmailWebhookPayload } = await import('npm:@lovable.dev/email-js');
  const { verifyWebhookRequest } = await import('npm:@lovable.dev/webhooks-js');
  const verified = await verifyWebhookRequest({ req, secret: apiKey, parser: parseEmailWebhookPayload });
  return verified.payload as Record<string, any>;
}
