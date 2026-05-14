"use client";

/**
 * Hook for managing Camera AI image analysis
 * Handles loading states, error handling, and result management
 */

import { useCallback, useState } from "react";
import { analyzeImageForDonation } from "@/lib/b2cImageAnalysisApi";
import type { ImageAnalysisState } from "@/types/imageAnalysis";

const initialState: ImageAnalysisState = {
  isLoading: false,
  result: null,
  error: null,
  isCompleted: false
};

export const useImageAnalysis = () => {
  const [state, setState] = useState<ImageAnalysisState>(initialState);

  const analyzeImage = useCallback(
    async (imageFile: File, category?: "charity" | "recycle") => {
      setState({
        isLoading: true,
        result: null,
        error: null,
        isCompleted: false
      });

      try {
        const result = await analyzeImageForDonation(imageFile, category);

        setState({
          isLoading: false,
          result,
          error: null,
          isCompleted: true
        });

        return result;
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";

        setState({
          isLoading: false,
          result: null,
          error: errorMessage,
          isCompleted: true
        });

        throw error;
      }
    },
    []
  );

  const resetAnalysis = useCallback(() => {
    setState(initialState);
  }, []);

  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null
    }));
  }, []);

  return {
    ...state,
    analyzeImage,
    resetAnalysis,
    clearError
  };
};
