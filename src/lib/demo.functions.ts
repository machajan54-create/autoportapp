import { createServerFn } from "@tanstack/react-start";

const DEMO_EMAIL = "demo@autoport.app";
const DEMO_PASSWORD = "Demo1234!";

export const ensureDemoUser = createServerFn({ method: "POST" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Find existing user by email
  const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (listErr) throw new Error(listErr.message);
  let user = list.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);

  if (!user) {
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: DEMO_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: "Demo účet" },
    });
    if (createErr) throw new Error(createErr.message);
    user = created.user!;
  } else {
    // Reset password to ensure it always works
    await supabaseAdmin.auth.admin.updateUserById(user.id, { password: DEMO_PASSWORD });
  }

  // Approve profile
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: user.id, email: DEMO_EMAIL, full_name: "Demo účet", approved: true });

  // Ensure employee role
  await supabaseAdmin
    .from("user_roles")
    .upsert({ user_id: user.id, role: "employee" }, { onConflict: "user_id,role" });

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});