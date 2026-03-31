-- Migration: Payment & Subscription System

-- 1. Packages table
CREATE TABLE IF NOT EXISTS public.subscription_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    price_ghs NUMERIC(10, 2) NOT NULL,
    product_limit INTEGER, -- NULL for unlimited
    duration_days INTEGER,
    features JSONB DEFAULT '[]',
    is_active BOOLEAN DEFAULT true,
    package_type TEXT DEFAULT 'subscription', -- 'subscription' or 'boost'
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. User subscriptions (Current active plan for users)
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    package_id UUID REFERENCES public.subscription_packages(id),
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ, -- NULL for free forever
    status TEXT DEFAULT 'active' NOT NULL, -- active, expired, cancelled
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Listing boosts (Per-listing promotions)
CREATE TABLE IF NOT EXISTS public.listing_boosts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    package_id UUID REFERENCES public.subscription_packages(id),
    start_date TIMESTAMPTZ DEFAULT now(),
    end_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Payment Transactions
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    amount NUMERIC(10, 2) NOT NULL,
    currency TEXT DEFAULT 'GHS' NOT NULL,
    reference TEXT UNIQUE NOT NULL, -- Paystack transaction reference
    status TEXT NOT NULL, -- success, failed, pending
    payment_method TEXT, -- card, momo, etc
    package_id UUID REFERENCES public.subscription_packages(id),
    listing_id UUID REFERENCES public.listings(id), -- If it was a boost
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Update Listings table with boost indicators
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS boost_expires_at TIMESTAMPTZ;

-- 6. Indices for performance
CREATE INDEX IF NOT EXISTS idx_listings_boosted ON public.listings(is_boosted) WHERE is_boosted = true;
CREATE INDEX IF NOT EXISTS idx_user_subs_user ON public.user_subscriptions(user_id, status);
CREATE INDEX IF NOT EXISTS idx_listing_boosts_listing ON public.listing_boosts(listing_id, end_date);

-- 7. Row Level Security Policies
ALTER TABLE public.subscription_packages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.listing_boosts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Select policies
CREATE POLICY "Anyone can view active packages" ON public.subscription_packages
    FOR SELECT USING (is_active = true);

CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Anyone can view active listing boosts" ON public.listing_boosts
    FOR SELECT USING (now() < end_date);

CREATE POLICY "Users can view their own transactions" ON public.payment_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- Insert policies (Internal or Admin only usually, but let's allow users to see their own if needed)
-- Note: Real insertion will happen via service with Service Role or authenticated logic

-- 8. Seed Default Packages
INSERT INTO public.subscription_packages (name, description, price_ghs, product_limit, duration_days, features, package_type)
VALUES 
('Free', 'Basic selling for individuals', 0, 5, NULL, '["5 active listings"]', 'subscription'),
('Weekly Boost', 'Promote one product for 7 days', 10, 1, 7, '["Rank first in search", "Featured in For You section"]', 'boost'),
('30 Days Boost', 'Promote one product for a month', 30, 1, 30, '["Rank first in search", "Featured in For You section", "Social media mention"]', 'boost'),
('Standard 20', 'Bulk selling with 20 items', 80, 20, 30, '["20 active listings", "Standard support"]', 'subscription'),
('Premium', 'Unlimited selling for businesses', 150, NULL, 30, '["Unlimited listings", "Brand profile", "Priority support"]', 'subscription');

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
