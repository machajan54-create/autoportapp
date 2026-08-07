import * as React from "react";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "Píše Citroën | Autoport s.r.o.";
const SENDER_DOMAIN = "notify.autoport-app.cz";
const FROM_DOMAIN = "autoport-app.cz";

function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export interface NotifyArgs {
  templateName: keyof typeof TEMPLATES | string;
  recipientEmail: string;
  templateData?: Record<string, any>;
  idempotencyKey?: string;
}

/**
 * Server-side helper to render + enqueue a transactional email
 * directly via service role, without going through the HTTP send route.
 * Safe to call from authenticated server functions after the caller has
 * been authorized.
 */
export async function enqueueTransactionalEmail(args: NotifyArgs): Promise<void> {
  try {
    const tpl = TEMPLATES[args.templateName as string];
    if (!tpl) {
      console.error("[notify] unknown template", args.templateName);
      return;
    }
    const recipient = (tpl.to || args.recipientEmail || "").trim();
    if (!recipient) return;

    const normalized = recipient.toLowerCase();
    const messageId = crypto.randomUUID();
    const idempotencyKey = args.idempotencyKey || messageId;
    const templateData = args.templateData || {};

    // suppression
    const { data: suppressed } = await supabaseAdmin
      .from("suppressed_emails")
      .select("id")
      .eq("email", normalized)
      .maybeSingle();
    if (suppressed) {
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: args.templateName as string,
        recipient_email: recipient,
        status: "suppressed",
      });
      return;
    }

    // unsubscribe token
    let token: string;
    const { data: existing } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token, used_at")
      .eq("email", normalized)
      .maybeSingle();
    if (existing && !existing.used_at) {
      token = existing.token;
    } else {
      token = generateToken();
      await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .upsert({ token, email: normalized }, { onConflict: "email", ignoreDuplicates: true });
      const { data: stored } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", normalized)
        .maybeSingle();
      token = stored?.token ?? token;
    }

    // render
    const element = React.createElement(tpl.component as any, templateData);
    const html = await render(element);
    const text = await render(element, { plainText: true });
    const subject = typeof tpl.subject === "function" ? tpl.subject(templateData) : tpl.subject;

    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: args.templateName as string,
      recipient_email: recipient,
      status: "pending",
    });

    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: messageId,
        to: recipient,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: args.templateName,
        idempotency_key: idempotencyKey,
        unsubscribe_token: token,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) {
      console.error("[notify] enqueue failed", error);
      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: args.templateName as string,
        recipient_email: recipient,
        status: "failed",
        error_message: error.message,
      });
    }
  } catch (e: any) {
    console.error("[notify] unexpected error", e?.message ?? e);
  }
}

/** Returns emails of all super-admin users. */
export async function getAdminEmails(): Promise<string[]> {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  const ids = (roles ?? []).map((r: any) => r.user_id);
  if (!ids.length) return [];
  const { data: profs } = await supabaseAdmin.from("profiles").select("email").in("id", ids);
  return (profs ?? []).map((p: any) => p.email).filter(Boolean);
}

export async function getUserEmail(
  userId: string,
): Promise<{ email: string | null; name: string | null }> {
  const { data } = await supabaseAdmin
    .from("profiles")
    .select("email, full_name")
    .eq("id", userId)
    .maybeSingle();
  return { email: data?.email ?? null, name: data?.full_name ?? null };
}

export async function notifyAdmins(args: Omit<NotifyArgs, "recipientEmail">): Promise<void> {
  const emails = await getAdminEmails();
  await Promise.all(
    emails.map((email) => enqueueTransactionalEmail({ ...args, recipientEmail: email })),
  );
}
