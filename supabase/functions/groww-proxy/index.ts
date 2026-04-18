import { getUserIdFromAuthHeader } from "../_shared/auth.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const ALLOWED_EXCHANGES = new Set(["NSE", "BSE"]);
const ALLOWED_SEGMENTS = new Set(["CASH", "FNO", "EQ", "FO"]);
// Trading symbols / exchange symbols: alphanumeric, underscore, dash, dot, comma (for lists), max 200 chars total
const SYMBOL_RE = /^[A-Za-z0-9_.\-,]{1,200}$/;

function isValidSymbol(value: unknown): value is string {
  return typeof value === "string" && SYMBOL_RE.test(value);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Require an authenticated Supabase user
  const userId = await getUserIdFromAuthHeader(req.headers.get("Authorization"));
  if (!userId) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const token = Deno.env.get('GROWW_API_TOKEN');
    if (!token) {
      return new Response(JSON.stringify({ error: 'API token not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, params } = await req.json();
    if (!params || typeof params !== "object") {
      return new Response(JSON.stringify({ error: 'Invalid params' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let url: string;

    switch (action) {
      case 'quote': {
        const { exchange, segment, trading_symbol } = params as Record<string, unknown>;
        if (!ALLOWED_EXCHANGES.has(String(exchange)) || !ALLOWED_SEGMENTS.has(String(segment)) || !isValidSymbol(trading_symbol)) {
          return new Response(JSON.stringify({ error: 'Invalid quote parameters' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const u = new URL('https://api.groww.in/v1/live-data/quote');
        u.searchParams.set('exchange', String(exchange));
        u.searchParams.set('segment', String(segment));
        u.searchParams.set('trading_symbol', String(trading_symbol));
        url = u.toString();
        break;
      }
      case 'ltp': {
        const { segment, exchange_symbols } = params as Record<string, unknown>;
        if (!ALLOWED_SEGMENTS.has(String(segment)) || !isValidSymbol(exchange_symbols)) {
          return new Response(JSON.stringify({ error: 'Invalid ltp parameters' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const u = new URL('https://api.groww.in/v1/live-data/ltp');
        u.searchParams.set('segment', String(segment));
        u.searchParams.set('exchange_symbols', String(exchange_symbols));
        url = u.toString();
        break;
      }
      case 'ohlc': {
        const { segment, exchange_symbols } = params as Record<string, unknown>;
        if (!ALLOWED_SEGMENTS.has(String(segment)) || !isValidSymbol(exchange_symbols)) {
          return new Response(JSON.stringify({ error: 'Invalid ohlc parameters' }), {
            status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const u = new URL('https://api.groww.in/v1/live-data/ohlc');
        u.searchParams.set('segment', String(segment));
        u.searchParams.set('exchange_symbols', String(exchange_symbols));
        url = u.toString();
        break;
      }
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${token}`,
        'X-API-VERSION': '1.0',
      },
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('groww-proxy error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
