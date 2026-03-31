-- Migration 2: Add Location Column
-- This migration adds the location field to the existing listings table.

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS location TEXT DEFAULT 'Accra, Ghana' NOT NULL;
