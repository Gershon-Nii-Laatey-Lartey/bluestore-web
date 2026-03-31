-- BLUESTORE Enum Fix for Listing Status

-- Adding 'rejected' to listing_status enum
-- Enum was originally: ('draft', 'pending', 'approved', 'closed', 'expired')
ALTER TYPE listing_status ADD VALUE IF NOT EXISTS 'rejected' AFTER 'expired';
