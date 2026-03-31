-- Migration 9: Profiles Location, Listings Rank, and Auto-View Incrementing
-- Adds regional context to users and discovery ranking to products

-- 1. Add location to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS location TEXT;

-- 2. Add rank to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS rank INTEGER DEFAULT 0;

-- 3. Create index for faster rank-based discovery
CREATE INDEX IF NOT EXISTS idx_listings_rank ON public.listings(rank DESC);

-- 4. Auto-update view counter logic
-- This function increments the total views on a listing only when a NEW user views it for the first time
CREATE OR REPLACE FUNCTION increment_listing_views()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.listings 
    SET views = views + 1
    WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Trigger to fire only on INSERT (first-time views)
-- Subsequent views (updates to viewed_at) will not fire this trigger
DROP TRIGGER IF EXISTS tr_increment_views ON public.viewed_listings;
CREATE TRIGGER tr_increment_views
AFTER INSERT ON public.viewed_listings
FOR EACH ROW 
EXECUTE FUNCTION increment_listing_views();
