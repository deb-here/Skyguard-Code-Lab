import { createClient } from '@supabase/supabase-js';

// Public anon key only — safe for the browser. RLS policies in
// supabase/schema.sql are what actually restrict access.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);
