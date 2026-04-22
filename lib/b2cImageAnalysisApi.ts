/**
 * B2C Image Analysis API
 * Handles communication with backend AI for image analysis
 */

import { apiRequest } from "@/lib/apiClient";
import type { ImageAnalysisResult } from "@/types/imageAnalysis";

export const analyzeImageForDonation = async (
  imageFile: File,
  category?: "charity" | "recycle"
): Promise<ImageAnalysisResult> => {
  const formData = new FormData();
  formData.append("image", imageFile);

  if (category) {
    formData.append("category", category);
  }

  // Include available material rewards as context for the AI
  // This helps ensure detected materials match available options
  try {
    const response = await apiRequest<ImageAnalysisResult>("/b2c/analyze-donation-image", {
      method: "POST",
      body: formData
    });

    return response;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to analyze image";

    throw new Error(`Image analysis failed: ${errorMessage}`);
  }
};
