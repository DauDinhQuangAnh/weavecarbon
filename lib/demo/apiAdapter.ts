"use client";

import {
  ApiError,
  type ApiRequestAdapter,
} from "@/lib/apiClient";
import type { DemoDataset } from "@/lib/demo/schema";
import { mutateDemoDataset, readDemoDataset } from "@/lib/demo/storage";
import { getDemoAccountPayload, getDemoCheckCompanyPayload, getDemoCompanyMembersPayload } from "@/lib/demo/domain/account";
import { getDemoSubscriptionPayload } from "@/lib/demo/domain/subscription";
import {
  getDemoOverviewPayload,
  saveDemoDashboardTarget
} from "@/lib/demo/domain/overview";
import {
  addDemoBatchItem,
  createDemoBatch,
  createDemoProduct,
  deleteDemoBatch,
  deleteDemoProduct,
  getDemoBatchById,
  getDemoProductById,
  importDemoBulkRows,
  listDemoBatches,
  listDemoProducts,
  publishDemoBatch,
  removeDemoBatchItem,
  updateDemoBatch,
  updateDemoBatchItem,
  updateDemoProduct,
  updateDemoProductStatus,
  validateDemoBulkImport,
} from "@/lib/demo/domain/products";
import {
  createDemoShipment,
  getDemoLogisticsOverview,
  getDemoShipmentById,
  listDemoShipments,
  replaceDemoShipmentLegs,
  replaceDemoShipmentProducts,
  updateDemoShipment,
  updateDemoShipmentStatus,
} from "@/lib/demo/domain/logistics";
import {
  approveDemoComplianceDocument,
  createDemoComplianceReport,
  getDemoComplianceMarkets,
  removeDemoComplianceDocument,
  removeDemoComplianceProduct,
  runDemoComplianceRecommendationAction,
  uploadDemoComplianceDocument,
  upsertDemoComplianceCarbonData,
  upsertDemoComplianceProduct,
} from "@/lib/demo/domain/export";
import {
  createDemoReport,
  deleteDemoReport,
  getDemoExportData,
  getDemoReports,
  getDemoReportSourceCount,
  getDemoReportSourceCounts,
} from "@/lib/demo/domain/reports";
import {
  getDemoAuditTrail,
  getDemoCarbonCalculations,
  getDemoDataGaps,
  getDemoElectricityInvoices,
  getDemoEvidenceDocuments,
  getDemoEvidenceFields,
  getDemoFuelInvoices,
  getDemoSuppliers,
} from "@/lib/demo/domain/operations";
import {
  createDemoB2CDonation,
  getDemoB2CAccount,
  getDemoB2CCollectionPoints,
  getDemoB2CCoupons,
  getDemoB2CDashboard,
  getDemoB2CDonationById,
  getDemoB2CDonations,
  getDemoB2CImageAnalysis,
  getDemoB2CMaterialRewards,
  getDemoB2CRewardTransactions,
} from "@/lib/demo/domain/b2c";

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const normalizePath = (value: string) => {
  try {
    const parsed = new URL(value, "http://demo.local");
    return `${parsed.pathname.replace(/^\/api(?=\/|$)/, "")}${parsed.search}`;
  } catch {
    return value.replace(/^\/api(?=\/|$)/, "");
  }
};

const parseRequestUrl = (value: string) => new URL(normalizePath(value), "http://demo.local");

const getBodyObject = (value: unknown) => (isObject(value) ? value : {});

const createUnhandledEndpointError = (path: string, method: string) =>
  new ApiError(`Demo adapter does not handle ${method} ${path}.`, {
    status: 501,
    code: "DEMO_ENDPOINT_NOT_IMPLEMENTED",
  });

const getDemoDataset = () => {
  const dataset = readDemoDataset();
  if (!dataset) {
    throw new ApiError("Demo dataset is unavailable.", {
      status: 503,
      code: "DEMO_DATASET_UNAVAILABLE",
    });
  }
  return dataset;
};

const ensurePathMatches = (match: RegExpMatchArray | null, path: string) => {
  if (!match) {
    throw new ApiError(`Invalid demo path: ${path}`, {
      status: 400,
      code: "DEMO_INVALID_PATH",
    });
  }
  return match;
};

const stripQuotes = (value: string) => value.replace(/^"+|"+$/g, "");

const removeProductFromExportScopes = (dataset: DemoDataset, productId: string) => {
  for (const marketCode of Object.keys(dataset.exportCompliance)) {
    const market = dataset.exportCompliance[marketCode] as Record<string, unknown>;
    if (Array.isArray(market.productScope)) {
      market.productScope = market.productScope.filter(
        (item) => String((item as Record<string, unknown>)?.productId || "") !== productId
      );
    }
    if (Array.isArray(market.documents)) {
      market.documents = market.documents.map((document) => {
        const entry = document as Record<string, unknown>;
        if (!Array.isArray(entry.linkedProducts)) {
          return entry;
        }
        return {
          ...entry,
          linkedProducts: entry.linkedProducts.filter((id) => String(id) !== productId),
        };
      });
    }
  }
};

