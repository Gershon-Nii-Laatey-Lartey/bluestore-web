import { createClient } from '@supabase/supabase-js';

// IMPORTANT: Replace these with your actual Supabase project's URL and Anon Key
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
