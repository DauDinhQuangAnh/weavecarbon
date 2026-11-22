import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/apiClient";

export interface CalculationHistoryItem {
  id: string;
  productId: string;
  productName: string;
  materialsCO2: number;
  manufacturingCO2: number;
  transportCO2: number;
  packagingCO2: number;
  totalCO2: number;
  carbonVersion: string;
  createdAt: string;
  createdBy: string;
}

const STORAGE_KEY = "weavecarbon_calculation_history";
const LEGACY_STORAGE_KEY = "weavecarbon_history";

// Calculation history belongs to the signed-in company and is read from the server only.
// Older builds also cached it under browser-wide localStorage keys shared by every account
// (and by the /demo runtime) on the same device, so records from one account or from the
// demo showed up in another account's history. Those keys are purged and never read again.
const purgeLegacyHistoryCache = () => {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  } catch {
    // Storage may be unavailable (private mode, blocked storage); nothing to purge then.
  }
};

export const useCalculationHistory = () => {
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchBackendCalculations = useCallback(async () => {
    try {
      const response = await api.get<{ data?: Record<string, unknown>[] }>("/carbon-calculations");
      const items: Record<string, unknown>[] = Array.isArray(response?.data) ?
        response.data :
        Array.isArray(response) ?
        (response as Record<string, unknown>[]) :
        [];

      if (items.length > 0) {
        const mapped: CalculationHistoryItem[] = items.map((row, idx) => ({
          id: String(row.id || `calc-be-${idx}`),
          productId: String(row.productId || row.product_id || ""),
          productName: String(
            row.notes || (row.productId ? `Sản phẩm ${row.productId}` : "Bản tính phát thải")
          ),
          materialsCO2: Number(row.materialsCo2e ?? row.materialsCO2) || 0,
          manufacturingCO2: Number(row.productionCo2e ?? row.manufacturingCO2) || 0,
          transportCO2: Number(row.transportCo2e ?? row.transportCO2) || 0,
          packagingCO2: Number(row.packagingCO2 ?? row.packagingCo2e) || 0,
          totalCO2: Number(row.totalCo2e ?? row.totalCO2) || 0,
          carbonVersion: String(row.engineVersion || row.methodology || row.methodologyVersion || "v2.1"),
          createdAt: String(row.calculatedAt || row.createdAt || new Date().toISOString()),
          createdBy: String(row.userId || row.createdBy || "system")
        }));

        setHistory(mapped);
      } else {
        setHistory([]);
      }
    } catch {
      // Keep what this session already loaded; never fall back to another account's cache.
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchBackendCalculations();
  }, [fetchBackendCalculations]);

  useEffect(() => {
    purgeLegacyHistoryCache();
  }, []);

  const addCalculation = useCallback(
    (calculation: Omit<CalculationHistoryItem, "id" | "createdAt">) => {
      const newItem: CalculationHistoryItem = {
        ...calculation,
        id: `calc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString()
      };
      setHistory((prev) => [newItem, ...prev]);
      return newItem;
    },
    []
  );

  const deleteCalculation = useCallback((id: string) => {
    setHistory((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const getByProductId = useCallback(
    (productId: string) => {
      return history.filter((item) => item.productId === productId);
    },
    [history]
  );

  return {
    history,
    isLoaded,
    addCalculation,
    deleteCalculation,
    getByProductId,
    refresh: fetchBackendCalculations
  };
};
