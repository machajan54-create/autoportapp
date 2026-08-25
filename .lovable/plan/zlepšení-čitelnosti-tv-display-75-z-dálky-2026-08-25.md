# Zlepšení čitelnosti TV Display (75" z dálky)

Cíl: aby vše na obrazovce bylo čitelné ze 3–6 metrů. Hlavní slidy jsou v pořádku, problém je pravý sidebar, ticker a nízké průhlednosti textu.

## Co je dnes špatně (zjištěno v kódu)

Vše je navrženo na plochu 1920×1080, která se škáluje na TV. Na 75" TV je 1 px ≈ 0,86 mm, takže text pod ~24 px je z odstupu nečitelný.

- Sidebar používá drobná písma: popisky statistik 12 px, „Online“ 12 px, jména lidí 16 px, novinky 14 px, nadpisy sekcí 11 px.
- Text má nízkou průhlednost: 0.4–0.6 u popisků, 0.75 u tělového textu slidů — na světlém pozadí fotky mizí.
- Ticker (běžící text dole) má 26 px při výšce pruhu 80 px a běží 45 s na celou šířku – pomalu a nevýrazně.
- Tělový text slidů (30 px) a některé bullety mají jen textový stín, chybí souvislý tmavý překryv pod textem u slidů s fotkou.
- Hodnoty statistik 40 px vs. popisek 12 px — velký nepoměr, popisek se ztrácí.

## Návrh změn (jen vzhled, žádná logika)

1. Minimální velikost písma na displeji = 20 px, u hodnot a jmen 28–40 px.
   - Popisky statistik 12 → 20 px, hodnoty 40 → 52 px.
   - Jména „Kdo je v práci“ 16 → 30 px, avatar 42 → 56 px.
   - Novinky v sidebaru: titulek 22 → 32 px, text 14 → 22 px.
   - Nadpisy sekcí sidebaru 11 → 18 px, letterspacing zachovat.
2. Zvýšit kontrast: minimální opacity textu 0.75 (dnes 0.4–0.6), tělový text slidů 0.75 → 0.88.
3. Přidat pod texty na slidech s fotkou souvislý tmavý gradientní scrim (zleva/zdola), aby text nikdy nesplýval s obrázkem.
4. Ticker: pruh 80 → 96 px, písmo 26 → 34 px, tučnější, rychlost přizpůsobit délce textu (aby krátký text nebyl 45 s pryč z obrazovky).
5. Sjednotit typografickou škálu do CSS proměnných (`--tv-fs-xs/sm/md/lg`) místo desítek inline `fontSize`, aby šlo velikost celého displeje škálovat jedním místem.
6. Volitelně: v administraci `/admin/tv` přepínač „Velké písmo (vzdálené sledování)“, který zvětší celou škálu o ~15 %.

## Technické detaily

- Soubory: `src/components/tv/TvDisplay.tsx` (sidebar, ticker, globální `<style>` blok s `.tv-*` třídami) a `src/components/tv/SlideRenderer.tsx` (inline styly slidů).
- Škálovací plocha 1920×1080 a `useTvScale` zůstávají beze změny.
- Bod 6 by vyžadoval nový sloupec v `display_config` (např. `text_scale`), proto ho udělám jen pokud ho potvrdíš.

## Kontrola

Po úpravě pořídím screenshot TV displeje v 1920×1080 a ověřím, že žádný text není menší než 20 px designové plochy.
