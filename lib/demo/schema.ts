import { z } from "zod";
import { DEMO_DATA_VERSION, DEMO_SCENARIO } from "@/lib/demo/constants";

const LooseRecordSchema = z.record(z.string(), z.unknown());

export const DemoUserSchema = z
  .object({
    id: z.string().min(1),
    email: z.string().email(),
    full_name: z.string().min(1),
    company_id: z.string().min(1),
    user_type: z.literal("b2b"),
    company_role: z.literal("root"),
    is_root: z.literal(true),
    is_demo: z.literal(true),
  })
  .passthrough();

export const DemoCompanySchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    business_type: z.string().min(1),
    domestic_market: z.string().min(1),
    target_markets: z.array(z.string()),
    current_plan: z.literal("standard"),
    standard_sku_limit: z.number().int().positive(),
  })
  .passthrough();

export const DemoReportSnapshotSchema = z
  .object({
    datasetType: z.string().min(1),
    columns: z.array(z.string()),
    rows: z.array(LooseRecordSchema),
  })
  .passthrough();

export const DemoReportManifestSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().min(1),
    type: z.string().min(1),
    format: z.string().min(1),
    status: z.literal("completed"),
    createdAt: z.string().min(1),
    date: z.string().min(1).optional(),
    size: z.string().optional(),
    records: z.number().int().nonnegative(),
    co2e: z.number().nullable().optional(),
    downloadUrl: z.string().optional(),
    snapshot: z.union([DemoReportSnapshotSchema, z.array(DemoReportSnapshotSchema)]),
  })
  .passthrough();

export const DemoSessionSchema = z
  .object({
    version: z.literal(DEMO_DATA_VERSION),
    scenario: z.literal(DEMO_SCENARIO),
    startedAt: z.string().min(1),
    user: DemoUserSchema,
    company: DemoCompanySchema,
  })
  .passthrough();

export const DemoDatasetV1Schema = z
  .object({
    version: z.literal(DEMO_DATA_VERSION),
    scenario: z.literal(DEMO_SCENARIO),
    seededAt: z.string().min(1),
    user: DemoUserSchema,
    company: DemoCompanySchema,
    products: z.array(LooseRecordSchema),
    batches: z.array(LooseRecordSchema),
    shipments: z.array(LooseRecordSchema),
    exportCompliance: z.record(z.string(), LooseRecordSchema),
    reports: z.array(DemoReportManifestSchema),
    users: z.array(LooseRecordSchema),
    history: z.array(LooseRecordSchema),
    analytics: z.object({ rows: z.array(LooseRecordSchema) }).passthrough(),
    uiState: LooseRecordSchema.default({}),
  })
  .passthrough();

export type DemoDataset = z.infer<typeof DemoDatasetV1Schema>;
export type DemoSession = z.infer<typeof DemoSessionSchema>;
export type DemoReportManifest = z.infer<typeof DemoReportManifestSchema>;
export type DemoReportSnapshot = z.infer<typeof DemoReportSnapshotSchema>;
