require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabasePublishableKey = process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn(
    "Supabase environment variables are missing. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_DEFAULT_KEY.",
  );
}

const supabase = createClient(supabaseUrl || "", supabasePublishableKey || "", {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;
