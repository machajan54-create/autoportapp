# Security Model — Autoport APP

This document is the source of truth for who can read and write what.
Before changing any RLS policy, storage policy, role, module, or server
function that writes from a public surface, read this file and update it
in the same migration / PR.

The security memory (`mem://security`) is the short version of this file —
keep them aligned.

---

## 1. Roles

Roles live in `public.user_roles` (NEVER on `profiles`) and are checked
via the `SECURITY DEFINER` helper `public.has_role(uid, role)`.

| Role       | Who                              | Granted by                                |
| ---------- | -------------------------------- | ----------------------------------------- |
| `admin`    | Super admin / owner / ředitel    | Manually in DB or via super-admin UI      |
| `employee` | Default for every new signup     | `handle_new_user` trigger on `auth.users` |

Rules:
- `admin` implicitly has access to every module (see `has_module`).
- `employee` has NO access until an admin grants modules in
  `/admin/users`.
- New signups land in `profiles` with `approved = false`. They cannot
  use the app until a super admin flips `approved` and assigns modules.

Do NOT add role checks against `profiles` or any other table. The only
source of truth is `user_roles`, accessed through `has_role`.

---

## 2. Modules

Per-user feature access lives in `public.user_modules` and is checked
via `public.has_module(uid, module)`.

`has_module` returns `true` when the user is `admin` OR has the module
row — so policies never need to OR `has_role` and `has_module` themselves.

| Module enum  | What it unlocks                                                     |
| ------------ | ------------------------------------------------------------------- |
| `claims`     | Pojistné události: `claims`, `claim_attachments`, `claim_events`, `claim_tasks`, claim-files storage reads |
| `vykupy`     | Ojeté vozy: `vykupy`                                                |
| `vykupy_external` | Externí výkupní formulář (UI gating)                           |
| `dochazka`   | Docházka: `attendance_*` (čtení nastavení; zápis nastavení = admin) |
| `defects`    | Závady: `defects`, defect-photos storage                            |
| `deals`      | Obchodní případy: `deals`, `deal_stage_history`                     |
| `logbook`    | Kniha jízd: `logbook_entries`, `logbook_vehicles`                   |
| `tasks`      | Úkoly: `tasks`, `task_comments`, `task_attachments`                 |
| `demo_orders`| Předváděcí vozy: `clients`, `demo_orders`, `demo_order_*`           |
| `evidence_zakazek` | Evidence mytí: `evidence_orders`, `evidence_wash_assignments`, `washers` |
| `approvals`  | Schvalování: `suppliers`, `purchases` (gating UI; tabulky jsou admin-only) |
| `dashboard`  | Přehled napříč moduly                                               |
| `users`      | (Rezervováno — admin-only obrazovky jsou gated `isAdmin`)           |

Admin-only surfaces (no module needed, gated by `isAdmin` in the UI and
by `has_role('admin')` in policies):
- `/admin/users` — schvalování účtů, přidělování modulů
- `/admin/templates` — šablony dokumentů
- `/admin/audit` — audit log
- `/approvals` — Schvalování: `suppliers`, `purchases`
- `/dashboard` — přehled napříč moduly

When adding a new module: add the enum value, then add policies on the
new tables that gate on `has_module(auth.uid(), '<module>')`. Update
`AdminShell` to render the nav item only when `can(module)` returns true.

---

## 3. RLS Policies — back-office tables

Every public-schema table has RLS ON. Default shape:

```sql
CREATE POLICY "<table>_select_module" ON public.<table>
  FOR SELECT TO authenticated
  USING (public.has_module(auth.uid(), '<module>'));

CREATE POLICY "<table>_insert_module" ON public.<table>
  FOR INSERT TO authenticated
  WITH CHECK (public.has_module(auth.uid(), '<module>'));

CREATE POLICY "<table>_update_module" ON public.<table>
  FOR UPDATE TO authenticated
  USING (public.has_module(auth.uid(), '<module>'))
  WITH CHECK (public.has_module(auth.uid(), '<module>'));

CREATE POLICY "<table>_delete_admin" ON public.<table>
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
```

Deletes are admin-only on business-critical tables (`claims`, `vykupy`)
to make accidental data loss harder. Module users can delete their own
sub-rows (tasks, attachments) when the workflow needs it.

### Current matrix

