-- BLUESTORE Notifications System Migration

-- 1. Notifications Table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'listing_status', 'message', 'verification', 'system', 'offer'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 3. Policies
-- Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
TO authenticated 
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
TO authenticated 
USING (auth.uid() = user_id);

-- 4. Automatic Notifications via Triggers (Optional but good)

-- Trigger for Listing Approval/Rejection
CREATE OR REPLACE FUNCTION public.notify_listing_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.status IS DISTINCT FROM NEW.status) AND (NEW.status != 'pending') THEN
        INSERT INTO public.notifications (user_id, type, title, message, payload)
        VALUES (
            NEW.user_id,
            'listing_status',
            CASE 
                WHEN NEW.status = 'approved' THEN 'Listing Approved! 🎉'
                WHEN NEW.status = 'rejected' THEN 'Listing Needs Changes'
                ELSE 'Listing Status Updated'
            END,
            CASE 
                WHEN NEW.status = 'approved' THEN 'Your item "' || NEW.title || '" is now live and visible to buyers.'
                WHEN NEW.status = 'rejected' THEN 'Your item "' || NEW.title || '" was not approved. Check our guidelines for more info.'
                ELSE 'The status of your listing "' || NEW.title || '" has changed to ' || NEW.status || '.'
            END,
            jsonb_build_object('listing_id', NEW.id, 'status', NEW.status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_listing_status_change
    AFTER UPDATE OF status ON public.listings
    FOR EACH ROW EXECUTE FUNCTION public.notify_listing_status();

-- Trigger for Verification Status
CREATE OR REPLACE FUNCTION public.notify_verification_status()
RETURNS TRIGGER AS $$
BEGIN
    IF (OLD.verification_status IS DISTINCT FROM NEW.verification_status) THEN
        INSERT INTO public.notifications (user_id, type, title, message, payload)
        VALUES (
            NEW.id,
            'verification',
            CASE 
                WHEN NEW.verification_status = 'verified' THEN 'Account Verified! ✅'
                WHEN NEW.verification_status = 'rejected' THEN 'Verification Failed'
                ELSE 'Verification Status Update'
            END,
            CASE 
                WHEN NEW.verification_status = 'verified' THEN 'Congratulations! You are now a verified seller on Bluestore.'
                WHEN NEW.verification_status = 'rejected' THEN 'We could not verify your identity. Please try again with clearer documents.'
                ELSE 'Your verification is currently ' || NEW.verification_status || '.'
            END,
            jsonb_build_object('profile_id', NEW.id, 'status', NEW.verification_status)
        );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_verification_status_change
    AFTER UPDATE OF verification_status ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.notify_verification_status();
