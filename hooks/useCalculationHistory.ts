import { useCallback, useEffect, useRef, useState } from "react";
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

const normalizeHistory = (raw: unknown): CalculationHistoryItem[] => {
  if (!Array.isArray(raw)) return [];

  return raw.
  filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null).
  map((item, index) => ({
    id:
    typeof item.id === "string" && item.id.length > 0 ?
    item.id :
    `calc-${Date.now()}-${index}`,
    productId: typeof item.productId === "string" ? item.productId : "",
    productName: typeof item.productName === "string" ? item.productName : "",
    materialsCO2: Number(item.materialsCO2 ?? item.materialsCo2e ?? item.materials) || 0,
    manufacturingCO2: Number(
      item.manufacturingCO2 ??
      item.productionCo2e ??
      item.productionCO2 ??
      item.manufacturing ??
      item.production
    ) || 0,
    transportCO2: Number(item.transportCO2 ?? item.transportCo2e ?? item.transport) || 0,
    packagingCO2: Number(item.packagingCO2 ?? item.packagingCo2e ?? item.packaging) || 0,
    totalCO2: Number(item.totalCO2 ?? item.totalCo2e ?? item.total) || 0,
    carbonVersion:
    typeof item.carbonVersion === "string" ?
    item.carbonVersion :
    typeof item.engineVersion === "string" ?
    item.engineVersion :
    typeof item.version === "string" ?
    item.version :
    "v1",
    createdAt:
    typeof item.createdAt === "string" && item.createdAt.length > 0 ?
    item.createdAt :
    typeof item.calculatedAt === "string" ?
    item.calculatedAt :
    new Date().toISOString(),
    createdBy: typeof item.createdBy === "string" ? item.createdBy : "system"
  }));
};

const readHistoryFromStorage = () => {
  if (typeof window === "undefined") return [];

  try {
    const primaryRaw = localStorage.getItem(STORAGE_KEY);
    const primary = normalizeHistory(primaryRaw ? JSON.parse(primaryRaw) : []);
    if (primary.length > 0) {
      return primary;
    }

    const legacyRaw = localStorage.getItem(LEGACY_STORAGE_KEY);
    return normalizeHistory(legacyRaw ? JSON.parse(legacyRaw) : []);
  } catch (error) {
    console.error("Error loading calculation history:", error);
    return [];
  }
};

export const useCalculationHistory = () => {
  const [history, setHistory] = useState<CalculationHistoryItem[]>(readHistoryFromStorage);
  const isHydratedRef = useRef(false);
  const [isLoaded, setIsLoaded] = useState(false);

  const fetchBackendCalculations = useCallback(async () => {
    try {
      const response = await api.get<{ data?: any[] }>("/carbon-calculations");
      const items = Array.isArray(response?.data) ?
      response.data :
      Array.isArray(response) ?
      response :
      [];

      if (items.length > 0) {
        const mapped: CalculationHistoryItem[] = items.map((row: any, idx: number) => ({
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

        setHistory((prev) => {
          const beIds = new Set(mapped.map((m) => m.id));
          const localOnly = prev.filter((p) => !beIds.has(p.id) && !p.id.startsWith("calc-be-"));
          return [...mapped, ...localOnly];
        });
      }
    } catch {
      // Graceful fallback to localStorage
    } finally {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    fetchBackendCalculations();
  }, [fetchBackendCalculations]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (!isHydratedRef.current) {
      isHydratedRef.current = true;
      return;
    }

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history));
    } catch (error) {
      console.error("Error saving calculation history:", error);
    }
  }, [history]);

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
