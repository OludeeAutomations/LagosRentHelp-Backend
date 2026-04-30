/**
 * backfill-coordinates.js
 *
 * ONE-OFF production migration script:
 *   1. Ensures the `coordinates` (jsonb) column exists on the properties table.
 *   2. Geocodes every property whose coordinates are NULL via Nominatim (free).
 *   3. Saves { lat, lng } back to Supabase.
 *
 * Usage (run locally against the target env, or on the server):
 *   node scripts/backfill-coordinates.js
 *
 * ⚠️  Remove this file and redeploy once the migration is complete.
 *
 * Nominatim fair-use rules:
 *   - Max 1 request per second  (enforced below with a 1.1 s delay)
 *   - Must supply a descriptive User-Agent
 */

require("dotenv").config();
const https = require("https");
const axios = require("axios");
const supabase = require("../config/supabase");

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// ─── helpers ────────────────────────────────────────────────────────────────

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Run raw SQL against Supabase using the REST SQL endpoint (service role only).
 * Supabase exposes POST /rest/v1/rpc/... for functions, but raw DDL requires
 * the pg/sql endpoint available via the supabase-js internal fetch.
 * We use the undocumented but stable `POST /rest/v1/query` available in
 * supabase-js v2 via the underlying fetch — or fall back to a pg advisory lock trick.
 *
 * Simpler: use the Supabase Management API SQL endpoint.
 * Project ref is extracted from the SUPABASE_URL.
 */
async function runSQL(sql) {
  // Extract project ref from e.g. https://dcvdbjkqtzmchxlktpvp.supabase.co
  const ref = SUPABASE_URL.replace("https://", "").split(".")[0];
  const url = `https://api.supabase.com/v1/projects/${ref}/database/query`;

  try {
    const response = await axios.post(
      url,
      { query: sql },
      {
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": "application/json",
        },
      }
    );
    return { data: response.data, error: null };
  } catch (err) {
    return { data: null, error: err.response?.data || err.message };
  }
}

/**
 * Ensure the coordinates column exists. If production DB was created before
 * the column was added to the schema, this adds it without touching any data.
 */
async function ensureCoordinatesColumn() {
  console.log("🔧  Ensuring `coordinates` column exists on properties table...");

  const { error } = await runSQL(
    "ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS coordinates jsonb;"
  );

  if (error) {
    // If Management API token is refused, fall back: attempt a harmless
    // SELECT to detect if the column is already there via the Supabase client.
    console.warn(
      "  ⚠️  Management API returned an error (this is OK if the column already exists):",
      JSON.stringify(error)
    );
    console.log("  ℹ️  Checking column existence via query instead...");

    const { error: selectError } = await supabase
      .from("properties")
      .select("coordinates")
      .limit(1);

    if (selectError && selectError.message?.includes("column")) {
      console.error(
        "\n❌  The `coordinates` column does NOT exist in this database.\n" +
        "   Please run the following SQL in the Supabase SQL Editor for this project:\n\n" +
        "   ALTER TABLE public.properties ADD COLUMN IF NOT EXISTS coordinates jsonb;\n\n" +
        "   Then re-run this script.\n"
      );
      process.exit(1);
    }

    console.log("  ✅  Column already exists — continuing.\n");
    return;
  }

  console.log("  ✅  Column ensured (created or already existed).\n");
}

/**
 * Geocode a location string with Nominatim.
 * Returns { lat, lng } or null if nothing was found.
 */
async function geocode(locationStr) {
  const query = encodeURIComponent(locationStr + ", Lagos, Nigeria");
  const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;

  return new Promise((resolve) => {
    const options = {
      headers: {
        "User-Agent": "LagosRentHelp-Backfill/1.0 (contact@lagosrenthelp.ng)",
      },
    };

    https
      .get(url, options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const results = JSON.parse(body);
            if (results.length === 0) return resolve(null);
            resolve({
              lat: parseFloat(results[0].lat),
              lng: parseFloat(results[0].lon),
            });
          } catch {
            resolve(null);
          }
        });
      })
      .on("error", () => resolve(null));
  });
}

// ─── main ────────────────────────────────────────────────────────────────────

async function main() {
  // Step 1 — ensure column exists in production
  await ensureCoordinatesColumn();

  // Step 2 — fetch all properties without coordinates
  console.log("🔍  Fetching properties with missing coordinates...\n");

  const PAGE_SIZE = 1000;
  let allRows = [];
  let from = 0;

  while (true) {
    const { data, error } = await supabase
      .from("properties")
      .select("id, title, location")
      .is("coordinates", null)
      .range(from, from + PAGE_SIZE - 1);

    if (error) {
      console.error("❌  Supabase fetch error:", error.message);
      process.exit(1);
    }

    allRows = allRows.concat(data || []);
    if (!data || data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }

  if (allRows.length === 0) {
    console.log("✅  All properties already have coordinates. Nothing to do.");
    return;
  }

  console.log(
    `📦  Found ${allRows.length} propert${allRows.length === 1 ? "y" : "ies"} without coordinates.\n`
  );

  // Step 3 — geocode and update
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < allRows.length; i++) {
    const { id, title, location } = allRows[i];
    const label = `[${i + 1}/${allRows.length}] "${title}" — ${location}`;

    process.stdout.write(`  ${label} → geocoding...`);

    const coords = await geocode(location);

    if (!coords) {
      console.log(" ⚠️  Not found, skipping.");
      skipped++;
    } else {
      const { error: updateError } = await supabase
        .from("properties")
        .update({ coordinates: coords })
        .eq("id", id);

      if (updateError) {
        console.log(` ❌  Update failed: ${updateError.message}`);
        failed++;
      } else {
        console.log(` ✅  lat=${coords.lat}, lng=${coords.lng}`);
        updated++;
      }
    }

    // Nominatim fair-use: max 1 req/sec
    if (i < allRows.length - 1) await sleep(1100);
  }

  console.log("\n─────────────────────────────────────────");
  console.log(`✅  Updated : ${updated}`);
  console.log(`⚠️  Skipped : ${skipped} (location not geocodable)`);
  console.log(`❌  Failed  : ${failed} (Supabase error)`);
  console.log("─────────────────────────────────────────");
  console.log(
    "\n🎉  Done! Remove scripts/backfill-coordinates.js and redeploy.\n"
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
