import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const CLAIM_STATUS_LABEL: Record<string, string> = {
  new: "Nová",
  in_progress: "V řešení",
  in_repair: "V opravě",
  waiting_vat: "Čeká na DPH",
  done: "Hotovo",
  closed: "Uzavřeno",
};

const attachmentSchema = z.object({
  category: z.string(),
  file_path: z.string(),
  file_name: z.string(),
  mime_type: z.string().optional(),
  size: z.number().optional(),
});

const claimInput = z.object({
  first_name: z.string().min(1),
  last_name: z.string().min(1),
  company: z.string().optional().nullable(),
  ico: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal("")),
  insurer: z.string().optional().nullable(),
  claim_number: z.string().optional().nullable(),
  event_at: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  liquidation_type: z.string().optional().nullable(),
  vat_payer: z.string().optional().nullable(),
  loan_lease: z.string().optional().nullable(),
  accident_record: z.string().optional().nullable(),
  insurer_record: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  signature: z.string().min(10),
  attachments: z.array(attachmentSchema).optional().default([]),
});

export const createClaim = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => claimInput.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { attachments, email, event_at, ...rest } = data;
    const { data: claim, error } = await supabaseAdmin
      .from("claims")
      .insert({
        ...rest,
        email: email || null,
        event_at: event_at || null,
      })
      .select("id,pu_number,upload_token")
      .single();
    if (error) throw new Error(error.message);
    if (attachments && attachments.length) {
      const rows = attachments.map((a) => ({ ...a, claim_id: claim.id }));
      const { error: aerr } = await supabaseAdmin.from("claim_attachments").insert(rows);
      if (aerr) throw new Error(aerr.message);
    }
    // Notify super admin about new claim
    await (
      await import("@/lib/email/notify.server")
    ).notifyAdmins({
      templateName: "approval-request",
      templateData: {
        kind: "claim",
        requesterName: `${rest.first_name} ${rest.last_name}`,
        title: `Reklamace ${claim.pu_number ?? ""}`.trim(),
        details: rest.notes ?? "",
        meta: [
          ...(email ? [{ label: "E-mail", value: email }] : []),
          ...(rest.phone ? [{ label: "Telefon", value: rest.phone }] : []),
          ...(rest.insurer ? [{ label: "Pojišťovna", value: rest.insurer }] : []),
        ],
        actionUrl: `https://www.autoport-app.cz/vykupy`,
      },
    });
    return { id: claim.id, pu_number: claim.pu_number, upload_token: claim.upload_token };
  });

export const getPendingApprovalsCount = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) return { count: 0 };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count } = await supabaseAdmin
      .from("profiles")
      .select("id", { count: "exact", head: true })
      .eq("approved", false);
    return { count: count ?? 0 };
  });

export const listClaims = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("claims")
      .select(
        "id,pu_number,status,vat_paid,first_name,last_name,phone,insurer,claim_number,event_at,created_at",
      )
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data;
  });

export const getClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: claim, error } = await context.supabase
      .from("claims")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: attachments } = await context.supabase
      .from("claim_attachments")
      .select("*")
      .eq("claim_id", data.id)
      .order("created_at", { ascending: true });
    const signed = await Promise.all(
      (attachments ?? []).map(async (a) => {
        const { data: s } = await context.supabase.storage
          .from("claim-files")
          .createSignedUrl(a.file_path, 3600);
        return { ...a, url: s?.signedUrl ?? null };
      }),
    );
    const { data: events } = await context.supabase
      .from("claim_events")
      .select("*")
      .eq("claim_id", data.id)
      .order("created_at", { ascending: false });
    const { data: tasks } = await context.supabase
      .from("claim_tasks")
      .select("*")
      .eq("claim_id", data.id)
      .order("created_at", { ascending: true });
    return { claim, attachments: signed, events: events ?? [], tasks: tasks ?? [] };
  });

