-- Migration 37: Fix RLS Policies for Payments and Subscriptions
-- Ensure users can actually buy plans and boosts from the client side

-- 1. user_subscriptions: Allow authenticated users to purchase (insert) and manage (update) their own subscriptions
DROP POLICY IF EXISTS "Users can view their own subscriptions" ON public.user_subscriptions;
CREATE POLICY "Users can view their own subscriptions" ON public.user_subscriptions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own subscriptions" ON public.user_subscriptions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own subscriptions" ON public.user_subscriptions
    FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- 2. payment_transactions: Allow authenticated users to log their own successful transactions
DROP POLICY IF EXISTS "Users can view their own transactions" ON public.payment_transactions;
CREATE POLICY "Users can view their own transactions" ON public.payment_transactions
    FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own transactions" ON public.payment_transactions
    FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 3. listing_boosts: Allow authenticated users to boost their listings
DROP POLICY IF EXISTS "Anyone can view active listing boosts" ON public.listing_boosts;
CREATE POLICY "Anyone can view active listing boosts" ON public.listing_boosts
    FOR SELECT USING (now() < end_date);

CREATE POLICY "Users can manage their own listing boosts" ON public.listing_boosts
    FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 4. Ensure listings can be updated for boosting (already exists but for clarity)
-- The existing policy in migration 1:
-- CREATE POLICY "Users can update their own listings" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = user_id);
-- This is sufficient because boosting is performed by the listing owner.

-- 5. Force schema reload
NOTIFY pgrst, 'reload schema';
