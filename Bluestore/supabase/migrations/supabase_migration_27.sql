-- Bluestore Admin Relations Fix

-- 1. Enable PostgREST to join Listings -> Profiles automatically
ALTER TABLE public.listings 
ADD CONSTRAINT fk_listings_profiles 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- 2. Enhance Reports table for easier admin management
ALTER TABLE public.reports 
ADD COLUMN IF NOT EXISTS reported_user_id UUID REFERENCES public.profiles(id);

-- 3. Update existing reports to populate reported_user_id if possible
-- If target_type is 'profile', target_id IS the user_id
UPDATE public.reports 
SET reported_user_id = target_id 
WHERE target_type = 'profile';

-- If target_type is 'listing', get user_id from listings
UPDATE public.reports r
SET reported_user_id = l.user_id
FROM public.listings l
WHERE r.target_type = 'listing' AND r.target_id = l.id;
