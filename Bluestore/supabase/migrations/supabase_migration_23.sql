-- BLUESTORE Reporting & Safety + Review System Migration

-- 1. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    target_type TEXT NOT NULL, -- 'listing', 'profile', 'chat'
    target_id UUID NOT NULL, -- ID of the reported listing or profile
    reason TEXT NOT NULL,
    details TEXT,
    status TEXT DEFAULT 'pending' NOT NULL, -- 'pending', 'investigating', 'resolved', 'dismissed'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Reviews Table (Chat-Verified System)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reviewer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    listing_id UUID REFERENCES public.listings(id) ON DELETE SET NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5) NOT NULL,
    comment TEXT,
    is_verified BOOLEAN DEFAULT FALSE, -- Set to TRUE if system detects significant chat history
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    CONSTRAINT unique_review_per_transaction UNIQUE (reviewer_id, receiver_id, listing_id)
);

-- 3. Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- 4. Policies for Reports
CREATE POLICY "Users can create reports" 
ON public.reports FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view their own reports" 
ON public.reports FOR SELECT 
TO authenticated 
USING (auth.uid() = reporter_id);

-- 5. Policies for Reviews
CREATE POLICY "Anyone can view reviews" 
ON public.reviews FOR SELECT 
TO public 
USING (true);

CREATE POLICY "Authenticated users can create reviews" 
ON public.reviews FOR INSERT 
TO authenticated 
WITH CHECK (auth.uid() = reviewer_id);

-- 6. Function to calculate seller rating
CREATE OR REPLACE FUNCTION public.get_seller_rating(seller_uuid UUID)
RETURNS TABLE (avg_rating NUMERIC, total_reviews BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ROUND(AVG(rating)::numeric, 1),
        COUNT(*)
    FROM public.reviews
    WHERE receiver_id = seller_uuid;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
