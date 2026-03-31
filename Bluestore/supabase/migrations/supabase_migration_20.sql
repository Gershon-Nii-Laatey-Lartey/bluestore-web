-- 1. Create a Bucket for Verification Documents
-- Note: You should manually set this to 'Private' in the Supabase Dashboard
-- and add RLS policies as shown below.

-- 2. Create the seller_verifications table
CREATE TABLE IF NOT EXISTS public.seller_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    full_legal_name TEXT NOT NULL,
    id_type TEXT NOT NULL, -- 'National ID', 'Passport', 'Driver License'
    id_number TEXT,
    id_front_url TEXT NOT NULL,
    id_back_url TEXT, -- Optional (some IDs only have front)
    selfie_url TEXT NOT NULL,
    address_line1 TEXT NOT NULL,
    address_line2 TEXT,
    city TEXT NOT NULL,
    state TEXT,
    postal_code TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- 3. Update the profiles table to include tracking of verification status (if not already exists)
-- This facilitates quick lookups without joining seller_verifications.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'unverified'; -- 'unverified', 'pending', 'verified', 'rejected'

-- 4. Set up Row Level Security (RLS)
ALTER TABLE public.seller_verifications ENABLE ROW LEVEL SECURITY;

-- Users can view their own verification requests
CREATE POLICY "Users can view their own verifications" 
ON public.seller_verifications FOR SELECT 
USING (auth.uid() = user_id);

-- Users can insert their own verification requests
CREATE POLICY "Users can insert their own verifications" 
ON public.seller_verifications FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Only admins/system (via service role) should be able to update/delete
-- No public UPDATE/DELETE policy = denied by default except for service role.

-- 5. Set up Storage Policies for 'verification_docs' bucket
-- Policy: Users can only upload their own docs
CREATE POLICY "Users can upload their own verification docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'verification_docs' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Policy: Users can view their own docs
CREATE POLICY "Users can view their own verification docs"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'verification_docs' AND (storage.foldername(name))[1] = auth.uid()::text);
