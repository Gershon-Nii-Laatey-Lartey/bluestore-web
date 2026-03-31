-- Migration 36: Fixes for Listing Deletion
-- 1. Add MISSING Delete Policy for Listings
-- Without this, users cannot delete their own listings
CREATE POLICY "Users can delete their own listings" ON public.listings
    FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 2. Ensure ALL auxiliary tables use ON DELETE CASCADE
-- This prevents foreign key violations when a listing is deleted

-- listing_chats
ALTER TABLE public.listing_chats 
    DROP CONSTRAINT IF EXISTS listing_chats_listing_id_fkey,
    ADD CONSTRAINT listing_chats_listing_id_fkey 
    FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

-- listing_calls
ALTER TABLE public.listing_calls 
    DROP CONSTRAINT IF EXISTS listing_calls_listing_id_fkey,
    ADD CONSTRAINT listing_calls_listing_id_fkey 
    FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

-- listing_impressions
ALTER TABLE public.listing_impressions 
    DROP CONSTRAINT IF EXISTS listing_impressions_listing_id_fkey,
    ADD CONSTRAINT listing_impressions_listing_id_fkey 
    FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE CASCADE;

-- payment_transactions (Set to NULL so we keep financial records)
ALTER TABLE public.payment_transactions 
    DROP CONSTRAINT IF EXISTS payment_transactions_listing_id_fkey,
    ADD CONSTRAINT payment_transactions_listing_id_fkey 
    FOREIGN KEY (listing_id) REFERENCES public.listings(id) ON DELETE SET NULL;

-- 3. Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
