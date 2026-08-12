/**
 * Microfibre (microplastic) shedding classifier for donated garments.
 *
 * Synthetic fibres shed microplastic fragments during laundering. Mechanically
 * recycled synthetics shed substantially more — experimental work under
 * ISO 4484-1:2023 reports rPES-2/rPES-3 fragmenting 4.3–6.2× more than virgin
 * polyester. The app surfaces a laundering advisory and nudges reuse (which keeps
 * the fibre intact) over mechanical recycling, per PEFCR v3.1's fibre-fragment
 * impact category.
 *
 * Classification is by material name (the B2C reward catalogue has no fibre-type
 * flag), so keep the keyword list aligned with `b2cMaterialRewardsDefaults.ts`.
 */
const SYNTHETIC_KEYWORDS = [
  "polyester",
  "nylon",
  "acrylic",
  "faux leather",
  "faux fur",
  "polyamide",
  "elastane",
  "spandex"
];

export type MicrofiberLevel = "none" | "synthetic" | "recycled-synthetic";

export interface MicrofiberClassification {
  synthetic: boolean;
  recycledSynthetic: boolean;
  level: MicrofiberLevel;
}

export function classifyMicrofiber(materialName: string | null | undefined): MicrofiberClassification {
  const name = String(materialName ?? "").toLowerCase();
  const synthetic = SYNTHETIC_KEYWORDS.some((keyword) => name.includes(keyword));
  const recycledSynthetic = synthetic && (name.includes("recycl") || name.includes("rpet"));
  const level: MicrofiberLevel = recycledSynthetic
    ? "recycled-synthetic"
    : synthetic
      ? "synthetic"
      : "none";
  return { synthetic, recycledSynthetic, level };
}

/**
 * Highest-concern level across a set of material names — drives whether (and how
 * strongly) the donation wizard shows its microfibre advisory.
 */
export function aggregateMicrofiberLevel(
  materialNames: Array<string | null | undefined>
): MicrofiberLevel {
  let level: MicrofiberLevel = "none";
  for (const materialName of materialNames) {
    const { level: itemLevel } = classifyMicrofiber(materialName);
    if (itemLevel === "recycled-synthetic") {
      return "recycled-synthetic";
    }
    if (itemLevel === "synthetic") {
      level = "synthetic";
    }
  }
  return level;
}
