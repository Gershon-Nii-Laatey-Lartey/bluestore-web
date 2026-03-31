-- Migration 17: Structured Location for Profiles
-- This migration adds columns to store both the display name and the 
-- rich, sectioned location data (city, district, etc.) in the profiles table.

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS location_structured JSONB;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
