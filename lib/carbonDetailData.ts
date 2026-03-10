

export interface CarbonBreakdownItem {
  stage:
  "materials" |
  "manufacturing" |
  "transport" |
  "packaging" |
  "end_of_life";
  label: string;
  co2e: number | null;
  percentage: number | null;
  note: string;
  isProxy: boolean;
  hasData: boolean;
}

export interface MaterialImpactItem {
  material: string;
  percentage: number;
  emissionFactor: number;
  co2e: number;
  source: "documented" | "proxy";
  factorSource: string;
}

export interface EndOfLifeData {
  strategy: "no_takeback" | "selective" | "data_based" | "not_set";
  strategyLabel: string;
  breakdown: {
    reuse: number;
    recycle: number;
    disposal: number;
  };
  avoidedEmissions: number;
  netImpact: number;
  hasData: boolean;
}

export interface ComplianceItem {
  criterion: string;
  status: "passed" | "partial" | "failed";
  note?: string;
}

export interface ImprovementSuggestion {
  id: string;
  type:
  "material" |
  "transport" |
  "manufacturing" |
  "packaging" |
  "end_of_life";
  title: string;
  description: string;
  potentialReduction: number;
  difficulty: "easy" | "medium" | "hard";
}

export interface DataCompletenessItem {
  field: string;
  label: string;
  status: "complete" | "partial" | "missing";
  jumpTo?: string;
  note?: string;
}

export interface VersionHistoryItem {
  version: string;
  timestamp: string;
  updatedBy: string;
  note: string;
  changes?: string[];
}

export interface ProductCarbonDetail {
  productId: string;
  totalCo2e: number;
  co2eRange?: {min: number;max: number;};
  confidenceLevel: "high" | "medium" | "low";
  confidenceScore: number;
  calculationNote: string;
  isPreliminary: boolean;
  breakdown: CarbonBreakdownItem[];
  dataCompleteness: DataCompletenessItem[];
  materialImpact: MaterialImpactItem[];
  versionHistory: VersionHistoryItem[];
  endOfLife: EndOfLifeData;
  compliance: ComplianceItem[];
  exportReady: boolean;
  suggestions: ImprovementSuggestion[];
}

export const STAGE_COLORS: Record<string, string> = {
  materials: "hsl(var(--chart-1))",
  manufacturing: "hsl(var(--chart-2))",
  transport: "hsl(var(--chart-3))",
  packaging: "hsl(var(--chart-4))",
  end_of_life: "hsl(var(--chart-5))"
};

export const CONFIDENCE_CONFIG = {
  high: {
    color: "text-green-600",
    bg: "bg-green-100",
    label: "Cao",
    minScore: 85
  },
  medium: {
    color: "text-yellow-600",
    bg: "bg-yellow-100",
    label: "Trung bình",
    minScore: 65
  },
  low: {
    color: "text-red-600",
    bg: "bg-red-100",
    label: "Thấp",
    minScore: 0
  }
};