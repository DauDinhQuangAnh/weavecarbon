-- Split export compliance documents and material certification documents
-- Goal:
-- 1) Keep "Certificates & Documents" on /export for export-compliance only.
-- 2) Add explicit group metadata so FE/BE can manage material certification docs separately.

BEGIN;

DO $$
DECLARE
  target_table text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'market_compliance_documents'
  ) THEN
    target_table := 'market_compliance_documents';
  ELSIF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'product_compliance_documents'
  ) THEN
    target_table := 'product_compliance_documents';
  ELSE
    target_table := null;
  END IF;

  IF target_table IS NULL THEN
    RAISE NOTICE 'Skip migration: no compliance documents table found.';
    RETURN;
  END IF;

  EXECUTE format(
    'ALTER TABLE %I ADD COLUMN IF NOT EXISTS document_group text NOT NULL DEFAULT ''export_compliance''',
    target_table
  );

  EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I', target_table, target_table || '_document_group_check');
  EXECUTE format(
    'ALTER TABLE %I ADD CONSTRAINT %I CHECK (document_group IN (''export_compliance'', ''material_certification''))',
    target_table,
    target_table || '_document_group_check'
  );

  -- Auto-map known material certification document codes.
  EXECUTE format(
    $sql$
      UPDATE %I
      SET document_group = 'material_certification'
      WHERE lower(
        coalesce(document_code, code, document_id, id, '')
      ) IN (
        'cert_gots',
        'cert_oeko_tex',
        'cert_grs',
        'cert_bci_cotton',
        'cert_fsc',
        'cert_rcs'
      )
    $sql$,
    target_table
  );

  EXECUTE format(
    'CREATE INDEX IF NOT EXISTS %I ON %I (company_id, market_code, document_group)',
    target_table || '_company_market_group_idx',
    target_table
  );
END $$;

COMMIT;

-- Suggested BE contract changes:
-- 1) Include `document_group` in GET /api/export/markets payload for every document.
-- 2) Restrict export readiness scoring to documents where document_group = 'export_compliance'.
-- 3) For Step 2 material certifications, read only document_group = 'material_certification'.
