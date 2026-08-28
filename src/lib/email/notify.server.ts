import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";
import { sendTemplateEmail } from "@/lib/email-templates/send-email";

export interface NotifyArgs {
  templateName: keyof typeof TEMPLATES | string;
  recipientEmail: string;
  templateData?: Record<string, any>;
  idempotencyKey?: string;
}

async function logSend(
  templateName: string,
  recipient: string,
  status: "sent" | "suppressed" | "failed",
  errorMessage?: string,
) {
  const { error } = await supabaseAdmin.from("email_send_log").insert({
    message_id: null,
    template_name: templateName,
    recipient_email: recipient,
    status,
    ...(errorMessage ? { error_message: errorMessage } : {}),
  });
  if (error) console.error("[notify] log insert failed", error.message);
}

/**
 * Server-side helper to render + send a transactional email through
 * Lovable's managed email delivery. Safe to call from authenticated
 * server functions after the caller has been authorized.
 */
export async function enqueueTransactionalEmail(args: NotifyArgs): Promise<void> {
  const templateName = args.templateName as string;
  const tpl = TEMPLATES[templateName];
  if (!tpl) {
    console.error("[notify] unknown template", templateName);
    return;
  }
  const recipient = (tpl.to || args.recipientEmail || "").trim();
  if (!recipient) return;

  try {
    const result = await sendTemplateEmail(templateName, recipient, {
      templateData: args.templateData || {},
      idempotencyKey: args.idempotencyKey,
    });
    if (result.sent) {
      await logSend(templateName, recipient, "sent");
    } else {
      await logSend(templateName, recipient, "suppressed");
    }
  } catch (e: any) {
    const message = e?.message ?? String(e);
    console.error("[notify] send failed", message);
    await logSend(templateName, recipient, "failed", message);
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
