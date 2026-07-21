import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive";

// Uživatelské tabulky, které se zálohují (bez systémových auth/storage schémat).
const BACKUP_TABLES = [
  "profiles","user_roles","user_modules",
  "attendance_absences","attendance_employees","attendance_employee_pins",
  "attendance_notifications","attendance_pin_ip_allowlist","attendance_records",
  "attendance_settings","attendance_shifts",
  "audit_log","backup_settings","backup_runs",
  "claim_attachments","claim_events","claim_tasks","claims",
  "clients","deal_stage_history","deals","defects","deletion_requests",
  "demo_order_documents","demo_order_events","demo_order_signatures","demo_orders",
  "document_templates","email_send_log","email_send_state","email_unsubscribe_tokens",
  "evidence_orders","evidence_wash_assignments",
  "logbook_entries","logbook_vehicles",
  "pin_attempt_log","purchases","suppliers","suppressed_emails",
  "task_attachments","task_comments","tasks",
  "vykup_photos","vykupy","washers",
] as const;

function requireEnv() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const connKey = process.env.GOOGLE_DRIVE_API_KEY;
  if (!lovableKey || !connKey) {
    throw new Error(
      "Google Disk není propojen. Kontaktujte administrátora Lovable pro propojení konektoru.",
    );
  }
  return { lovableKey, connKey };
}

async function driveFetch(path: string, init?: RequestInit) {
  const { lovableKey, connKey } = requireEnv();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", connKey);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(`${GATEWAY_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Google Disk API selhalo (${res.status}): ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : {};
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nemáte oprávnění.");
}

export const getGoogleDriveStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);

    const { data: settings } = await context.supabase
      .from("backup_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();

    const hasKeys = !!process.env.LOVABLE_API_KEY && !!process.env.GOOGLE_DRIVE_API_KEY;
    if (!hasKeys) {
      return {
        connected: false,
        settings: settings ?? null,
        account: null as null | { emailAddress?: string; displayName?: string; storageQuota?: any },
        error: "Konektor Google Disk není propojen s projektem.",
      };
    }

    try {
      const about = await driveFetch(
        "/drive/v3/about?fields=user(displayName,emailAddress,photoLink),storageQuota(limit,usage,usageInDrive)",
      );
      return {
        connected: true,
        settings: settings ?? null,
        account: {
          emailAddress: about?.user?.emailAddress,
          displayName: about?.user?.displayName,
          photoLink: about?.user?.photoLink,
          storageQuota: about?.storageQuota,
        },
        error: null,
      };
    } catch (e) {
      return {
        connected: false,
        settings: settings ?? null,
        account: null,
        error: e instanceof Error ? e.message : "Neznámá chyba spojení.",
      };
    }
  });

export const listGoogleDriveFolders = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { parentId?: string; query?: string } | undefined) =>
    z
      .object({
        parentId: z.string().optional(),
        query: z.string().optional(),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const parts: string[] = [
      "mimeType='application/vnd.google-apps.folder'",
      "trashed=false",
    ];
    if (data.parentId) parts.push(`'${data.parentId}' in parents`);
    if (data.query) parts.push(`name contains '${data.query.replace(/'/g, "\\'")}'`);
    const q = encodeURIComponent(parts.join(" and "));
    const res = await driveFetch(
      `/drive/v3/files?q=${q}&fields=files(id,name,parents,modifiedTime)&pageSize=100&orderBy=name`,
    );
    return { folders: res.files ?? [] };
  });

export const createGoogleDriveFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { name: string; parentId?: string }) =>
    z.object({ name: z.string().min(1), parentId: z.string().optional() }).parse(data),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const body: any = {
      name: data.name,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (data.parentId) body.parents = [data.parentId];
    const created = await driveFetch(`/drive/v3/files?fields=id,name`, {
      method: "POST",
      body: JSON.stringify(body),
    });
    return created;
  });

export const saveBackupSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    drive_folder_id?: string | null;
    drive_folder_name?: string | null;
    drive_account_email?: string | null;
    auto_backup_enabled?: boolean;
    schedule_frequency?: "interval" | "daily" | "weekly" | "monthly";
    schedule_time?: string;
    schedule_day_of_week?: number;
    schedule_day_of_month?: number;
    schedule_interval_hours?: number;
  }) =>
    z
      .object({
        drive_folder_id: z.string().nullable().optional(),
        drive_folder_name: z.string().nullable().optional(),
        drive_account_email: z.string().nullable().optional(),
        auto_backup_enabled: z.boolean().optional(),
        schedule_frequency: z.enum(["interval", "daily", "weekly", "monthly"]).optional(),
        schedule_time: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Čas musí být ve formátu HH:MM")
          .optional(),
        schedule_day_of_week: z.number().int().min(0).max(6).optional(),
        schedule_day_of_month: z.number().int().min(1).max(31).optional(),
        schedule_interval_hours: z.number().int().min(1).max(168).optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const patch: any = {
      updated_by: context.userId,
      last_connected_at: new Date().toISOString(),
    };
    if (data.drive_folder_id !== undefined) patch.drive_folder_id = data.drive_folder_id;
    if (data.drive_folder_name !== undefined) patch.drive_folder_name = data.drive_folder_name;
    if (data.drive_account_email !== undefined) patch.drive_account_email = data.drive_account_email;
    if (data.auto_backup_enabled !== undefined) patch.auto_backup_enabled = data.auto_backup_enabled;
    if (data.schedule_frequency !== undefined) patch.schedule_frequency = data.schedule_frequency;
    if (data.schedule_time !== undefined) patch.schedule_time = data.schedule_time;
    if (data.schedule_day_of_week !== undefined) patch.schedule_day_of_week = data.schedule_day_of_week;
    if (data.schedule_day_of_month !== undefined) patch.schedule_day_of_month = data.schedule_day_of_month;
    if (data.schedule_interval_hours !== undefined)
      patch.schedule_interval_hours = data.schedule_interval_hours;

    const { data: existing } = await context.supabase
      .from("backup_settings")
      .select("id")
      .eq("singleton", true)
      .maybeSingle();

    if (existing) {
      const { error } = await context.supabase
        .from("backup_settings")
        .update(patch)
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await context.supabase
        .from("backup_settings")
        .insert({ singleton: true, ...patch });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const testGoogleDriveWrite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data: settings } = await context.supabase
      .from("backup_settings")
      .select("drive_folder_id, drive_folder_name")
      .eq("singleton", true)
      .maybeSingle();

    if (!settings?.drive_folder_id) {
      throw new Error("Nejprve zvolte cílovou složku pro zálohy.");
    }

    const { lovableKey, connKey } = requireEnv();
    const boundary = `-------lovable${Date.now()}`;
    const metadata = {
      name: `autoport-test-${new Date().toISOString()}.txt`,
      parents: [settings.drive_folder_id],
    };
    const content = `Test připojení Autoport → Google Disk\nČas: ${new Date().toISOString()}\n`;
    const body =
      `--${boundary}\r\n` +
      `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
      `${JSON.stringify(metadata)}\r\n` +
      `--${boundary}\r\n` +
      `Content-Type: text/plain\r\n\r\n` +
      `${content}\r\n` +
      `--${boundary}--`;

    const res = await fetch(
      `${GATEWAY_BASE}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${lovableKey}`,
          "X-Connection-Api-Key": connKey,
          "Content-Type": `multipart/related; boundary=${boundary}`,
        },
        body,
      },
    );
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Nahrání testovacího souboru selhalo (${res.status}): ${text.slice(0, 300)}`);
    }
    return JSON.parse(text);
  });