export const updateClaimStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "in_repair", "waiting_vat", "done", "in_progress", "closed"]),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("claims")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase
      .from("claim_events")
      .insert({ claim_id: data.id, type: "status", message: `Stav změněn na ${data.status}` });
    // Notify claim's client about status change
    const { data: claim } = await context.supabase
      .from("claims")
      .select("email, first_name, last_name, pu_number")
      .eq("id", data.id)
      .maybeSingle();
    // Audit log
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "claims",
        action: "status_change",
        entityId: data.id,
        entityLabel: claim?.pu_number ?? data.id,
        details: { status: data.status },
      });
    }
    if (claim?.email) {
      const isApproved = data.status === "done";
      const isRejected = data.status === "closed";
      await (
        await import("@/lib/email/notify.server")
      ).enqueueTransactionalEmail({
        templateName: "approval-decision",
        recipientEmail: claim.email,
        idempotencyKey: `claim-${data.id}-${data.status}`,
        templateData: {
          kind: "claim",
          status: isApproved ? "approved" : isRejected ? "rejected" : data.status,
          recipientName: `${claim.first_name ?? ""} ${claim.last_name ?? ""}`.trim(),
          title: `Reklamace ${claim.pu_number ?? ""}`.trim(),
          meta: [{ label: "Aktuální stav", value: CLAIM_STATUS_LABEL[data.status] ?? data.status }],
          actionUrl: "https://www.autoport-app.cz",
        },
      });
    }
    return { ok: true };
  });

export const setVatPaid = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), paid: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("claims")
      .update({ vat_paid: data.paid })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await context.supabase.from("claim_events").insert({
      claim_id: data.id,
      type: "vat",
      message: data.paid ? "DPH označeno jako zaplacené" : "DPH vráceno do nezaplaceno",
    });
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "claims",
        action: data.paid ? "vat_paid" : "vat_unpaid",
        entityId: data.id,
      });
    }
    return { ok: true };
  });

export const addTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ claim_id: z.string().uuid(), title: z.string().min(1).max(500) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("claim_tasks")
      .insert({ claim_id: data.claim_id, title: data.title });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const toggleTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), done: z.boolean() }).parse(d))
  .handler(async ({ context, data }) => {
    const { error } = await context.supabase
      .from("claim_tasks")
      .update({ done: data.done })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteTask = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

export const deleteClaim = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async () => {
    throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
  });

export const notifyClient = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: claim } = await context.supabase
      .from("claims")
      .select("email,first_name,last_name,pu_number")
      .eq("id", data.id)
      .single();
    if (!claim?.email) throw new Error("Klient neuvedl e-mail.");
    await context.supabase.from("claim_events").insert({
      claim_id: data.id,
      type: "notify",
      message: `Odesláno upozornění klientovi na ${claim.email}`,
    });
    return { ok: true, email: claim.email };
  });

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: profiles } = await context.supabase
      .from("profiles")
      .select("id,email,full_name,created_at,approved,department,is_department_head")
      .order("created_at", { ascending: false });
    const { data: roles } = await context.supabase.from("user_roles").select("user_id,role");
    const { data: modules } = await context.supabase.from("user_modules").select("user_id,module");
    // Načti banned_until pro každého uživatele (super admin)
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = !!meRoles?.some((r) => r.role === "admin");
    const bannedMap = new Map<string, string | null>();
    if (isAdmin) {
      try {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: au } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        for (const u of au?.users ?? []) {
          bannedMap.set(u.id, (u as any).banned_until ?? null);
        }
      } catch {
        // tichá degradace, banned info bude nedostupné
      }
    }
    // Spočítej vedoucího pro každé oddělení
    const headByDept = new Map<
      string,
      { id: string; full_name: string | null; email: string | null }
    >();
    for (const p of profiles ?? []) {
      if (
        (p as any).is_department_head &&
        (p as any).department &&
        !headByDept.has((p as any).department)
      ) {
        headByDept.set((p as any).department, { id: p.id, full_name: p.full_name, email: p.email });
      }
    }
    return (profiles ?? []).map((p) => {
      const bu = bannedMap.get(p.id) ?? null;
      const banned = !!bu && new Date(bu).getTime() > Date.now();
      const userRoles = (roles ?? []).filter((r) => r.user_id === p.id).map((r) => r.role);
      const isUserAdmin = userRoles.includes("admin");
      const dept = (p as any).department as string | null;
      const head = dept ? (headByDept.get(dept) ?? null) : null;
      // Nadřízený: vedoucí oddělení (pokud existuje a není to on sám), jinak super admin
      const supervisor =
        !isUserAdmin && head && head.id !== p.id
          ? { id: head.id, name: head.full_name || head.email || "—" }
          : null;
      return {
        ...p,
        roles: userRoles,
        modules: (modules ?? []).filter((m) => m.user_id === p.id).map((m) => m.module),
        banned,
        banned_until: bu,
        supervisor,
      };
    });
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        role: z.enum(["admin", "employee"]),
        enable: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enable) {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: data.user_id, role: data.role }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin
        .from("user_roles")
        .delete()
        .eq("user_id", data.user_id)
        .eq("role", data.role);
    }
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "users",
        action: data.enable ? "role_grant" : "role_revoke",
        entityId: data.user_id,
        details: { role: data.role },
      });
    }
    return { ok: true };
  });

