-- Bluestore Platform Configuration & Admin RLS
-- This migration adds global settings and ensures admins can manage everything.

-- 1. Platform Config Table (for global alerts, maintenance mode, etc)
CREATE TABLE IF NOT EXISTS public.platform_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Initial Alert Config
INSERT INTO public.platform_config (key, value) 
VALUES ('global_alert', '{"active": false, "message": "Welcome to Bluestore!", "type": "info"}')
ON CONFLICT (key) DO NOTHING;

-- 2. Admin RLS for Platform Management

-- Categories: Admins can do everything
CREATE POLICY "Admins can manage categories" 
ON public.categories FOR ALL 
TO authenticated 
USING (public.is_admin());

-- Brands: Admins can do everything
CREATE POLICY "Admins can manage brands" 
ON public.brands FOR ALL 
TO authenticated 
USING (public.is_admin());

-- Category-Brand Junction: Admins can do everything
CREATE POLICY "Admins can manage category_brands" 
ON public.category_brands FOR ALL 
TO authenticated 
USING (public.is_admin());

-- Platform Config: Admins can update, everyone can read
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view platform config" 
ON public.platform_config FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Admins can update platform config" 
ON public.platform_config FOR ALL 
TO authenticated 
USING (public.is_admin());
