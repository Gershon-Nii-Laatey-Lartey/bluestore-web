-- Bluestore Platform Configuration & Admin Features (Phase 2)

-- 1. Create New Storage Buckets
INSERT INTO storage.buckets (id, name, public) VALUES 
('brand_logos', 'brand_logos', true),
('alert_banners', 'alert_banners', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Storage Policies for Admin Access
-- Brand Logos
CREATE POLICY "Public Read Brand Logos" ON storage.objects FOR SELECT USING (bucket_id = 'brand_logos');
CREATE POLICY "Admins Can Manage Brand Logos" ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'brand_logos' AND public.is_admin());

-- Alert Banners
CREATE POLICY "Public Read Alert Banners" ON storage.objects FOR SELECT USING (bucket_id = 'alert_banners');
CREATE POLICY "Admins Can Manage Alert Banners" ON storage.objects FOR ALL TO authenticated 
USING (bucket_id = 'alert_banners' AND public.is_admin());

-- 3. Extend Profiles/Brands Schema
ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS logo_url TEXT;

-- 4. Admin Verification Docs Oversight
CREATE POLICY "Admins can view all verifications" 
ON public.seller_verifications FOR SELECT 
TO authenticated 
USING (public.is_moderator());

CREATE POLICY "Admins can update verifications" 
ON public.seller_verifications FOR UPDATE 
TO authenticated 
USING (public.is_moderator());

-- 5. Extend Global Alert Config
-- We will update the default value to include image support and layout
UPDATE public.platform_config 
SET value = '{"active": false, "message": "Welcome to Bluestore!", "type": "info", "image_url": null, "layout": "text_only"}'::jsonb
WHERE key = 'global_alert';