export const setUserModule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        module: z.enum([
          "claims",
          "vykupy",
          "vykupy_external",
          "users",
          "approvals",
          "dashboard",
          "dochazka",
          "defects",
          "deals",
          "logbook",
          "tasks",
          "demo_orders",
          "evidence_zakazek",
        ]),
        enable: z.boolean(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (data.enable) {
      await supabaseAdmin
        .from("user_modules")
        .upsert({ user_id: data.user_id, module: data.module }, { onConflict: "user_id,module" });
    } else {
      await supabaseAdmin
        .from("user_modules")
        .delete()
        .eq("user_id", data.user_id)
        .eq("module", data.module);
    }
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "users",
        action: data.enable ? "module_grant" : "module_revoke",
        entityId: data.user_id,
        details: { module: data.module },
      });
    }
    return { ok: true };
  });

export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: roles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    const isAdmin = (roles ?? []).some((r) => r.role === "admin");
    const { data: profile } = await context.supabase
      .from("profiles")
      .select("approved, full_name, email")
      .eq("id", context.userId)
      .maybeSingle();
    const approved = isAdmin || !!profile?.approved;
    const userName = (profile?.full_name || profile?.email || "").trim();
    if (isAdmin) {
      return {
        isAdmin: true,
        approved: true,
        userId: context.userId,
        userName,
        modules: [
          "claims",
          "vykupy",
          "vykupy_external",
          "users",
          "approvals",
          "dashboard",
          "dochazka",
          "defects",
          "deals",
          "logbook",
          "tasks",
          "demo_orders",
          "evidence_zakazek",
        ] as const,
      };
    }
    const { data: mods } = await context.supabase
      .from("user_modules")
      .select("module")
      .eq("user_id", context.userId);
    return {
      isAdmin: false,
      approved,
      userId: context.userId,
      userName,
      modules: (mods ?? []).map((m) => m.module),
    };
  });

export const setUserApproved = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), approved: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ approved: data.approved })
      .eq("id", data.user_id);
    if (error) throw new Error(error.message);
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "users",
        action: data.approved ? "approved" : "unapproved",
        entityId: data.user_id,
      });
    }
    return { ok: true };
  });

export const adminCreateUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        email: z.string().email().max(255),
        password: z.string().min(8).max(128),
        full_name: z.string().min(1).max(200),
        role: z.enum(["admin", "employee"]).default("employee"),
        approved: z.boolean().default(true),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { full_name: data.full_name },
    });
    if (error) throw new Error(error.message);
    const newId = created.user!.id;
    // The trigger creates a profile + employee role; adjust to requested role + approval.
    if (data.role === "admin") {
      await supabaseAdmin
        .from("user_roles")
        .upsert({ user_id: newId, role: "admin" }, { onConflict: "user_id,role" });
    }
    await supabaseAdmin
      .from("profiles")
      .update({ approved: data.approved, full_name: data.full_name })
      .eq("id", newId);
    return { ok: true, id: newId };
  });

export const adminSetUserPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        password: z.string().min(8).max(128).optional(),
        generate: z.boolean().default(false),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    let password = data.password;
    if (data.generate || !password) {
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
      const bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      password = Array.from(bytes, (b) => chars[b % chars.length]).join("");
    }
    if (!password || password.length < 8) throw new Error("Heslo musí mít alespoň 8 znaků");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      password,
    });
    if (error) throw new Error(error.message);
    return { ok: true, password };
  });

export const adminSetUserActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ user_id: z.string().uuid(), active: z.boolean() }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    if (data.user_id === context.userId) throw new Error("Nelze deaktivovat vlastní účet");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.user_id, {
      ban_duration: data.active ? "none" : "876000h",
    } as any);
    if (error) throw new Error(error.message);
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "users",
        action: data.active ? "activated" : "deactivated",
        entityId: data.user_id,
      });
    }
    return { ok: true };
  });

export const adminDeleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ user_id: z.string().uuid() }).parse(d))
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    if (data.user_id === context.userId) throw new Error("Nelze smazat vlastní účet");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "users",
        action: "deleted",
        entityId: data.user_id,
      });
    }
    return { ok: true };
  });

