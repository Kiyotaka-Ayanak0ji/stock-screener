import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { createClient } from 'npm:@supabase/supabase-js@2'
import { WelcomeEmail } from '../_shared/email-templates/welcome.tsx'
import { PriceTriggerDigestEmail } from '../_shared/email-templates/price-trigger-digest.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SITE_NAME = 'EquityLens'
const SENDER_DOMAIN = 'notify.stockscreener.sbs'
const FROM_DOMAIN = 'stockscreener.sbs'
const SITE_URL = 'https://calm-white-cloud.lovable.app'

const EMAIL_TEMPLATES: Record<string, { component: React.ComponentType<any>; subject: (props: any) => string }> = {
  welcome: {
    component: WelcomeEmail,
    subject: () => 'Welcome to EquityLens! 📈',
  },
  price_trigger_digest: {
    component: PriceTriggerDigestEmail,
    subject: (props: any) =>
      `🔔 ${props.alerts?.length || 1} price trigger${(props.alerts?.length || 1) > 1 ? 's' : ''} hit`,
  },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

  // Accept calls from authenticated users or service role
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey)
  const token = authHeader.slice('Bearer '.length).trim()

  // Verify the user's JWT
  const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token)
  if (authError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  let body: any
  try {
    body = await req.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  const { template, props, to } = body
  const recipientEmail = to || user.email

  if (!template || !EMAIL_TEMPLATES[template]) {
    return new Response(JSON.stringify({ error: `Unknown template: ${template}` }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  if (!recipientEmail) {
    return new Response(JSON.stringify({ error: 'No recipient email' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // Check suppression list
  const { data: suppressed } = await supabaseAuth
    .from('suppressed_emails')
    .select('id')
    .eq('email', recipientEmail)
    .maybeSingle()

  if (suppressed) {
    return new Response(JSON.stringify({ skipped: true, reason: 'suppressed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  // For non-critical templates (e.g. price alerts, digests), respect email_opt_in preference
  const NON_CRITICAL_TEMPLATES = ['price_trigger_digest']
  if (NON_CRITICAL_TEMPLATES.includes(template)) {
    // Find the user by email and check their opt-in preference
    const { data: authUsers } = await supabaseAuth.auth.admin.listUsers()
    const matchingUser = authUsers?.users?.find((u: any) => u.email === recipientEmail)
    if (matchingUser) {
      const { data: profileData } = await supabaseAuth
        .from('profiles')
        .select('email_opt_in')
        .eq('user_id', matchingUser.id)
        .maybeSingle()
      if (profileData && profileData.email_opt_in === false) {
        return new Response(JSON.stringify({ skipped: true, reason: 'opted_out' }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }
  }

  const { component: EmailComponent, subject: getSubject } = EMAIL_TEMPLATES[template]
  const templateProps = { ...props, siteUrl: SITE_URL }

  const html = await renderAsync(React.createElement(EmailComponent, templateProps))
  const text = await renderAsync(React.createElement(EmailComponent, templateProps), { plainText: true })
  const subject = getSubject(templateProps)

  const messageId = crypto.randomUUID()

  // Get or create unsubscribe token for this recipient
  let unsubscribeToken: string | null = null
  const { data: existingToken } = await supabaseAuth
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', recipientEmail)
    .maybeSingle()

  if (existingToken) {
    unsubscribeToken = existingToken.token
  } else {
    const newToken = crypto.randomUUID()
    const { error: tokenError } = await supabaseAuth
      .from('email_unsubscribe_tokens')
      .insert({ email: recipientEmail, token: newToken })
    if (!tokenError) {
      unsubscribeToken = newToken
    }
  }

  // Log pending
  await supabaseAuth.from('email_send_log').insert({
    message_id: messageId,
    template_name: template,
    recipient_email: recipientEmail,
    status: 'pending',
  })

  const idempotencyKey = body.idempotencyKey || `${template}-${messageId}`

  // Enqueue for async sending
  const { error: enqueueError } = await supabaseAuth.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: recipientEmail,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: 'transactional',
      label: template,
      idempotency_key: idempotencyKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  })

  if (enqueueError) {
    console.error('Failed to enqueue transactional email', { error: enqueueError, template })
    return new Response(JSON.stringify({ error: 'Failed to enqueue email' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ success: true, messageId }), {
    status: 200,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
})
