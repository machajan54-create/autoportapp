## Princip (platí napříč aplikací)

- **Admin / super admin**: vidí a edituje vše.
- **Ostatní přihlášení**: vidí záznam jen pokud jsou jeho **autor** nebo **přiřazený řešitel**.
- **Mazání**: i nadále jen přes žádost (super admin).
- **Stará data** bez autora → viditelná pouze adminovi (admin je doplní/přiřadí). Žádné automatické „vidí to všichni z modulu" pro historii — jinak to obchází princip.

## Moduly a mapování polí

| Modul | Autor | Řešitel | Poznámka |
|---|---|---|---|
| Úkoly (tasks) | created_by | assignee_id | hotovo |
| Komentáře/přílohy úkolů | dědí z úkolu | — | join na tasks |
| Výkupy (vykupy) | **přidat** created_by | **přidat** assignee_id (+ assignee_name) | dnes je `zpracoval` jen text |
| Reklamace (claims) | **přidat** created_by (NULL = z webu) | **přidat** assignee_id | nepřiřazené reklamace z webu uvidí jen admin, dokud je nepřidělí |
| Závady (defects) | reported_by | resolved_by | zatím prázdné `resolved_by` ⇒ vidí jen autor + admin |
| Demo objednávky | created_by | **přidat** assignee_id | |
| Evidence zakázek | created_by | **přidat** assignee_id | |
| Kniha jízd – záznamy | created_by | (bez řešitele) | jízdu vidí jen řidič + admin |
| Kniha jízd – vozidla | created_by | **přidat** responsible_user_id | dnes `responsible_person` jen text |
| Obchodní případy (deals) | owner_id | owner_id | jeden vlastník |
| Nákupy (purchases) | requested_by | decided_by | |
| Dodavatelé (suppliers) | requested_by | decided_by | |
| Docházka – záznamy | employee_id → user_id | — | zaměstnanec vidí jen své; admin vše |
| Docházka – absence | employee_id → user_id | — | dtto |

## Co se změní v UI

- Všude, kde přibyl `assignee_id`, přidám výběr řešitele do formuláře (Výkupy, Reklamace, Demo objednávky, Evidence zakázek, Vozidla v knize jízd).
- Listy/dashboards budou nově zobrazovat jen relevantní záznamy (díky RLS automaticky).
- Notifikace (zvoneček + e-mail) budou rozšířeny po vzoru úkolů — při změně / přidělení dostane upozornění druhý zúčastněný.

## Co se NEMĚNÍ

- `clients` (klientela) – sdílený číselník, zůstává viditelná všem schváleným uživatelům.
- `attendance_employees`, `attendance_settings`, `attendance_shifts` – konfigurace docházky, admin/HR.
- `washers`, `document_templates`, `suppliers` číselník – číselníky.
- Veřejné formuláře (claims z webu, upload tokeny, sign tokeny) – fungují dál (service role).

## Technicky

1. **Migrace 1** – přidá chybějící sloupce (`created_by`, `assignee_id`, `assignee_name`, `responsible_user_id`) jako nullable. Default `auth.uid()` přes trigger pro `created_by`.
2. **Migrace 2** – nahradí stávající široké RLS politiky novými ve formátu:
   ```sql
   USING ( has_role(auth.uid(),'admin')
           OR created_by = auth.uid()
           OR assignee_id = auth.uid() )
   ```
   (přizpůsobeno názvům polí v každé tabulce)
3. **Server functions** – `createXxx` doplní `created_by = userId`; `updateXxx` při změně přiřazení pošle notifikaci.
4. **UI** – formuláře dostanou pole „Řešitel" (select uživatelů s daným modulem).
5. **Notifikace** – stejný vzor jako u úkolů (e-mail + zvoneček) i pro Výkupy, Reklamace, Defekty, Demo objednávky, Evidence, Deals, Purchases.

## Rizika / na co upozornit

- **Historická data**: cokoli bez vyplněného `created_by` (téměř všechny stávající záznamy) uvidí po nasazení **pouze admin**. Admin pak postupně přiřadí. Pokud nechceš tohle chování, jediná alternativa je dočasně udržet „kdo má modul, vidí staré záznamy" — řekni a přidám výjimku.
- **Reklamace z webu** mají `created_by = NULL` napořád (zakládá je externí klient). Logika: dokud admin nepřidělí řešitele, vidí ji jen admin.
- Velký zásah, doporučuji nasadit najednou (jedna migrace + jedna várka kódu) ať aplikace není v půli cesty.

## Otázky před spuštěním

1. **Historická data** – nechat „viditelné jen pro admina dokud nepřiřadí" (čisté), nebo dočasná výjimka „vidí to všichni s daným modulem"? *(doporučuji čisté)*
2. **Deals** – stačí jeden `owner_id`, nebo chceš i `created_by` zvlášť? *(dnes je tam jen owner_id)*
3. **Kniha jízd** – jízdu vidí jen řidič + admin. Stačí? *(žádný „přidělující")*
