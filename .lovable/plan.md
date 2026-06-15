## Cíl

Odebrat všem uživatelům (včetně adminů na první kliknutí) možnost mazat záznamy. Místo toho každé "Smazat" odešle **žádost o smazání** super adminovi, který ji buď zamítne, nebo schválí — a po schválení se záznam **smaže automaticky**.

## 1) Databáze – nová tabulka

`deletion_requests`
- `entity_type` (text, např. `demo_orders`, `tasks`, `deals`, `claims`, `defects`, `vykupy`, `vykup_photos`, `logbook_vehicles`, `logbook_entries`, `clients`, `suppliers`, `purchases`, `attendance_records`, `attendance_shifts`, `attendance_absences`, `task_comments`, `task_attachments`, `claim_attachments`)
- `entity_id` (uuid)
- `entity_label` (text) – snapshot lidsky čitelného popisu („Objednávka OBJ-2026-0001 / Novák")
- `requested_by` (uuid → auth.users)
- `reason` (text) – povinný důvod, max 1000 znaků
- `status` (`pending` | `approved` | `rejected`)
- `decided_by`, `decided_at`, `decision_note`
- RLS: uživatel vidí/vytváří jen své žádosti; admin vidí vše a rozhoduje
- GRANT na `authenticated` + `service_role`
- Unikátní index `(entity_type, entity_id) WHERE status='pending'` aby nešlo zaduplikovat čekající žádost

## 2) Server funkce – `src/lib/deletion-requests.functions.ts`

- `requestDeletion({ entity_type, entity_id, reason })` – validuje typ z whitelistu, najde label, vloží řádek, notifikuje adminy e-mailem
- `listDeletionRequests({ status? })` – uživatel své, admin vše
- `decideDeletionRequest({ id, status, decision_note? })` – jen admin:
  - `rejected` → uloží rozhodnutí, pošle žadateli e-mail
  - `approved` → zavolá interní `executeDeletion(entity_type, entity_id)` přes `supabaseAdmin`, který provede skutečný `DELETE` (včetně úklidu storage – fotky, podepsané PDF, klientské dokumenty), pak označí žádost jako `approved`. Pokud delete selže, žádost zůstane pending a vrátí chybu.
- `cancelDeletionRequest({ id })` – žadatel může svou pending žádost zrušit

## 3) Zrušení přímých `delete*` server funkcí

Všechny existující exporty (`deleteDemoOrder`, `deleteVykup`, `deleteVykupPhoto`, `deleteTask`, `deleteDeal`, `deleteClaim`, `deleteDefect`, `deleteSupplier`, `deletePurchase`, `deleteTaskComment`, `deleteTaskAttachment`, mazání v `logbook` a `dochazka`) přepíšeme tak, aby pouze **vyhodily chybu** „Smazání musí schválit super admin – odešlete žádost". Tím se zachová binární kompatibilita pro nezreferencované volání, ale nic skutečně nesmaže.

## 4) UI – jednotný komponent `RequestDeleteButton`

Nová komponenta s ikonkou koše, která místo přímého `confirm()` otevře malý dialog:
- pole pro důvod (povinné)
- tlačítko „Odeslat žádost"
- po úspěchu: toast „Žádost odeslána super adminovi"

Nasadit ji na všech místech, kde teď visí tlačítko `Trash2`:
- seznam objednávek předváděcích vozů
- seznam zakázek, reklamací, úkolů, výkupů, dealů, vad
- detail výkupu (mazání fotek), detail úkolu (mazání komentářů/příloh)
- admin/users (vlastní detail klienta), schvalovací fronta (dodavatelé/nákupy)
- kniha jízd, docházka

## 5) Stránka `/approvals` – nová sekce „Žádosti o smazání"

Tabulka pending žádostí: typ entity, popis, žadatel, důvod, kdy. Tlačítka **Zamítnout** (s notou) a **Schválit a smazat** (s potvrzovacím dialogem „Tato akce je nevratná"). Filtr `vše | čekající | rozhodnuto`.

V `AdminShell` přidat badge s počtem pending žádostí (vedle stávajícího zvonku notifikací).

## 6) E-mailové notifikace

- `deletion-request` – adminům, když přijde nová žádost (žadatel, entita, důvod, odkaz)
- `deletion-decision` – žadateli, když je rozhodnuto (schváleno/zamítnuto + poznámka)
- Registrace v `email-templates/registry.ts`

## 7) Migrace dat

Žádné. Existující záznamy zůstávají.

## Pořadí

1. Migrace (tabulka + RLS + index)
2. Server fn `deletion-requests.functions.ts` + executor mapy pro každý typ entity
3. Přepsat všechny `delete*` exporty na throw
4. `RequestDeleteButton` komponenta + e-mailové šablony
5. Nasadit RequestDeleteButton na všech UI místech
6. Sekce v `/approvals`
7. Badge v `AdminShell`

## Poznámka k rozsahu

Vztahuje se i na „operativní" mazání: chybný stamp v docházce, špatně nahraná fotka výkupu, překlep v komentáři. Žadatel je nemůže ihned napravit — musí počkat na schválení. (Pokud by to v praxi bylo nepraktické, dá se později vyjmout whitelist „uživatel může mazat svá vlastní data starší než X minut", ale primárně držím tvůj požadavek: **nikdo nesmaže nic přímo**.)
