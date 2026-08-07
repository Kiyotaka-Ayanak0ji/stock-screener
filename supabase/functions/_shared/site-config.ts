// Central, environment driven site/email configuration.
//
// Every value falls back to the historical hard coded default so existing
// deployments keep working unchanged. Self hosted deployments override them
// with edge function secrets (see DEPLOYMENT.md).
//
//   SITE_NAME       Display name used in emails            (default: EquityIQ)
//   SITE_URL        Public base URL of the frontend
//   MAIL_FROM_DOMAIN  Domain shown in the From address
//   MAIL_SENDER_DOMAIN Verified sending subdomain
//   MAIL_FROM_ADDRESS  Local part or full address used as sender

const env = (key: string, fallback: string): string => {
  const value = Deno.env.get(key);
  return value && value.trim().length > 0 ? value.trim() : fallback;
};

export const SITE_NAME = env('SITE_NAME', 'EquityIQ');
export const SITE_URL = env('SITE_URL', 'https://calm-white-cloud.lovable.app').replace(/\/$/, '');
export const FROM_DOMAIN = env('MAIL_FROM_DOMAIN', 'stockscreener.sbs');
export const SENDER_DOMAIN = env('MAIL_SENDER_DOMAIN', 'notify.stockscreener.sbs');
export const ROOT_DOMAIN = env('MAIL_ROOT_DOMAIN', FROM_DOMAIN);
export const FROM_ADDRESS = env('MAIL_FROM_ADDRESS', `noreply@${FROM_DOMAIN}`);
export const FROM_HEADER = `${SITE_NAME} <${FROM_ADDRESS}>`;
