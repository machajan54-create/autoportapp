import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type VinLookupResult = {
  source: "registr" | "nhtsa";
  vehicle_name?: string;
  rok_vyroby?: string;
  barva?: string;
  palivo?: string;
  first_registration?: string;
  tp?: string;
};

function str(v: unknown): string | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  return s ? s : undefined;
}

function czDate(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toLocaleDateString("cs-CZ");
}

export const lookupVin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        vin: z
          .string()
          .trim()
          .toUpperCase()
          .regex(/^[A-HJ-NPR-Z0-9]{17}$/, "VIN musí mít 17 znaků (bez písmen I, O, Q)."),
      })
      .parse(d),
  )
  .handler(async ({ data }): Promise<VinLookupResult> => {
    const key = process.env["DATAOVOZIDLECH_API_KEY"];
    if (key) {
      try {
        const r = await fetch(
          `https://api.dataovozidlech.cz/api/vehicletechnicaldata/v2?vin=${data.vin}`,
          { headers: { api_key: key, accept: "application/json" } },
        );
        if (r.ok) {
          const j = (await r.json()) as { Data?: Record<string, unknown> };
          const d = j.Data;
          if (d && Object.keys(d).length) {
            const first = str(d["DatumPrvniRegistrace"]);
            const vykon = str(d["MotorMaxVykon"]);
            const palivo = [str(d["Palivo"]), vykon ? `${vykon} kW` : undefined]
              .filter(Boolean)
              .join(", ");
            return {
              source: "registr",
              vehicle_name: [str(d["TovarniZnacka"]), str(d["ObchodniOznaceni"])]
                .filter(Boolean)
                .join(" "),
              rok_vyroby: first ? String(new Date(first).getFullYear()) : undefined,
              barva: str(d["VozidloKaroserieBarva"]),
              palivo: palivo || undefined,
              first_registration: czDate(first),
              tp: str(d["CisloTp"]),
            };
          }
        } else {
          console.error("dataovozidlech status", r.status);
        }
      } catch (e) {
        console.error("dataovozidlech error", e);
      }
    }

    const r = await fetch(
      `https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVinValues/${data.vin}?format=json`,
    );
    if (!r.ok) throw new Error("Služba pro dekódování VIN je teď nedostupná. Zkuste to později.");
    const j = (await r.json()) as { Results?: Record<string, string>[] };
    const d = j.Results?.[0] ?? {};
    const make = str(d["Make"]);
    const model = str(d["Model"]);
    if (!make && !model) throw new Error("K tomuto VIN se nepodařilo najít žádné údaje.");
    const cap = (s?: string) => (s ? s.charAt(0) + s.slice(1).toLowerCase() : s);
    const fuel = [str(d["FuelTypePrimary"]), str(d["DisplacementL"]) && `${Number(d["DisplacementL"]).toFixed(1)} l`]
      .filter(Boolean)
      .join(", ");
    return {
      source: "nhtsa",
      vehicle_name: [cap(make), model].filter(Boolean).join(" "),
      rok_vyroby: str(d["ModelYear"]),
      palivo: fuel || undefined,
    };
  });