const mutateDemoResult = async <T>(
  mutator: (draft: DemoDataset) => T | Promise<T>
) => {
  const mutation = await mutateDemoDataset(mutator);
  return mutation.result;
};

export const createDemoApiRequestAdapter = (): ApiRequestAdapter => {
  return (async ({ path, method, body }) => {
    const requestUrl = parseRequestUrl(path);
    const pathname = requestUrl.pathname;
    const searchParams = requestUrl.searchParams;

    try {
      if (method === "GET" && pathname === "/auth/check-company") {
        return { handled: true, value: getDemoCheckCompanyPayload() };
      }

      if (method === "GET" && pathname === "/account") {
        return {
          handled: true,
          value: {
            ...getDemoAccountPayload(getDemoDataset()),
          },
        };
      }

      if (method === "GET" && (pathname === "/company/members" || pathname === "/company-members")) {
        return {
          handled: true,
          value: getDemoCompanyMembersPayload(getDemoDataset()),
        };
      }

      if (method === "POST" && pathname === "/company/members") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const now = new Date().toISOString();
            const member = {
              id: `demo-member-${Date.now()}`,
              user_id: `demo-member-${Date.now()}`,
              company_id: dataset.company.id,
              full_name: String(payload.full_name || payload.email || "Demo Team Member"),
              email: String(payload.email || `member-${Date.now()}@weavecarbon.demo`),
              role: String(payload.role || "member"),
              status: "invited",
              last_login: null,
              created_at: now,
            };
            dataset.users = [member, ...dataset.users] as DemoDataset["users"];
            return member;
          }),
        };
      }

      if (method === "POST" && /^\/company\/members\/[^/]+\/resend-invite$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/company\/members\/([^/]+)\/resend-invite$/), pathname);
        return {
          handled: true,
          value: {
            success: true,
            id: decodeURIComponent(match[1]),
            resent_at: new Date().toISOString(),
          },
        };
      }

      if (method === "PUT" && /^\/company\/members\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/company\/members\/([^/]+)$/), pathname);
        const memberId = decodeURIComponent(match[1]);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            let updated: Record<string, unknown> | null = null;
            dataset.users = dataset.users.map((rawUser) => {
              const user = rawUser as Record<string, unknown>;
              if (String(user.id || user.user_id || "") !== memberId) return rawUser;
              updated = {
                ...user,
                ...payload,
                id: String(user.id || memberId),
                user_id: String(user.user_id || user.id || memberId),
                updated_at: new Date().toISOString(),
              };
              return updated;
            }) as DemoDataset["users"];
            return updated || { id: memberId, ...payload, updated_at: new Date().toISOString() };
          }),
        };
      }

      if (method === "DELETE" && /^\/company\/members\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/company\/members\/([^/]+)$/), pathname);
        const memberId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            dataset.users = dataset.users.filter((rawUser) => {
              const user = rawUser as Record<string, unknown>;
              const id = String(user.id || user.user_id || "");
              return id !== memberId && id !== dataset.user.id;
            }) as DemoDataset["users"];
            return { success: true };
          }),
        };
      }

      if (method === "GET" && pathname === "/subscription") {
        return {
          handled: true,
          value: getDemoSubscriptionPayload(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/dashboard/overview") {
        return {
          handled: true,
          value: getDemoOverviewPayload(getDemoDataset()),
        };
      }

      if (method === "POST" && pathname === "/dashboard/targets") {
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            saveDemoDashboardTarget(dataset, getBodyObject(body))
          ),
        };
      }

      if (method === "GET" && pathname === "/products") {
        return {
          handled: true,
          value: listDemoProducts(getDemoDataset(), {
            search: searchParams.get("search") || undefined,
            status: (searchParams.get("status") as "draft" | "published" | "all" | null) || undefined,
            page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
            page_size: searchParams.get("page_size") ? Number(searchParams.get("page_size")) : undefined,
          }),
        };
      }

      if (method === "POST" && pathname === "/products") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            createDemoProduct(dataset, payload as never)
          ),
        };
      }

      if (method === "POST" && pathname === "/products/bulk-import/validate") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: validateDemoBulkImport(Array.isArray(payload.rows) ? payload.rows : []),
        };
      }

      if (method === "POST" && pathname === "/products/bulk-import") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            importDemoBulkRows(
              dataset,
              Array.isArray(payload.rows) ? payload.rows : [],
              String(payload.save_mode || "draft") === "publish" ? "publish" : "draft"
            )
          ),
        };
      }

      if (method === "GET" && /^\/products\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/products\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: getDemoProductById(getDemoDataset(), decodeURIComponent(match[1])),
        };
      }

      // ── Public passport ────────────────────────────────────────
      if (method === "GET" && /^\/passport\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/passport\/([^/]+)$/), pathname);
        const productId = decodeURIComponent(match[1]);
        const dataset = getDemoDataset();
        const product = getDemoProductById(dataset, productId);
        const shipments = listDemoShipments(dataset, {});
        const relatedShipment = shipments.items.find((s) => {
          const ids = [s.referenceNumber, s.id];
          return ids.some((v) => v === productId);
        }) ?? shipments.items[0] ?? null;
        return {
          handled: true,
          value: { product, shipment: relatedShipment },
        };
      }

      if (method === "PUT" && /^\/products\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/products\/([^/]+)$/), pathname);
        const productId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoProduct(dataset, productId, body as never)
          ),
        };
      }

      if (method === "PATCH" && /^\/products\/[^/]+\/status$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/products\/([^/]+)\/status$/), pathname);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoProductStatus(
              dataset,
              decodeURIComponent(match[1]),
              String(payload.status || "draft") === "published" ? "published" : "draft"
            )
          ),
        };
      }

      if (method === "DELETE" && /^\/products\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/products\/([^/]+)$/), pathname);
        const productId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            deleteDemoProduct(dataset, productId);
            removeProductFromExportScopes(dataset, productId);
            return { success: true };
          }),
        };
      }

      if (method === "GET" && pathname === "/product-batches") {
        return {
          handled: true,
          value: listDemoBatches(getDemoDataset(), {
            search: searchParams.get("search") || undefined,
            status: (searchParams.get("status") as "draft" | "published" | "archived" | "all" | null) || undefined,
            page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
            page_size: searchParams.get("page_size") ? Number(searchParams.get("page_size")) : undefined,
          }),
        };
      }

      if (method === "POST" && pathname === "/product-batches") {
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => createDemoBatch(dataset, body as never)),
        };
      }

      if (method === "GET" && /^\/product-batches\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: getDemoBatchById(getDemoDataset(), decodeURIComponent(match[1])),
        };
      }

      if (method === "PATCH" && /^\/product-batches\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoBatch(dataset, decodeURIComponent(match[1]), body as never)
          ),
        };
      }

      if (method === "DELETE" && /^\/product-batches\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            deleteDemoBatch(dataset, decodeURIComponent(match[1]));
            return { success: true };
          }),
        };
      }

      if (method === "POST" && /^\/product-batches\/[^/]+\/items$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)\/items$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            addDemoBatchItem(dataset, decodeURIComponent(match[1]), body as never);
            return { success: true };
          }),
        };
      }

      if (method === "PATCH" && /^\/product-batches\/[^/]+\/items\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(
          pathname.match(/^\/product-batches\/([^/]+)\/items\/([^/]+)$/),
          pathname
        );
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            updateDemoBatchItem(
              dataset,
              decodeURIComponent(match[1]),
              decodeURIComponent(match[2]),
              body as never
            );
            return { success: true };
          }),
        };
      }

      if (method === "DELETE" && /^\/product-batches\/[^/]+\/items\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(
          pathname.match(/^\/product-batches\/([^/]+)\/items\/([^/]+)$/),
          pathname
        );
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            removeDemoBatchItem(dataset, decodeURIComponent(match[1]), decodeURIComponent(match[2]));
            return { success: true };
          }),
        };
      }

      if (method === "PATCH" && /^\/product-batches\/[^/]+\/publish$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/product-batches\/([^/]+)\/publish$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            publishDemoBatch(dataset, decodeURIComponent(match[1]))
          ),
        };
      }

      if (method === "GET" && pathname === "/logistics/shipments") {
        return {
          handled: true,
          value: listDemoShipments(getDemoDataset(), {
            search: searchParams.get("search") || undefined,
            status:
              (searchParams.get("status") as "pending" | "in_transit" | "delivered" | "cancelled" | "all" | null) ||
              undefined,
            transport_mode:
              (searchParams.get("transport_mode") as "road" | "sea" | "air" | "rail" | null) || undefined,
            page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
            page_size: searchParams.get("page_size") ? Number(searchParams.get("page_size")) : undefined,
          }),
        };
      }

      if (method === "POST" && pathname === "/logistics/shipments") {
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => createDemoShipment(dataset, body as never)),
        };
      }

      if (method === "GET" && /^\/logistics\/shipments\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/logistics\/shipments\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: getDemoShipmentById(getDemoDataset(), decodeURIComponent(match[1])),
        };
      }

      if (method === "PATCH" && /^\/logistics\/shipments\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/logistics\/shipments\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoShipment(dataset, decodeURIComponent(match[1]), body as never)
          ),
        };
      }

      if (method === "PATCH" && /^\/logistics\/shipments\/[^/]+\/status$/.test(pathname)) {
        const match = ensurePathMatches(
          pathname.match(/^\/logistics\/shipments\/([^/]+)\/status$/),
          pathname
        );
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) =>
            updateDemoShipmentStatus(
              dataset,
              decodeURIComponent(match[1]),
              String(payload.status || "pending") as never,
              typeof payload.actual_arrival === "string" ? payload.actual_arrival : undefined
            )
          ),
        };
      }

      if (method === "PUT" && /^\/logistics\/shipments\/[^/]+\/legs$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/logistics\/shipments\/([^/]+)\/legs$/), pathname);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            replaceDemoShipmentLegs(
              dataset,
              decodeURIComponent(match[1]),
              Array.isArray(payload.legs) ? payload.legs : []
            );
            return { success: true };
          }),
        };
      }

      if (method === "PUT" && /^\/logistics\/shipments\/[^/]+\/products$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/logistics\/shipments\/([^/]+)\/products$/), pathname);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            replaceDemoShipmentProducts(
              dataset,
              decodeURIComponent(match[1]),
              Array.isArray(payload.products) ? payload.products : []
            );
            return { success: true };
          }),
        };
      }

      if (method === "GET" && pathname === "/logistics/overview") {
        return {
          handled: true,
          value: getDemoLogisticsOverview(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/export/markets") {
        return {
          handled: true,
          value: getDemoComplianceMarkets(getDemoDataset()),
        };
      }

      if (pathname.startsWith("/export/markets/")) {
        const parts = pathname.split("/").filter(Boolean);
        const marketCode = decodeURIComponent(stripQuotes(parts[2] || "")) as never;

        if (method === "POST" && parts[3] === "recommendations" && parts[5] === "actions") {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              runDemoComplianceRecommendationAction(
                dataset,
                marketCode,
                decodeURIComponent(parts[4] || ""),
                String(payload.action || "")
              );
              return { success: true };
            }),
          };
        }

        if (method === "POST" && parts[3] === "products" && parts.length === 4) {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              upsertDemoComplianceProduct(dataset, marketCode, {
                productName: String(payload.product_name || ""),
                hsCode: String(payload.hs_code || ""),
                productionSite: String(payload.production_site || ""),
                exportVolume: Number(payload.export_volume || 0),
                unit: String(payload.unit || "pcs"),
              });
              return { success: true };
            }),
          };
        }

        if (method === "PATCH" && parts[3] === "products" && parts.length === 5) {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              upsertDemoComplianceProduct(dataset, marketCode, {
                productId: decodeURIComponent(parts[4] || ""),
                productName: String(payload.product_name || ""),
                hsCode: String(payload.hs_code || ""),
                productionSite: String(payload.production_site || ""),
                exportVolume: Number(payload.export_volume || 0),
                unit: String(payload.unit || "pcs"),
              });
              return { success: true };
            }),
          };
        }

        if (method === "DELETE" && parts[3] === "products" && parts.length === 5) {
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              removeDemoComplianceProduct(dataset, marketCode, decodeURIComponent(parts[4] || ""));
              return { success: true };
            }),
          };
        }

        if (method === "PATCH" && parts[3] === "carbon-data" && parts.length === 5) {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              upsertDemoComplianceCarbonData(dataset, marketCode, {
                scope: decodeURIComponent(parts[4] || "") as never,
                value: Number(payload.value || 0),
                unit: String(payload.unit || "tCO2e"),
                methodology: String(payload.methodology || ""),
                dataSource: String(payload.data_source || payload.dataSource || ""),
                reportingPeriod: String(payload.reporting_period || payload.reportingPeriod || ""),
                isComplete: true,
              });
              return { success: true };
            }),
          };
        }

        if (method === "POST" && parts[3] === "documents" && parts[5] === "upload") {
          const formData = body instanceof FormData ? body : null;
          const file = formData?.get("file");
          if (!(file instanceof File)) {
            throw new ApiError("Demo upload requires a PDF file.", {
              status: 400,
              code: "DEMO_FILE_REQUIRED",
            });
          }
          return {
            handled: true,
            value: await mutateDemoResult(async (dataset) => {
              await uploadDemoComplianceDocument(dataset, marketCode, decodeURIComponent(parts[4] || ""), file);
              return { success: true };
            }),
          };
        }

        if (method === "DELETE" && parts[3] === "documents" && parts.length === 5) {
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              removeDemoComplianceDocument(dataset, marketCode, decodeURIComponent(parts[4] || ""));
              return { success: true };
            }),
          };
        }

        if (method === "POST" && parts[3] === "documents" && parts[5] === "approve") {
          return {
            handled: true,
            value: await mutateDemoResult((dataset) => {
              approveDemoComplianceDocument(dataset, marketCode, decodeURIComponent(parts[4] || ""));
              return { success: true };
            }),
          };
        }

        if (method === "POST" && parts[3] === "reports" && parts.length === 4) {
          const payload = getBodyObject(body);
          return {
            handled: true,
            value: await mutateDemoResult((dataset) =>
              createDemoComplianceReport(
                dataset,
                marketCode,
                String(payload.file_format || "xlsx") as "csv" | "xlsx" | "pdf"
              )
            ),
          };
        }
      }

      if (method === "GET" && pathname === "/reports") {
        return {
          handled: true,
          value: getDemoReports(getDemoDataset()),
        };
      }

      if (method === "POST" && pathname === "/reports") {
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => createDemoReport(dataset, getBodyObject(body))),
        };
      }

      if (method === "GET" && /^\/reports\/[^/]+\/status$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/reports\/([^/]+)\/status$/), pathname);
        const reportId = decodeURIComponent(match[1]);
        const report = getDemoReports(getDemoDataset()).find((item) => item.id === reportId);
        return {
          handled: true,
          value: {
            id: reportId,
            status: report?.status || "completed",
            download_url: report?.downloadUrl || `demo://report/${reportId}`,
          },
        };
      }

      if (method === "DELETE" && /^\/reports\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/reports\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            deleteDemoReport(dataset, decodeURIComponent(match[1]));
            return { success: true };
          }),
        };
      }

      if (method === "GET" && pathname === "/reports/export-sources") {
        return {
          handled: true,
          value: getDemoReportSourceCounts(getDemoDataset()),
        };
      }

      if (method === "GET" && /^\/reports\/export-sources\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/reports\/export-sources\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: {
            count: getDemoReportSourceCount(getDemoDataset(), decodeURIComponent(match[1]) as never),
          },
        };
      }

      if (method === "GET" && /^\/reports\/export-data\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/reports\/export-data\/([^/]+)$/), pathname);
        return {
          handled: true,
          value: getDemoExportData(getDemoDataset(), decodeURIComponent(match[1]) as never),
        };
      }

      if (method === "GET" && pathname === "/audit-trail") {
        return {
          handled: true,
          value: getDemoAuditTrail(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/suppliers") {
        return {
          handled: true,
          value: getDemoSuppliers(getDemoDataset()),
        };
      }

      if (method === "POST" && pathname === "/suppliers") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: {
            id: `sup-${Date.now()}`,
            supplierName: String(payload.supplierName || payload.supplier_name || "New demo supplier"),
            supplierEmail: String(payload.supplierEmail || payload.supplier_email || "supplier@example.com"),
            materialSupplied: String(payload.materialSupplied || payload.material_supplied || null),
            requiredData: Array.isArray(payload.requiredData)
              ? payload.requiredData
              : Array.isArray(payload.required_data)
              ? payload.required_data
              : ["Emission factor", "Invoice", "Certificate"],
            deadline: String(
              payload.deadline || new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
            ),
            status: String(payload.status || "draft"),
            createdAt: new Date().toISOString(),
          },
        };
      }

      if (method === "GET" && pathname === "/evidence") {
        const dataset = getDemoDataset();
        const deletedIds = new Set<string>(
          Array.isArray(dataset.uiState.deletedEvidenceIds)
            ? (dataset.uiState.deletedEvidenceIds as string[])
            : []
        );
        const allDocuments = getDemoEvidenceDocuments(dataset).filter(
          (d) => !deletedIds.has(d.id)
        );
        const page = searchParams.get("page") ? Number(searchParams.get("page")) : 1;
        const pageSize = searchParams.get("page_size") ? Number(searchParams.get("page_size")) : allDocuments.length;
        const safePage = Number.isFinite(page) && page > 0 ? page : 1;
        const safePageSize = Number.isFinite(pageSize) && pageSize > 0 ? pageSize : allDocuments.length;
        const start = (safePage - 1) * safePageSize;
        const items = allDocuments.slice(start, start + safePageSize);
        return {
          handled: true,
          value: {
            items,
            total: allDocuments.length,
            page: safePage,
            page_size: safePageSize,
          },
        };
      }

      if (method === "POST" && pathname === "/evidence/upload") {
        return {
          handled: true,
          value: {
            id: `ev-demo-${Date.now()}`,
            kind: "supplier_declaration",
            documentName: "demo-upload.pdf",
            fileName: "demo-upload.pdf",
            status: "processing",
            verificationLevel: 0,
            trustScore: 61,
            checksumSha256: "pending-demo-upload-hash",
            warnings: ["OCR processing in demo mode"],
            extractedJson: {},
            createdAt: new Date().toISOString(),
          },
        };
      }

      if (method === "GET" && /^\/evidence\/[^/]+\/fields$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/evidence\/([^/]+)\/fields$/), pathname);
        return {
          handled: true,
          value: getDemoEvidenceFields(getDemoDataset(), decodeURIComponent(match[1])),
        };
      }

      if (method === "GET" && pathname === "/data-gaps") {
        return {
          handled: true,
          value: getDemoDataGaps(getDemoDataset()),
        };
      }

      if (method === "GET" && pathname === "/electricity-invoices") {
        const dataset = getDemoDataset();
        const ds = dataset as Record<string, unknown>;
        const list = Array.isArray(ds.electricityInvoices)
          ? (ds.electricityInvoices as Record<string, unknown>[])
          : getDemoElectricityInvoices(dataset);
        return { handled: true, value: list };
      }

      if (method === "GET" && pathname === "/fuel-invoices") {
        const dataset = getDemoDataset();
        const ds = dataset as Record<string, unknown>;
        const list = Array.isArray(ds.fuelInvoices)
          ? (ds.fuelInvoices as Record<string, unknown>[])
          : getDemoFuelInvoices(dataset);
        return { handled: true, value: list };
      }

      if (method === "GET" && pathname === "/carbon-calculations") {
        return {
          handled: true,
          value: getDemoCarbonCalculations(getDemoDataset()),
        };
      }
      // ── Suppliers CRUD ─────────────────────────────────────────
      if (method === "PUT" && /^\/suppliers\/[^/]+$/.test(pathname)) {
        const payload = getBodyObject(body);
        return { handled: true, value: { ...payload, updated_at: new Date().toISOString() } };
      }

      // ── Evidence CRUD ──────────────────────────────────────────
      if (method === "PATCH" && /^\/evidence\/[^/]+\/fields$/.test(pathname)) {
        return { handled: true, value: { success: true } };
      }

      if (method === "POST" && /^\/evidence\/[^/]+\/confirm$/.test(pathname)) {
        return { handled: true, value: { success: true } };
      }

      if (method === "POST" && /^\/evidence\/[^/]+\/verify$/.test(pathname)) {
        return { handled: true, value: { success: true } };
      }

      if (method === "DELETE" && /^\/evidence\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/evidence\/([^/]+)$/), pathname);
        const evidenceId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const existing = Array.isArray(dataset.uiState.deletedEvidenceIds)
              ? (dataset.uiState.deletedEvidenceIds as string[])
              : [];
            dataset.uiState = { ...dataset.uiState, deletedEvidenceIds: [...existing, evidenceId] };
            return { deleted: true };
          }),
        };
      }

      // ── Data Gaps CRUD ─────────────────────────────────────────
      if (method === "POST" && pathname === "/data-gaps/seed") {
        return { handled: true, value: { seeded: 6, message: "Demo seed data already loaded." } };
      }

      if (method === "POST" && pathname === "/data-gaps") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: {
            id: `dg-${Date.now()}`,
            requiredForAudit: true,
            currentStatus: "missing",
            riskLevel: "medium",
            ...payload,
            createdAt: new Date().toISOString(),
          },
        };
      }

      if (method === "PUT" && /^\/data-gaps\/[^/]+$/.test(pathname)) {
        const payload = getBodyObject(body);
        return { handled: true, value: { ...payload, updatedAt: new Date().toISOString() } };
      }

      // ── Electricity Invoices CRUD ──────────────────────────────
      if (method === "POST" && pathname === "/electricity-invoices") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const ds = dataset as Record<string, unknown>;
            const current = Array.isArray(ds.electricityInvoices)
              ? (ds.electricityInvoices as Record<string, unknown>[])
              : getDemoElectricityInvoices(dataset);
            const newItem = { id: `elec-${Date.now()}`, created_at: new Date().toISOString(), ...payload };
            ds.electricityInvoices = [...current, newItem];
            return newItem;
          }),
        };
      }

      if (method === "PUT" && /^\/electricity-invoices\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/electricity-invoices\/([^/]+)$/), pathname);
        const invoiceId = decodeURIComponent(match[1]);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const ds = dataset as Record<string, unknown>;
            const current = Array.isArray(ds.electricityInvoices)
              ? (ds.electricityInvoices as Record<string, unknown>[])
              : getDemoElectricityInvoices(dataset);
            let updated: Record<string, unknown> | null = null;
            ds.electricityInvoices = current.map((item) => {
              if (String((item as Record<string, unknown>).id) !== invoiceId) return item;
              updated = { ...(item as Record<string, unknown>), ...payload, id: invoiceId, updated_at: new Date().toISOString() };
              return updated;
            });
            return updated ?? { id: invoiceId, ...payload, updated_at: new Date().toISOString() };
          }),
        };
      }

      if (method === "DELETE" && /^\/electricity-invoices\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/electricity-invoices\/([^/]+)$/), pathname);
        const invoiceId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const ds = dataset as Record<string, unknown>;
            const current = Array.isArray(ds.electricityInvoices)
              ? (ds.electricityInvoices as Record<string, unknown>[])
              : getDemoElectricityInvoices(dataset);
            ds.electricityInvoices = current.filter(
              (item) => String((item as Record<string, unknown>).id) !== invoiceId
            );
            return { deleted: true };
          }),
        };
      }

      // ── Fuel Invoices CRUD ─────────────────────────────────────
      if (method === "POST" && pathname === "/fuel-invoices") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const ds = dataset as Record<string, unknown>;
            const current = Array.isArray(ds.fuelInvoices)
              ? (ds.fuelInvoices as Record<string, unknown>[])
              : getDemoFuelInvoices(dataset);
            const newItem = { id: `fuel-${Date.now()}`, created_at: new Date().toISOString(), ...payload };
            ds.fuelInvoices = [...current, newItem];
            return newItem;
          }),
        };
      }

      if (method === "PUT" && /^\/fuel-invoices\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/fuel-invoices\/([^/]+)$/), pathname);
        const invoiceId = decodeURIComponent(match[1]);
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const ds = dataset as Record<string, unknown>;
            const current = Array.isArray(ds.fuelInvoices)
              ? (ds.fuelInvoices as Record<string, unknown>[])
              : getDemoFuelInvoices(dataset);
            let updated: Record<string, unknown> | null = null;
            ds.fuelInvoices = current.map((item) => {
              if (String((item as Record<string, unknown>).id) !== invoiceId) return item;
              updated = { ...(item as Record<string, unknown>), ...payload, id: invoiceId, updated_at: new Date().toISOString() };
              return updated;
            });
            return updated ?? { id: invoiceId, ...payload, updated_at: new Date().toISOString() };
          }),
        };
      }

      if (method === "DELETE" && /^\/fuel-invoices\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(pathname.match(/^\/fuel-invoices\/([^/]+)$/), pathname);
        const invoiceId = decodeURIComponent(match[1]);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            const ds = dataset as Record<string, unknown>;
            const current = Array.isArray(ds.fuelInvoices)
              ? (ds.fuelInvoices as Record<string, unknown>[])
              : getDemoFuelInvoices(dataset);
            ds.fuelInvoices = current.filter(
              (item) => String((item as Record<string, unknown>).id) !== invoiceId
            );
            return { deleted: true };
          }),
        };
      }

      // ── Chat / AI direct ───────────────────────────────────────
      if (method === "POST" && pathname === "/chat/direct") {
        const payload = getBodyObject(body);
        const query = String(payload.query || "").toLowerCase();
        let answer =
          "**Nhận định:** Mức phát thải này ở ngưỡng trung bình ngành dệt may xuất khẩu Việt Nam.\n\n" +
          "**Nguyên nhân chính:**\n- Hệ số vật liệu nguyên sinh cao (cotton, polyester)\n- Khoảng cách vận chuyển đường dài sang EU/US\n- Chưa tối ưu tỷ lệ vật liệu tái chế trong BOM\n\n" +
          "**Đề xuất giảm phát thải (theo thứ tự ưu tiên):**\n1. Chuyển sang cotton hữu cơ hoặc polyester tái chế (GRS) — giảm 35–40% phát thải vật liệu\n2. Gộp lô hàng để tăng fill-rate container — giảm phát thải vận chuyển trên mỗi sản phẩm\n3. Điện mặt trời tại nhà máy để giảm phát thải Scope 2\n\n" +
          "_Lưu ý: Đây là ước tính proxy. Tải chứng từ lên Evidence để hệ thống nâng độ tin cậy lên dữ liệu sơ cấp._";

        if (query.includes("wool") || query.includes("len")) {
          answer =
            "**Nhận định:** Len có hệ số phát thải cao nhất trong các vật liệu dệt (10.1 kg CO2e/kg) do chuỗi cung ứng từ chăn nuôi.\n\n" +
            "**Nguyên nhân:**\n- Phát thải CH₄ từ cừu (Scope 3 upstream)\n- Xử lý hóa chất tẩy trắng và nhuộm\n- Vận chuyển nguyên liệu thô quốc tế\n\n" +
            "**Đề xuất:**\n1. Chứng nhận RWS (Responsible Wool Standard) để traceability\n2. Blend với cotton hữu cơ để giảm hệ số trung bình\n3. Sourcing len từ nhà cung ứng gần thị trường đích\n\n" +
            "_Ước tính proxy — thay bằng dữ liệu sơ cấp từ nhà cung ứng để báo cáo audit._";
        }

        return { handled: true, value: { answer } };
      }

      // ── Account profile update ─────────────────────────────────
      if (method === "PUT" && pathname === "/account/profile") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            dataset.user = {
              ...dataset.user,
              ...payload,
              updated_at: new Date().toISOString(),
            };
            dataset.users = dataset.users.map((rawUser) => {
              const user = rawUser as Record<string, unknown>;
              if (String(user.id || user.user_id || "") !== dataset.user.id) return rawUser;
              return {
                ...user,
                ...payload,
                updated_at: new Date().toISOString(),
              };
            }) as DemoDataset["users"];
            return {
              full_name: dataset.user.full_name,
              email: dataset.user.email,
            };
          }),
        };
      }

      if ((method === "PUT" || method === "POST") && pathname === "/account/company") {
        const payload = getBodyObject(body);
        return {
          handled: true,
          value: await mutateDemoResult((dataset) => {
            dataset.company = {
              ...dataset.company,
              ...payload,
              updated_at: new Date().toISOString(),
            };
            return getDemoAccountPayload(dataset).company;
          }),
        };
      }

      if (method === "POST" && pathname === "/account/change-password") {
        return { handled: true, value: { success: true, message: "Password updated (demo — no actual change)." } };
      }

      // ── Subscription upgrade (billing) ─────────────────────────
      if (method === "POST" && pathname === "/subscription/upgrade") {
        return { handled: true, value: { success: true, checkout_url: null, message: "Demo mode — upgrade not processed." } };
      }

      if (method === "GET" && pathname.startsWith("/subscription/payment-status")) {
        return { handled: true, value: { status: "demo", plan: "standard", message: "Demo session — payment not required." } };
      }

    } catch (error) {
      if (error instanceof ApiError) {
        return { handled: true, error };
      }
      const message = error instanceof Error ? error.message : "Demo request failed.";
      return {
        handled: true,
        error: new ApiError(message, {
          status: 400,
          code: "DEMO_REQUEST_FAILED",
        }),
      };
    }

    return {
      handled: true,
      error: createUnhandledEndpointError(pathname, method),
    };
  }) as ApiRequestAdapter;
};

