import { supabase } from "@/integrations/supabase/client";

export type Vykup = {
  id: string;
  created_at: string;
  znacka: string;
  model: string;
  rok_vyroby: number | null;
  pocet_km: number | null;
  klient: string;
  telefon: string | null;
  naceneno_od: number | null;
  vykoupeno_za: number | null;
  prodano_za: number | null;
  naklady: number;
  zdroj: string | null;
  datum_vykupu: string | null;
  stav: string;
  zpracoval: string | null;
  poznamka: string | null;
  internal_priced_by_user_id: string | null;
  internal_priced_amount: number | null;
  internal_priced_at: string | null;
  internal_priced_by_name: string | null;
  external_priced_by: string | null;
  external_priced_amount: number | null;
  external_priced_at: string | null;
  stav_changed_at: string | null;
  follow_up_at: string | null;
  follow_up_notified_at: string | null;
  owner_expectation_czk: number | null;
  naklady_popis: string | null;
  new_in_cz: boolean | null;
  service_history: boolean | null;
  barva: string | null;
};

export const ZNACKY = [
  "Škoda",
  "Hyundai",
  "Toyota",
  "Volkswagen",
  "Dacia",
  "Kia",
  "Mercedes-Benz",
  "Ford",
  "Renault",
  "BMW",
  "Peugeot",
  "MG",
  "Volvo",
  "Audi",
  "Cupra",
  "Opel",
  "Citroën",
  "Suzuki",
  "Jiná",
] as const;
export const ZDROJE = ["PRODEJ NOVÝCH VOZŮ", "SERVIS", "Poptávka z mailu", "Jiné"] as const;
export const STAVY = ["Nacenění", "Vykoupeno", "Prodáno", "Zamítnuto"] as const;

export function formatKc(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return new Intl.NumberFormat("cs-CZ").format(n) + " Kč";
}

export function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("cs-CZ");
}

export function marze(v: Pick<Vykup, "prodano_za" | "vykoupeno_za" | "naklady">): number | null {
  if (v.prodano_za == null || v.vykoupeno_za == null) return null;
  return v.prodano_za - v.vykoupeno_za - (v.naklady ?? 0);
}

export const stavBadge: Record<string, string> = {
  "Nacenění": "bg-amber-100 text-amber-900 border-amber-200",
  "Vykoupeno": "bg-blue-100 text-blue-900 border-blue-200",
  "Prodáno": "bg-emerald-100 text-emerald-900 border-emerald-200",
  "Zamítnuto": "bg-rose-100 text-rose-900 border-rose-200",
};

export async function listVykupy(): Promise<Vykup[]> {
  const { data, error } = await supabase
    .from("vykupy" as never)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as Vykup[];
}

export async function getVykup(id: string): Promise<Vykup | null> {
  const { data, error } = await supabase
    .from("vykupy" as never)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as Vykup) ?? null;
}

export async function upsertVykup(v: Partial<Vykup> & { id?: string }) {
  if (v.id) {
    const { id, created_at: _c, ...rest } = v;
    const { error } = await supabase.from("vykupy" as never).update(rest as never).eq("id", id);
    if (error) throw error;
    return id;
  }
  const { data, error } = await supabase
    .from("vykupy" as never)
    .insert(v as never)
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function deleteVykup(_id: string): Promise<never> {
  throw new Error("Smazání musí schválit super admin – odešlete žádost o smazání.");
}