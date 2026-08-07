/**
 * Auth helper pro veřejné cron / hook endpointy pod /api/public/*.
 * Vyžaduje hlavičku `x-cron-secret` s tajným klíčem uloženým ve Vaultu
 * (pg_cron ho čte z `vault.decrypted_secrets`, sem nikdy nepronikne klient).
 * Když chybí nebo nesedí, vrátí 401.
 */
let cachedSecret: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

async function loadCronSecret(): Promise<string | null> {
  if (cachedSecret && Date.now() - cachedAt < CACHE_TTL_MS) return cachedSecret;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("get_cron_auth_secret");
  if (error || !data) return null;
  cachedSecret = String(data);
  cachedAt = Date.now();
  return cachedSecret;
}

function timingSafeEqStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function requireCronAuth(request: Request): Promise<Response | null> {
  const expected = await loadCronSecret();
  if (!expected) {
    return Response.json(
      { ok: false, error: "Server není správně nakonfigurován." },
      { status: 500 },
    );
  }
  const provided =
    request.headers.get("x-cron-secret") ??
    (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!provided || !timingSafeEqStr(provided, expected)) {
    return Response.json({ ok: false, error: "Neautorizováno." }, { status: 401 });
  }
  return null;
}
