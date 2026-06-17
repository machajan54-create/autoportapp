/**
 * Auth helper pro veřejné cron / hook endpointy pod /api/public/*.
 * Vyžaduje hlavičku `apikey` se Supabase publishable (anon) klíčem.
 * Klíč už je nastavený v env (SUPABASE_PUBLISHABLE_KEY), pg_cron joby
 * ho posílají v hlavičce. Když chybí nebo nesedí, vrátí 401.
 */
export function requireCronAuth(request: Request): Response | null {
  const expected = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!expected) {
    return Response.json(
      { ok: false, error: 'Server není správně nakonfigurován.' },
      { status: 500 },
    )
  }
  const provided =
    request.headers.get('apikey') ??
    request.headers.get('x-api-key') ??
    (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (provided !== expected) {
    return Response.json({ ok: false, error: 'Neautorizováno.' }, { status: 401 })
  }
  return null
}