// ─────────────────────────────────────────────────────────────────────────────
// B2C Demo Adapter
// ─────────────────────────────────────────────────────────────────────────────

export const createDemoB2CApiRequestAdapter = (): ApiRequestAdapter => {
  return (async ({ path, method, body }) => {
    const requestUrl = parseRequestUrl(path);
    const pathname = requestUrl.pathname;
    const searchParams = requestUrl.searchParams;

    try {
      // ── Auth / account (B2C user) ────────────────────────────────
      if (
        method === "GET" &&
        (pathname === "/account" ||
          pathname === "/auth/session" ||
          pathname === "/account/profile")
      ) {
        return { handled: true, value: getDemoB2CAccount() };
      }

      if (method === "GET" && pathname === "/company/check") {
        return {
          handled: true,
          value: { is_b2b: false, has_company: false, user_type: "b2c" },
        };
      }

      // ── B2C Dashboard ────────────────────────────────────────────
      if (method === "GET" && pathname === "/b2c/dashboard") {
        return { handled: true, value: getDemoB2CDashboard() };
      }

      // ── Collection points ────────────────────────────────────────
      if (method === "GET" && pathname.startsWith("/b2c/collection-points/nearby")) {
        return {
          handled: true,
          value: getDemoB2CCollectionPoints({
            lat: Number(searchParams.get("lat") ?? ""),
            lng: Number(searchParams.get("lng") ?? ""),
            category: (searchParams.get("category") as "charity" | "recycle") ?? undefined,
            limit: Number(searchParams.get("limit") || 12),
          }),
        };
      }

      if (method === "GET" && pathname.startsWith("/b2c/collection-points")) {
        return {
          handled: true,
          value: getDemoB2CCollectionPoints({
            search: searchParams.get("search") ?? undefined,
            city: searchParams.get("city") ?? undefined,
            category: (searchParams.get("category") as "charity" | "recycle") ?? undefined,
            limit: Number(searchParams.get("limit") || 20),
          }),
        };
      }

      // ── Material rewards ─────────────────────────────────────────
      if (method === "GET" && pathname === "/b2c/material-rewards") {
        return { handled: true, value: getDemoB2CMaterialRewards() };
      }

      // ── Coupons ──────────────────────────────────────────────────
      if (method === "GET" && pathname.startsWith("/b2c/coupons")) {
        return {
          handled: true,
          value: getDemoB2CCoupons({
            search: searchParams.get("search") ?? undefined,
            category: searchParams.get("category") ?? undefined,
            limit: Number(searchParams.get("limit") || 48),
          }),
        };
      }

      // ── Donations ────────────────────────────────────────────────
      if (method === "POST" && pathname === "/b2c/donations") {
        const parsed =
          body instanceof FormData
            ? JSON.parse(body.get("payload") as string)
            : getBodyObject(body);
        return { handled: true, value: createDemoB2CDonation(parsed as Record<string, unknown>) };
      }

      if (method === "GET" && /^\/b2c\/donations\/[^/]+$/.test(pathname)) {
        const match = ensurePathMatches(
          pathname.match(/^\/b2c\/donations\/([^/]+)$/),
          pathname
        );
        const donation = getDemoB2CDonationById(decodeURIComponent(match[1]));
        if (!donation) {
          return {
            handled: true,
            error: new ApiError("Donation not found.", { status: 404, code: "NOT_FOUND" }),
          };
        }
        return { handled: true, value: donation };
      }

      if (method === "GET" && pathname === "/b2c/donations") {
        return {
          handled: true,
          value: getDemoB2CDonations(Number(searchParams.get("limit") || 20)),
        };
      }

      if (method === "GET" && /^\/b2c\/donations\/[^/]+\/image$/.test(pathname)) {
        return {
          handled: true,
          error: new ApiError("Image not available in demo.", { status: 404, code: "NOT_FOUND" }),
        };
      }

      // ── Reward transactions ──────────────────────────────────────
      if (method === "GET" && pathname === "/b2c/reward-transactions") {
        return {
          handled: true,
          value: getDemoB2CRewardTransactions(Number(searchParams.get("limit") || 30)),
        };
      }

      // ── Camera AI image analysis ─────────────────────────────────
      if (method === "POST" && pathname === "/b2c/analyze-donation-image") {
        return { handled: true, value: getDemoB2CImageAnalysis() };
      }

      // ── Chat / AI ────────────────────────────────────────────────
      if (method === "POST" && pathname === "/chat/direct") {
        return {
          handled: true,
          value: {
            answer:
              "Với lượng điểm hiện tại bạn có thể đổi coupon cà phê hoặc giảm giá mua sắm. Tiếp tục tặng quần áo để tích thêm điểm và leo hạng lên **Eco Champion**!",
          },
        };
      }

    } catch (error) {
      if (error instanceof ApiError) {
        return { handled: true, error };
      }
      const message = error instanceof Error ? error.message : "Demo B2C request failed.";
      return {
        handled: true,
        error: new ApiError(message, { status: 400, code: "DEMO_B2C_REQUEST_FAILED" }),
      };
    }

    return {
      handled: true,
      error: createUnhandledEndpointError(pathname, method),
    };
  }) as ApiRequestAdapter;
};
