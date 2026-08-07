// Provider agnostic email transport.
//
// EMAIL_PROVIDER selects the transport:
//   smtp    (default when SMTP_HOST is set)  fully self hosted, any SMTP server
//   resend                                    Resend HTTP API (RESEND_API_KEY)
//   http                                      generic JSON webhook (EMAIL_HTTP_URL)
//   lovable                                   legacy Lovable email API (LOVABLE_API_KEY)
//
// No provider is hard coded: a deployment without internet access can point
// SMTP_HOST at a local MTA (Mailpit, Postfix) and the pipeline works offline.

import { SMTPClient } from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

export interface OutboundEmail {
  to: string;
  from: string;
  subject: string;
  html: string;
  text?: string;
  sender_domain?: string;
  purpose?: string;
  label?: string;
  idempotency_key?: string;
  unsubscribe_token?: string;
  message_id?: string;
  run_id?: string;
}

export class EmailSendError extends Error {
  status: number;
  retryAfterSeconds: number | null;
  constructor(message: string, status = 500, retryAfterSeconds: number | null = null) {
    super(message);
    this.name = 'EmailSendError';
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

function env(key: string): string | undefined {
  const v = Deno.env.get(key);
  return v && v.trim().length > 0 ? v.trim() : undefined;
}

export function resolveProvider(): 'smtp' | 'resend' | 'http' | 'lovable' {
  const explicit = env('EMAIL_PROVIDER')?.toLowerCase();
  if (explicit === 'smtp' || explicit === 'resend' || explicit === 'http' || explicit === 'lovable') {
    return explicit;
  }
  if (env('SMTP_HOST')) return 'smtp';
  if (env('RESEND_API_KEY')) return 'resend';
  if (env('EMAIL_HTTP_URL')) return 'http';
  return 'lovable';
}

export function isEmailConfigured(): boolean {
  const provider = resolveProvider();
  if (provider === 'smtp') return Boolean(env('SMTP_HOST'));
  if (provider === 'resend') return Boolean(env('RESEND_API_KEY'));
  if (provider === 'http') return Boolean(env('EMAIL_HTTP_URL'));
  return Boolean(env('LOVABLE_API_KEY'));
}

async function sendViaSmtp(email: OutboundEmail): Promise<void> {
  const client = new SMTPClient({
    connection: {
      hostname: env('SMTP_HOST')!,
      port: Number(env('SMTP_PORT') ?? '587'),
      tls: (env('SMTP_TLS') ?? 'true') === 'true',
      auth: env('SMTP_USER')
        ? { username: env('SMTP_USER')!, password: env('SMTP_PASSWORD') ?? '' }
        : undefined,
    },
  });

  try {
    await client.send({
      from: email.from,
      to: email.to,
      subject: email.subject,
      content: email.text ?? 'This message requires an HTML capable email client.',
      html: email.html,
    });
  } finally {
    await client.close().catch(() => {});
  }
}

async function sendViaResend(email: OutboundEmail): Promise<void> {
  const res = await fetch(env('RESEND_API_URL') ?? 'https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: email.from,
      to: [email.to],
      subject: email.subject,
      html: email.html,
      text: email.text,
    }),
  });
  if (!res.ok) {
    const retryAfter = res.headers.get('Retry-After');
    throw new EmailSendError(
      `Resend responded ${res.status}: ${await res.text()}`,
      res.status,
      retryAfter ? Number(retryAfter) : null,
    );
  }
}

async function sendViaHttp(email: OutboundEmail): Promise<void> {
  const url = env('EMAIL_HTTP_URL')!;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = env('EMAIL_HTTP_TOKEN');
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(email) });
  if (!res.ok) {
    const retryAfter = res.headers.get('Retry-After');
    throw new EmailSendError(
      `Email endpoint responded ${res.status}: ${await res.text()}`,
      res.status,
      retryAfter ? Number(retryAfter) : null,
    );
  }
}

async function sendViaLovable(email: OutboundEmail): Promise<void> {
  const { sendLovableEmail } = await import('npm:@lovable.dev/email-js');
  const payload: Record<string, unknown> = { ...email };
  if (!email.run_id) delete payload.run_id;
  await sendLovableEmail(payload as never, {
    apiKey: env('LOVABLE_API_KEY')!,
    sendUrl: env('LOVABLE_SEND_URL'),
  });
}

export async function sendEmail(email: OutboundEmail): Promise<void> {
  switch (resolveProvider()) {
    case 'smtp':
      return await sendViaSmtp(email);
    case 'resend':
      return await sendViaResend(email);
    case 'http':
      return await sendViaHttp(email);
    default:
      return await sendViaLovable(email);
  }
}
