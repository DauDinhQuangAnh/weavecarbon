import { z } from "zod";

// Centralized, validated access to NEXT_PUBLIC_* environment variables.
// Each variable must be referenced as a literal `process.env.NEXT_PUBLIC_X`
// below (not looped/destructured dynamically) so Next.js's build-time env
// inlining for client bundles keeps working.
const publicEnvSchema = z.object({
  NEXT_PUBLIC_API_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_ENFORCE_CLIENT_ROLE_GUARD: z.string().optional(),
  NEXT_PUBLIC_AUTH_DISABLED: z.string().optional(),
  NEXT_PUBLIC_ACCOUNT_ENDPOINT: z.string().optional(),
  NEXT_PUBLIC_WEAVEY_API_URL: z.string().optional(),
  NEXT_PUBLIC_RAG_API_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_RAG_COLLECTION: z.string().optional(),
  NEXT_PUBLIC_RAG_COLUMNS_TO_ANSWER: z.string().optional(),
  NEXT_PUBLIC_RAG_NUMBER_DOCS_RETRIEVAL: z.string().optional(),
  NEXT_PUBLIC_RAG_TIMEOUT_MS: z.string().optional(),
  NEXT_PUBLIC_MAPBOX_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: z.string().optional(),
  NEXT_PUBLIC_MAPBOX_GEOCODING_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_MAPBOX_DIRECTIONS_BASE_URL: z.string().optional(),
  NEXT_PUBLIC_APP_PUBLIC_URL: z.string().optional(),
  NEXT_PUBLIC_SITE_URL: z.string().optional()
});

export const env = publicEnvSchema.parse({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_ENFORCE_CLIENT_ROLE_GUARD: process.env.NEXT_PUBLIC_ENFORCE_CLIENT_ROLE_GUARD,
  NEXT_PUBLIC_AUTH_DISABLED: process.env.NEXT_PUBLIC_AUTH_DISABLED,
  NEXT_PUBLIC_ACCOUNT_ENDPOINT: process.env.NEXT_PUBLIC_ACCOUNT_ENDPOINT,
  NEXT_PUBLIC_WEAVEY_API_URL: process.env.NEXT_PUBLIC_WEAVEY_API_URL,
  NEXT_PUBLIC_RAG_API_BASE_URL: process.env.NEXT_PUBLIC_RAG_API_BASE_URL,
  NEXT_PUBLIC_RAG_COLLECTION: process.env.NEXT_PUBLIC_RAG_COLLECTION,
  NEXT_PUBLIC_RAG_COLUMNS_TO_ANSWER: process.env.NEXT_PUBLIC_RAG_COLUMNS_TO_ANSWER,
  NEXT_PUBLIC_RAG_NUMBER_DOCS_RETRIEVAL: process.env.NEXT_PUBLIC_RAG_NUMBER_DOCS_RETRIEVAL,
  NEXT_PUBLIC_RAG_TIMEOUT_MS: process.env.NEXT_PUBLIC_RAG_TIMEOUT_MS,
  NEXT_PUBLIC_MAPBOX_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_TOKEN,
  NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN: process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN,
  NEXT_PUBLIC_MAPBOX_GEOCODING_BASE_URL: process.env.NEXT_PUBLIC_MAPBOX_GEOCODING_BASE_URL,
  NEXT_PUBLIC_MAPBOX_DIRECTIONS_BASE_URL: process.env.NEXT_PUBLIC_MAPBOX_DIRECTIONS_BASE_URL,
  NEXT_PUBLIC_APP_PUBLIC_URL: process.env.NEXT_PUBLIC_APP_PUBLIC_URL,
  NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL
});

// Repeated across multiple components; centralized here so they stay in sync.
export const ACCOUNT_ENDPOINT_ENABLED = env.NEXT_PUBLIC_ACCOUNT_ENDPOINT !== "0";
export const AUTH_DISABLED = env.NEXT_PUBLIC_AUTH_DISABLED === "1";
