-- Migration 13: Create Banners Storage Bucket
-- This migration sets up a public storage bucket for seller/user banners.

-- 1. Create the banners bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('banners', 'banners', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for Banners
-- Policy to allow public access to all objects in banners
CREATE POLICY "Banner images are publicly accessible."
ON storage.objects FOR SELECT
USING (bucket_id = 'banners');

-- Policy to allow authenticated uploads to banners
CREATE POLICY "Authenticated users can upload banners."
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'banners');

-- Policy to allow users to update their own banners
CREATE POLICY "Users can update their own banners."
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'banners' AND auth.uid() = owner);

-- Policy to allow users to delete their own banners
CREATE POLICY "Users can delete their own banners."
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'banners' AND auth.uid() = owner);
