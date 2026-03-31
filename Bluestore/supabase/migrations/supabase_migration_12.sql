-- Migration 10: Unique Engagement Counters
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS chats_count INTEGER DEFAULT 0;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS calls_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.listing_chats (
    user_id UUID REFERENCES auth.users(id),
    listing_id UUID REFERENCES public.listings(id),
    PRIMARY KEY (user_id, listing_id)
);

CREATE TABLE IF NOT EXISTS public.listing_calls (
    user_id UUID REFERENCES auth.users(id),
    listing_id UUID REFERENCES public.listings(id),
    PRIMARY KEY (user_id, listing_id)
);

-- Note: The triggers provided in the last message will ensure 
-- these counts update automatically on first-time interaction.

-- Migration 12: Seller Profile Extension
-- 1. Add banner and bio support
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banner_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio TEXT;

-- 2. Note: Please create a public storage bucket named 'banners' 
-- in your Supabase dashboard to host high-res banners.
