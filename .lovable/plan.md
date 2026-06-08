
## Co přebuduju

Současný admin (jen tabulka zakázek + detail) nahradím rozhraním podle `claim-charm-69`:

### Layout
- Levý **sidebar** s logem „Pojistné události", nav „Zakázky" a patičkou s e-mailem + tlačítkem Odhlásit.
- Hlavní oblast s nadpisem „Klientský servis / Pojistné události".

### Přehled (`/admin`)
- 3 statistické karty: **Aktivní zakázky**, **Neuhrazené DPH**, **Celkem v databázi** + oranžová CTA karta **Zadat pojistnou událost** (vede na `/nahlasit`).
- Filtrační lišta: hledání + záložky **Všechny / Nové / V opravě / Čeká na DPH / Dokončené** + refresh.
- Seznam karet **Složky zakázek** — každá karta: kód `PU-YYYY-NNNN`, datum, status badge, název pojišťovny, „Majitel: …", „Číslo škodní: …".

### Detail zakázky (`/admin/:id`)
- Header: PU kód, jméno klienta, badge + dropdown na změnu stavu (Nová, V opravě, Čeká na DPH, Dokončeno).
- **Údaje** (vše ze současné databáze).
- **Fotogalerie** s náhledy příloh typu fotka/podpis.
- **Dokumenty** — plné moci se generují automaticky (uloží se do storage) a tady se jen stahují.
- **Časová osa** událostí (vytvoření, změny stavů, nahrané fotky, DPH).
- **Fotit do zakázky** — QR kód s veřejným tokenem; mobilní stránka umožní nahrát fotky bez přihlášení.
- **DPH** checkbox „Zaplaceno".
- **Úkoly** — jednoduchý seznam (přidat / odškrtnout).
- **Upozornění klientovi** — pošle e-mail (přes Lovable AI Gateway / resend-style integration) pokud má klient e-mail.

### Datová vrstva
Migrace přidá:
- `claims.pu_number` (text, unikátní), `claims.vat_paid` (bool), `claims.upload_token` (uuid) — pro veřejný upload přes QR.
- Rozšíření enumu `claim_status`: `new`, `in_repair`, `waiting_vat`, `done` (zachová zpětnou kompatibilitu).
- `claim_events` (timeline): claim_id, type, message, created_at, created_by.
- `claim_tasks`: claim_id, title, done, created_at.
- RLS + GRANTy.
- Storage policy + nová serverFn pro veřejný upload pomocí `upload_token` (bez přihlášení).

### Co zůstává
- Veřejný formulář `/nahlasit`, podpis, demo login, role.

### Mimo plán (potvrď, jestli chceš taky)
- Odesílání e-mailů — bez nastaveného mailového providera pošlu jen toast „odesláno" (placeholder). Pokud chceš reálné e-maily, řekni a doplním Resend/SMTP secret.

Pokud souhlasíš, jdu na to.
