-- Migration 10: Dynamic Categories and Brands
-- Moves hardcoded frontend lists into the database for better scalability and linkage.

-- 1. Categories Table
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    icon TEXT, -- Lucide/Ionicons name
    color TEXT, -- Hex code for UI
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- Enable RLS for Categories
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for categories" ON public.categories FOR SELECT USING (true);

-- 2. Brands Table
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    icon TEXT,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    UNIQUE(name, category_id)
);

-- Enable RLS for Brands
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access for brands" ON public.brands FOR SELECT USING (true);

-- 3. Initial Seed Data
DO $$
DECLARE
    electronics_id UUID;
    home_id UUID;
    tech_id UUID;
    style_id UUID;
    sport_id UUID;
    vehicles_id UUID;
    props_id UUID;
BEGIN
    -- Insert Categories
    INSERT INTO public.categories (name, icon, color) VALUES 
        ('Electronics', 'phone-portrait-outline', '#F5F0FF'),
        ('Home', 'home-outline', '#FFF5F0'),
        ('Tech', 'laptop-outline', '#F0F4FF'),
        ('Style', 'shirt-outline', '#F0F9FF'),
        ('Sport', 'football-outline', '#F0FFF4'),
        ('Vehicles', 'car-outline', '#FFF0F5'),
        ('Properties', 'business-outline', '#F5F5F5')
    ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
    RETURNING id INTO electronics_id;

    -- Update IDs for subsequent inserts (simplifying since ON CONFLICT RETURNING is tricky in loops)
    SELECT id INTO electronics_id FROM public.categories WHERE name = 'Electronics';
    SELECT id INTO home_id FROM public.categories WHERE name = 'Home';
    SELECT id INTO tech_id FROM public.categories WHERE name = 'Tech';
    SELECT id INTO style_id FROM public.categories WHERE name = 'Style';
    SELECT id INTO sport_id FROM public.categories WHERE name = 'Sport';
    SELECT id INTO vehicles_id FROM public.categories WHERE name = 'Vehicles';
    SELECT id INTO props_id FROM public.categories WHERE name = 'Properties';

    -- Insert Brands for Electronics
    INSERT INTO public.brands (name, category_id, icon) VALUES
        ('Apple', electronics_id, 'logo-apple'),
        ('Samsung', electronics_id, 'logo-android'),
        ('Sony', electronics_id, 'headset-outline')
    ON CONFLICT (name, category_id) DO NOTHING;

    -- Insert Brands for Home
    INSERT INTO public.brands (name, category_id, icon) VALUES
        ('IKEA', home_id, 'home-outline'),
        ('West Elm', home_id, 'bed-outline')
    ON CONFLICT (name, category_id) DO NOTHING;

    -- Insert Brands for Tech
    INSERT INTO public.brands (name, category_id, icon) VALUES
        ('Microsoft', tech_id, 'logo-windows'),
        ('Dell', tech_id, 'desktop-outline'),
        ('HP', tech_id, 'print-outline')
    ON CONFLICT (name, category_id) DO NOTHING;

    -- Insert Brands for Style
    INSERT INTO public.brands (name, category_id, icon) VALUES
        ('Nike', style_id, 'logo-twitter'), -- placeholder
        ('Adidas', style_id, 'trail-sign-outline'),
        ('Zara', style_id, 'shirt-outline'),
        ('H&M', style_id, 'shirt-outline')
    ON CONFLICT (name, category_id) DO NOTHING;

    -- Insert Brands for Sport
    INSERT INTO public.brands (name, category_id, icon) VALUES
        ('Puma', sport_id, 'walk-outline'),
        ('Under Armour', sport_id, 'fitness-outline')
    ON CONFLICT (name, category_id) DO NOTHING;

    -- Insert Brands for Vehicles
    INSERT INTO public.brands (name, category_id, icon) VALUES
        ('Toyota', vehicles_id, 'car-outline'),
        ('Honda', vehicles_id, 'car-sport-outline'),
        ('Tesla', vehicles_id, 'flash-outline')
    ON CONFLICT (name, category_id) DO NOTHING;

END $$;

-- Force schema reload
NOTIFY pgrst, 'reload schema';
