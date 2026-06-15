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

/* ---------- Comments ---------- */

export const listTaskComments = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('task_comments')
      .select('*')
      .eq('task_id', data.taskId)
      .order('created_at', { ascending: true })
    if (error) throw new Error(error.message)
    return { rows: rows ?? [] }
  })

export const addTaskComment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        body: z.string().trim().min(1).max(4000),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const author_name = await lookupName(supabase, userId!)
    const { data: row, error } = await supabase
      .from('task_comments')
      .insert({
        task_id: data.taskId,
        author_id: userId!,
        author_name,
        body: data.body,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { id: row.id }
  })

export const deleteTaskComment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from('task_comments')
      .delete()
      .eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

/* ---------- Attachments ---------- */

export const listTaskAttachments = createServerFn({ method: 'GET' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ taskId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from('task_attachments')
      .select('*')
      .eq('task_id', data.taskId)
      .order('created_at', { ascending: false })
    if (error) throw new Error(error.message)
    return { rows: rows ?? [] }
  })

export const recordTaskAttachment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        taskId: z.string().uuid(),
        file_name: z.string().min(1).max(255),
        storage_path: z.string().min(1).max(500),
        size_bytes: z.number().int().nonnegative().max(50 * 1024 * 1024),
        content_type: z.string().max(127).optional().nullable(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context
    const uploader_name = await lookupName(supabase, userId!)
    const { data: row, error } = await supabase
      .from('task_attachments')
      .insert({
        task_id: data.taskId,
        uploader_id: userId!,
        uploader_name,
        file_name: data.file_name,
        storage_path: data.storage_path,
        size_bytes: data.size_bytes,
        content_type: data.content_type ?? null,
      })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    return { id: row.id }
  })

export const deleteTaskAttachment = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context
    const { data: row } = await supabase
      .from('task_attachments')
      .select('storage_path')
      .eq('id', data.id)
      .maybeSingle()
    if (row?.storage_path) {
      await supabase.storage.from('task-attachments').remove([row.storage_path])
    }
    const { error } = await supabase.from('task_attachments').delete().eq('id', data.id)
    if (error) throw new Error(error.message)
    return { ok: true }
  })

export const getTaskAttachmentUrl = createServerFn({ method: 'POST' })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context
    const { data: row, error } = await supabase
      .from('task_attachments')
      .select('storage_path,file_name')
      .eq('id', data.id)
      .maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) throw new Error('Příloha nenalezena')
    const { data: signed, error: sErr } = await supabase.storage
      .from('task-attachments')
      .createSignedUrl(row.storage_path, 300, { download: row.file_name })
    if (sErr) throw new Error(sErr.message)
    return { url: signed.signedUrl, file_name: row.file_name }
  })