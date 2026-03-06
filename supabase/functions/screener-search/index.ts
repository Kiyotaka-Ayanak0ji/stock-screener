const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { query } = await req.json();

    if (!query || query.trim().length < 1) {
      return new Response(JSON.stringify({ results: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = `https://www.screener.in/api/company/search/?q=${encodeURIComponent(query.trim())}`;

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error('Screener API error:', response.status, text);
      return new Response(JSON.stringify({ results: [], error: 'Screener API error' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const data = await response.json();

    // Screener returns array of objects like: { id, name, url }
    // url format: "/company/RELIANCE/consolidated/" or "/company/500325/consolidated/"
    // name format: "Reliance Industries" or "Reliance Industries - BSE: 500325"
    const results = (data || []).map((item: any) => {
      const urlParts = (item.url || '').split('/');
      const ticker = urlParts[2] || '';
      
      // Determine exchange from the name or default to NSE
      let exchange: 'NSE' | 'BSE' = 'NSE';
      let name = item.name || '';
      
      if (name.includes('BSE:')) {
        exchange = 'BSE';
        name = name.split(' - BSE:')[0].trim();
      } else if (name.includes('NSE:')) {
        name = name.split(' - NSE:')[0].trim();
      }

      return {
        ticker,
        name,
        exchange,
      };
    }).filter((item: any) => item.ticker && item.name);

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search error:', error);
    return new Response(JSON.stringify({ results: [], error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
