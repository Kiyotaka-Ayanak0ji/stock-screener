const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const BASE_URL = 'https://military-jobye-haiqstudios-14f59639.koyeb.app';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { symbols } = await req.json();

    if (!symbols || !Array.isArray(symbols) || symbols.length === 0) {
      return new Response(JSON.stringify({ error: 'symbols array required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Build comma-separated symbols: RELIANCE.NS, ADANIPOWER.BO
    const symbolList = symbols.map((s: { ticker: string; exchange: string }) => {
      const suffix = s.exchange === 'BSE' ? '.BO' : '.NS';
      return `${s.ticker}${suffix}`;
    }).join(',');

    const url = `${BASE_URL}/stock/${symbolList}`;

    const response = await fetch(url, {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Stock API error:', response.status, text);
      return new Response(JSON.stringify({ error: 'Stock API error', status: response.status }), {
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // The API returns an array of stock objects or a single object
    const stocksArray = Array.isArray(data) ? data : [data];

    // Transform to our keyed format: { "NSE_RELIANCE": { ltp, open, high, low, close, volume } }
    const result: Record<string, Record<string, number>> = {};

    for (const stock of stocksArray) {
      if (!stock || stock.error) continue;

      const symbol = stock.symbol || '';
      const isBSE = symbol.endsWith('.BO');
      const ticker = symbol.replace(/\.(NS|BO)$/, '');
      const exchange = isBSE ? 'BSE' : 'NSE';
      const key = `${exchange}_${ticker}`;

      result[key] = {
        ltp: parseFloat(stock.price) || parseFloat(stock.current_price) || parseFloat(stock.ltp) || 0,
        open: parseFloat(stock.open) || 0,
        high: parseFloat(stock.high) || parseFloat(stock.day_high) || 0,
        low: parseFloat(stock.low) || parseFloat(stock.day_low) || 0,
        close: parseFloat(stock.previous_close) || parseFloat(stock.prev_close) || 0,
        volume: parseInt(stock.volume) || 0,
      };
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Stock proxy error:', error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
