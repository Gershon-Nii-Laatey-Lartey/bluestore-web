-- Migration 19: Make chat-attachments bucket public so images load correctly
-- The previous migration created the bucket as private which causes 404 errors
-- when using getPublicUrl(). Making it public fixes image display.

UPDATE storage.buckets
SET public = true
WHERE id = 'chat-attachments';

-- Keep existing RLS policies for upload (only authenticated users can upload)
-- Public read is now handled by the bucket being public, not by RLS policies.
-- Optionally, also ensure a public SELECT policy exists on the objects:
DROP POLICY IF EXISTS "Authenticated users can read chat attachments" ON storage.objects;

CREATE POLICY "Anyone can view chat attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-attachments');
