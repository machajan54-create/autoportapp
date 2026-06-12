## Vylepšení modulu Docházka — 5 oblastí

Implementuji všech 5 vylepšení v tomto pořadí:

### 1. Veřejný terminál (`/terminal`)
- Přesun `_authenticated/dochazka/terminal.tsx` → `terminal.tsx` (top-level, public route).
- Server fn `terminalPunch` (PIN-based, service role, žádný `requireSupabaseAuth`).
- Validace PIN proti `attendance_employees`, rate-limit ochrana (jednoduchá in-memory na úrovni IP/PIN — best effort).
- Odkaz na terminál v admin shellu odstranit / nahradit linkem.

### 2. Stránkování seznamů
- `listRecords`, `listAbsences`, `listNotifications` — přidat `page`/`pageSize` parametry, vrátit `{ rows, total }`.
- UI tabulky doplnit o pagination controls (shadcn `Pagination`).

### 3. Měsíční kalendář
- Nová záložka "Kalendář" v `/dochazka` modulu.
- Grid den × zaměstnanec, barevné stavy: in/out/absent/pending.
- Server fn `getMonthCalendar(year, month)` agreguje z `attendance_records` + `attendance_absences`.

### 4. Audit absencí
- Migrace: `attendance_absences.resolved_by uuid references auth.users(id)`.
- `resolveAbsence` server fn ukládá `auth.uid()` jako `resolved_by`.
- UI zobrazí jméno schvalovatele (join na `profiles`).

### 5. Realtime
- Migrace: `ALTER PUBLICATION supabase_realtime ADD TABLE attendance_records, attendance_absences, attendance_notifications;`
- Admin dashboard `/dochazka`: `useEffect` subscribe → `queryClient.invalidateQueries(['dochazka'])` při INSERT/UPDATE.

### Pořadí
1. Migrace (audit + realtime publikace) — jeden migration call.
2. Server fns (terminal public, pagination, kalendář, audit resolve).
3. Routing (přesun terminálu).
4. UI (kalendář, pagination, realtime hook, schvalovatel).

Pozn.: Po každé migraci čekám na schválení/regeneraci `types.ts` před úpravou kódu závisejícího na nových sloupcích.
