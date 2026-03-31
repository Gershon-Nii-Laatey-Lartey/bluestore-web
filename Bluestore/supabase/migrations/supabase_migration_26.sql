-- Add 'rejected' to listing_status enum if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'rejected' AND enumtypid = 'listing_status'::regtype) THEN
        ALTER TYPE listing_status ADD VALUE 'rejected';
    END IF;
END $$;
