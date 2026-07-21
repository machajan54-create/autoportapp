# Týdenní záloha na Google Disk

Cíl: nastavit automatickou týdenní zálohu celé aplikace na firemní Google Disk. Záloha bude obsahovat export všech dat z databáze i všech nahraných souborů/fotografií ze Storage.

## Co se postaví

1. **Připojení Google Drive connectoru**
   - Prostřednictvím workspace připojení `Google Drive` (connector_id `google_drive`).
   - Po připojení budou v projektu dostupné proměnné `GOOGLE_DRIVE_API_KEY` a `LOVABLE_API_KEY` pro volání Lovable gateway.

2. **Evidence záloh v databázi**
   - Nová tabulka `backups` (začátek, konec, stav, počet souborů, ID Google Drive složky, případná chyba).
   - RLS: vidí jen admini, zapisuje pouze service role.

3. **Zálohovací engine** (`src/lib/backup.server.ts`)
   - Vytvoří na Google Drive složku pojmenovanou `Autoport záloha – YYYY-MM-DD HH:mm`.
   - Exportuje každou veřejnou tabulku do JSON a CSV a uloží do podsložky `Databáze`.
   - Projde všechny Storage buckety (`claim-files`, `defect-photos`, `logbook-receipts`, `task-attachments`, `vykup-photos`, `client-documents`, `attendance-reports`) a nahraje soubory do podsložek `Soubory/<bucket>`.
   - Soubory > 5 MB nahraje přes resumable upload, aby se vešel do limitů Google Drive API.
   - Po dokončení zapíše výsledek do tabulky `backups`.
   - Automaticky smaže zálohy starší než 4 týdny (Drive složky i záznamy v tabulce).

4. **Veřejný cron endpoint** (`src/routes/api/public/backup/weekly.ts`)
   - POST handler ověří `x-cron-secret` pomocí existujícího `requireCronAuth` / `get_cron_auth_secret`.
   - Spustí zálohovací engine a vrátí přehled uložených souborů.
   - Endpoint bude pod `/api/public/backup/weekly`, takže ho může volat `pg_cron` bez přihlášeného uživatele.

5. **Naplánování týdenního běhu**
   - `pg_cron` úloha `weekly-google-drive-backup` volá endpoint každou neděli v 2:00 s hlavičkou `x-cron-secret` načtenou z `vault`.

6. **Admin UI**
   - Nová stránka `Nastavení → Zálohy` (`/admin/backups`).
   - Zobrazí historii záloh, stav poslední zálohy, počet souborů a odkaz na Google Drive složku.
   - Tlačítko **Zálohovat teď** pro ruční spuštění (pouze pro adminy).
   - Přidá se odkaz do `AdminShell`.

## Technické detaily

- **Autorizace Google Drive**: volání půjdou přes `https://connector-gateway.lovable.dev/google_drive/…` s hlavičkami `Authorization: Bearer <LOVABLE_API_KEY>` a `X-Connection-Api-Key: <GOOGLE_DRIVE_API_KEY>`.
- **Vytvoření složky**: `POST /drive/v3/files` s `mimeType: application/vnd.google-apps.folder`.
- **Upload souborů**: `POST /upload/drive/v3/files?uploadType=multipart` s `multipart/related` tělem (metadata + binární obsah). Pro soubory > 5 MB se použije resumable upload.
- **Čtení dat**: `supabaseAdmin` (service role) pro export všech tabulek a Storage; vše se děje server-side, klient nikdy nevidí tajné klíče.
- **Cron autentizace**: využije se stávající `CRON_SECRET` uložený ve Vaultu a `requireCronAuth` helper, takže zálohovací endpoint nebude veřejně zneužitelný jen pomocí anon klíče.
- **Retence**: výchozí nastavení je ponechat poslední 4 zálohy. Lze později změnit.

## Poznámky a omezení

- První úplná záloha může být objemná a časově náročná (záleží na počtu fotografií). Engine bude zpracovávat soubory po dávkách, aby se vešel do limitů serverless běhu.
- Pokud by objem fotografií překročil časový limit jednoho cron běhu, lze zálohu souborů rozdělit na menší dávky – to řešíme až v případě potřeby.
- Nastavení zálohování bude viditelné a spustitelné pouze pro uživatele s rolí admin.

Schválíš plán?