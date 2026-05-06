// Admin-only bulk importer for historical stock prices.
//
// Accepts JSON: { ticker, exchange, rows: [{ date: "YYYY-MM-DD" | ISO, price: number }] }
// Inserts into stock_price_history idempotently — any row whose (ticker,
// exchange, recorded_at-day) already exists is skipped, so re-uploading the
// same CSV won't duplicate points. Each row is recorded at 15:30 IST of its
// date so it lines up with the daily-snapshot job.
//
// Auth: requires the caller to have the 'admin' role in user_roles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const TICKER_RE = /^[A-Za-z0-9_\-.]{1,30}$/;
const EXCHANGE_RE = /^(NSE|BSE)$/;
const MAX_ROWS = 5000;

interface InboundRow { date: unknown; price: unknown }

function parseDateToIstClose(input: unknown): string | null {
  if (typeof input !== "string" && typeof input !== "number") return null;
  const s = String(input).trim();
  if (!s) return null;

  // Try YYYY-MM-DD or YYYY/MM/DD first
  const ymd = s.match(/^(\d{4})[\-\/](\d{1,2})[\-\/](\d{1,2})$/);
  // DD-MM-YYYY or DD/MM/YYYY
  const dmy = s.match(/^(\d{1,2})[\-\/](\d{1,2})[\-\/](\d{4})$/);
  let y: number, m: number, d: number;
  if (ymd) {
    y = +ymd[1]; m = +ymd[2]; d = +ymd[3];
  } else if (dmy) {
    d = +dmy[1]; m = +dmy[2]; y = +dmy[3];
  } else {
    const parsed = new Date(s);
    if (Number.isNaN(parsed.getTime())) return null;
    y = parsed.getUTCFullYear();
    m = parsed.getUTCMonth() + 1;
    d = parsed.getUTCDate();
  }
  if (y < 1990 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return null;
  // 15:30 IST == 10:00 UTC
  const iso = `${y.toString().padStart(4, "0")}-${m.toString().padStart(2, "0")}-${d.toString().padStart(2, "0")}T10:00:00.000Z`;
  return Number.isNaN(new Date(iso).getTime()) ? null : iso;
}

function parsePrice(input: unknown): number | null {
  if (typeof input === "number") {
    return Number.isFinite(input) && input > 0 ? input : null;
  }
  if (typeof input !== "string") return null;
  // Strip currency symbols, commas, spaces (handles "₹1,234.50" / "$12.3")
  const cleaned = input.replace(/[^\d.\-]/g, "");
  const n = parseFloat(cleaned);
  return Number.isFinite(n) && n > 0 ? n : null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Verify caller is an authenticated admin
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sbAuth = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: userErr } = await sbAuth.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: roleRow } = await sb
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "admin")
      .maybeSingle();
    if (!roleRow) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const ticker = String(body?.ticker ?? "").trim().toUpperCase();
    const exchange = String(body?.exchange ?? "").trim().toUpperCase();
    const rowsIn = Array.isArray(body?.rows) ? body.rows as InboundRow[] : null;

    if (!TICKER_RE.test(ticker) || !EXCHANGE_RE.test(exchange) || !rowsIn) {
      return new Response(JSON.stringify({ error: "invalid_payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (rowsIn.length === 0 || rowsIn.length > MAX_ROWS) {
      return new Response(JSON.stringify({ error: `rows must be 1..${MAX_ROWS}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse + dedupe by date (last-write wins for same date in payload)
    const byDate = new Map<string, { price: number; iso: string }>();
    let invalid = 0;
    for (const r of rowsIn) {
      const iso = parseDateToIstClose(r.date);
      const price = parsePrice(r.price);
      if (!iso || price === null) { invalid++; continue; }
      byDate.set(iso, { price, iso });
    }
    if (byDate.size === 0) {
      return new Response(JSON.stringify({ error: "no_valid_rows", invalid }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find existing rows in this date set so we don't duplicate
    const isos = Array.from(byDate.keys());
    const minIso = isos.reduce((a, b) => (a < b ? a : b));
    const maxIso = isos.reduce((a, b) => (a > b ? a : b));
    const { data: existing } = await sb
      .from("stock_price_history")
      .select("recorded_at")
      .eq("ticker", ticker)
      .eq("exchange", exchange)
      .gte("recorded_at", minIso)
      .lte("recorded_at", maxIso);

    const seen = new Set((existing ?? []).map((e: any) => new Date(e.recorded_at).toISOString()));
    const toInsert = isos
      .filter((iso) => !seen.has(iso))
      .map((iso) => ({
        ticker,
        exchange,
        price: byDate.get(iso)!.price,
        recorded_at: iso,
      }));

    let inserted = 0;
    const BATCH = 500;
    for (let i = 0; i < toInsert.length; i += BATCH) {
      const chunk = toInsert.slice(i, i + BATCH);
      const { error } = await sb.from("stock_price_history").insert(chunk);
      if (error) {
        console.error("import-stock-history insert error:", error);
        return new Response(JSON.stringify({ error: "insert_failed", inserted, message: error.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inserted += chunk.length;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        ticker,
        exchange,
        received: rowsIn.length,
        valid: byDate.size,
        invalid,
        skipped_existing: byDate.size - toInsert.length,
        inserted,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("import-stock-history error:", err);
    return new Response(JSON.stringify({ error: "internal_error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
