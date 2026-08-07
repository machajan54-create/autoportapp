import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { BACKUP_TABLES } from "@/lib/backup-tables";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive";

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
    const parts: string[] = ["mimeType='application/vnd.google-apps.folder'", "trashed=false"];
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
  .inputValidator(
    (data: {
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
    if (data.drive_account_email !== undefined)
      patch.drive_account_email = data.drive_account_email;
    if (data.auto_backup_enabled !== undefined)
      patch.auto_backup_enabled = data.auto_backup_enabled;
    if (data.schedule_frequency !== undefined) patch.schedule_frequency = data.schedule_frequency;
    if (data.schedule_time !== undefined) patch.schedule_time = data.schedule_time;
    if (data.schedule_day_of_week !== undefined)
      patch.schedule_day_of_week = data.schedule_day_of_week;
    if (data.schedule_day_of_month !== undefined)
      patch.schedule_day_of_month = data.schedule_day_of_month;
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


// ---------------- ZÁLOHA (deleguje do backup-core.server) ----------------

export const runBackupNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { performBackup } = await import("@/lib/backup-core.server");
    const res = await performBackup({ trigger: "manual", startedBy: context.userId });
    return {
      ok: true,
      runId: res.runId,
      durationMs: res.durationMs,
      tables: res.tables,
      rows: res.rows,
      sizeBytes: res.sizeBytes,
      storageBuckets: res.buckets,
      storageFiles: res.files,
      driveFileName: res.fileName,
      driveWebViewLink: res.webViewLink ?? null,
    };
  });


export const listBackupRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("backup_runs")
      .select(
        "id,kind,status,trigger,started_at,finished_at,duration_ms,size_bytes,tables_count,rows_count,drive_file_id,drive_file_name,drive_web_view_link,error,started_by",
      )
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });

/** Kompletní historie záloh i obnov (databáze, soubory, zdrojový kód). */
export const listBackupHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("backup_runs")
      .select(
        "id,kind,status,trigger,started_at,finished_at,duration_ms,size_bytes,tables_count,rows_count,drive_file_id,drive_file_name,drive_web_view_link,error,started_by",
      )
      .order("started_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);

    const runs = data ?? [];
    const userIds = [...new Set(runs.map((r) => r.started_by).filter(Boolean))] as string[];
    let names: Record<string, string> = {};
    if (userIds.length) {
      const { data: profs } = await context.supabase
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      names = Object.fromEntries(
        (profs ?? []).map((p) => [p.id, p.full_name || p.email || "—"]),
      );
    }

    return {
      runs: runs.map((r) => ({
        ...r,
        started_by_name: r.started_by ? (names[r.started_by] ?? null) : null,
      })),
    };
  });

// ---------------- OBNOVA ZE ZÁLOHY ----------------

export const listBackupFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);

    const { data: settings } = await context.supabase
      .from("backup_settings")
      .select("drive_folder_id, drive_folder_name")
      .eq("singleton", true)
      .maybeSingle();

    if (!settings?.drive_folder_id) {
      throw new Error("Není zvolena složka pro zálohy.");
    }

    const q = encodeURIComponent(
      `'${settings.drive_folder_id}' in parents and trashed = false and name contains 'autoport-backup'`,
    );
    const res = await driveFetch(
      `/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=50&fields=files(id,name,size,modifiedTime,webViewLink)`,
    );
    return {
      folder: settings.drive_folder_name ?? null,
      files: (res?.files ?? []) as Array<{
        id: string;
        name: string;
        size?: string;
        modifiedTime?: string;
        webViewLink?: string;
      }>,
    };
  });

