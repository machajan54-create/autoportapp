Přidat do TV display (`/tv/:token`) statický, nezapínaný uvítací řádek pro zákaznický koutek, aby byl vidět po celou dobu běhu prezentace.

### Co se změní
1. **Nový prvek v `src/routes/tv.$token.tsx`**
   - Pevný (fixed) skleněný pill umístěný do dolní části obrazovky, nad ticker (pokud je zapnutý) a vedle značkových odznaků.
   - Pozice: dolní centrum, `z-index: 12`, s odsazením přizpůsobeným stavu tickeru.
   - Text: **"Zde je zákaznický koutek – dejte si v klidu kávu a usadte se."**
   - Stylování v souladu s aktuálním TV designem: poloprůhledné pozadí, `backdrop-filter: blur`, bílý text, zaoblené rohy, velké písmo (~28–32 px), volně doplněno ikonou kávy (☕).

2. **Respekt k layoutu**
   - Pill se vykreslí pod obsahovou zónou slajdů (`.tv-content` končí 100 px od spodního okraje), aby nepřekrýval hlavní obsah.
   - Pokud je aktivní ticker, pill se posune nad něj (bottom offset ~100 px); bez tickeru zůstane 20 px nad spodním okrajem.

3. **Bez databázových změn**
   - Text zůstane hardcoded, protože jde o pevné provozní info. Pokud budete chtít text měnit z adminu, navrhnu to jako samostatný krok později.

### Výsledek
Na TV display bude stále vidět přátelská informace pro zákazníky v showroomu, která nebude rotovat ani mizet mezi slajdy.