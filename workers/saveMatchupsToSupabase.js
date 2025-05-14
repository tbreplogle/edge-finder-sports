/* workers/saveMatchupsToSupabase.js
   Kicks off the Covers‑ID scraper and writes rows to Supabase */

import { scrapeAndSaveTodayMatchups } from "./scrapeMatchupIds.js";

/* -------------------------------------------------------------------------- */
/* Main                                                                       */
/* -------------------------------------------------------------------------- */
async function main() {
  console.log("Starting MLB matchup scraper…");

  try {
    console.log("Scraping and saving today’s MLB matchups…");
    const result = await scrapeAndSaveTodayMatchups();

    if (result.success) {
      console.log(
        `✅ Successfully scraped + saved ${result.matchups.length} MLB matchups`,
      );
      return result.matchups;
    }

    console.error("❌ Failed to save MLB matchups:", result.error);
    return [];
  } catch (err) {
    console.error("❌ Error in MLB matchup scraper:", err);
    process.exit(1);
  }
}

/* -------------------------------------------------------------------------- */
/* Run when called directly                                                   */
/* -------------------------------------------------------------------------- */
main()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
