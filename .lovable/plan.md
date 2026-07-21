# Plán vylepšení modulu TV Display

Cíl: z jednoduchého fotoslideshow udělat "showroom kokpit" — bohatší typy slajdů, živá data z aplikace a osvěžený vizuál. Jeden displej, jeden playlist.

## 1. Bohatší typy slajdů

Rozšířit tabulku `slides` o `kind` (enum) + `payload` (jsonb) a v `/tv/:token` vykreslit podle typu. Stávající obrázkové slajdy zůstanou (`kind='image'`).

Nové typy:
- **image** — dnešní chování (Ken Burns + crossfade)
- **video** — MP4 nahrané do bucketu `slides`, autoplay muted loop, po skončení → další slajd (nebo po `duration_sec`)
- **youtube** — embed přes `youtube-nocookie.com`, muted autoplay
- **rich_text** — nadpis + podnadpis + odrážky + volitelné pozadí (barva / obrázek / gradient), typografie ze slide skillu (velké fonty pro projekci)
- **pdf_page** — jedna stránka PDF vyrenderovaná přes `pdfjs-dist` do canvasu (užitečné pro ceníky)
- **web_url** — `<iframe>` s `sandbox` (např. Google Slides published)
- **data_widget** — viz sekce 2 (výběr přes `payload.widget`)

UI v `/admin/tv`:
- V dialogu "Nový slajd" přepínač typu (Tabs), formulář se přepne podle výběru
- Živý 16:9 náhled renderuje stejnou komponentou jako TV
- Upload videí přes stejný bucket `slides` (nové MIME pravidla)

## 2. Živá data ze systému (data widgets)

Nová veřejná server-fn `getTvWidgetData({ token, widget })` (bez auth, ale scoped na `display_config.token`), která vrací jen agregovaná anonymizovaná data. Cache 30 s v paměti + Supabase Realtime invalidation.

Widgety (uživatel si vybere v adminu, který chce zařadit do playlistu):
- **Nabídka ojetých vozů** — 3–6 karet z `vykupy` se stavem "na prodej", foto + značka/model + rok + km + cena. Auto-rotace uvnitř slajdu, pak další slide.
- **Kdo je v práci** — dnes přihlášení zaměstnanci (jen jméno, žádné časy), z `attendance_records`
- **Statistiky dne / týdne** — počet výkupů, hotových zakázek, prodaných vozů (velká čísla, sparkline)
- **Dnešní úkoly týmu** — počet otevřených/dokončených, top 3 dokončené dnes (jen názvy)
- **Počasí + čas** — velké hodiny, počasí z open-meteo (bez API key), nadpis showroomu
- **Novinky / aktuality** — textový feed z nové tabulky `display_news` (admin píše krátké zprávy)

Bezpečnost: server-fn nikdy nevrací PII, ceny/interní data jen z tabulek, kde to admin explicitně povolil. RLS na `display_news` = admin write, anon read.

## 3. Playlist a přehrávání

Rozšíření `slides`:
- `kind` (enum), `payload` (jsonb), `duration_sec` (int, default dle typu), `transition` (fade/slide/kenburns/none)
- `weight` (int) pro častější zobrazování důležitých slajdů
- Zachovat `valid_from` / `valid_to` a `active`

TV runtime:
- Preload dalšího slajdu (obrázek/video) pro plynulé přechody
- Video/YouTube: přehraj do konce nebo `duration_sec`, co nastane dřív
- Widget se refreshuje před zobrazením (fresh data)
- Pokud widget selže (offline), přeskoč a loguj do konzole (nekrachuje smyčka)
- Zachovat wake lock, 6h reload, localStorage fallback

## 4. Vizuální redesign

Po přepnutí do build módu:
1. Playwright screenshot aktuálního `/tv/:token` (fullscreen 1920×1080) + admin `/admin/tv`
2. Ask questions vizuální preference — paleta / typografie / layout (curated presets vhodné pro automotive showroom)
3. `design--create_directions` se screenshotem → 3 varianty (např. "Editorial magazine", "Motion sports", "Minimal luxury")
4. Uživatel vybere → implementace: nové CSS tokeny v `src/styles.css`, layout widgetů, přechody, spodní ticker + hodiny, corner branding

Design constraint: sloty pro obsah zůstávají 1920×1080, text respektuje slide skill (min 28px body, semantic classes).

## 5. Technické detaily

**Migrace DB:**
```sql
ALTER TABLE slides
  ADD COLUMN kind text NOT NULL DEFAULT 'image'
    CHECK (kind IN ('image','video','youtube','rich_text','pdf_page','web_url','data_widget')),
  ADD COLUMN payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN duration_sec integer,
  ADD COLUMN transition text NOT NULL DEFAULT 'fade',
  ADD COLUMN weight integer NOT NULL DEFAULT 1;

CREATE TABLE display_news (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- + GRANT, RLS (anon read active, admin write)
```

**Nové soubory:**
- `src/lib/tv-widgets.functions.ts` — `getTvWidgetData`, `listActiveSlides` (public, token-scoped)
- `src/components/tv/SlideRenderer.tsx` — switch podle `kind`
- `src/components/tv/widgets/*.tsx` — jeden soubor per widget
- `src/routes/tv.$token.tsx` — refaktor na SlideRenderer + preloader

**Dotčené soubory:**
- `src/routes/_authenticated/admin/tv.tsx` — nový editor slajdů (Tabs), správa novinek
- `src/lib/tv.functions.ts` — CRUD pro nové sloupce a `display_news`

**Balíčky:** `pdfjs-dist` (jen pokud budeš chtít PDF widget — mohu vynechat)

## Otevřená rozhodnutí

Před samotnou implementací potvrď (můžu se doptat v build módu):
- Které konkrétní widgety z bodu 2 chceš mít v první iteraci?
- Chceš PDF slajd (přidává balíček ~1 MB) nebo ho vynechat?
- Video slajdy — max délka / velikost, kterou má admin uploadnout?