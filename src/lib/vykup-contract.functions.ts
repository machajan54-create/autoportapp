import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

function fmtKc(n: number | null | undefined): string {
  if (n == null) return '—'
  return new Intl.NumberFormat('cs-CZ').format(Number(n)) + ' Kč'
}
function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return s
  return d.toLocaleDateString('cs-CZ')
}

/** Returns a base64-encoded PDF of the výkupní smlouva. */
export const generateVykupContract = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vykupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: v, error } = await context.supabase
      .from('vykupy')
      .select('*')
      .eq('id', data.vykupId)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!v) throw new Error('Výkup nenalezen')

    const { PDFDocument, StandardFonts, rgb } = await import('pdf-lib')
    const pdf = await PDFDocument.create()
    pdf.setTitle(`Vykupni smlouva ${v.znacka} ${v.model}`)
    pdf.setProducer('AutoPort')
    pdf.setCreator('AutoPort')

    const page = pdf.addPage([595.28, 841.89]) // A4 portrait, pt
    const { width, height } = page.getSize()
    const font = await pdf.embedFont(StandardFonts.Helvetica)
    const fontB = await pdf.embedFont(StandardFonts.HelveticaBold)

    const marginX = 56
    let y = height - 60
    const black = rgb(0, 0, 0)
    const gray = rgb(0.4, 0.4, 0.4)
    const accent = rgb(0.96, 0.45, 0.05)

    // Helper sanitize: WinAnsi doesn't cover all czech chars in StandardFonts; map basic ones.
    const sanitize = (s: string) =>
      s
        .normalize('NFKD')
        .replace(/[\u0300-\u036f]/g, '')
        // keep ASCII; replace remaining non-ascii with '?'
        .replace(/[^\x20-\x7e\n]/g, '?')

    const draw = (
      text: string,
      x: number,
      yy: number,
      opts: { size?: number; bold?: boolean; color?: any } = {},
    ) => {
      page.drawText(sanitize(text), {
        x,
        y: yy,
        size: opts.size ?? 10,
        font: opts.bold ? fontB : font,
        color: opts.color ?? black,
      })
    }

    // Header bar
    page.drawRectangle({ x: 0, y: height - 36, width, height: 36, color: accent })
    draw('AutoPort', marginX, height - 24, { size: 14, bold: true, color: rgb(1, 1, 1) })
    draw('Vykupni smlouva', width - marginX - 110, height - 24, {
      size: 11,
      bold: true,
      color: rgb(1, 1, 1),
    })

    y = height - 70
    draw('SMLOUVA O KOUPI MOTOROVEHO VOZIDLA', marginX, y, { size: 14, bold: true })
    y -= 16
    draw(`Cislo: ${v.id.slice(0, 8).toUpperCase()}`, marginX, y, { size: 9, color: gray })
    draw(`Datum: ${fmtDate(v.datum_vykupu ?? new Date().toISOString())}`, width - marginX - 150, y, {
      size: 9,
      color: gray,
    })
    y -= 24

    const section = (title: string) => {
      y -= 6
      draw(title, marginX, y, { size: 11, bold: true, color: accent })
      y -= 4
      page.drawLine({
        start: { x: marginX, y },
        end: { x: width - marginX, y },
        thickness: 0.6,
        color: accent,
      })
      y -= 14
    }
    const kv = (k: string, val: string) => {
      draw(k, marginX, y, { size: 10, color: gray })
      draw(val, marginX + 170, y, { size: 10 })
      y -= 14
    }

    section('Prodavajici (klient)')
    kv('Jmeno / firma:', v.klient ?? '—')
    kv('Telefon:', v.telefon ?? '—')

    section('Kupujici')
    kv('AutoPort s.r.o.', '')
    kv('Zastoupeny:', v.zpracoval ?? '—')

    section('Predmet smlouvy — vozidlo')
    kv('Znacka:', v.znacka ?? '—')
    kv('Model:', v.model ?? '—')
    kv('Rok vyroby:', v.rok_vyroby ? String(v.rok_vyroby) : '—')
    kv('Pocet km:', v.pocet_km ? new Intl.NumberFormat('cs-CZ').format(v.pocet_km) : '—')

    section('Kupni cena')
    kv('Vykoupeno za:', fmtKc(v.vykoupeno_za))
    if (v.naceneno_od != null) kv('Naceneno od:', fmtKc(v.naceneno_od))

    if (v.poznamka) {
      section('Poznamka')
      const lines = String(v.poznamka).split(/\n/)
      for (const line of lines) {
        draw(line, marginX, y, { size: 10 })
        y -= 12
      }
    }

    // Signatures
    y = Math.min(y, 200)
    y -= 40
    page.drawLine({
      start: { x: marginX, y },
      end: { x: marginX + 200, y },
      thickness: 0.5,
    })
    page.drawLine({
      start: { x: width - marginX - 200, y },
      end: { x: width - marginX, y },
      thickness: 0.5,
    })
    draw('Prodavajici', marginX, y - 12, { size: 9, color: gray })
    draw('Kupujici', width - marginX - 200, y - 12, { size: 9, color: gray })

    // Footer
    draw(
      'Vygenerovano systemem AutoPort — ' + new Date().toLocaleString('cs-CZ'),
      marginX,
      30,
      { size: 8, color: gray },
    )

    const bytes = await pdf.save()
    // Convert Uint8Array -> base64 (chunked to avoid call stack issues)
    let bin = ''
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    const base64 = btoa(bin)
    const safeName =
      `vykupni-smlouva-${(v.znacka ?? '').toLowerCase()}-${(v.model ?? '').toLowerCase()}-${v.id.slice(0, 8)}.pdf`
        .replace(/\s+/g, '-')
        .replace(/[^a-z0-9.-]/g, '')
    return { base64, file_name: safeName }
  })