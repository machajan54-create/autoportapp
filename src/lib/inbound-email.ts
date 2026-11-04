// Pure helpers for "BCC to CRM" inbound emails (no server deps → testable).

export const FOLLOW_UP_DAYS = 3;

export type Addr = { email: string; name?: string | null };

export type InboundEmail = {
  from: Addr;
  to: Addr[];
  cc: Addr[];
  subject: string;
  text: string;
};

function parseAddrList(v: unknown): Addr[] {
  if (!v) return [];
  if (Array.isArray(v)) {
    return v
      .map((a: any) =>
        typeof a === "string"
          ? parseAddrList(a)[0]
          : { email: String(a?.Email ?? a?.email ?? a?.address ?? ""), name: a?.Name ?? a?.name ?? null },
      )
      .filter((a): a is Addr => !!a && /@/.test(a.email))
      .map((a) => ({ ...a, email: a.email.trim().toLowerCase() }));
  }
  return String(v)
    .split(",")
    .map((part) => {
      const m = part.match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
      return m ? { name: m[1].trim() || null, email: m[2].trim().toLowerCase() } : { email: part.trim().toLowerCase(), name: null };
    })
    .filter((a) => /@/.test(a.email));
}

/** Accepts Postmark inbound JSON or a generic {from,to,cc,subject,text} payload. */
export function normalizeInbound(p: any): InboundEmail | null {
  const from = parseAddrList(p?.FromFull ? [p.FromFull] : (p?.from ?? p?.From))[0];
  if (!from) return null;
  return {
    from,
    to: parseAddrList(p?.ToFull ?? p?.to ?? p?.To),
    cc: parseAddrList(p?.CcFull ?? p?.cc ?? p?.Cc),
    subject: String(p?.Subject ?? p?.subject ?? "").slice(0, 300),
    text: String(p?.TextBody ?? p?.text ?? p?.StrippedTextReply ?? "").slice(0, 4000),
  };
}

/** Client = first To/Cc address that isn't the sender, an employee, or the CRM inbox. */
export function pickClient(mail: InboundEmail, internalEmails: Set<string>, inboxDomain?: string): Addr | null {
  for (const a of [...mail.to, ...mail.cc]) {
    if (a.email === mail.from.email) continue;
    if (internalEmails.has(a.email)) continue;
    if (inboxDomain && a.email.endsWith("@" + inboxDomain)) continue;
    return a;
  }
  return null;
}

export function followUpDate(now: Date, days = FOLLOW_UP_DAYS): Date {
  const d = new Date(now);
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d;
}
