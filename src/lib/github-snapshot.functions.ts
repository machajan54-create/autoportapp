import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const DRIVE_GATEWAY = "https://connector-gateway.lovable.dev/google_drive";
const GITHUB_API = "https://api.github.com";

function requireEnv() {
  const lovableKey = process.env.LOVABLE_API_KEY;
  const driveKey = process.env.GOOGLE_DRIVE_API_KEY;
  const ghToken = process.env.GITHUB_TOKEN;
  const missing: string[] = [];
  if (!lovableKey) missing.push("LOVABLE_API_KEY");
  if (!driveKey) missing.push("GOOGLE_DRIVE_API_KEY");
  if (!ghToken) missing.push("GITHUB_TOKEN");
  if (missing.length) {
    throw new Error(
      `Chybí konfigurace: ${missing.join(", ")}. Ověřte propojení Google Disku a token GitHubu.`,
    );
  }
  return { lovableKey: lovableKey!, driveKey: driveKey!, ghToken: ghToken! };
}

async function requireAdmin(context: { supabase: any; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "admin",
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Nemáte oprávnění.");
}

async function githubFetch(path: string, token: string, accept = "application/vnd.github+json") {
  const res = await fetch(`${GITHUB_API}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: accept,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "autoport-backup",
    },
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub API ${res.status}: ${t.slice(0, 300)}`);
  }
  return res;
}

