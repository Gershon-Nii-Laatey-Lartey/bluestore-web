-- Migration 31: Consolidate Coordinates into location_structured
-- This migration ensures location_structured exists and removes redundant columns

-- 1. Ensure JSONB column exists
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS location_structured JSONB;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location_structured JSONB;

-- 2. Drop redundant columns
ALTER TABLE public.listings DROP COLUMN IF EXISTS latitude CASCADE;
ALTER TABLE public.listings DROP COLUMN IF EXISTS longitude CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS latitude CASCADE;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS longitude CASCADE;

-- Force PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';

