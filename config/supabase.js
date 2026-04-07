require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  throw new Error(
    "Missing Supabase server environment variables. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
  );
}

if (supabaseUrl && !supabaseUrl.startsWith("https://")) {
  throw new Error(
    "SUPABASE_URL must be your HTTPS project URL, for example https://your-project-ref.supabase.co. Do not use the Postgres connection string here.",
  );
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

module.exports = supabase;
