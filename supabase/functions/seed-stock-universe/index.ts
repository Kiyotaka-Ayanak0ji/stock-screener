// Bulk-seed the full Indian stock universe (NSE + BSE + SME) into cached_stock_prices.
//
// Operates in two modes:
//   action=ingest   → fetches the master ticker lists from NSE and BSE and upserts
//                     them into stock_universe (one-time / weekly refresh).
//   action=process  → picks the next chunk of tickers (oldest last_seeded_at first),
//                     fetches their prices via stock-proxy, upserts into
//                     cached_stock_prices, updates progress + last_status.
//
// Designed to be invoked by pg_cron every ~5 min to spread ~7500 tickers across 24h.
// Public endpoint — input is a fixed action keyword, no untrusted SQL.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CHUNK_SIZE = 40;            // tickers per invocation (Yahoo batch sweet-spot)
const PROXY_TIMEOUT_MS = 25000;   // overall stock-proxy call ceiling
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// ---------------------------------------------------------------------------
// Universe ingestion sources
// ---------------------------------------------------------------------------

interface UniverseRow {
  ticker: string;
  exchange: "NSE" | "BSE";
  segment: "MAIN" | "SME";
  name?: string;
  bse_code?: string;
}

// NSE — public CSV listings of all equities and SME stocks.
async function fetchNseUniverse(): Promise<UniverseRow[]> {
  const out: UniverseRow[] = [];
  const sources: { url: string; segment: "MAIN" | "SME" }[] = [
    { url: "https://archives.nseindia.com/content/equities/EQUITY_L.csv", segment: "MAIN" },
    { url: "https://archives.nseindia.com/emerge/corporates/content/SME_EQUITY_L.csv", segment: "SME" },
  ];
  for (const s of sources) {
    try {
      const res = await fetch(s.url, {
        headers: { "User-Agent": UA, Accept: "text/csv,*/*" },
      });
      if (!res.ok) { console.log(`NSE ${s.segment} list HTTP ${res.status}`); continue; }
      const csv = await res.text();
      const lines = csv.split(/\r?\n/).slice(1); // skip header
      for (const line of lines) {
        if (!line.trim()) continue;
        const cols = line.split(",");
        const symbol = (cols[0] || "").trim();
        const name = (cols[1] || "").trim();
        if (!symbol || !/^[A-Za-z0-9_\-.]{1,30}$/.test(symbol)) continue;
        out.push({ ticker: symbol, exchange: "NSE", segment: s.segment, name });
      }
      console.log(`NSE ${s.segment}: ${out.length} cumulative rows`);
    } catch (err) {
      console.error(`NSE ${s.segment} fetch failed:`, (err as Error).message);
    }
  }
  return out;
}

// BSE — uses the all-equities JSON endpoint (public).
async function fetchBseUniverse(): Promise<UniverseRow[]> {
  const out: UniverseRow[] = [];
  try {
    const res = await fetch(
      "https://api.bseindia.com/BseIndiaAPI/api/ListofScripData/w?Group=&Scripcode=&industry=&segment=Equity&status=Active",
      { headers: { "User-Agent": UA, Accept: "application/json" } },
    );
    if (!res.ok) { console.log(`BSE list HTTP ${res.status}`); return out; }
    const json = await res.json();
    const arr = Array.isArray(json) ? json : (json?.Table || []);
    for (const r of arr) {
      const symbol = String(r?.scrip_id || r?.SCRIP_ID || "").trim().toUpperCase();
      const code = String(r?.SCRIP_CD || r?.scrip_cd || "").trim();
      const name = String(r?.scrip_name || r?.SCRIP_NAME || "").trim();
      const group = String(r?.GROUP || r?.group || "").trim().toUpperCase();
      if (!symbol || !/^[A-Za-z0-9_\-.]{1,30}$/.test(symbol)) continue;
      const segment: "MAIN" | "SME" = group.includes("SME") || group === "M" || group === "MS" ? "SME" : "MAIN";
      out.push({ ticker: symbol, exchange: "BSE", segment, name, bse_code: code || undefined });
    }
    console.log(`BSE: ${out.length} rows`);
  } catch (err) {
    console.error("BSE fetch failed:", (err as Error).message);
  }
  return out;
}

async function ingestUniverse(sb: ReturnType<typeof createClient>) {
  const [nse, bse] = await Promise.all([fetchNseUniverse(), fetchBseUniverse()]);
  const all = [...nse, ...bse];
  if (all.length === 0) return { inserted: 0, total: 0 };

  // Upsert in batches of 500.
  let inserted = 0;
  for (let i = 0; i < all.length; i += 500) {
    const batch = all.slice(i, i + 500);
    const { error } = await sb
      .from("stock_universe")
      .upsert(batch, { onConflict: "ticker,exchange", ignoreDuplicates: false });
    if (error) {
      console.error("universe upsert error:", error.message);
    } else {
      inserted += batch.length;
    }
  }
  // Refresh total in progress.
  const { count } = await sb
    .from("stock_universe")
    .select("*", { count: "exact", head: true });
  await sb.from("seed_job_progress").update({
    total: count ?? all.length,
    cycle_started_at: new Date().toISOString(),
    status: "running",
  }).eq("id", 1);

  return { inserted, total: count ?? all.length };
}