export const adminSendWelcomeEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        password: z.string().min(8).max(128).optional(),
        note: z.string().max(2000).optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: target, error: tErr } = await supabaseAdmin.auth.admin.getUserById(data.user_id);
    if (tErr) throw new Error(tErr.message);
    const email = target.user?.email;
    if (!email) throw new Error("Uživatel nemá e-mail");
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", data.user_id)
      .maybeSingle();
    const { enqueueTransactionalEmail } = await import("@/lib/email/notify.server");
    await enqueueTransactionalEmail({
      templateName: "account-welcome",
      recipientEmail: email,
      idempotencyKey: `account-welcome-${data.user_id}-${Date.now()}`,
      templateData: {
        recipientName: profile?.full_name ?? "",
        email,
        password: data.password ?? "",
        loginUrl: "https://www.autoport-app.cz/auth",
        note: data.note ?? "",
      },
    });
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "users",
        action: "welcome_email_sent",
        entityId: data.user_id,
      });
    }
    return { ok: true };
  });

export const generatePoaPdf = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z.object({ id: z.string().uuid(), kind: z.enum(["jednani", "plneni"]) }).parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: claim, error } = await context.supabase
      .from("claims")
      .select("*")
      .eq("id", data.id)
      .single();
    if (error) throw new Error(error.message);
    const { data: tpl } = await context.supabase
      .from("document_templates")
      .select("body,title")
      .eq("key", data.kind)
      .maybeSingle();
    const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595, 842]);
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const ascii = (s: string) =>
      s
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^\x00-\x7F]/g, "");
    const vars: Record<string, string> = {
      first_name: claim.first_name ?? "",
      last_name: claim.last_name ?? "",
      company: claim.company ?? "",
      ico: claim.ico ?? "",
      address: claim.address ?? "",
      phone: claim.phone ?? "",
      email: claim.email ?? "",
      insurer: claim.insurer ?? "-",
      claim_number: claim.claim_number ?? "-",
      event_at: claim.event_at ? new Date(claim.event_at).toLocaleString("cs-CZ") : "-",
      location: claim.location ?? "-",
    };
    const fallback =
      data.kind === "jednani"
        ? "PLNA MOC k jednani s pojistovnou\n\nZmocnitel: {{first_name}} {{last_name}}"
        : "PLNA MOC k prevzeti pojistneho plneni\n\nZmocnitel: {{first_name}} {{last_name}}";
    const body = (tpl?.body ?? fallback).replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
    const allLines = body.split("\n");
    const titleLine = allLines[0] ?? "";
    const lines = allLines.slice(1);
    page.drawText(ascii(titleLine), { x: 50, y: 790, size: 16, font: bold, color: rgb(0, 0, 0) });
    let y = 750;
    for (const ln of lines) {
      page.drawText(ascii(ln), { x: 50, y, size: 11, font });
      y -= 18;
    }
    if (claim.signature?.startsWith("data:image/png")) {
      try {
        const b64 = claim.signature.split(",")[1];
        const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
        const png = await pdf.embedPng(bytes);
        page.drawText(ascii("Podpis zmocnitele:"), { x: 50, y: y - 30, size: 11, font });
        const dims = png.scale(0.5);
        page.drawImage(png, {
          x: 50,
          y: y - 30 - Math.min(dims.height, 80),
          width: Math.min(dims.width, 200),
          height: Math.min(dims.height, 80),
        });
      } catch {
        // ignore
      }
    }
    page.drawText(`Datum: ${new Date().toLocaleDateString("cs-CZ")}`, {
      x: 50,
      y: 60,
      size: 10,
      font,
    });
    const bytes = await pdf.save();
    return { base64: Buffer.from(bytes).toString("base64") };
  });

export const listTemplates = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { data, error } = await context.supabase
      .from("document_templates")
      .select("id,key,title,body,updated_at")
      .order("key");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const updateTemplate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        title: z.string().min(1).max(200),
        body: z.string().min(1).max(20000),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("document_templates")
      .update({ title: data.title, body: data.body })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Public photo upload (used by mobile via QR code). No auth required — gated by upload_token.
export const publicGetClaimByToken = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => z.object({ token: z.string().uuid() }).parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claim, error } = await supabaseAdmin
      .from("claims")
      .select("id,pu_number,first_name,last_name")
      .eq("upload_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) throw new Error("Neplatný odkaz.");
    return claim;
  });

