/**
 * Image Analysis Service
 * Handles conversion of AI analysis results to donation items
 * Manages multi-product detection and form population
 */

import type { MaterialReward } from "@/lib/b2cApi";
import type { ImageAnalysisResult, AnalyzedProduct } from "@/types/imageAnalysis";

export interface DonationItemFormState {
  id: string;
  item_name: string;
  item_type: string;
  condition: string;
  material_id: string;
  custom_material_name: string;
  weight_kg: string;
}

/**
 * Converts analyzed products from AI into donation item form states
 * Handles multiple products and generates unique IDs
 */
export const convertAnalysisResultToFormItems = (
  analysisResult: ImageAnalysisResult,
  materialMap: Map<string, MaterialReward>,
  fallbackMaterialId: string
): DonationItemFormState[] => {
  if (!analysisResult.products || analysisResult.products.length === 0) {
    return [];
  }

  return analysisResult.products.map((product, index) => {
    const materialId = resolveMaterialId(product.material_id, materialMap, fallbackMaterialId);

    return {
      id: `item-${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
      item_name: product.item_name.trim(),
      item_type: product.item_type.trim(),
      condition: product.condition || "good",
      material_id: materialId,
      custom_material_name: product.custom_material_name?.trim() || "",
      weight_kg: formatWeight(product.weight_kg)
    };
  });
};

/**
 * Resolves AI-detected material to available material IDs
 * Falls back to custom material name if exact match not found
 */
const resolveMaterialId = (
  detectedMaterial: string,
  materialMap: Map<string, MaterialReward>,
  fallbackMaterialId: string
): string => {
  if (!detectedMaterial) {
    return fallbackMaterialId;
  }

  const normalizedDetected = detectedMaterial.toLowerCase().trim();

  // Try exact match first
  for (const [id, reward] of materialMap.entries()) {
    if (reward.material_name.toLowerCase() === normalizedDetected) {
      return id;
    }
  }

  // Try partial match in material name
  for (const [id, reward] of materialMap.entries()) {
    if (reward.material_name.toLowerCase().includes(normalizedDetected)) {
      return id;
    }
  }

  // Try partial match in material category
  for (const [id, reward] of materialMap.entries()) {
    if (reward.material_category.toLowerCase().includes(normalizedDetected)) {
      return id;
    }
  }

  // Return fallback if no match found
  return fallbackMaterialId;
};

/**
 * Formats weight value with appropriate precision
 * Returns string representation for form input
 */
const formatWeight = (weightKg: number): string => {
  if (!Number.isFinite(weightKg) || weightKg <= 0) {
    return "";
  }

  // Round to 2 decimal places for user input
  const rounded = Math.round(weightKg * 100) / 100;
  return rounded.toString();
};

/**
 * Validates if the analysis result contains usable products
 * Returns true only if result has at least one valid product with good confidence
 */
export const isAnalysisUsable = (result: ImageAnalysisResult | null): boolean => {
  if (!result || !result.products || result.products.length === 0) {
    return false;
  }

  // Require at least one product with reasonable confidence
  return result.products.some((product) => product.confidence >= 0.5);
};

/**
 * Provides user-friendly error message for analysis failures
 */
export const getAnalysisErrorMessage = (
  error: string | null,
  hasKey: (key: string) => boolean,
  getTranslation: (key: string) => string
): string => {
  if (!error) {
    return "";
  }

  const errorLowercase = error.toLowerCase();

  if (errorLowercase.includes("network")) {
    return hasKey("donationWizard.errors.networkError")
      ? getTranslation("donationWizard.errors.networkError")
      : "Network error. Please check your connection and try again.";
  }

  if (errorLowercase.includes("timeout")) {
    return hasKey("donationWizard.errors.analysisTimeout")
      ? getTranslation("donationWizard.errors.analysisTimeout")
      : "Analysis took too long. Please try again.";
  }

  if (errorLowercase.includes("invalid")) {
    return hasKey("donationWizard.errors.invalidImage")
      ? getTranslation("donationWizard.errors.invalidImage")
      : "Unable to process this image. Please try another one.";
  }

  // Generic error message
  return hasKey("donationWizard.errors.analysisError")
    ? getTranslation("donationWizard.errors.analysisError")
    : "Unable to analyze the image. Please try again.";
};

/**
 * Checks if multiple distinct products were detected
 * Useful for prompting user to add more items
 */
export const hasMultipleProductsDetected = (result: ImageAnalysisResult | null): boolean => {
  return Boolean(result?.products && result.products.length > 1);
};

/**
 * Gets a summary message for analysis result
 * Shows number of items detected with confidence indication
 */
export const getAnalysisSummary = (
  result: ImageAnalysisResult | null,
  hasKey: (key: string) => boolean,
  getTranslation: (key: string) => string
): string => {
  if (!result || !result.products || result.products.length === 0) {
    return hasKey("donationWizard.analysis.noItemsDetected")
      ? getTranslation("donationWizard.analysis.noItemsDetected")
      : "No items detected in this image.";
  }

  const itemCount = result.products.length;
  const confidence = Math.round(result.overall_confidence * 100);

  if (itemCount === 1) {
    return hasKey("donationWizard.analysis.singleItemDetected")
      ? getTranslation("donationWizard.analysis.singleItemDetected")
      : `Detected 1 item (${confidence}% confidence)`;
  }

  return hasKey("donationWizard.analysis.multipleItemsDetected")
    ? getTranslation("donationWizard.analysis.multipleItemsDetected")
    : `Detected ${itemCount} items (${confidence}% confidence)`;
};
