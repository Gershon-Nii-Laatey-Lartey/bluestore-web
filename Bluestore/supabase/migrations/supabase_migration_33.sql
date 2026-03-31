-- Add push_token column to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS push_token TEXT;

-- Force PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
