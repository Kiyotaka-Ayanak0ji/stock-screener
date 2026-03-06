const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
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

    let url: string;

    switch (action) {
      case 'quote': {
        const { exchange, segment, trading_symbol } = params;
        url = `https://api.groww.in/v1/live-data/quote?exchange=${exchange}&segment=${segment}&trading_symbol=${trading_symbol}`;
        break;
      }
      case 'ltp': {
        const { segment, exchange_symbols } = params;
        url = `https://api.groww.in/v1/live-data/ltp?segment=${segment}&exchange_symbols=${exchange_symbols}`;
        break;
      }
      case 'ohlc': {
        const { segment, exchange_symbols } = params;
        url = `https://api.groww.in/v1/live-data/ohlc?segment=${segment}&exchange_symbols=${exchange_symbols}`;
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
