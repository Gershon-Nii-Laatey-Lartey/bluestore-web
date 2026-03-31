-- Migration 5: Reset Database (DANGER: DEVELOPMENT ONLY)
-- This script deletes all users from the Supabase authentication system.
-- Because our `profiles` and `listings` tables use foreign keys referencing `auth.users(id)` 
-- with the `ON DELETE CASCADE` constraint, running this single command will automatically 
-- wipe out all profiles, listings, and user data across the entire database.

DELETE FROM auth.users;
