/**
 * Jádro záloh a obnovy na Google Disk (server-only).
 * Používá se ze server funkcí i z cron endpointu.
 */
import { BACKUP_TABLES, BACKUP_BUCKETS } from "@/lib/backup-tables";

const GATEWAY_BASE = "https://connector-gateway.lovable.dev/google_drive";

export function requireDriveEnv() {
  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connKey = process.env["GOOGLE_DRIVE_API_KEY"];
  if (!lovableKey || !connKey) {
    throw new Error("Google Disk není propojen s projektem.");
  }
  return { lovableKey, connKey };
}

export async function driveFetchCore(path: string, init?: RequestInit) {
  const { lovableKey, connKey } = requireDriveEnv();
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${lovableKey}`);
  headers.set("X-Connection-Api-Key", connKey);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(`${GATEWAY_BASE}${path}`, { ...init, headers });
  const text = await res.text();
  if (!res.ok) throw new Error(`Google Disk API selhalo (${res.status}): ${text.slice(0, 300)}`);
  return text ? JSON.parse(text) : {};
}

export async function uploadGzipToDrive(
  folderId: string,
  name: string,
  content: Buffer,
): Promise<{ id: string; name: string; webViewLink?: string; size?: number }> {
  const { lovableKey, connKey } = requireDriveEnv();
  const boundary = `-------lovable${Date.now()}`;
  const metadata = { name, parents: [folderId], mimeType: "application/gzip" };
  const preamble =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/gzip\r\n` +
    `Content-Transfer-Encoding: binary\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(preamble, "utf8"), content, Buffer.from(closing, "utf8")]);

  const res = await fetch(
    `${GATEWAY_BASE}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size`,
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
  if (!res.ok) throw new Error(`Nahrání zálohy selhalo (${res.status}): ${text.slice(0, 300)}`);
  const parsed = JSON.parse(text);
  return { ...parsed, size: parsed.size ? Number(parsed.size) : undefined };
}

export async function downloadDriveFileCore(fileId: string): Promise<Buffer> {
  const { lovableKey, connKey } = requireDriveEnv();
  const res = await fetch(`${GATEWAY_BASE}/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": connKey },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Stažení zálohy selhalo (${res.status}): ${text.slice(0, 300)}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

// ---------------- TAR ----------------

function tarHeader(name: string, size: number): Buffer {
  const buf = Buffer.alloc(512, 0);
  buf.write(name.slice(0, 100), 0, "utf8");
  buf.write("0000644\0", 100, "ascii");
  buf.write("0000000\0", 108, "ascii");
  buf.write("0000000\0", 116, "ascii");
  buf.write(size.toString(8).padStart(11, "0") + "\0", 124, "ascii");
  buf.write(
    Math.floor(Date.now() / 1000)
      .toString(8)
      .padStart(11, "0") + "\0",
    136,
    "ascii",
  );
  buf.write("0", 156, "ascii");
  buf.write("ustar\0", 257, "ascii");
  buf.write("00", 263, "ascii");
  buf.write("        ", 148, "ascii");
  let chk = 0;
  for (let i = 0; i < 512; i++) chk += buf[i]!;
  buf.write(chk.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
  return buf;
}

export function buildTar(entries: { name: string; data: Buffer }[]): Buffer {
  const parts: Buffer[] = [];
  for (const e of entries) {
    parts.push(tarHeader(e.name, e.data.length));
    parts.push(e.data);
    const rem = e.data.length % 512;
    if (rem > 0) parts.push(Buffer.alloc(512 - rem, 0));
  }
  parts.push(Buffer.alloc(1024, 0));
  return Buffer.concat(parts);
}

export function parseTar(buf: Buffer): { name: string; data: Buffer }[] {
  const out: { name: string; data: Buffer }[] = [];
  let off = 0;
  while (off + 512 <= buf.length) {
    const header = buf.subarray(off, off + 512);
    const rawName = header.subarray(0, 100).toString("utf8").replace(/\0.*$/, "");
    if (!rawName) break; // end-of-archive
    const sizeStr = header.subarray(124, 136).toString("ascii").replace(/\0.*$/, "").trim();
    const size = parseInt(sizeStr || "0", 8) || 0;
    const start = off + 512;
    out.push({ name: rawName, data: buf.subarray(start, start + size) });
    off = start + Math.ceil(size / 512) * 512;
  }
  return out;
}

// ---------------- STORAGE ----------------

export async function listAllObjects(
  supabaseAdmin: any,
  bucket: string,
  prefix = "",
): Promise<{ path: string }[]> {
  const results: { path: string }[] = [];
  const limit = 1000;
  let offset = 0;
  while (true) {
    const { data, error } = await supabaseAdmin.storage
      .from(bucket)
      .list(prefix, { limit, offset, sortBy: { column: "name", order: "asc" } });
    if (error) {
      console.warn(`[backup] bucket ${bucket} prefix "${prefix}" list error:`, error.message);
      break;
    }
    if (!data || data.length === 0) break;
    for (const item of data) {
      const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
      if (!item.metadata) {
        results.push(...(await listAllObjects(supabaseAdmin, bucket, fullPath)));
      } else {
        results.push({ path: fullPath });
      }
    }
    if (data.length < limit) break;
    offset += limit;
  }
  return results;
}

async function downloadStorageFile(
  supabaseAdmin: any,
  bucket: string,
  path: string,
): Promise<Buffer | null> {
  const { data, error } = await supabaseAdmin.storage.from(bucket).download(path);
  if (error || !data) {
    console.warn(`[backup] bucket ${bucket} soubor ${path} chyba:`, error?.message);
    return null;
  }
  return Buffer.from(await (data as Blob).arrayBuffer());
}

export async function backupStorageBuckets(
  supabaseAdmin: any,
  folderId: string,
): Promise<{ bucketsCount: number; filesCount: number; sizeBytes: number }> {
  const { gzipSync } = await import("node:zlib");
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
  let bucketsCount = 0;
  let filesCount = 0;
  let sizeBytes = 0;

  for (const bucket of BACKUP_BUCKETS) {
    try {
      const objects = await listAllObjects(supabaseAdmin, bucket);
      if (objects.length === 0) continue;
      const entries: { name: string; data: Buffer }[] = [];
      for (const obj of objects) {
        const b = await downloadStorageFile(supabaseAdmin, bucket, obj.path);
        if (b) entries.push({ name: obj.path, data: b });
      }
      if (entries.length === 0) continue;
      const gz = gzipSync(buildTar(entries), { level: 9 });
      const uploaded = await uploadGzipToDrive(
        folderId,
        `autoport-storage-${bucket}-${stamp}.tar.gz`,
        gz,
      );
      bucketsCount += 1;
      filesCount += entries.length;
      sizeBytes += uploaded.size ?? gz.byteLength;
    } catch (e) {
      console.warn(`[backup] bucket ${bucket} selhal:`, e instanceof Error ? e.message : e);
    }
  }
  return { bucketsCount, filesCount, sizeBytes };
}

export type ArchiveValidation = {
  ok: boolean;
  type: "database" | "storage" | "unknown";
  bucket: string | null;
  tables: Array<{ table: string; rows: number; known: boolean }>;
  files: Array<{ path: string; size: number }>;
  filesCount: number;
  totalBytes: number;
  errors: string[];
  warnings: string[];
};

/**
 * Ověří archiv na Disku bez jakéhokoli zápisu (dry-run).
 * Zkontroluje gzip formát, typ archivu, název bucketu a obsah.
 */
export async function validateArchive(params: {
  fileId: string;
  fileName: string;
}): Promise<ArchiveValidation> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const out: ArchiveValidation = {
    ok: false,
    type: "unknown",
    bucket: null,
    tables: [],
    files: [],
    filesCount: 0,
    totalBytes: 0,
    errors,
    warnings,
  };

  const isStorage = /^autoport-storage-/.test(params.fileName);
  const isDb = /^autoport-(backup|db)-/.test(params.fileName) || params.fileName.endsWith(".json.gz");
  out.type = isStorage ? "storage" : isDb ? "database" : "unknown";

  let raw: Buffer;
  try {
    raw = await downloadDriveFileCore(params.fileId);
  } catch (e) {
    errors.push(`Soubor se nepodařilo stáhnout: ${e instanceof Error ? e.message : String(e)}`);
    return out;
  }
  if (raw.byteLength < 3 || raw[0] !== 0x1f || raw[1] !== 0x8b) {
    errors.push("Soubor není platný gzip archiv (.gz).");
    return out;
  }

  let plain: Buffer;
  try {
    const { gunzipSync } = await import("node:zlib");
    plain = gunzipSync(raw);
  } catch (e) {
    errors.push(`Archiv se nepodařilo rozbalit: ${e instanceof Error ? e.message : String(e)}`);
    return out;
  }

  if (isStorage) {
    const match = /^autoport-storage-(.+?)-\d{4}-\d{2}-\d{2}_/.exec(params.fileName);
    const bucket = match?.[1] ?? null;
    out.bucket = bucket;
    if (!bucket) {
      errors.push(
        `Z názvu souboru nelze určit bucket (očekáváno autoport-storage-<bucket>-<datum>.tar.gz).`,
      );
    } else if (!(BACKUP_BUCKETS as readonly string[]).includes(bucket)) {
      errors.push(
        `Bucket "${bucket}" není mezi zálohovanými buckety (${BACKUP_BUCKETS.join(", ")}).`,
      );
    }
    let entries: { name: string; data: Buffer }[] = [];
    try {
      entries = parseTar(plain);
    } catch (e) {
      errors.push(`Obsah archivu není platný TAR: ${e instanceof Error ? e.message : String(e)}`);
      return out;
    }
    if (entries.length === 0) errors.push("Archiv neobsahuje žádné soubory.");
    out.filesCount = entries.length;
    out.totalBytes = entries.reduce((s, e) => s + e.data.byteLength, 0);
    out.files = entries.slice(0, 25).map((e) => ({ path: e.name, size: e.data.byteLength }));
    const empty = entries.filter((e) => e.data.byteLength === 0).length;
    if (empty > 0) warnings.push(`${empty} souborů v archivu má nulovou velikost.`);

    if (bucket && errors.length === 0) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { error } = await supabaseAdmin.storage.from(bucket).list("", { limit: 1 });
        if (error) errors.push(`Bucket "${bucket}" není v aplikaci dostupný: ${error.message}`);
      } catch (e) {
        warnings.push(`Bucket se nepodařilo ověřit: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  } else {
    let dump: Record<string, unknown>;
    try {
      dump = JSON.parse(plain.toString("utf8")) as Record<string, unknown>;
    } catch (e) {
      errors.push(`Archiv neobsahuje platný JSON dump: ${e instanceof Error ? e.message : String(e)}`);
      return out;
    }
    if (!dump || typeof dump !== "object" || Array.isArray(dump)) {
      errors.push("Struktura dumpu není očekávaný objekt tabulek.");
      return out;
    }
    out.type = "database";
    const keys = Object.keys(dump).filter((k) => Array.isArray((dump as any)[k]));
    if (keys.length === 0) errors.push("Dump neobsahuje žádné tabulky.");
    out.tables = keys.map((k) => ({
      table: k,
      rows: ((dump as any)[k] as unknown[]).length,
      known: (BACKUP_TABLES as readonly string[]).includes(k),
    }));
    out.totalBytes = plain.byteLength;
    const unknown = out.tables.filter((t) => !t.known).map((t) => t.table);
    if (unknown.length) warnings.push(`Neznámé tabulky (přeskočí se): ${unknown.join(", ")}`);
    const missing = (BACKUP_TABLES as readonly string[]).filter((t) => !keys.includes(t));
    if (missing.length) warnings.push(`V záloze chybí tabulky: ${missing.join(", ")}`);
  }

  out.ok = errors.length === 0;
  return out;
}

/** Obnoví soubory jednoho bucketu z .tar.gz archivu na Disku. */
export async function restoreStorageArchive(params: {
  fileId: string;
  fileName: string;
  overwrite: boolean;
}): Promise<{ bucket: string; restored: number; skipped: number; errors: string[] }> {
  const match = /^autoport-storage-(.+?)-\d{4}-\d{2}-\d{2}_/.exec(params.fileName);
  const bucket = match?.[1];
  if (!bucket) {
    throw new Error(
      `Z názvu souboru "${params.fileName}" nelze určit bucket (očekáváno autoport-storage-<bucket>-<datum>.tar.gz).`,
    );
  }
  if (!(BACKUP_BUCKETS as readonly string[]).includes(bucket)) {
    throw new Error(`Bucket "${bucket}" není v seznamu zálohovaných bucketů.`);
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { gunzipSync } = await import("node:zlib");
  const tar = gunzipSync(await downloadDriveFileCore(params.fileId));
  const entries = parseTar(tar);

  let restored = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const entry of entries) {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(entry.name, entry.data, { upsert: params.overwrite });
    if (error) {
      if (!params.overwrite && /exists/i.test(error.message)) skipped += 1;
      else if (errors.length < 20) errors.push(`${entry.name}: ${error.message}`);
    } else {
      restored += 1;
    }
  }

  return { bucket, restored, skipped, errors };
}

/** Kompletní záloha: databáze + storage buckety. Volatelné z cronu i z UI. */
export async function performBackup(params: {
  trigger: string;
  startedBy: string | null;
}): Promise<{
  ok: true;
  runId: string;
  durationMs: number;
  tables: number;
  rows: number;
  sizeBytes: number;
  fileName: string;
  webViewLink?: string | null;
  buckets: number;
  files: number;
}> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: settings } = await supabaseAdmin
    .from("backup_settings")
    .select("drive_folder_id")
    .eq("singleton", true)
    .maybeSingle();
  if (!settings?.drive_folder_id) throw new Error("Nejprve zvolte cílovou složku pro zálohy.");

  const startedAt = Date.now();
  const { data: run, error: runErr } = await supabaseAdmin
    .from("backup_runs")
    .insert({ status: "running", trigger: params.trigger, started_by: params.startedBy })
    .select("id")
    .single();
  if (runErr) throw new Error(runErr.message);
  const runId = run.id as string;

  try {
    const dump: Record<string, unknown> = {
      __meta: { generated_at: new Date().toISOString(), app: "autoport", version: 1 },
    };
    let totalRows = 0;
    let tablesCount = 0;

    for (const table of BACKUP_TABLES) {
      const rows: any[] = [];
      const pageSize = 1000;
      let from = 0;
      while (true) {
        const { data, error } = await supabaseAdmin
          .from(table as any)
          .select("*")
          .range(from, from + pageSize - 1);
        if (error) {
          console.warn(`[backup] tabulka ${table} přeskočena:`, error.message);
          break;
        }
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < pageSize) break;
        from += pageSize;
      }
      dump[table] = rows;
      totalRows += rows.length;
      tablesCount += 1;
    }

    const { gzipSync } = await import("node:zlib");
    const gz = gzipSync(Buffer.from(JSON.stringify(dump), "utf8"), { level: 9 });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").replace("T", "_").slice(0, 19);
    const uploaded = await uploadGzipToDrive(
      settings.drive_folder_id,
      `autoport-backup-${stamp}.json.gz`,
      gz,
    );

    const storage = await backupStorageBuckets(supabaseAdmin, settings.drive_folder_id);
    const totalSize = (uploaded.size ?? gz.byteLength) + storage.sizeBytes;
    const duration = Date.now() - startedAt;

    await supabaseAdmin
      .from("backup_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        size_bytes: totalSize,
        tables_count: tablesCount,
        rows_count: totalRows,
        drive_file_id: uploaded.id,
        drive_file_name: uploaded.name,
        drive_web_view_link: uploaded.webViewLink ?? null,
      })
      .eq("id", runId);

    await supabaseAdmin
      .from("backup_settings")
      .update({ last_backup_at: new Date().toISOString() })
      .eq("singleton", true);

    return {
      ok: true,
      runId,
      durationMs: duration,
      tables: tablesCount,
      rows: totalRows,
      sizeBytes: totalSize,
      fileName: uploaded.name,
      webViewLink: uploaded.webViewLink ?? null,
      buckets: storage.bucketsCount,
      files: storage.filesCount,
    };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    await supabaseAdmin
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
}

/** Rozhodne podle nastavení, jestli je záloha právě teď „na řadě". */
export function isBackupDue(settings: any, now = new Date()): boolean {
  if (!settings?.auto_backup_enabled) return false;
  const last = settings.last_backup_at ? new Date(settings.last_backup_at) : null;
  const freq = settings.schedule_frequency ?? "daily";

  if (freq === "interval") {
    const hours = Number(settings.schedule_interval_hours ?? 24);
    if (!last) return true;
    return now.getTime() - last.getTime() >= hours * 3600_000;
  }

  // Čas v pražském pásmu
  const prague = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Prague" }));
  const [h, m] = String(settings.schedule_time ?? "02:00")
    .split(":")
    .map((v: string) => parseInt(v, 10));
  const scheduled = new Date(prague);
  scheduled.setHours(h || 0, m || 0, 0, 0);
  if (prague < scheduled) return false;

  if (freq === "weekly" && prague.getDay() !== Number(settings.schedule_day_of_week ?? 1))
    return false;
  if (freq === "monthly" && prague.getDate() !== Number(settings.schedule_day_of_month ?? 1))
    return false;

  if (!last) return true;
  const lastPrague = new Date(last.toLocaleString("en-US", { timeZone: "Europe/Prague" }));
  return lastPrague < scheduled;
}
