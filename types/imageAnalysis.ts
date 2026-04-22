/**
 * Type definitions for Camera AI image analysis feature
 * Handles detection and classification of products in images
 */

export interface AnalyzedProduct {
  /** Detected product name */
  item_name: string;
  /** Product category/type (e.g., "shirt", "pants", "bag") */
  item_type: string;
  /** Material composition (e.g., "cotton", "polyester", "mixed") */
  material_id: string;
  /** Custom material name if not in predefined list */
  custom_material_name?: string;
  /** Condition of the item (e.g., "good", "fair", "poor") */
  condition: "good" | "fair" | "poor";
  /** Estimated weight in kilograms */
  weight_kg: number;
  /** Confidence score of detection (0-1) */
  confidence: number;
}

export interface ImageAnalysisResult {
  /** Array of detected products */
  products: AnalyzedProduct[];
  /** Total number of items detected */
  total_items_detected: number;
  /** Overall analysis confidence score (0-1) */
  overall_confidence: number;
  /** Error message if analysis failed */
  error?: string;
  /** Raw analysis data from AI model */
  raw_analysis?: Record<string, unknown>;
}

export interface ImageAnalysisRequest {
  /** Image file to analyze */
  image: File;
  /** Optional category context: "charity" or "recycle" */
  category?: "charity" | "recycle";
}

export interface ImageAnalysisState {
  /** Whether analysis is in progress */
  isLoading: boolean;
  /** Analysis result */
  result: ImageAnalysisResult | null;
  /** Error message if analysis failed */
  error: string | null;
  /** Whether analysis has been completed */
  isCompleted: boolean;
}
