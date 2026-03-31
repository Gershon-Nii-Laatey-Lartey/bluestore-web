-- Migration 14: Daily Impressions Tracking and Engagement Triggers
-- This migration sets up the data structure for tracking listing impressions
-- on a daily unique basis (one impression per user, per day, per listing).

-- 1. Add impressions_count to listings
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS impressions_count INTEGER DEFAULT 0;

-- 2. Create listing_impressions table
-- We use a DATE column in the primary key to allow one unique impression per day
CREATE TABLE IF NOT EXISTS public.listing_impressions (
    user_id UUID REFERENCES auth.users(id),
    listing_id UUID REFERENCES public.listings(id),
    view_date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (user_id, listing_id, view_date)
);

-- Enable RLS for impressions
ALTER TABLE public.listing_impressions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can insert their own impressions" ON public.listing_impressions
    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can view their own impressions" ON public.listing_impressions
    FOR SELECT USING (auth.uid() = user_id);

-- 3. Trigger for impressions_count
CREATE OR REPLACE FUNCTION increment_listing_impressions()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.listings 
    SET impressions_count = impressions_count + 1
    WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_increment_impressions ON public.listing_impressions;
CREATE TRIGGER tr_increment_impressions
AFTER INSERT ON public.listing_impressions
FOR EACH ROW 
EXECUTE FUNCTION increment_listing_impressions();

-- 4. Triggers for Engagement Synchronization (Chats and Calls)
CREATE OR REPLACE FUNCTION increment_listing_chats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.listings 
    SET chats_count = chats_count + 1
    WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_increment_chats ON public.listing_chats;
CREATE TRIGGER tr_increment_chats
AFTER INSERT ON public.listing_chats
FOR EACH ROW 
EXECUTE FUNCTION increment_listing_chats();

CREATE OR REPLACE FUNCTION increment_listing_calls()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.listings 
    SET calls_count = calls_count + 1
    WHERE id = NEW.listing_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_increment_calls ON public.listing_calls;
CREATE TRIGGER tr_increment_calls
AFTER INSERT ON public.listing_calls
FOR EACH ROW 
EXECUTE FUNCTION increment_listing_calls();
