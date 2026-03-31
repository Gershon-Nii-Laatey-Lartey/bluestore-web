-- Categories table
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT, 
  color TEXT, 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Brands table
CREATE TABLE IF NOT EXISTS brands (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  icon TEXT, 
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Junction table for Many-to-Many relationship (Category <-> Brand)
CREATE TABLE IF NOT EXISTS category_brands (
  category_id UUID REFERENCES categories(id) ON DELETE CASCADE,
  brand_id UUID REFERENCES brands(id) ON DELETE CASCADE,
  PRIMARY KEY (category_id, brand_id)
);

-- Enable RLS
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE category_brands ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read on categories" ON categories FOR SELECT USING (true);
CREATE POLICY "Allow public read on brands" ON brands FOR SELECT USING (true);
CREATE POLICY "Allow public read on category_brands" ON category_brands FOR SELECT USING (true);

-- Initial Categories
INSERT INTO categories (name, slug, icon, color) VALUES
('Electronics', 'electronics', 'phone-portrait-outline', '#F5F0FF'),
('Home', 'home', 'home-outline', '#FFF5F0'),
('Tech', 'tech', 'laptop-outline', '#F0F4FF'),
('Style', 'style', 'shirt-outline', '#F0F9FF'),
('Sport', 'sport', 'basketball-outline', '#F0FFF4'),
('Vehicles', 'vehicles', 'car-outline', '#F5F0FF'),
('Properties', 'properties', 'business-outline', '#FFF0F5')
ON CONFLICT (name) DO NOTHING;

-- Initial Brands
INSERT INTO brands (name, icon) VALUES
('Apple', 'logo-apple'),
('Sony', 'headset-outline'),
('Nike', 'logo-twitter'),
('Adidas', 'football-outline'),
('Zara', 'shirt-outline'),
('IKEA', 'home-outline'),
('Samsung', 'phone-portrait-outline'),
('LG', 'tv-outline'),
('BMW', 'car-outline'),
('Honda', 'car-sport-outline')
ON CONFLICT (name) DO NOTHING;

-- Link logic (Example links)
DO $$
DECLARE
  electronics_id UUID := (SELECT id FROM categories WHERE name = 'Electronics');
  tech_id UUID := (SELECT id FROM categories WHERE name = 'Tech');
  style_id UUID := (SELECT id FROM categories WHERE name = 'Style');
  sport_id UUID := (SELECT id FROM categories WHERE name = 'Sport');
  home_id UUID := (SELECT id FROM categories WHERE name = 'Home');
  vehicles_id UUID := (SELECT id FROM categories WHERE name = 'Vehicles');

  apple_id UUID := (SELECT id FROM brands WHERE name = 'Apple');
  sony_id UUID := (SELECT id FROM brands WHERE name = 'Sony');
  nike_id UUID := (SELECT id FROM brands WHERE name = 'Nike');
  adidas_id UUID := (SELECT id FROM brands WHERE name = 'Adidas');
  zara_id UUID := (SELECT id FROM brands WHERE name = 'Zara');
  ikea_id UUID := (SELECT id FROM brands WHERE name = 'IKEA');
  samsung_id UUID := (SELECT id FROM brands WHERE name = 'Samsung');
  bmw_id UUID := (SELECT id FROM brands WHERE name = 'BMW');
BEGIN
  -- Apple in Electronics and Tech
  INSERT INTO category_brands (category_id, brand_id) VALUES (electronics_id, apple_id), (tech_id, apple_id) ON CONFLICT DO NOTHING;
  -- Sony in Electronics and Tech
  INSERT INTO category_brands (category_id, brand_id) VALUES (electronics_id, sony_id), (tech_id, sony_id) ON CONFLICT DO NOTHING;
  -- Nike/Adidas in Style and Sport
  INSERT INTO category_brands (category_id, brand_id) VALUES (style_id, nike_id), (sport_id, nike_id) ON CONFLICT DO NOTHING;
  INSERT INTO category_brands (category_id, brand_id) VALUES (style_id, adidas_id), (sport_id, adidas_id) ON CONFLICT DO NOTHING;
  -- Zara in Style
  INSERT INTO category_brands (category_id, brand_id) VALUES (style_id, zara_id) ON CONFLICT DO NOTHING;
  -- IKEA in Home
  INSERT INTO category_brands (category_id, brand_id) VALUES (home_id, ikea_id) ON CONFLICT DO NOTHING;
  -- Samsung in Electronics
  INSERT INTO category_brands (category_id, brand_id) VALUES (electronics_id, samsung_id) ON CONFLICT DO NOTHING;
  -- BMW in Vehicles
  INSERT INTO category_brands (category_id, brand_id) VALUES (vehicles_id, bmw_id) ON CONFLICT DO NOTHING;
END $$;
