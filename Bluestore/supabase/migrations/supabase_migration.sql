-- Migration: Create Listings Table
-- This table stores items published by users for sale

CREATE TYPE listing_status AS ENUM ('draft', 'pending', 'approved', 'closed', 'expired');

CREATE TABLE IF NOT EXISTS public.listings (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    price NUMERIC(10, 2) NOT NULL,
    category TEXT NOT NULL,
    condition TEXT NOT NULL,
    images TEXT[] DEFAULT '{}',
    status listing_status DEFAULT 'pending' NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable Row Level Security
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;

-- Policies for Listings
-- 1. Everyone can view approved listings
CREATE POLICY "Anyone can view approved listings" ON public.listings
    FOR SELECT USING (status = 'approved');

-- 2. Users can view their own listings regardless of status
CREATE POLICY "Users can view their own listings" ON public.listings
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- 3. Authenticated users can create listings
CREATE POLICY "Users can create listings" ON public.listings
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 4. Users can update their own listings (e.g., mark as closed)
CREATE POLICY "Users can update their own listings" ON public.listings
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_listings_updated_at
    BEFORE UPDATE ON public.listings
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- Storage Bucket for Listing Images
INSERT INTO storage.buckets (id, name, public) VALUES ('listing_images', 'listing_images', true)
ON CONFLICT (id) DO NOTHING;

-- Policies for listing_images bucket
-- Note: Requires "auth.uid() = owner" to ensure users only manage their own images

CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING (bucket_id = 'listing_images');

CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'listing_images');

CREATE POLICY "Users can update their own images"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'listing_images' AND auth.uid() = owner);

CREATE POLICY "Users can delete their own images"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'listing_images' AND auth.uid() = owner);