| Table                 | SELECT                          | INSERT                          | UPDATE                          | DELETE                       |
| --------------------- | ------------------------------- | ------------------------------- | ------------------------------- | ---------------------------- |
| `claims`              | `has_module('claims')`          | server (admin client) only      | `has_module('claims')`          | `has_role('admin')`          |
| `claim_attachments`   | `has_module('claims')`          | server (admin client) only      | —                               | `has_module('claims')`       |
| `claim_events`        | `has_module('claims')`          | `has_module('claims')` + trigger | —                              | —                            |
| `claim_tasks`         | `has_module('claims')`          | `has_module('claims')`          | `has_module('claims')`          | `has_module('claims')`       |
| `vykupy`              | `has_module('vykupy')`          | `has_module('vykupy')`          | `has_module('vykupy')`          | `has_role('admin')`          |
| `suppliers`           | `has_role('admin')` (FOR ALL)   | same                            | same                            | same                         |
| `purchases`           | `has_role('admin')` (FOR ALL)   | same                            | same                            | same                         |
| `document_templates`  | `has_role('admin')` (FOR ALL)   | same                            | same                            | same                         |
| `user_modules`        | own row OR `has_role('admin')`  | server (admin client) only      | server (admin client) only      | server (admin client) only   |
| `user_roles`          | own row OR `has_role('admin')`  | server (admin client) only      | server (admin client) only      | server (admin client) only   |
| `profiles`            | own row; admins via separate policy | trigger only                | own row; admins via separate policy | —                        |

"server (admin client) only" means no `authenticated` INSERT/UPDATE
policy exists; the only writers are server functions in
`src/lib/*.functions.ts` that import `@/integrations/supabase/client.server`
(`supabaseAdmin`, which bypasses RLS by design).

### Rules of thumb

- Never use `USING (true)` or `WITH CHECK (true)` on authenticated
  policies. The linter flags it and it is almost always wrong.
- Never write a policy that selects from the same table it protects —
  that's the infinite-recursion footgun. Use a `SECURITY DEFINER`
  function (`has_role`, `has_module`) instead.
- Every `CREATE TABLE public.x` must be followed in the same migration by
  `GRANT ... TO authenticated; GRANT ALL ... TO service_role;` then
  `ENABLE ROW LEVEL SECURITY` then `CREATE POLICY`. Skipping the GRANT
  makes PostgREST return permission errors even with RLS configured.
- Skip `GRANT ... TO anon` unless a policy is intentionally public.
  We currently grant `anon` nothing on public tables.

---

## 4. Storage — `claim-files` bucket

Private bucket. Two policies on `storage.objects`:

| Operation | Policy                          | Who                                                  |
| --------- | ------------------------------- | ---------------------------------------------------- |
| INSERT    | `claim_files_upload_anyone`     | `anon` + `authenticated` (public intake form uploads files before submitting the claim) |
| SELECT    | `claim_files_read_module`       | `authenticated` AND `has_module(auth.uid(), 'claims')` |

No public read. Back-office UI fetches files via signed URLs produced by
server functions, or directly through the authenticated Supabase client
(RLS allows it because the user has the `claims` module).

If we ever add another bucket, default to private + a `SELECT` policy
that requires the matching module, and only grant `anon` INSERT when a
public flow actually needs it.

---

## 5. Public (unauthenticated) write flows

Two surfaces are reachable without sign-in. They MUST stay narrowly
scoped — never widen them with broad anon policies.

### 5.1 `/nahlasit` — claim intake

1. Browser uploads files directly to `claim-files/` via the publishable
   anon key, allowed by `claim_files_upload_anyone`.
2. Browser calls the `createClaim` server function
   (`src/lib/claims.functions.ts`). The handler validates input with
   Zod, then writes to `claims` and `claim_attachments` using
   `supabaseAdmin` (service role).
3. The `log_claim_created` trigger inserts the initial row into
   `claim_events`. The trigger runs as the table owner, so it does not
   need an anon INSERT policy on `claim_events`.

Why no anon `INSERT` policy on `claims` / `claim_attachments`: writes
go through the server function, which validates input and runs as
`service_role`. Removing the policy reduced the attack surface.

### 5.2 `/upload/$token` — public file upload by claim token

1. URL contains an opaque `upload_token` from `claims.upload_token`.
2. Browser uploads files to `claim-files/` (allowed by
   `claim_files_upload_anyone`).
3. Browser calls a server function that resolves the token to a claim
   via `supabaseAdmin`, then writes the `claim_attachments` row.

