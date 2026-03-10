-- Product hard-delete migration baseline
-- Goal: remove archived mode for products and standardize hard delete behavior.

BEGIN;

-- 1) Optional cleanup for legacy soft-deleted rows (if any).
DELETE FROM products WHERE status = 'archived';

-- 2) Remove soft-delete audit columns if they exist.
ALTER TABLE products
  DROP COLUMN IF EXISTS archived_at,
  DROP COLUMN IF EXISTS archived_by;

-- 3) Align status constraint to active lifecycle only.
-- If your DB uses enum type, keep enum as-is and enforce allowed states via CHECK/business logic.
ALTER TABLE products
  DROP CONSTRAINT IF EXISTS products_status_check;

ALTER TABLE products
  ADD CONSTRAINT products_status_check
  CHECK (status IN ('draft', 'active'));

COMMIT;

-- Suggested BE behavior for DELETE /api/products/:id
-- 1) Validate product exists.
-- 2) Delete dependent rows first OR use FK ON DELETE CASCADE.
-- 3) DELETE FROM products WHERE id = :id;
-- 4) Return 200 { id, deleted: true } or 204.
