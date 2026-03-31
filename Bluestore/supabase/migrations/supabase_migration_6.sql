-- Migration 6: Saved Listings (Favorites)
-- Creates a junction table to allow users to save/favorite listings.

CREATE TABLE IF NOT EXISTS public.saved_listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(user_id, listing_id)
);

-- Enable RLS
ALTER TABLE public.saved_listings ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage their own saved listings."
ON public.saved_listings FOR ALL
USING (auth.uid() = user_id);
