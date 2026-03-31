-- migration_search_location_column.sql
-- Add a dedicated column for search filtering to avoid confusion with profile location

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS search_location_structured JSONB;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
