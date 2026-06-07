import type {
  ProductAssessmentData,
  ProductAssessmentSessionDraft
} from "@/components/dashboard/assessment/steps/types";

const ASSESSMENT_DRAFT_SCHEMA_VERSION = 2;
const ASSESSMENT_DRAFT_KEY_PREFIX = "assessment_draft_v2";

export interface AssessmentDraftScope {
  companyId?: string | null;
  mode: "modal" | "page";
  productId?: string | null;
  userId?: string | null;
}

interface StoredAssessmentDraft extends ProductAssessmentSessionDraft {
  companyId: string | null;
  mode: "modal" | "page";
  productId: string | null;
  schemaVersion: number;
  userId: string | null;
}

const getStorage = () => {
  if (typeof window === "undefined") return null;
  return window.localStorage;
};

export const buildAssessmentDraftKey = (scope: AssessmentDraftScope) =>
  [
    ASSESSMENT_DRAFT_KEY_PREFIX,
    scope.userId || "anonymous",
    scope.companyId || "no-company",
    scope.mode,
    scope.productId || "new"
  ].join(":");

export const readAssessmentDraft = (
  scope: AssessmentDraftScope
): ProductAssessmentSessionDraft | null => {
  const storage = getStorage();
  if (!storage) return null;

  try {
    const raw = storage.getItem(buildAssessmentDraftKey(scope));
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredAssessmentDraft> | null;
    if (!parsed || parsed.schemaVersion !== ASSESSMENT_DRAFT_SCHEMA_VERSION) {
      return null;
    }

    if (!parsed.data || typeof parsed.currentStep !== "number") {
      return null;
    }

    return {
      currentStep: parsed.currentStep,
      data: parsed.data as ProductAssessmentData,
      updatedAt: parsed.updatedAt || new Date().toISOString()
    };
  } catch {
    return null;
  }
};

export const writeAssessmentDraft = (
  scope: AssessmentDraftScope,
  draft: ProductAssessmentSessionDraft
) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    const payload: StoredAssessmentDraft = {
      ...draft,
      companyId: scope.companyId || null,
      mode: scope.mode,
      productId: scope.productId || null,
      schemaVersion: ASSESSMENT_DRAFT_SCHEMA_VERSION,
      userId: scope.userId || null
    };
    storage.setItem(buildAssessmentDraftKey(scope), JSON.stringify(payload));
  } catch {

  }
};

export const clearAssessmentDraft = (scope: AssessmentDraftScope) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    storage.removeItem(buildAssessmentDraftKey(scope));
  } catch {

  }
};

