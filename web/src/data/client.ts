import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

// Public project URL and publishable key (the same ones the legacy pages ship).
// Row-level security is the protection; never put a service-role key here.
const SUPABASE_URL = 'https://mzgnhmeydhhpzgxlgudh.supabase.co';
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_sxWDz2XL-BB5oXbPOR-1zg_XROZYWdD';

/** The one Supabase client. Only the data layer (src/data) may import it. */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