The token IS the auth check. Server functions must always look the
claim up by token before writing — never trust a `claim_id` passed
from the client.

### Adding a new public surface

- Validate every input with Zod (length, format, enums).
- Do the write from a server function with `supabaseAdmin`, not from
  the browser, unless RLS can fully describe the rule.
- If you must add an anon RLS policy, make `WITH CHECK` reference real
  columns — never `(true)`.
- Never return user PII from `/api/public/*` routes.

---

## 6. Server functions

Three Supabase clients, never to be mixed up:

| Client                                                | Use in                              | Auth | RLS    |
| ----------------------------------------------------- | ----------------------------------- | ---- | ------ |
| `@/integrations/supabase/client`                      | components, hooks, realtime         | user | yes    |
| `requireSupabaseAuth` middleware (`context.supabase`) | server fns acting AS the user       | user | yes    |
| `@/integrations/supabase/client.server` (`supabaseAdmin`) | trusted server-only paths       | service_role | bypassed |

Rules:
- `supabaseAdmin` is never imported from a component, loader, or
  `.functions.ts` module scope. Always `await import(...)` it INSIDE
  the handler.
- Admin-only server functions defend in depth: even though the route
  is admin-gated, the handler calls `assertAdmin(context.supabase,
  context.userId)` (see `src/lib/approvals.functions.ts`) before
  touching admin tables.
- Public server functions (called from `/nahlasit`, `/upload/$token`)
  do NOT use `requireSupabaseAuth`. They validate input with Zod and
  rely on `supabaseAdmin` + business-rule checks (e.g. token match).

---

## 7. Auth

- Email/password sign-in with Google OAuth as the default social
  provider (see `cloud-auth-and-security`).
- `auto_confirm_email = true` — accepted because new users still need
  admin approval (`profiles.approved`) before they can use anything.
- `password_hibp_enabled = true` — blocks passwords found in HaveIBeenPwned.
- `external_anonymous_users_enabled = false` — no anonymous Supabase
  sessions. The public form does not create a session.
- `disable_signup = false` — anyone can register, but they cannot use
  the app until approved.

---

## 8. Helper functions (`SECURITY DEFINER`)

| Function                              | Purpose                                          |
| ------------------------------------- | ------------------------------------------------ |
| `public.has_role(uid, app_role)`      | Used in RLS to check role without recursion.     |
| `public.has_module(uid, app_module)`  | Returns true for admins OR users with the module.|
| `public.handle_new_user()`            | `auth.users` trigger: creates `profiles` row (approved=false) and assigns `employee` role. |
| `public.assign_pu_number()`           | Trigger that assigns `PU-YYYY-NNNN` to new claims.|
| `public.log_claim_created()`          | Trigger that writes the initial `claim_events` row.|
| `public.touch_updated_at()`           | Generic `updated_at` trigger.                    |

All have `SET search_path = public` to avoid search-path hijacking.

The scanner flags `has_role`, `has_module`, and `handle_new_user` as
"public can execute SECURITY DEFINER function". This is intentional and
is documented in `mem://security` as an accepted finding:
- `has_role` / `has_module` MUST be executable by `authenticated` (and
  `anon` for `has_module`, since RLS evaluates anon too) — they are
  called from RLS policies.
- `handle_new_user` is only ever invoked by the `auth.users` trigger;
  exposing EXECUTE is harmless because it requires a row insert that
  only Supabase Auth can perform.

Do NOT revoke EXECUTE on these.

---

## 9. Checklist for future changes

When you add or modify schema, walk through this list:

- [ ] New public-schema table has `GRANT` + `ENABLE RLS` + at least one
      `CREATE POLICY` in the same migration.
- [ ] Policies reference `has_role` / `has_module`, not the table they
      protect.
- [ ] No `USING (true)` / `WITH CHECK (true)` on authenticated policies.
- [ ] No new `anon` policy unless a public flow truly needs it; if it
      does, document it in §5.
- [ ] If the table belongs to a module, the module enum, `AdminShell`
      nav, and `getMyAccess` modules list are updated.
- [ ] If you introduced a new `SECURITY DEFINER` function, it has
      `SET search_path = public`.
- [ ] If you added a server function that writes from a public surface,
      it validates input with Zod and uses `supabaseAdmin` inside the
      handler — not at module scope.
- [ ] `mem://security` reflects the change.
- [ ] This document reflects the change.