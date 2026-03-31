-- Migration 4: Add Verification Status
-- Adds `is_verified` column to the `profiles` table.

ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false;

-- Backfill phone numbers from auth.users if missing in profile
UPDATE public.profiles p
SET phone_number = u.phone
FROM auth.users u
WHERE p.id = u.id AND (p.phone_number IS NULL OR p.phone_number = '');
