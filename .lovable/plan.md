## Modul: Objednávky předváděcích vozů

Kompletní workflow od založení klienta a objednávky přes generování PDF, digitální podpis (na místě nebo remote přes e-mail), automatickou zálohovou fakturu, archivaci dokumentů v klientské složce a notifikaci klientovi s odkazy ke stažení.

### 1) Databáze (migrace)

**`clients`** — globální adresář klientů (sdílený do budoucna i mimo tento modul)
- `full_name`, `company`, `ico`, `dic`, `address`, `phone`, `email`, `notes`, `owner_id`

**`demo_orders`** — objednávka předváděcího vozu
- `order_number` (auto: `OBJ-RRRR-NNNN`, sequence)
- `client_id` → `clients`
- vůz: `model_verze`, `vin`, `barva`, `najete_km`, `rok_vyroby`
- záruka: `zaruka_spustena_od`, `registrace_datum`
- ceny (řádky): `line_items jsonb` (název, cena bez DPH, DPH %, sleva, kategorie: vybava/sleva/vip)
- součty: `cena_celkem_bez_dph`, `cena_celkem_s_dph`, `zaloha`, `datum_dodani`, `datum_objednavky`
- stav: `status` (`draft` | `sent_for_signature` | `signed` | `cancelled`)
- `notes`, `created_by`

**`demo_order_documents`** — všechny vygenerované soubory (objednávka, faktura, podepsané verze)
- `order_id`, `client_id`, `kind` (`order`, `order_signed`, `invoice`, `invoice_signed`)
- `storage_path`, `file_name`, `mime`, `signed_at`

**`demo_order_signatures`** — podpisové eventy
- `order_id`, `mode` (`in_person` | `remote`), `signer_name`, `signature_data` (base64 PNG), `ip`, `user_agent`, `signed_at`
- pro remote: `token` (UUID), `token_expires_at`, `consumed_at`

**`invoice_sequence`** — sekvence `ZF-RRRR-NNNN` (per rok)

Plus RLS (auth pro vše, super_admin override), GRANTs, `updated_at` triggery, sekvence pro číslo objednávky a faktury.

**Storage bucket** `client-documents` (private) s RLS: čtení/zápis pro authenticated, signed URL pro stažení.

### 2) Server functions (`src/lib/`)

- `clients.functions.ts` — `listClients`, `createClient`, `updateClient`, `getClient`
- `demo-orders.functions.ts`:
  - `listOrders`, `getOrder`, `createOrder`, `updateOrder`, `deleteOrder` (admin)
  - `generateOrderPdf({ orderId })` — vytvoří PDF objednávky (Citroën branding podle screenshotu), uloží do Storage, zapíše do `demo_order_documents`
  - `generateInvoicePdf({ orderId })` — zálohová faktura ZF-RRRR-NNNN
  - `signOrderInPerson({ orderId, signatureDataUrl, signerName })` — vloží podpis do PDF (pdf-lib), uloží jako `order_signed.pdf`
  - `createRemoteSignatureLink({ orderId })` — vygeneruje token + pošle e-mail klientovi
  - `signOrderRemote({ token, signatureDataUrl })` — veřejný endpoint pro klienta
  - `sendDocumentsToClient({ orderId })` — pošle klientovi e-mail s odkazy (signed URL, 7 dní) na podepsanou objednávku + zálohovou fakturu

### 3) PDF generátory (pdf-lib)

- **Objednávka**: replikuje layout ze screenshotu — hlavička s logem Citroën, číslo objednávky, datum, dvě sekce (vozidlo / klient), tabulka ceník (Bez DPH / DPH / Včetně DPH), barevné zvýraznění "Cena celkem", podpisové pole.
- **Zálohová faktura**: standardní rozložení (dodavatel AutoPort, odběratel klient, řádky, DPH, QR platba volitelně), č. ZF-RRRR-NNNN.
- **Podpis**: pdf-lib načte vygenerované PDF, vloží podpisový obrázek a metadata (jméno, datum, IP) na podpisovou plochu.

### 4) Routy (UI)

- `/clients` — seznam + detail klienta s historií objednávek a galerií dokumentů
- `/demo-orders` — seznam objednávek (filtry, stavy, hledání)
- `/demo-orders/new` — formulář (krok 1 klient, krok 2 vůz, krok 3 ceník, krok 4 souhrn)
- `/demo-orders/$id` — detail:
  - tlačítka: "Generovat PDF", "Podepsat na místě" (otevře SignaturePad — komponenta už existuje), "Odeslat odkaz k podpisu", "Generovat zálohovou fakturu", "Odeslat klientovi"
  - tab "Dokumenty" — seznam všech PDF s download/preview
- `/sign/$token` (public route, mimo `_authenticated/`) — klientova stránka pro remote podpis (zobrazí PDF preview + SignaturePad + tlačítko Podepsat)

### 5) E-mailové šablony

- `demo-order-signature-request.tsx` — "Prosíme o podpis objednávky" + odkaz `/sign/{token}` (platnost 7 dní)
- `demo-order-documents.tsx` — "Vaše dokumenty k objednávce" + 2 odkazy (objednávka + faktura, signed URL)
- Registrace v `registry.ts`

### 6) Menu & oprávnění

- Nový `app_module = 'demo_orders'` (přidat do enumu)
- Položka v `AdminShell` / sidebar
- `users.tsx` — toggle pro nový modul

### Pořadí implementace

1. Migrace (tabulky, sekvence, RLS, bucket, modul enum)
2. Server fn `clients` + `demo-orders` (bez PDF)
3. Routy `/clients` a `/demo-orders` (list, new, detail) — základní CRUD
4. PDF generátor objednávky
5. Podpis na místě (SignaturePad + uložení do PDF)
6. Remote podpis (token + `/sign/$token` + e-mail)
7. Zálohová faktura PDF
8. E-mail s dokumenty + signed URL
9. Modul v menu + oprávnění + super admin delete

### Poznámky

- Vše české texty (memory rule).
- Storage layout: `client-documents/{client_id}/{order_id}/{kind}-{timestamp}.pdf`.
- Číslo faktury i objednávky generuje DB sekvence (atomické, žádné duplicity).
- Použijeme existující `SignaturePad` komponentu.
- pdf-lib už je v projektu (viz `vykup-contract.functions.ts`).
- Citroën logo: použít jako URL v PDF headeru (lze později nahradit firemním).

Rozsah: ~15 nových souborů, 1 velká migrace. Po schválení postavím postupně všech 9 kroků v jedné dlouhé sérii edit-batchů.