async function downloadDriveFile(fileId: string): Promise<Buffer> {
  const { lovableKey, connKey } = requireEnv();
  const res = await fetch(
    `${GATEWAY_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`,
    {
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connKey,
      },
    },
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stažení zálohy selhalo (${res.status}): ${text.slice(0, 300)}`);
  }
  const ab = await res.arrayBuffer();
  return Buffer.from(ab);
}

export const validateBackupArchive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileId: string; fileName: string }) =>
    z.object({ fileId: z.string().min(1), fileName: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    const { validateArchive } = await import("@/lib/backup-core.server");
    return await validateArchive({ fileId: data.fileId, fileName: data.fileName });
  });

export const restoreBackupFromDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileId: string; fileName?: string; confirm: string }) =>
    z
      .object({
        fileId: z.string().min(1),
        fileName: z.string().optional(),
        confirm: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);

    if (data.confirm !== "OBNOVIT") {
      throw new Error("Pro obnovu je nutné potvrdit napsáním slova OBNOVIT.");
    }

    // Validace archivu před jakýmkoli zápisem
    if (data.fileName) {
      const { validateArchive } = await import("@/lib/backup-core.server");
      const check = await validateArchive({ fileId: data.fileId, fileName: data.fileName });
      if (!check.ok) {
        throw new Error(`Archiv neprošel kontrolou: ${check.errors.join(" ")}`);
      }
      if (check.type !== "database") {
        throw new Error("Zvolený archiv není zálohou databáze.");
      }
    }

    const startedAt = Date.now();
    const { data: run, error: runErr } = await context.supabase
      .from("backup_runs")
      .insert({
        status: "running",
        trigger: "restore",
        kind: "database_restore",
        started_by: context.userId,
        drive_file_id: data.fileId,
        drive_file_name: data.fileName ?? null,
      })
      .select("id")
      .single();
    if (runErr) throw new Error(runErr.message);
    const runId = run.id as string;

    try {
      const gz = await downloadDriveFile(data.fileId);
      const { gunzipSync } = await import("node:zlib");
      const json = gunzipSync(gz).toString("utf8");
      const dump = JSON.parse(json) as Record<string, unknown>;

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // Tabulky, které NIKDY nechceme přepsat (obsahují systémové/aktuální stavy)
      const SKIP_ON_RESTORE = new Set<string>([
        "attendance_employee_pins", // hashe PINů, ať nezablokujeme aktivní zaměstnance
        "pin_attempt_log",
        "audit_log",
        "email_send_log",
        "email_send_state",
        "backup_runs",
        "backup_settings",
      ]);

      const tablesInDump = BACKUP_TABLES.filter(
        (t) => Array.isArray((dump as any)[t]) && !SKIP_ON_RESTORE.has(t),
      );

      let totalRestored = 0;
      const errors: Array<{ table: string; error: string }> = [];

      // 1) Smaž existující řádky (v opačném pořadí kvůli FK)
      for (const t of [...tablesInDump].reverse()) {
        const { error } = await supabaseAdmin
          .from(t as any)
          .delete()
          .not("id", "is", null);
        if (error) {
          errors.push({ table: t, error: `delete: ${error.message}` });
        }
      }

      // 2) Vlož řádky ze zálohy (po dávkách)
      for (const t of tablesInDump) {
        const rows = (dump as any)[t] as any[];
        if (!rows?.length) continue;
        const chunkSize = 500;
        for (let i = 0; i < rows.length; i += chunkSize) {
          const chunk = rows.slice(i, i + chunkSize);
          const { error } = await supabaseAdmin.from(t as any).insert(chunk);
          if (error) {
            errors.push({ table: t, error: `insert: ${error.message}` });
            break;
          }
          totalRestored += chunk.length;
        }
      }

      const duration = Date.now() - startedAt;
      const finalStatus = errors.length === 0 ? "success" : "error";

      await context.supabase
        .from("backup_runs")
        .update({
          status: finalStatus,
          finished_at: new Date().toISOString(),
          duration_ms: duration,
          tables_count: tablesInDump.length,
          rows_count: totalRestored,
          error:
            errors.length === 0
              ? null
              : errors
                  .slice(0, 20)
                  .map((e) => `${e.table}: ${e.error}`)
                  .join("\n")
                  .slice(0, 2000),
        })
        .eq("id", runId);

      return {
        ok: errors.length === 0,
        runId,
        durationMs: duration,
        tables: tablesInDump.length,
        rowsRestored: totalRestored,
        errors: errors.slice(0, 20),
        skipped: [...SKIP_ON_RESTORE],
      };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await context.supabase
        .from("backup_runs")
        .update({
          status: "error",
          finished_at: new Date().toISOString(),
          duration_ms: Date.now() - startedAt,
          error: msg.slice(0, 2000),
        })
        .eq("id", runId);
      throw new Error(msg);
    }
  });

// ---------------- OBNOVA STORAGE SOUBORŮ ----------------

export const listStorageBackupFiles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data: settings } = await context.supabase
      .from("backup_settings")
      .select("drive_folder_id, drive_folder_name")
      .eq("singleton", true)
      .maybeSingle();
    if (!settings?.drive_folder_id) throw new Error("Není zvolena složka pro zálohy.");

    const q = encodeURIComponent(
      `'${settings.drive_folder_id}' in parents and trashed = false and name contains 'autoport-storage-'`,
    );
    const res = await driveFetch(
      `/drive/v3/files?q=${q}&orderBy=modifiedTime desc&pageSize=100&fields=files(id,name,size,modifiedTime,webViewLink)`,
    );
    return {
      folder: settings.drive_folder_name ?? null,
      files: (res?.files ?? []) as Array<{
        id: string;
        name: string;
        size?: string;
        modifiedTime?: string;
        webViewLink?: string;
      }>,
    };
  });

export const restoreStorageFromDrive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { fileId: string; fileName: string; overwrite?: boolean; confirm: string }) =>
    z
      .object({
        fileId: z.string().min(1),
        fileName: z.string().min(1),
        overwrite: z.boolean().optional(),
        confirm: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context);
    if (data.confirm !== "OBNOVIT") {
      throw new Error("Pro obnovu je nutné potvrdit napsáním slova OBNOVIT.");
    }

    const { validateArchive } = await import("@/lib/backup-core.server");
    const check = await validateArchive({ fileId: data.fileId, fileName: data.fileName });
    if (!check.ok) throw new Error(`Archiv neprošel kontrolou: ${check.errors.join(" ")}`);
    if (check.type !== "storage") throw new Error("Zvolený archiv není zálohou souborů (bucketu).");

    const startedAt = Date.now();
    const { data: run } = await context.supabase
      .from("backup_runs")
      .insert({
        status: "running",
        trigger: "restore",
        kind: "storage_restore",
        started_by: context.userId,
        drive_file_id: data.fileId,
        drive_file_name: data.fileName,
      })
      .select("id")
      .single();
    const runId = run?.id as string | undefined;

    try {
      const { restoreStorageArchive } = await import("@/lib/backup-core.server");
      const result = await restoreStorageArchive({
        fileId: data.fileId,
        fileName: data.fileName,
        overwrite: data.overwrite ?? false,
      });
      if (runId) {
        await context.supabase
          .from("backup_runs")
          .update({
            status: result.errors.length === 0 ? "success" : "error",
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
            rows_count: result.restored,
            tables_count: 1,
            error: result.errors.length ? result.errors.join("\n").slice(0, 2000) : null,
          })
          .eq("id", runId);
      }
      return { ok: result.errors.length === 0, ...result };
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (runId) {
        await context.supabase
          .from("backup_runs")
          .update({
            status: "error",
            finished_at: new Date().toISOString(),
            duration_ms: Date.now() - startedAt,
            error: msg.slice(0, 2000),
          })
          .eq("id", runId);
      }
      throw new Error(msg);
    }
  });
