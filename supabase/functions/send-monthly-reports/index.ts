// Monthly activity report job.
//
// Runs on the first day of each month (pg_cron) with the service role key.
// For every user who has both `email_opt_in` and `monthly_report_opt_in`
// enabled it builds a personal account summary and enqueues one email.
// Nothing is sent to users who opted out or whose address is suppressed.

import { createClient } from 'npm:@supabase/supabase-js@2'
import * as React from 'npm:react@18.3.1'
import { renderAsync } from 'npm:@react-email/components@0.0.22'
import { MonthlyActivityReportEmail } from '../_shared/email-templates/monthly-activity-report.tsx'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SITE_NAME = 'EquityIQ'
const SENDER_DOMAIN = 'notify.stockscreener.sbs'
const FROM_DOMAIN = 'stockscreener.sbs'
const SITE_URL = 'https://calm-white-cloud.lovable.app'

const PLAN_LABELS: Record<string, string> = {
  free: 'Free',
  trial: 'Trial',
  monthly: 'Pro',
  pro_monthly: 'Pro',
  pro_yearly: 'Pro',
  premium_monthly: 'Premium',
  premium_yearly: 'Premium',
  premium_plus_monthly: 'Premium Plus',
  premium_plus_yearly: 'Premium Plus',
  lifetime: 'Lifetime',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin = createClient(supabaseUrl, serviceKey)

  // Only the service role (cron) or an admin user may trigger this job.
  const authHeader = req.headers.get('Authorization') || ''
  const token = authHeader.replace('Bearer ', '').trim()
  if (!token) {
    return json({ error: 'Unauthorized' }, 401)
  }
  if (token !== serviceKey) {
    const { data: { user } } = await admin.auth.getUser(token)
    if (!user) return json({ error: 'Unauthorized' }, 401)
    const { data: roles } = await admin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
    if (!roles) return json({ error: 'Forbidden' }, 403)
  }

  const now = new Date()
  const previous = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1))
  const period = previous.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const { data: profiles, error: profileError } = await admin
    .from('profiles')
    .select('user_id, display_name, email_opt_in, monthly_report_opt_in')
    .eq('email_opt_in', true)
    .eq('monthly_report_opt_in', true)

  if (profileError) {
    console.error('monthly-report: profile query failed', profileError)
    return json({ error: 'Failed to load recipients' }, 500)
  }

  const { data: authUsers } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  const emailById = new Map<string, string>()
  for (const u of authUsers?.users ?? []) {
    if (u.email && u.email_confirmed_at) emailById.set(u.id, u.email)
  }

  const { data: suppressedRows } = await admin.from('suppressed_emails').select('email')
  const suppressed = new Set((suppressedRows ?? []).map((r: { email: string }) => r.email))

  let sent = 0
  let skipped = 0

  for (const profile of profiles ?? []) {
    const email = emailById.get(profile.user_id)
    if (!email || suppressed.has(email)) {
      skipped++
      continue
    }

    const [watchlists, favourites, holdings, prefs, subscription] = await Promise.all([
      admin.from('user_watchlists').select('tickers').eq('user_id', profile.user_id),
      admin.from('user_favourites').select('id').eq('user_id', profile.user_id),
      admin.from('portfolio_holdings').select('id').eq('user_id', profile.user_id),
      admin.from('user_preferences').select('price_triggers').eq('user_id', profile.user_id).maybeSingle(),
      admin
        .from('user_subscriptions')
        .select('plan, status')
        .eq('user_id', profile.user_id)
        .maybeSingle(),
    ])

    const tickerSet = new Set<string>()
    for (const w of watchlists.data ?? []) {
      for (const t of ((w.tickers as string[]) ?? [])) tickerSet.add(t)
    }

    // Skip users with no activity at all, an empty report is noise.
    if (tickerSet.size === 0 && (favourites.data?.length ?? 0) === 0) {
      skipped++
      continue
    }

    const triggers = (prefs.data?.price_triggers ?? {}) as Record<string, unknown>
    const priceTriggerCount = Object.keys(triggers).length

    let movers: Array<{ ticker: string; price: number; changePercent: number }> = []
    if (tickerSet.size > 0) {
      const { data: prices } = await admin
        .from('cached_stock_prices')
        .select('ticker, price, change_percent')
        .in('ticker', Array.from(tickerSet).slice(0, 100))
      movers = (prices ?? [])
        .filter((p: { price: number | null }) => typeof p.price === 'number' && p.price > 0)
        .map((p: { ticker: string; price: number; change_percent: number | null }) => ({
          ticker: p.ticker,
          price: Number(p.price),
          changePercent: Number(p.change_percent ?? 0),
        }))
        .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent))
    }

    const props = {
      displayName: profile.display_name || email.split('@')[0],
      period,
      watchlistCount: watchlists.data?.length ?? 0,
      trackedTickers: tickerSet.size,
      favouriteCount: favourites.data?.length ?? 0,
      priceTriggerCount,
      holdingCount: holdings.data?.length ?? 0,
      plan: PLAN_LABELS[subscription.data?.plan ?? 'free'] ?? 'Free',
      movers,
      siteUrl: SITE_URL,
    }

    const html = await renderAsync(React.createElement(MonthlyActivityReportEmail, props))
    const text = await renderAsync(React.createElement(MonthlyActivityReportEmail, props), { plainText: true })
    const messageId = crypto.randomUUID()

    // Reuse (or mint) the recipient's unsubscribe token.
    let unsubscribeToken: string | null = null
    const { data: existingToken } = await admin
      .from('email_unsubscribe_tokens')
      .select('token')
      .eq('email', email)
      .maybeSingle()
    if (existingToken) {
      unsubscribeToken = existingToken.token
    } else {
      const newToken = crypto.randomUUID()
      const { error } = await admin.from('email_unsubscribe_tokens').insert({ email, token: newToken })
      if (!error) unsubscribeToken = newToken
    }

    await admin.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'monthly_activity_report',
      recipient_email: email,
      status: 'pending',
    })

    const { error: enqueueError } = await admin.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: `Your EquityIQ activity report, ${period}`,
        html,
        text,
        purpose: 'transactional',
        label: 'monthly_activity_report',
        // One report per recipient per period, replays are ignored downstream.
        idempotency_key: `monthly_activity_report-${profile.user_id}-${period}`,
        unsubscribe_token: unsubscribeToken,
        queued_at: new Date().toISOString(),
      },
    })

    if (enqueueError) {
      console.error('monthly-report: enqueue failed', { user: profile.user_id, error: enqueueError })
      skipped++
    } else {
      sent++
    }
  }

  console.log(`monthly-report: period=${period} queued=${sent} skipped=${skipped}`)
  return json({ success: true, period, queued: sent, skipped })
})

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
