// ============================================================
//  MADAKOP — SUPABASE CONFIG
//  STEP 1: Replace the two values below with yours from Supabase
//  Dashboard → Settings → API
// ============================================================

const SUPABASE_URL = 'YOUR_SUPABASE_URL';        // e.g. https://xyzxyz.supabase.co
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY'; // long string starting with eyJ...

// DO NOT change anything below this line
const { createClient } = supabase;
const db = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
