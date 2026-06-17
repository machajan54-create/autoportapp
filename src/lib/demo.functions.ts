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
  }

  // Approve profile
  await supabaseAdmin
    .from("profiles")
    .upsert({ id: user.id, email: DEMO_EMAIL, full_name: "Demo účet", approved: true });

  // Ensure employee role
  await supabaseAdmin
    .from("user_roles")
    .upsert(
      [
        { user_id: user.id, role: "admin" },
        { user_id: user.id, role: "employee" },
      ],
      { onConflict: "user_id,role" },
    );

  // Grant all modules
  const modules = ["claims", "vykupy", "users", "approvals", "dashboard", "vykupy_external", "dochazka", "defects"] as const;
  await supabaseAdmin
    .from("user_modules")
    .upsert(
      modules.map((m) => ({ user_id: user!.id, module: m })),
      { onConflict: "user_id,module" },
    );

  // Seed demo data (only if there are no claims yet — avoid duplicates)
  const { count: claimsCount } = await supabaseAdmin
    .from("claims")
    .select("*", { count: "exact", head: true });

  if (!claimsCount) {
    // Claims (pojistné události)
    await supabaseAdmin.from("claims").insert([
      {
        first_name: "Jan", last_name: "Novák", phone: "+420 777 123 456", email: "jan.novak@example.cz",
        address: "Korunní 12, Praha 2", insurer: "ČSOB Pojišťovna", claim_number: "C-2026-0001",
        event_at: new Date(Date.now() - 1000*60*60*24*3).toISOString(), location: "Praha 4, Jižní spojka",
        liquidation_type: "Totální škoda", vat_payer: "Ne", notes: "Demo zakázka — čelní střet, vyřizuje se s pojišťovnou.",
        signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        status: "in_progress",
      },
      {
        first_name: "Petra", last_name: "Svobodová", phone: "+420 602 987 654", email: "p.svobodova@example.cz",
        address: "Masarykovo nám. 3, Brno", insurer: "Allianz", claim_number: "C-2026-0002",
        event_at: new Date(Date.now() - 1000*60*60*24*10).toISOString(), location: "D1, exit 178",
        liquidation_type: "Oprava", vat_payer: "Ano", notes: "Demo — boční náraz, čeká se na díly.",
        signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        status: "new",
      },
      {
        company: "AutoLogistik s.r.o.", ico: "27889922", first_name: "Tomáš", last_name: "Dvořák",
        phone: "+420 731 222 111", email: "dvorak@autologistik.cz", address: "Průmyslová 8, Plzeň",
        insurer: "Kooperativa", claim_number: "C-2026-0003",
        event_at: new Date(Date.now() - 1000*60*60*24*30).toISOString(), location: "Plzeň, Borská pole",
        liquidation_type: "Oprava", vat_payer: "Ano", notes: "Demo — dokončeno, vyplaceno.",
        signature: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
        status: "done",
      },
    ]);
  }

  const { count: vykupyCount } = await supabaseAdmin
    .from("vykupy")
    .select("*", { count: "exact", head: true });

  if (!vykupyCount) {
    await supabaseAdmin.from("vykupy").insert([
      { znacka: "Škoda", model: "Octavia 2.0 TDI", rok_vyroby: 2019, pocet_km: 142000,
        klient: "Martin Procházka", telefon: "+420 605 111 222",
        naceneno_od: 285000, vykoupeno_za: 270000, naklady: 8000, zdroj: "Sauto.cz",
        datum_vykupu: new Date(Date.now() - 1000*60*60*24*14).toISOString().slice(0,10),
        stav: "Vykoupeno", zpracoval: "Demo účet", poznamka: "Demo — připraveno k prodeji." },
      { znacka: "Volkswagen", model: "Passat B8 2.0 TDI", rok_vyroby: 2017, pocet_km: 198000,
        klient: "Eva Horáková", telefon: "+420 776 333 444",
        naceneno_od: 320000, vykoupeno_za: 305000, prodano_za: 369000, naklady: 12500, zdroj: "Doporučení",
        datum_vykupu: new Date(Date.now() - 1000*60*60*24*45).toISOString().slice(0,10),
        stav: "Prodáno", zpracoval: "Demo účet", poznamka: "Demo — prodáno se ziskem." },
      { znacka: "BMW", model: "320d xDrive", rok_vyroby: 2020, pocet_km: 89000,
        klient: "Roman Kučera", telefon: "+420 608 555 666",
        naceneno_od: 565000, naklady: 0, zdroj: "Web formulář",
        stav: "Nacenění", zpracoval: "Demo účet", poznamka: "Demo — čeká na osobní prohlídku." },
    ]);
  }

  const { count: suppliersCount } = await supabaseAdmin
    .from("suppliers").select("*", { count: "exact", head: true });

  let supplierId: string | null = null;
  if (!suppliersCount) {
    const { data: sup } = await supabaseAdmin.from("suppliers").insert([
      { name: "AutoDíly Express s.r.o.", ico: "28456789", dic: "CZ28456789",
        contact_person: "Ing. Pavel Marek", email: "marek@autodily-express.cz", phone: "+420 234 567 890",
        address: "Logistická 5, Praha 9", notes: "Demo dodavatel originálních dílů.",
        status: "approved", requested_by: user.id, decided_by: user.id, decided_at: new Date().toISOString() },
      { name: "LakovnaPro s.r.o.", ico: "29887766", dic: "CZ29887766",
        contact_person: "Jiří Hruška", email: "info@lakovnapro.cz", phone: "+420 555 111 222",
        address: "Průmyslová 14, Ostrava", notes: "Demo lakovna — spolupráce na rámcové smlouvě.",
        status: "pending", requested_by: user.id },
    ]).select("id");
    supplierId = sup?.[0]?.id ?? null;
  }

  const { count: purchasesCount } = await supabaseAdmin
    .from("purchases").select("*", { count: "exact", head: true });

  if (!purchasesCount) {
    await supabaseAdmin.from("purchases").insert([
      { title: "Náhradní díly — Škoda Octavia (C-2026-0001)",
        description: "Demo — přední nárazník, světlomety, kapota.",
        supplier_id: supplierId, amount: 42500, currency: "CZK",
        status: "approved", requested_by: user.id, decided_by: user.id,
        decided_at: new Date().toISOString(), decision_note: "Schváleno v rámci limitu." },
      { title: "Lakování — Passat B8",
        description: "Demo — kompletní lak pravé strany.",
        amount: 18900, currency: "CZK",
        status: "pending", requested_by: user.id },
      { title: "Diagnostické zařízení BMW ISTA",
        description: "Demo — licence na 12 měsíců.",
        amount: 24990, currency: "CZK",
        status: "rejected", requested_by: user.id, decided_by: user.id,
        decided_at: new Date().toISOString(), decision_note: "Odloženo na další kvartál." },
    ]);
  }

  // Attendance demo data
  const { count: attEmpCount } = await supabaseAdmin
    .from("attendance_employees").select("*", { count: "exact", head: true });

  if (!attEmpCount) {
    const seedEmployees = [
      { name: "Hrubý Patrik", role: "Ředitel", pin: "1111", avatar_color: "slate", can_approve_absences: true },
      { name: "Hák Marek", role: "Provozní manažer", pin: "2222", avatar_color: "blue", can_approve_absences: true },
      { name: "Hochmanová Alena", role: "Personalistka", pin: "3333", avatar_color: "purple", can_approve_absences: true },
      { name: "Kolář Michal", role: "Vedoucí logistiky", pin: "4444", avatar_color: "emerald" },
      { name: "Bálek Jakub", role: "Skladový operátor", pin: "5555", avatar_color: "amber" },
      { name: "Píša Martin", role: "Brigádník", pin: "6666", avatar_color: "rose" },
    ];
    const { data: emps } = await supabaseAdmin
      .from("attendance_employees")
      .insert(seedEmployees.map(({ pin: _pin, ...e }) => e))
      .select("id,name");
    if (emps) {
      await supabaseAdmin.from("attendance_employee_pins").insert(
        emps.map((e) => ({
          employee_id: e.id,
          pin: seedEmployees.find((s) => s.name === e.name)?.pin ?? "0000",
        })),
      );
    }

    const { data: shifts } = await supabaseAdmin.from("attendance_shifts").insert([
      { name: "Ranní směna", start_time: "06:00", end_time: "14:30", color: "amber" },
      { name: "Odpolední směna", start_time: "14:00", end_time: "22:30", color: "sky" },
      { name: "Noční směna", start_time: "22:00", end_time: "06:30", color: "purple" },
      { name: "Kancelář", start_time: "08:00", end_time: "16:30", color: "emerald" },
    ]).select("id,name");

    if (emps && shifts) {
      const office = shifts.find((s) => s.name === "Kancelář")?.id;
      const morning = shifts.find((s) => s.name === "Ranní směna")?.id;
      const records: any[] = [];
      for (let day = 1; day <= 5; day++) {
        const d = new Date(Date.now() - day * 86_400_000);
        const dateStr = d.toISOString().slice(0, 10);
        emps.slice(0, 4).forEach((e, i) => {
          const shiftId = i < 2 ? office : morning;
          const baseHour = i < 2 ? 8 : 6;
          const checkIn = new Date(d); checkIn.setHours(baseHour, Math.floor(Math.random() * 10), 0, 0);
          const checkOut = new Date(d); checkOut.setHours(baseHour + 8, 30 + Math.floor(Math.random() * 20), 0, 0);
          records.push({
            employee_id: e.id, shift_id: shiftId, date: dateStr,
            check_in: checkIn.toISOString(), check_out: checkOut.toISOString(),
            break_duration: 30, hours_worked: 8.0 + Math.random() * 0.5,
          });
        });
      }
      await supabaseAdmin.from("attendance_records").insert(records);

      await supabaseAdmin.from("attendance_absences").insert([
        { employee_id: emps[3].id, type: "dovolena", start_date: new Date(Date.now() + 7*86_400_000).toISOString().slice(0,10), end_date: new Date(Date.now() + 11*86_400_000).toISOString().slice(0,10), note: "Demo — letní dovolená", status: "pending" },
        { employee_id: emps[4].id, type: "lekar", start_date: new Date(Date.now() + 2*86_400_000).toISOString().slice(0,10), end_date: new Date(Date.now() + 2*86_400_000).toISOString().slice(0,10), note: "Demo — kontrola", status: "approved", resolved_at: new Date().toISOString(), resolved_by: emps[0].id },
        { employee_id: emps[5].id, type: "nemoc", start_date: new Date(Date.now() - 3*86_400_000).toISOString().slice(0,10), end_date: new Date(Date.now() - 1*86_400_000).toISOString().slice(0,10), note: "Demo — chřipka", status: "approved", resolved_at: new Date().toISOString(), resolved_by: emps[0].id },
      ]);

      await supabaseAdmin.from("attendance_notifications").insert([
        { type: "absence_pending", title: "🏝️ Žádost o dovolenou: Kolář Michal", message: "[Hlavní Provoz] Nová žádost o dovolenou čeká na schválení.", is_for_manager: true, meta: { employee_id: emps[3].id } },
        { type: "late_arrival", title: "⏱️ Opožděný příchod: Bálek Jakub", message: "[Hlavní Provoz] Pozdní příchod o 12 minut.", is_for_manager: true, meta: { employee_id: emps[4].id } },
      ]);
    }
  }

  return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
});