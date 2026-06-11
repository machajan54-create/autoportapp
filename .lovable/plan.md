## Plán: Modul Docházka

Portuju nahraný docházkový systém (~5 600 řádků, 8 komponent) do AutoPortu jako nový modul `dochazka` s plnou perzistencí v Lovable Cloud, podle stejných vzorů jako stávající moduly (`claims`, `vykupy`, atd.).

### 1. Databáze (jedna migrace)

Nové tabulky pod `public`:
- `attendance_employees` — jméno, role, PIN (hash), barva avatara, active, can_approve_absences
- `attendance_shifts` — name, start_time, end_time, color
- `attendance_records` — employee_id, date, check_in, check_out, shift_id, note, break_duration, hours_worked
- `attendance_absences` — employee_id, type (enum), start_date, end_date, status (enum), note, resolved_by, resolved_at
- `attendance_notifications` — type, title, message, read, recipient_employee_id, is_for_manager, meta jsonb
- `attendance_settings` — singleton (jeden řádek) s notifikačními nastaveními

K tomu:
- Enum `app_module` rozšířit o hodnotu `dochazka`
- RLS: čtení/zápis pro uživatele s modulem `dochazka` (přes `has_module`), admin plný přístup, `service_role` ALL
- GRANT na všechny tabulky `authenticated` + `service_role`
- `updated_at` trigger na editovatelných tabulkách

### 2. Sidebar / navigace

- Přidat položku „Docházka" do `AdminShell.tsx` (ikona `Clock`)
- Modul `dochazka` přidat do seznamu modulů ve správě uživatelů (`admin/users.tsx`) a v demo seedu (`demo.functions.ts` — doplnit do `modules` pole)

### 3. Routy (pod `_authenticated/`)

```
_authenticated/dochazka/
  index.tsx           → /dochazka          (dashboard s 7 záložkami)
  terminal.tsx        → /dochazka/terminal (terminál s PIN přihlášením)
```

Dashboard použije lokální tab state (jako vykupy) — 7 záložek: Statistiky, Zaměstnanci, Směny, Záznamy, Absence, Upozornění, Export.

### 4. Komponenty

Zkopírovat upravené verze do `src/components/dochazka/`:
- `TerminalView.tsx`, `DashboardView.tsx`
- `StatsTab.tsx`, `EmployeesTab.tsx`, `ShiftsTab.tsx`, `RecordsTab.tsx`, `AbsencesTab.tsx`, `AlertsTab.tsx`, `ExportTab.tsx`

Adaptace originálu:
- Vyhodit `localStorage` ukládání → React Query + server functions
- Použít stávající shadcn komponenty (`Button`, `Card`, `Dialog`, `Input`, `Tabs`, `Badge`, `Table`) místo vlastních
- Sjednotit styl s AutoPort design tokens (žádné hardcoded barvy)
- Zachovat veškerou business logiku (výpočet hodin, late detection, etc.) z `utils.ts`

### 5. Server functions

`src/lib/dochazka.functions.ts` — vše s `requireSupabaseAuth`:
- `listEmployees`, `upsertEmployee`, `deleteEmployee`
- `listShifts`, `upsertShift`, `deleteShift`
- `listRecords(month?)`, `checkIn(employeeId, pin, shiftId)`, `checkOut(recordId)`, `upsertRecord`, `deleteRecord`
- `listAbsences`, `createAbsence`, `resolveAbsence(id, status)`
- `listNotifications`, `markNotificationRead`, `markAllRead`
- `getSettings`, `updateSettings`
- `seedDochazkaDemo` (volitelně) — naplnit demo zaměstnanci/směnami pro demo účet (zavolá se i z `ensureDemoUser`)

PIN se hashuje (bcrypt/sha256) — terminál posílá plaintext PIN, server porovná.

### 6. Demo data

Rozšířit `src/lib/demo.functions.ts`:
- Přidat `dochazka` do modulů demo účtu
- Seed: 4 zaměstnanci (Hrubý Patrik, Hák Marek, …), 3 směny (Ranní/Odpolední/Noční), pár záznamů z posledních dní, 2 absence

### 7. Co je mimo plán (úmyslně)

- Realtime push notifikací (zobrazují se při refetchi)
- Mobilní PWA terminál — funguje v prohlížeči, plnohodnotné PWA až později
- Tisk QR identifikátorů pro píchání (originál to nemá)

### Technické detaily

- Typy z `src/integrations/supabase/types.ts` (auto-gen po migraci)
- Časy v DB jako `timestamptz` (check_in/check_out), čisté datumy jako `date`
- `hours_worked` se počítá v DB triggeru při `UPDATE` check_out (nebo v server fn) — vyhneme se nekonzistenci
- Enum typy: `dochazka_absence_type`, `dochazka_absence_status`, `dochazka_notification_type`
- Soubory přesahující 300 řádků (TerminalView, RecordsTab, AlertsTab, AbsencesTab) ponechám jako jeden soubor — refaktor na menší by zdvojnásobil rozsah práce; pokud chceš, můžu je rozdělit v druhém kroku.

### Pořadí prací

1. Migrace DB (čeká na schválení)
2. Server functions + adaptace `demo.functions.ts`
3. Routy + sidebar
4. Postupně 7 záložek + terminál
5. Závěrečný test: přihlášení jako demo → /dochazka, píchnutí přes terminál

Odhad: rozsáhlá změna, několik tool callů. Pojedu po jednom velkém kroku, abych ti to nepřevalil najednou.
