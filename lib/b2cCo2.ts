/**
 * Disposition-adjusted CO₂ savings for B2C garment donations.
 *
 * The per-material `co2SavedPerKg` figures are cradle-to-gate *virgin production*
 * emission factors. Crediting them 1:1 assumes every donated garment is reused and
 * perfectly displaces a brand-new item — which over-credits the saving and is a
 * greenwashing risk under the EU Green Claims Directive (ECGT).
 *
 * Instead we scale by the realistic end-of-life pathway, grounded in WRAP
 * "Valuing Our Clothes":
 *   - Reuse (charity):   virgin EF × a conservative displacement rate. On cotton
 *                        (EF 8.0) this lands at ~4.0 kg CO₂e/kg — WRAP's net reuse
 *                        figure — while keeping material nuance (wool > polyester).
 *   - Recycle (downcycle): a flat ~0.7 kg CO₂e/kg net saving, independent of the
 *                        original fibre (the output is low-grade filler/wiping cloth).
 *
 * Keep these constants in sync with the backend
 * (`BE_weavecarbon/src/services/b2cService/helpers.js`).
 */
export const REUSE_DISPLACEMENT_FACTOR = 0.5;
export const RECYCLE_NET_EF_PER_KG = 0.7;

/** Disposition intent that earns the reuse (higher) credit. */
export const REUSE_CATEGORY = "charity";

/** Actual end-of-life pathway recorded at the sorting centre. */
export type DonationDisposition = "reuse" | "recycle" | "waste";

/**
 * CO₂e saved (kg) for a single item given its *actual* sorted disposition.
 * reuse → conservative virgin displacement; recycle → flat downcycling saving;
 * waste (incineration) → no net saving credited.
 */
export function dispositionCo2Saved(
  disposition: DonationDisposition | string | null | undefined,
  virginEfPerKg: number,
  weightKg: number
): number {
  const ef = Number(virginEfPerKg);
  const weight = Number(weightKg);
  if (!Number.isFinite(ef) || !Number.isFinite(weight) || weight <= 0) {
    return 0;
  }
  if (disposition === "reuse") {
    return ef * REUSE_DISPLACEMENT_FACTOR * weight;
  }
  if (disposition === "recycle") {
    return RECYCLE_NET_EF_PER_KG * weight;
  }
  return 0;
}

/**
 * CO₂e saved (kg) for a single donated line item, adjusted for its disposition.
 * Returns 0 for non-positive or non-finite inputs.
 */
export function donationCo2Saved(
  category: string | null | undefined,
  virginEfPerKg: number,
  weightKg: number
): number {
  const ef = Number(virginEfPerKg);
  const weight = Number(weightKg);
  if (!Number.isFinite(ef) || !Number.isFinite(weight) || weight <= 0) {
    return 0;
  }
  if (category === REUSE_CATEGORY) {
    return ef * REUSE_DISPLACEMENT_FACTOR * weight;
  }
  return RECYCLE_NET_EF_PER_KG * weight;
}
