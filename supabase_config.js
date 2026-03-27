// ============================================================
//  MADAKOP — SUPABASE CONFIG
//  STEP 1: Replace the two values below with yours from Supabase
//  Dashboard → Settings → API
// ============================================================

const SUPABASE_URL = 'https://rpufhpgftrmqavmyolwi.supabase.co';
const SUPABASE_ANON_KEY = 'sb_secret_DkJpbg7Nyo1u-Sj16bgu3A_jPaKGWDP';

// DO NOT change anything below this line
window.initializeSupabase = function(urlOverride, keyOverride) {
  const url = urlOverride || SUPABASE_URL;
  const key = keyOverride || SUPABASE_ANON_KEY;
  
  if (url === 'YOUR_SUPABASE_URL' || key === 'YOUR_SUPABASE_ANON_KEY') {
    console.warn('⚠️ Supabase credentials not configured. Please update supabase_config.js with your project URL and key.');
    return null;
  }
  
  try {
    const { createClient } = supabase;
    const client = createClient(url, key);
    window.supabaseClient = client;
    return client;
  } catch (error) {
    console.error('Failed to initialize Supabase:', error);
    return null;
  }
};

// Initialize with default credentials
window.supabaseClient = null;
window.addEventListener('DOMContentLoaded', () => {
  if (!window.supabaseClient && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
    window.initializeSupabase();
  }
});
