CREATE TABLE IF NOT EXISTS public.global_ai_runtime_settings (
  singleton_key TEXT PRIMARY KEY DEFAULT 'global',
  rag_base_url TEXT NOT NULL,
  collection_name TEXT NOT NULL,
  columns_to_answer TEXT[] NOT NULL DEFAULT '{}',
  number_docs_retrieval INTEGER NOT NULL DEFAULT 3,
  timeout_ms INTEGER NOT NULL DEFAULT 30000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT global_ai_runtime_settings_singleton CHECK (singleton_key = 'global')
);
