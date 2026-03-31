-- Bluestore Admin System & User Roles Migration

-- 1. Create User Role Type
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role') THEN
        CREATE TYPE user_role AS ENUM ('user', 'moderator', 'admin');
    END IF;
END $$;

-- 2. Add Role to Profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS role user_role DEFAULT 'user' NOT NULL;

-- 3. Add Status to Profiles (for banning/suspension)
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS account_status TEXT DEFAULT 'active' NOT NULL; -- 'active', 'suspended', 'banned'

-- 4. Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role = 'admin'
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Function to check if user is moderator or higher
CREATE OR REPLACE FUNCTION public.is_moderator()
RETURNS BOOLEAN AS $$
BEGIN
  RETURN (
    SELECT role IN ('moderator', 'admin')
    FROM public.profiles
    WHERE id = auth.uid()
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. RLS Updates for Admin Oversight

-- Listings: Admins can see ALL listings (including pending/draft/rejected)
CREATE POLICY "Admins can view all listings" 
ON public.listings FOR SELECT 
TO authenticated 
USING (public.is_moderator());

CREATE POLICY "Admins can update any listing" 
ON public.listings FOR UPDATE 
TO authenticated 
USING (public.is_moderator());

-- Reports: Moderators can see all reports
DROP POLICY IF EXISTS "Users can view their own reports" ON public.reports;
CREATE POLICY "Moderators can view all reports" 
ON public.reports FOR SELECT 
TO authenticated 
USING (public.is_moderator() OR auth.uid() = reporter_id);

CREATE POLICY "Moderators can update reports" 
ON public.reports FOR UPDATE 
TO authenticated 
USING (public.is_moderator());

-- Profiles: Admins can view and update any profile
CREATE POLICY "Admins can view all profiles" 
ON public.profiles FOR SELECT 
TO authenticated 
USING (public.is_moderator());

CREATE POLICY "Admins can update any profile" 
ON public.profiles FOR UPDATE 
TO authenticated 
USING (public.is_admin());

-- 7. Analytics Helper Function
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'total_users', (SELECT COUNT(*) FROM public.profiles),
    'total_listings', (SELECT COUNT(*) FROM public.listings),
    'pending_approvals', (SELECT COUNT(*) FROM public.listings WHERE status = 'pending'),
    'active_reports', (SELECT COUNT(*) FROM public.reports WHERE status = 'pending'),
    'verified_sellers', (SELECT COUNT(*) FROM public.profiles WHERE is_verified = true)
  ) INTO result;
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
