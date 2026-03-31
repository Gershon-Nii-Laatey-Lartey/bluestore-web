-- Migration 15: Add Logo Column to Brands
-- This migration adds a logo column to the brands table to support brand imagery.
-- If a logo URL is present, it will be used instead of the vector icon.

ALTER TABLE public.brands ADD COLUMN IF NOT EXISTS logo TEXT;

-- Seed some logos for existing popular brands if available
-- Note: These are placeholder URLs for external logos
UPDATE public.brands SET logo = 'https://logo.clearbit.com/apple.com' WHERE name = 'Apple';
UPDATE public.brands SET logo = 'https://logo.clearbit.com/samsung.com' WHERE name = 'Samsung';
UPDATE public.brands SET logo = 'https://logo.clearbit.com/nike.com' WHERE name = 'Nike';
UPDATE public.brands SET logo = 'https://logo.clearbit.com/adidas.com' WHERE name = 'Adidas';
UPDATE public.brands SET logo = 'https://logo.clearbit.com/tesla.com' WHERE name = 'Tesla';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
