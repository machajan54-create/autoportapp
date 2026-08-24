# Plán: Oprava duplicitních cron úloh + základní testy

## 1. Duplicitní cron úlohy

### Problém (ověřeno v migracích)
Následující pg_cron úlohy jsou naplánované vícekrát v různých migracích, takže se každá spouští 2–3× a maily/reminder-y se odesílají duplicitně:

| Job name | Migrace | Počet |
|---|---|---|
| `task-reminders` | `20260615104542` + `20260622114140` | 2× |
| `task-daily-digest` | `20260615104542` + `20260622114140` | 2× |
| `wash-reminders-hourly` | `20260615151726` + `20260617104805` + `20260622114140` | 3× |
| `autoport-followup-reminders` | `20260615105346` + `20260622114140` | 2× |
| `autoport-weekly-report` | `20260622114140` | 1× (OK) |
| `task-daily-digest-weekdays-0830` | `20260622114140` | 1× (OK) |
| `autoport-drive-backup` | `20260807113934` | 1× (OK) |

Konsolidovaná migrace `20260622114140` znovu naplánovala úlohy, které už existovaly ze starších per-job migrací.

### Řešení
Nová migrace, která pro každý duplicitní job name zavolá `cron.unschedule()` (odstraní všechny kopie) a následně znovu naplánuje každou úlohu přesně jednou se správným schedule a URL.

```sql
-- Odstranit všechny duplicitní instance
SELECT cron.unschedule(jobname) FROM cron.job 
WHERE jobname IN (
  'task-reminders','task-daily-digest','wash-reminders-hourly',
  'autoport-followup-reminders','autoport-weekly-report',
  'task-daily-digest-weekdays-0830'
);

-- Znovu naplánovat každou úlohu jednou (stejné URL jako v konsolidované migraci)
SELECT cron.schedule('task-reminders', '*/15 * * * *', $$ ... $$);
SELECT cron.schedule('task-daily-digest', '0 6 * * *', $$ ... $$);
SELECT cron.schedule('task-daily-digest-weekdays-0830', '30 6 * * 1-5', $$ ... $$);
SELECT cron.schedule('autoport-followup-reminders', '*/15 * * * *', $$ ... $$);
SELECT cron.schedule('wash-reminders-hourly', '0 * * * *', $$ ... $$);
SELECT cron.schedule('autoport-weekly-report', '0 7 * * 1', $$ ... $$);
```

URL pro každý job přeberu doslovně z konsolidované migrace `20260622114140` a `20260807113934` (drive-backup zůstává beze změny).

### Ověření
Po aplikaci migrace spustím:
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
```
a potvrdím, že každý job name existuje přesně jednou.

## 2. Základní testy

### Současný stav
- Vitest není nainstalován, v `package.json` není `test` skript ani žádná test dependency.
- Existují čisté funkce bez DB závislostí, které lze testovat izolovaně.

### Řešení
**Instalace:** `vitest` + `@vitest/coverage-v8` (dev dependencies), přidat `"test": "vitest run"` a `"test:watch": "vitest"` do `package.json` scripts. Vytvořit `vitest.config.ts` s `@` path aliasem (resolve alias).

**Testované čisté funkce (bez DB):**

1. **`src/lib/vykupy.ts`** — `src/lib/__tests__/vykupy.test.ts`
   - `formatKc` — formátování null, celá čísla, desetinná místa
   - `formatDate` — null, ISO string, neplatný vstup
   - `marze` — výpočet marže (prodano_za − vykoupeno_za − naklady), null vstupy, záporná marže

2. **`src/lib/tasks.functions.ts`** — `src/lib/__tests__/tasks.test.ts`
   - `computeNextDueDate` — daily (+1 den), weekly (+7 dní), weekdays (přeskočí víkend), null base (dnes)
   - Label maps — `TASK_STATUS_LABEL`, `TASK_PRIORITY_LABEL`, `TASK_RECURRENCE_LABEL` klíče existují

3. **`src/lib/dochazka.ts`** — `src/lib/__tests__/dochazka.test.ts`
   - `initials` — jedno slovo (2 písmena), dvě slova (iniciály), prázdný vstup
   - `formatTime` / `formatDate` — null, neplatný ISO, platný ISO
   - `formatHours` — null, celé hodiny, desetinné (např. 7.5 → "7h 30m")
   - `calculateHoursWorked` — normální směna, s pauzou, check-out před check-in → 0, pauza delší než směna → 0
   - `shiftDurationHours` — denní směna, noční směna (přechod přes půlnoc), neplatný vstup → 0
   - `expectedHoursWorked` — směna s pauzou, záporný výsledek → 0
   - `underTime` — odpracováno méně (kladný podčas), odpracováno více (0), přesně (0)

**Návrhový princip:** Testují se jen funkce bez side-efektů (žádné supabase volání, žádné `createServerFn` handlery). Server-funkce s DB se netestují (vyžadovalo by to mock infrastrukturu nad rámec tohoto kroku).

### Ověření
`bun run test` projde všech ~15–20 testů bez chyb.

## Co se nemění
- SEO meta tagy (označeno jako nepriorita)
- Type safety odstranění `: any`
- Rozdělování velkých souborů
- Loading skeletony
