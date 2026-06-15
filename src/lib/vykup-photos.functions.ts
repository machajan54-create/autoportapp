import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { requireSupabaseAuth } from '@/integrations/supabase/auth-middleware'

async function lookupName(supabase: any, userId: string) {
  const { data } = await supabase
    .from('profiles')
    .select('full_name,email')
    .eq('id', userId)
    .maybeSingle()
  return data?.full_name || data?.email || null
}

export const listVykupPhotos = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ vykupId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('vykup_photos')
      .select('*')
      .eq('vykup_id', data.vykupId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return { rows: rows ?? [] }
  })

export const recordVykupPhoto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        vykupId: z.string().uuid(),
        file_name: z.string().min(1).max(255),
        storage_path: z.string().min(1).max(500),
        size_bytes: z.number().int().nonnegative().max(20 * 1024 * 1024),
        content_type: z.string().max(127).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const uploader_name = await lookupName(supabase, userId!)
    const { data: row, error } = await supabase
      .from('vykup_photos')
      .insert({
        vykup_id: data.vykupId,
        file_name: data.file_name,
        storage_path: data.storage_path,
        size_bytes: data.size_bytes,
        content_type: data.content_type ?? null,
        uploader_id: userId!,
        uploader_name,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { id: row.id }
  })

export const updateVykupPhotoDefect = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        has_defect: z.boolean(),
        defect_note: z.string().max(500).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('vykup_photos')
      .update({
        has_defect: data.has_defect,
        defect_note: data.defect_note ?? null,
      })
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const deleteVykupPhoto = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.")
  })

export const getVykupPhotoUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context
    const { data: row, error } = await supabase
      .from('vykup_photos')
      .select('storage_path,file_name')
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) throw new Error('Fotografie nenalezena')
    const { data: signed, error: sErr } = await supabase.storage
      .from('vykup-photos')
      .createSignedUrl(row.storage_path, 600)
    if (sErr) throw new Error(sErr.message)
    return { url: signed.signedUrl, file_name: row.file_name }
  })