export const publicUploadPhoto = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        token: z.string().uuid(),
        file_name: z.string().min(1).max(200),
        mime_type: z
          .string()
          .regex(/^image\/(jpeg|jpg|png|gif|webp|bmp|heic|heif)$/i, "Nepovolený typ souboru"),
        data_base64: z.string().min(10),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: claim, error } = await supabaseAdmin
      .from("claims")
      .select("id")
      .eq("upload_token", data.token)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!claim) throw new Error("Neplatný token.");
    const safe = data.file_name.replace(/[^\w.-]/g, "_");
    const path = `${claim.id}/qr/${Date.now()}-${safe}`;
    const bytes = Buffer.from(data.data_base64, "base64");
    if (bytes.byteLength > 8 * 1024 * 1024) throw new Error("Soubor je větší než 8 MB.");
    const { error: uerr } = await supabaseAdmin.storage
      .from("claim-files")
      .upload(path, bytes, { contentType: data.mime_type, upsert: false });
    if (uerr) throw new Error(uerr.message);
    await supabaseAdmin.from("claim_attachments").insert({
      claim_id: claim.id,
      category: "photos",
      file_path: path,
      file_name: data.file_name,
      mime_type: data.mime_type,
      size: bytes.byteLength,
    });
    await supabaseAdmin.from("claim_events").insert({
      claim_id: claim.id,
      type: "photo",
      message: "Nahráno 1 fotek přes QR kód",
    });
    return { ok: true };
  });

export const listEmployees = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("profiles")
      .select("id,full_name,email")
      .order("full_name", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((p) => ({
      id: p.id,
      name: p.full_name || p.email || "—",
    }));
  });

// Public submission upload: used by the unauthenticated /nahlasit form to
// upload attachments before the claim is created. Path is a client-supplied
// tempId; uploads are performed via the service role so the storage INSERT
// policy can stay locked down. Validates mime type and file size.
export const publicSubmissionUpload = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) =>
    z
      .object({
        temp_id: z.string().uuid(),
        category: z
          .string()
          .min(1)
          .max(40)
          .regex(/^[a-z0-9_-]+$/i, "Neplatná kategorie"),
        file_name: z.string().min(1).max(200),
        mime_type: z
          .string()
          .regex(
            /^(image\/(jpeg|jpg|png|gif|webp|bmp|heic|heif)|application\/pdf)$/i,
            "Nepovolený typ souboru",
          ),
        data_base64: z.string().min(10).max(15_000_000),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const safe = data.file_name.replace(/[^\w.-]/g, "_");
    const path = `${data.temp_id}/${data.category}/${Date.now()}-${safe}`;
    const bytes = Buffer.from(data.data_base64, "base64");
    if (bytes.byteLength > 10 * 1024 * 1024) throw new Error("Soubor je větší než 10 MB.");
    const { error: uerr } = await supabaseAdmin.storage
      .from("claim-files")
      .upload(path, bytes, { contentType: data.mime_type, upsert: false });
    if (uerr) throw new Error(uerr.message);
    return {
      file_path: path,
      file_name: data.file_name,
      mime_type: data.mime_type,
      size: bytes.byteLength,
    };
  });

export const setUserDepartment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) =>
    z
      .object({
        user_id: z.string().uuid(),
        department: z.enum(["vedeni", "obchod", "servis", "nahradni_dily"]).nullable(),
        is_department_head: z.boolean().optional(),
      })
      .parse(d),
  )
  .handler(async ({ context, data }) => {
    const { data: meRoles } = await context.supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId);
    if (!meRoles?.some((r) => r.role === "admin")) throw new Error("Forbidden");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const isHead =
      typeof data.is_department_head === "boolean"
        ? data.department
          ? data.is_department_head
          : false
        : data.department
          ? undefined
          : false;
    const patch = {
      department: data.department,
      ...(typeof isHead === "boolean" ? { is_department_head: isHead } : {}),
    };
    const { error } = await supabaseAdmin.from("profiles").update(patch).eq("id", data.user_id);
    if (error) throw new Error(error.message);
    {
      const { logEvent } = await import("@/lib/audit.server");
      await logEvent({
        actorId: context.userId,
        actorEmail: context.claims?.email ?? null,
        module: "users",
        action: "department_change",
        entityId: data.user_id,
        details: { department: data.department, is_department_head: isHead },
      });
    }
    return { ok: true };
  });
