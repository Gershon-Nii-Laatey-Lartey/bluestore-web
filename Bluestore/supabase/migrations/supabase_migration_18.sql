-- =====================================================
-- Migration 18: Location Filtering + Chat Attachments
-- =====================================================

-- 1. Add location_structured to listings table
ALTER TABLE public.listings
ADD COLUMN IF NOT EXISTS location_structured JSONB;

-- Index for fast JSONB queries on district, city, region
CREATE INDEX IF NOT EXISTS idx_listings_location_district ON public.listings USING GIN (location_structured);

-- 2. Add message_type and attachment fields to messages table
ALTER TABLE public.messages
ADD COLUMN IF NOT EXISTS message_type TEXT NOT NULL DEFAULT 'text',   -- 'text' | 'image' | 'file' | 'location' | 'live_location'
ADD COLUMN IF NOT EXISTS attachment_url TEXT,                          -- URL of attached file/image
ADD COLUMN IF NOT EXISTS attachment_name TEXT,                         -- Original filename
ADD COLUMN IF NOT EXISTS attachment_size INTEGER,                      -- File size in bytes
ADD COLUMN IF NOT EXISTS attachment_mime TEXT,                         -- MIME type
ADD COLUMN IF NOT EXISTS location_data JSONB;                          -- For location/live_location messages: { lat, lng, name, address, expires_at }

-- 3. Create Supabase Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-attachments',
    'chat-attachments',
    false,
    10485760,  -- 10MB max file size
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'audio/mpeg', 'audio/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- 4. RLS Policy: Only conversation participants can upload/view attachments
CREATE POLICY "Chat participants can upload attachments"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'chat-attachments'
);

CREATE POLICY "Chat participants can view attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'chat-attachments'
);

CREATE POLICY "Users can delete own attachments"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]
);

-- 5. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
