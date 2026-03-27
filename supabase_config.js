// ============================================================
//  MADAKOP — SUPABASE CONFIG
//  STEP 1: Replace the two values below with yours from Supabase
//  Dashboard → Settings → API
// ============================================================

const SUPABASE_URL = 'https://rpufhpgftrmqavmyolwi.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJwdWZocGdmdHJtcWF2bXlvbHdpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIzOTUxNjAsImV4cCI6MjA4Nzk3MTE2MH0.hFRlsGNh_o_Oql-XigFOEh0WA_evL_Ja6OoUIUhzY38';

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
