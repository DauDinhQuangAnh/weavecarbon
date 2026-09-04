import { readAuthUserSnapshot } from "@/lib/apiClient";
import {
  CLIENT_CACHE_POLICIES,
  buildClientCacheKey,
  readSessionCache,
  writeSessionCache
} from "@/lib/clientCache";
import type { ProductRecord } from "@/lib/productsApi";

interface SummaryProductCacheValue {
  id: string;
  product: ProductRecord;
}

const normalizeLookup = (value: unknown) =>
  String(value ?? "").trim().toLowerCase();

const getCurrentScope = () => {
  const snapshot = readAuthUserSnapshot();
  return {
    companyId: normalizeLookup(snapshot?.company_id ?? snapshot?.companyId) || null,
    userId: normalizeLookup(snapshot?.id) || null
  };
};

const getCacheKey = () => buildClientCacheKey(
  CLIENT_CACHE_POLICIES.summaryProductPrefetch,
  getCurrentScope()
);

export const cacheSummaryProduct = (product: ProductRecord) => {
  writeSessionCache<SummaryProductCacheValue>(
    getCacheKey(),
    CLIENT_CACHE_POLICIES.summaryProductPrefetch,
    { id: product.id, product }
  );
};

export const readSummaryProduct = (slug: string): ProductRecord | null => {
  const cached = readSessionCache<SummaryProductCacheValue>(
    getCacheKey(),
    CLIENT_CACHE_POLICIES.summaryProductPrefetch
  );
  if (!cached?.product) return null;

  const target = normalizeLookup(slug);
  const candidateTokens = [
    cached.id,
    cached.product.id,
    cached.product.productCode,
    cached.product.productName
  ].map(normalizeLookup);

  return candidateTokens.some((token) => token.length > 0 && token === target)
    ? cached.product
    : null;
};
