-- Add featured and sort order to brands
ALTER TABLE brands ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE brands ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0;

-- Index for better performance when sorting
CREATE INDEX IF NOT EXISTS idx_brands_sort_order ON brands(sort_order);
CREATE INDEX IF NOT EXISTS idx_brands_is_featured ON brands(is_featured);
