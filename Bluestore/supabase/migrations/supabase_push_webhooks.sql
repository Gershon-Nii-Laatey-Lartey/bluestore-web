-- Enable the pg_net extension to allow HTTP requests from SQL
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Reusable function to call the 'push-notifications' Edge Function
CREATE OR REPLACE FUNCTION public.handle_push_notification_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- We use net.http_post to send the row data to the Edge Function
  -- Replace 'YOUR_PROJECT_REF' with your actual Supabase project reference
  -- Replace 'YOUR_SERVICE_ROLE_KEY' with your Service Role Key (found in Settings -> API)
  
  PERFORM net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY'
    ),
    body := jsonb_build_object(
      'record', row_to_json(NEW),
      'old_record', CASE WHEN TG_OP = 'UPDATE' THEN row_to_json(OLD) ELSE NULL END,
      'table', TG_TABLE_NAME,
      'type', TG_OP
    )
  );

  RETURN NEW;
END;
$$;

-- 1. Trigger for New Messages
DROP TRIGGER IF EXISTS on_new_message_push ON public.messages;
CREATE TRIGGER on_new_message_push
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_push_notification_trigger();

-- 2. Trigger for New Listings (Notify Admin)
DROP TRIGGER IF EXISTS on_new_listing_push ON public.listings;
CREATE TRIGGER on_new_listing_push
  AFTER INSERT ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_push_notification_trigger();

-- 3. Trigger for Listing Updates (Approvals - Notify User)
DROP TRIGGER IF EXISTS on_listing_update_push ON public.listings;
CREATE TRIGGER on_listing_update_push
  AFTER UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_push_notification_trigger();

-- 4. Trigger for Verification Submissions (Notify Admin)
DROP TRIGGER IF EXISTS on_new_verification_push ON public.seller_verifications;
CREATE TRIGGER on_new_verification_push
  AFTER INSERT ON public.seller_verifications
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_push_notification_trigger();
