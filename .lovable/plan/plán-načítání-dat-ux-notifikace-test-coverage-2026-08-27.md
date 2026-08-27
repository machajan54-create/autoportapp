# Plán: Načítání dat, UX notifikace, Test coverage

## 1. Načítání dat — migrace na loadery + useSuspenseQuery

**Problém:** Všechny seznamové routy (`vykupy`, `deals`, `ukoly`, `dochazka`, `zavady`, `evidence-zakazek`, `logbook`, `approvals`, `demo-orders`, `dashboard`) používají `useQuery` + `isLoading`. Chybí `errorComponent` a `pendingComponent` — chyba loaderu zobrazí syrovou chybu, ne načítání žádný skeleton.

**Co udělám:**

Pro každý ze 10 hlavních routů:
- Přidat `loader` volající `context.queryClient.ensureQueryData(queryOptions)` pro primární data
- Změnit komponentu z `useQuery`+`isLoading` na `useSuspenseQuery`
- Přidat `errorComponent` s tlačítkem „Zkusit znovu" (`router.invalidate()`)
- Přidat `pendingComponent` s načítacím skeletonem
- Zachovat stávající `useQuery` pro sekundární/data závislá na interakci (např. `access` gating)

**Pořadí (od nejjednoduššího):**
1. `vykupy/index.tsx` — jeden query (`listVykupy`)
2. `deals/index.tsx` — `listDeals`
3. `ukoly/index.tsx` — `listTasks`
4. `zavady/index.tsx` — `listDefects`
5. `evidence-zakazek/index.tsx` — `listOrders`
6. `logbook/index.tsx` — `listVehicles`, `listEntries`
7. `approvals.tsx` — `listSuppliers`, `listPurchases`
8. `demo-orders/index.tsx` — `listDemoOrders`
9. `dochazka/index.tsx` — `listRecords`, `listAbsences`, `listEmployees`
10. `dashboard.tsx` — nejsložitější (mnoho queries), nech na konec

**Invarianty:**
- `defaultPreloadStaleTime: 0` už je v routeru (nech být)
- Loader nevrací data přímo — vrací void, Query vlastní cache
- `queryOptions` definovat mimo komponentu pro sdílení key mezi loaderem a `useSuspenseQuery`
- Mutace zůstávají přes `useMutation` + `onSuccess` invalidate

## 2. UX notifikace — surface tiše spolknutých chyb

**Problém:** Server funkce chytají chyby odesílání e-mailů/notifikací do `try/catch` s `console.error` — uživatel se nic nedozví. Někdy to selže (např. odpojená e-mailová infrastruktura) a uživatel nemá tušení, že notifikace nedorazila.

**Co udělám:**

a) **Server funkce vrátí `warnings` pole** — místo tichého `console.error` nahromadí `warnings: string[]` v návratové hodnotě funkce. Příklad:
```ts
// tasks.functions.ts — createTask
return { ...task, warnings };
// warnings.push("E-mail přidělenému uživateli se nepodařilo odeslat");
```

b) **Klientská strana zobrazí toast.warning()** pro každou položku `warnings`:
```ts
const res = await mutation.mutateAsync(data);
res.warnings?.forEach(w => toast.warning(w));
```

**Dotčené funkce (vytaženo z kódu):**
- `tasks.functions.ts`: `notifyAssignee`, `notifyCreatorStatus`, `notifyTaskUpdated` (3×)
- `task-extras.functions.ts`: `notify on comment` (1×)
- `defects.functions.ts`: e-mail o nové závadě, e-mail o změně stavu (2×)
- `dochazka.functions.ts`: welcome email, notifikace o záznamu, absence žádost, absence rozhodnutí, upload CSV, DPP XLSX, archivace (7×)
- `deals.functions.ts`: `updateDeal notify` (1×)
- `deletion-requests.functions.ts`: lookup (1×)

**Pravidla:**
- Hlavní operace (CRUD) nesmí selhat kvůli notifikaci — `warnings` se jen připojí
- Toasty vždy česky
- Nezobrazovat warning pokud e-mail prostě neexistuje (to je OK) — jen při skutečné chybě odeslání

## 3. Test coverage — jednotkové testy pro netestované moduly

**Problém:** 57 testů pokrývá jen `dochazka`, `vykupy`, `tasks`. Moduly `deals`, `defects`, `claims`, `logbook`, `approvals`, `evidence` netestovány.

**Co udělám:** Přidám testy pro **čisté funkce a konstanty** (bez DB — stejný přístup jako existující testy):

| Soubor | Co testovat |
|--------|-------------|
| `deals.test.ts` | `DEAL_STAGES`, `DEAL_STAGE_LABEL`, `DEAL_VEHICLES`, `formatDuration` (exportovat ji) |
| `defects.test.ts` | `DEFECT_PRIORITY`, `DEFECT_STATUS`, `DEFECT_PRIORITY_LABEL`, `DEFECT_STATUS_LABEL` — české popisky, kompletnost |
| `claims.test.ts` | `CLAIM_STATUS_LABEL` (exportovat), `claimInput` schema validace |
| `logbook.test.ts` | helpery pokud existují, jinak schema validace |
| `approvals.test.ts` | `approval_status` přechody, label mapy |
| `evidence.test.ts` | stavové přechody, label mapy |

**Pravidla:**
- Stejný styl jako existující testy (`describe`/`it`/`expect`)
- Testovat jen exportované čisté funkce a konstanty — žádné mockování Supabase
- Exportovat `formatDuration` z `deals.functions.ts` (dnes je privátní)
- Exportovat `CLAIM_STATUS_LABEL` z `claims.functions.ts` (dnes je privátní)
- Vše česky

## Technické detaily

- **Dotčené soubory:** 10 route souborů v `src/routes/_authenticated/`, 8 `*.functions.ts` souborů, 6 nových test souborů v `src/lib/__tests__/`
- **Toaster** už je mounted v `__root.tsx` — nic neměnit
- **Router context** už má `queryClient` — `defaultPreloadStaleTime: 0` už nastaveno
- **Vitest config** už existuje — jen přidat soubory do `src/lib/__tests__/`

## Kontrola
- Po migraci loaderů: každý route má `loader`, `errorComponent`, `pendingComponent`
- Po UX notifikacích: `rg "console\.error.*failed|console\.error.*selhal" src/lib/*.functions.ts` vrátí 0 (vše přes `warnings`)
- Po testech: `bunx vitest run` projde s ~80+ testy
