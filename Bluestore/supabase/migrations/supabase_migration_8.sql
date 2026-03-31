-- Migration 8: Enhance Listings Table for Discovery
-- Adds brand, trending status, and view counting

ALTER TABLE public.listings 
ADD COLUMN IF NOT EXISTS brand TEXT,
ADD COLUMN IF NOT EXISTS is_trending BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';

-- Index for faster filtering and sorting
CREATE INDEX IF NOT EXISTS idx_listings_brand ON public.listings(brand);
CREATE INDEX IF NOT EXISTS idx_listings_trending ON public.listings(is_trending) WHERE is_trending = true;
CREATE INDEX IF NOT EXISTS idx_listings_category ON public.listings(category);