// ---------------------------------------------------------------------------
// Process one chunk
// ---------------------------------------------------------------------------

interface UniversePick {
  id: number;
  ticker: string;
  exchange: "NSE" | "BSE";
}

async function processChunk(sb: ReturnType<typeof createClient>) {
  // Pick the oldest-seeded chunk (NULL first).
  const { data: picks, error } = await sb
    .from("stock_universe")
    .select("id, ticker, exchange")
    .order("last_seeded_at", { ascending: true, nullsFirst: true })
    .limit(CHUNK_SIZE);

  if (error) throw error;
  const rows = (picks ?? []) as UniversePick[];
  if (rows.length === 0) {
    await sb.from("seed_job_progress").update({
      status: "idle",
      last_chunk_at: new Date().toISOString(),
    }).eq("id", 1);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  // Call stock-proxy in one batch.
  const symbolsBody = rows.map((r) => ({ ticker: r.ticker, exchange: r.exchange }));
  const proxyUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/stock-proxy`;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";

  let proxyData: Record<string, Record<string, number>> = {};
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), PROXY_TIMEOUT_MS);
    const r = await fetch(proxyUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON}`,
        apikey: ANON,
      },
      body: JSON.stringify({ symbols: symbolsBody }),
      signal: ctrl.signal,
    });
    clearTimeout(t);
    if (r.ok) {
      proxyData = await r.json();
    } else {
      console.error("stock-proxy returned", r.status);
    }
  } catch (err) {
    console.error("stock-proxy call failed:", (err as Error).message);
  }

  // Build cached_stock_prices upserts + universe status updates.
  const now = new Date().toISOString();
  const priceRows: Record<string, unknown>[] = [];
  const okIds: number[] = [];
  const failIds: number[] = [];

  for (const r of rows) {
    const key = `${r.exchange}_${r.ticker}`;
    const q = proxyData[key];
    if (!q || !q.ltp || q.ltp <= 0) {
      failIds.push(r.id);
      continue;
    }
    const price = Number(q.ltp);
    const prev = Number(q.close ?? price);
    const change = Math.round((price - prev) * 100) / 100;
    const changePct = prev > 0 ? Math.round((change / prev) * 10000) / 100 : 0;
    priceRows.push({
      ticker: r.ticker,
      exchange: r.exchange,
      name: r.ticker,
      price,
      previous_close: prev,
      change,
      change_percent: changePct,
      high: Number(q.high ?? price),
      low: Number(q.low ?? price),
      open_price: Number(q.open ?? price),
      volume: Math.max(0, Math.floor(Number(q.volume ?? 0))),
      market_cap: Number(q.marketCap ?? 0),
      pe: Number(q.pe ?? 0),
      updated_at: now,
    });
    okIds.push(r.id);
  }

  if (priceRows.length > 0) {
    const { error: upErr } = await sb
      .from("cached_stock_prices")
      .upsert(priceRows, { onConflict: "ticker,exchange" });
    if (upErr) console.error("cached_stock_prices upsert error:", upErr.message);
  }

  // Mark successes.
  if (okIds.length > 0) {
    await sb
      .from("stock_universe")
      .update({ last_seeded_at: now, last_status: "ok", error_message: null })
      .in("id", okIds);
  }
  if (failIds.length > 0) {
    await sb
      .from("stock_universe")
      .update({ last_seeded_at: now, last_status: "failed", error_message: "no quote returned" })
      .in("id", failIds);
  }

  // Update progress counters atomically-ish (read-modify-write is fine for a tracker).
  const { data: prog } = await sb.from("seed_job_progress").select("*").eq("id", 1).single();
  const newProcessed = (prog?.processed ?? 0) + rows.length;
  const newSucceeded = (prog?.succeeded ?? 0) + okIds.length;
  const newFailed = (prog?.failed ?? 0) + failIds.length;

  // If we've cycled past total, reset counters for a fresh 24h sweep.
  const total = prog?.total ?? rows.length;
  const cycleDone = newProcessed >= total;
  await sb.from("seed_job_progress").update({
    processed: cycleDone ? 0 : newProcessed,
    succeeded: cycleDone ? 0 : newSucceeded,
    failed: cycleDone ? 0 : newFailed,
    last_chunk_at: now,
    cycle_started_at: cycleDone ? now : prog?.cycle_started_at ?? now,
    status: "running",
  }).eq("id", 1);

  return { processed: rows.length, succeeded: okIds.length, failed: failIds.length };
}

// ---------------------------------------------------------------------------
// HTTP entry
// ---------------------------------------------------------------------------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const action = url.searchParams.get("action") || "process";

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    if (action === "ingest") {
      const r = await ingestUniverse(sb);
      return new Response(JSON.stringify({ ok: true, action, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "process") {
      const r = await processChunk(sb);
      return new Response(JSON.stringify({ ok: true, action, ...r }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("seed-stock-universe error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
