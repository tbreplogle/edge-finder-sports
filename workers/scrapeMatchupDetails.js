//scrapeMatchupDetails.js
import axios from 'axios';
import * as cheerio from 'cheerio';
import axiosRetry from 'axios-retry';
import { getTodayMatchupIds } from './scrapeMatchupIds.js';

// Configure axios with retry logic
axiosRetry(axios, {
  retries: 3,
  retryDelay: retryCount => 2000 * retryCount,
  retryCondition: error => 
    axiosRetry.isNetworkOrIdempotentRequestError(error) || 
    error.code === 'ERR_BAD_RESPONSE' || 
    error.code === 'ECONNABORTED' ||
    error.response?.status === 524,
  onRetry: (retryCount, error) => {
    console.log(`Retry attempt #${retryCount} for matchup detail`);
    console.log(`Reason: ${error.message}`);
  }
});

/**
 * Scrapes detailed pitcher and bullpen information from a specific matchup page
 * @param {string} matchupId - The ID of the matchup
 * @returns {Promise<object|null>} The scraped matchup data or null if unavailable
 */
export async function scrapeMatchupDetail(matchupId) {
  const url = `https://www.covers.com/sport/baseball/mlb/matchup/${matchupId}`;
  console.log(`Fetching matchup details from: ${url}`);
  
  try {
    const { data: html } = await axios.get(url, {
      timeout: 30000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) ' +
                      'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                      'Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(html);
    
    // Get team names
    const awayTeamName = $('.covers-CoversMatchups-awayTeamName').text().trim();
    const homeTeamName = $('.covers-CoversMatchups-homeTeamName').text().trim();
    
    // Extract starting pitchers from the 11th table (index 10)
    const tables = $('table');
    let homePitcher = '';
    let awayPitcher = '';
    
    if (tables.length >= 11) {
      const pitcherTable = $(tables[10]);
      
      // Process pitcher table rows
      pitcherTable.find('tbody tr').each((i, row) => {
        const cells = $(row).find('td');
        if (cells.length >= 2) {
          if (i === 0) {
            awayPitcher = $(cells[0]).text().trim();
          } else if (i === 1) {
            homePitcher = $(cells[0]).text().trim();
          }
        }
      });
    }
    
    // Extract bullpen stats from the 17th table (index 16)
    const bullpens = {};
    
    if (tables.length >= 17) {
      const bullpenTable = $(tables[16]);
      
      // Get the header row to identify stat columns
      const headers = [];
      bullpenTable.find('thead tr th').each((_, th) => {
        headers.push($(th).text().trim());
      });
      
      // Process bullpen table rows
      bullpenTable.find('tbody tr').each((_, row) => {
        const cells = $(row).find('td');
        
        if (cells.length >= headers.length) {
          const teamName = $(cells[0]).text().trim();
          const stats = {};
          
          // Start from index 1 to skip team name column
          for (let i = 1; i < headers.length; i++) {
            stats[headers[i]] = $(cells[i]).text().trim();
          }
          
          bullpens[teamName] = stats;
        }
      });
    }
    const pctEls = $('span.team-consensus strong');
    const awayTicketPct = pctEls.eq(0).text().trim().replace('%','') || null;
    const homeTicketPct = pctEls.eq(1).text().trim().replace('%','') || null;
    // parse into integers
    const awayTicket = awayTicketPct ? parseInt(awayTicketPct, 10) : null;
    const homeTicket = homeTicketPct ? parseInt(homeTicketPct,  10) : null;
    return {
      matchupId,
      awayTeam: awayTeamName,
      homeTeam: homeTeamName,
      homePitcher,
      awayPitcher,
      bullpens,
      
      // ─────────────── NEW FIELDS ───────────────
      awayTicketPct: awayTicket,
      homeTicketPct: homeTicket
      // ────────────────────────────────────────────
    };
  } catch (err) {
    console.error(`❌ Failed to fetch matchup details for ID ${matchupId}:`, err.message);
    return null;
  }
}

/**
 * Scrapes details for all of today's MLB matchups
 * @returns {Promise<object[]>} An array of matchup details
 */
export async function getAllMatchupDetails() {
  console.log('Starting to scrape all MLB matchup details...');
  
  try {
    // First get all matchup IDs for today
    const matchupIds = await getTodayMatchupIds();
    console.log(`Found ${matchupIds.length} matchups to scrape`);
    
    if (matchupIds.length === 0) {
      console.log('No matchups found for today');
      return [];
    }
    
    const results = [];
    
    // Process each matchup with a small delay between requests to avoid rate limiting
    for (const id of matchupIds) {
      const detail = await scrapeMatchupDetail(id);
      if (detail) {
        results.push(detail);
        console.log(`✅ Successfully scraped matchup ${id}`);
      }
      
      // Wait a short time between requests
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`Completed scraping ${results.length}/${matchupIds.length} matchup details`);
    return results;
  } catch (err) {
    console.error('❌ Error in getAllMatchupDetails:', err);
    return [];
  }
}

// Run if script is executed directly
if (import.meta.url === import.meta.main) {
  getAllMatchupDetails().then(results => {
    console.log(JSON.stringify(results, null, 2));
  });
}