async function uploadTarballToDrive(
  folderId: string,
  name: string,
  content: Buffer,
  mimeType: string,
): Promise<{ id: string; name: string; webViewLink?: string; size?: number }> {
  const { lovableKey, driveKey } = requireEnv();
  const boundary = `-------lovable${Date.now()}`;
  const metadata = { name, parents: [folderId], mimeType };
  const preamble =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: ${mimeType}\r\n` +
    `Content-Transfer-Encoding: binary\r\n\r\n`;
  const closing = `\r\n--${boundary}--`;
  const body = Buffer.concat([Buffer.from(preamble, "utf8"), content, Buffer.from(closing, "utf8")]);

  const res = await fetch(
    `${DRIVE_GATEWAY}/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,size`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": driveKey,
        "Content-Type": `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Nahrání snapshotu na Google Disk selhalo (${res.status}): ${text.slice(0, 300)}`);
  }
  const parsed = JSON.parse(text);
  return { ...parsed, size: parsed.size ? Number(parsed.size) : undefined };
}

// ---- Stav a nastavení GitHub snapshotu ----

export const getGithubSnapshotStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);

    const { data: settings } = await context.supabase
      .from("backup_settings")
      .select(
        "github_owner, github_repo, github_branch, github_auto_enabled, last_github_snapshot_at, drive_folder_id, drive_folder_name",
      )
      .eq("singleton", true)
      .maybeSingle();

    const hasToken = !!process.env.GITHUB_TOKEN;
    let repo: any = null;
    let error: string | null = null;

    if (hasToken && settings?.github_owner && settings?.github_repo) {
      try {
        const res = await githubFetch(
          `/repos/${encodeURIComponent(settings.github_owner)}/${encodeURIComponent(settings.github_repo)}`,
          process.env.GITHUB_TOKEN!,
        );
        const info = await res.json();
        repo = {
          full_name: info.full_name,
          default_branch: info.default_branch,
          private: info.private,
          size_kb: info.size,
          html_url: info.html_url,
          pushed_at: info.pushed_at,
        };
      } catch (e) {
        error = e instanceof Error ? e.message : String(e);
      }
    }

    return {
      hasToken,
      settings: settings ?? null,
      repo,
      error,
    };
  });

export const saveGithubSnapshotSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    github_owner?: string | null;
    github_repo?: string | null;
    github_branch?: string | null;
    github_auto_enabled?: boolean;
  }) =>
    z
      .object({
        github_owner: z.string().max(120).nullable().optional(),
        github_repo: z.string().max(120).nullable().optional(),
        github_branch: z.string().max(120).nullable().optional(),
        github_auto_enabled: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ context, data }) => {
    await requireAdmin(context);
    const patch: any = { updated_by: context.userId };
    if (data.github_owner !== undefined) patch.github_owner = data.github_owner?.trim() || null;
    if (data.github_repo !== undefined) patch.github_repo = data.github_repo?.trim() || null;
    if (data.github_branch !== undefined) patch.github_branch = data.github_branch?.trim() || "main";
    if (data.github_auto_enabled !== undefined) patch.github_auto_enabled = data.github_auto_enabled;

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

// ---- Vytvoření snapshotu (společné jádro pro cron i ruční spuštění) ----

export async function performGithubSnapshot(opts: {
  trigger: "github_manual" | "github_scheduled";
  startedBy?: string | null;
}) {
  const { ghToken } = requireEnv();
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: settings, error: sErr } = await supabaseAdmin
    .from("backup_settings")
    .select("drive_folder_id, github_owner, github_repo, github_branch")
    .eq("singleton", true)
    .maybeSingle();
  if (sErr) throw new Error(sErr.message);
  if (!settings?.drive_folder_id) throw new Error("Není zvolena složka pro zálohy na Google Disku.");
  if (!settings.github_owner || !settings.github_repo) {
    throw new Error("Není nastavený GitHub repozitář (owner/repo).");
  }
  const branch = settings.github_branch || "main";

  const startedAt = Date.now();
  const { data: run, error: runErr } = await supabaseAdmin
    .from("backup_runs")
    .insert({
      status: "running",
      trigger: opts.trigger,
      kind: "github",
      started_by: opts.startedBy ?? null,
    })
    .select("id")
    .single();
  if (runErr) throw new Error(runErr.message);
  const runId = run.id as string;

  try {
    // 1) Zjisti SHA větve, ať víme co jsme vlastně stáhli
    let sha: string | null = null;
    try {
      const refRes = await githubFetch(
        `/repos/${encodeURIComponent(settings.github_owner)}/${encodeURIComponent(settings.github_repo)}/branches/${encodeURIComponent(branch)}`,
        ghToken,
      );
      const refJson = await refRes.json();
      sha = refJson?.commit?.sha ?? null;
    } catch {
      // ignorujeme, tarball i tak stáhneme
    }

    // 2) Stáhni tarball (GitHub redirectuje na codeload)
    const tarRes = await githubFetch(
      `/repos/${encodeURIComponent(settings.github_owner)}/${encodeURIComponent(settings.github_repo)}/tarball/${encodeURIComponent(branch)}`,
      ghToken,
      "application/vnd.github.raw",
    );
    const ab = await tarRes.arrayBuffer();
    const tar = Buffer.from(ab);

    // 3) Nahraj na Disk
    const stamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .replace("T", "_")
      .slice(0, 19);
    const shortSha = sha ? sha.slice(0, 7) : "nosha";
    const filename = `autoport-source-${settings.github_owner}-${settings.github_repo}-${branch}-${stamp}-${shortSha}.tar.gz`;

    const uploaded = await uploadTarballToDrive(
      settings.drive_folder_id,
      filename,
      tar,
      "application/gzip",
    );

    const duration = Date.now() - startedAt;
    await supabaseAdmin
      .from("backup_runs")
      .update({
        status: "success",
        finished_at: new Date().toISOString(),
        duration_ms: duration,
        size_bytes: uploaded.size ?? tar.byteLength,
        drive_file_id: uploaded.id,
        drive_file_name: uploaded.name,
        drive_web_view_link: uploaded.webViewLink ?? null,
      })
      .eq("id", runId);

    await supabaseAdmin
      .from("backup_settings")
      .update({ last_github_snapshot_at: new Date().toISOString() })
      .eq("singleton", true);

    return {
      ok: true,
      runId,
      durationMs: duration,
      sizeBytes: uploaded.size ?? tar.byteLength,
      driveFileName: uploaded.name,
      driveWebViewLink: uploaded.webViewLink ?? null,
      sha,
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

export const runGithubSnapshotNow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    return performGithubSnapshot({ trigger: "github_manual", startedBy: context.userId });
  });

export const listGithubSnapshotRuns = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context);
    const { data, error } = await context.supabase
      .from("backup_runs")
      .select(
        "id,status,trigger,started_at,finished_at,duration_ms,size_bytes,drive_file_name,drive_web_view_link,error",
      )
      .eq("kind", "github")
      .order("started_at", { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return { runs: data ?? [] };
  });