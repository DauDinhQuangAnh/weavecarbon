/**
 * Image analysis prompt generation and validation
 * Ensures consistent, high-quality AI analysis results
 */

import type { MaterialReward } from "@/lib/b2cApi";

export const buildImageAnalysisSystemPrompt = () => `
You are an expert at analyzing donation images for fashion and textile items.
Your task is to identify and classify items in the image with high accuracy.

For each item detected, provide:
1. item_name: Clear name of the item (e.g., "Blue Cotton T-shirt", "Black Jeans")
2. item_type: Category (e.g., "shirt", "pants", "jacket", "shoes", "bag")
3. material_id: Match to standard materials (cotton, polyester, wool, silk, linen, nylon, leather, mixed)
4. custom_material_name: If material doesn't match standard categories
5. condition: "good" (like new/excellent), "fair" (worn but usable), or "poor" (damaged)
6. weight_kg: Estimated weight in kilograms based on typical garment weights
7. confidence: Your confidence in this detection (0-1)

Guidelines for accuracy:
- Look carefully for multiple items in the image
- Estimate weight based on fabric density, size, and type
- Be conservative with condition assessment
- If unsure about any field, use lower confidence score
- Provide each item as a separate object in the results array

Return a JSON object with structure:
{
  "products": [
    {
      "item_name": "string",
      "item_type": "string",
      "material_id": "string",
      "custom_material_name": "string",
      "condition": "good" | "fair" | "poor",
      "weight_kg": number,
      "confidence": number
    }
  ],
  "total_items_detected": number,
  "overall_confidence": number
}
`;

export const buildImageAnalysisUserPrompt = (
  availableMaterials?: MaterialReward[]
): string => {
  const materialsList = availableMaterials
    ?.map((m) => `- ${m.material_name} (${m.material_category})`)
    .join("\n");

  const materialsSection = materialsList
    ? `Available material options:\n${materialsList}`
    : "Standard materials: cotton, polyester, wool, silk, linen, nylon, leather, mixed";

  return `Analyze the image and detect all items for donation.

${materialsSection}

Please identify each item in the image and provide detailed information in JSON format.
`;
};

export const validateAnalysisResult = (
  result: unknown
): result is {
  products: Array<{
    item_name: string;
    item_type: string;
    material_id: string;
    custom_material_name?: string;
    condition: "good" | "fair" | "poor";
    weight_kg: number;
    confidence: number;
  }>;
  total_items_detected: number;
  overall_confidence: number;
} => {
  if (!result || typeof result !== "object") return false;

  const obj = result as Record<string, unknown>;

  // Check products array
  if (!Array.isArray(obj.products)) return false;

  const productsValid = obj.products.every((item: unknown) => {
    if (typeof item !== "object" || item === null) return false;

    const product = item as Record<string, unknown>;
    return (
      typeof product.item_name === "string" &&
      typeof product.item_type === "string" &&
      typeof product.material_id === "string" &&
      ["good", "fair", "poor"].includes(String(product.condition)) &&
      typeof product.weight_kg === "number" &&
      product.weight_kg > 0 &&
      typeof product.confidence === "number" &&
      product.confidence >= 0 &&
      product.confidence <= 1
    );
  });

  if (!productsValid) return false;

  // Check metadata
  if (
    typeof obj.total_items_detected !== "number" ||
    obj.total_items_detected < 0 ||
    typeof obj.overall_confidence !== "number" ||
    obj.overall_confidence < 0 ||
    obj.overall_confidence > 1
  ) {
    return false;
  }

  return true;
};
