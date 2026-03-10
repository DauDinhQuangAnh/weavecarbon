-- Add explicit compliance document fields for products.
-- Goal:
-- 1) Persist material certification selection per product.
-- 2) Persist export compliance document selection per product.
-- 3) Support FE manual/import flows with stable BE/DB contract.

BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    RAISE NOTICE 'Skip migration: table public.products not found.';
    RETURN;
  END IF;

  ALTER TABLE public.products
    ADD COLUMN IF NOT EXISTS material_certification_codes text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS export_compliance_document_codes text[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS compliance_last_verified_at timestamptz;

  CREATE INDEX IF NOT EXISTS products_material_certification_codes_gin
    ON public.products USING gin (material_certification_codes);

  CREATE INDEX IF NOT EXISTS products_export_compliance_document_codes_gin
    ON public.products USING gin (export_compliance_document_codes);
END $$;

COMMIT;

-- Suggested BE behavior:
-- 1) On create/update/bulk-import, map payload aliases into these two columns.
-- 2) Validate material_certification_codes against known certification dictionary.
-- 3) Validate export_compliance_document_codes against uploaded docs of target market.
