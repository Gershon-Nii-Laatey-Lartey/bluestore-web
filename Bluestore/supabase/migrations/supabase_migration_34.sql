-- Migration 34: Recommendation System Tables
-- Stores user taste profiles and pre-computed recommendations

-- 1. User Preferences (aggregated taste profile)
CREATE TABLE IF NOT EXISTS public.user_preferences (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    preferred_categories JSONB DEFAULT '{}',
    preferred_brands JSONB DEFAULT '{}',
    preferred_price_range JSONB DEFAULT '{"min": 0, "max": 0, "avg": 0}',
    preferred_conditions JSONB DEFAULT '{}',
    preferred_locations JSONB DEFAULT '{}',
    updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own preferences"
    ON public.user_preferences FOR ALL
    USING (auth.uid() = user_id);

-- 2. User Recommendations (pre-scored listing suggestions)
CREATE TABLE IF NOT EXISTS public.user_recommendations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES public.listings(id) ON DELETE CASCADE,
    score NUMERIC(8,4) DEFAULT 0,
    reason TEXT DEFAULT 'Recommended for you',
    recommendation_type TEXT DEFAULT 'personalized',
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE(user_id, listing_id)
);

ALTER TABLE public.user_recommendations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own recommendations"
    ON public.user_recommendations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recommendations"
    ON public.user_recommendations FOR ALL
    USING (auth.uid() = user_id);

-- 3. Fast retrieval index
CREATE INDEX IF NOT EXISTS idx_user_recs_score
    ON public.user_recommendations(user_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_user_recs_type
    ON public.user_recommendations(user_id, recommendation_type);

-- 4. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
