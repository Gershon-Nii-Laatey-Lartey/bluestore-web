-- Migration 16: Add Precise Coordinates to Listings
-- This migration adds latitude and longitude for maps integration.

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- Also add to profiles for user default location if needed
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
