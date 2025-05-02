
import axios from 'axios';
import * as cheerio from 'cheerio';
import axiosRetry from 'axios-retry';

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
    console.log(`Retry attempt #${retryCount} for Covers.com`);
    console.log(`Reason: ${error.message}`);
  }
});

/**
 * Scrapes MLB matchup IDs from Covers.com for today's games
 * @returns {Promise<string[]>} An array of unique matchup IDs
 */
export async function getTodayMatchupIds() {
  const url = 'https://www.covers.com/sports/mlb/matchups';
  console.log(`Fetching MLB matchups from: ${url}`);

  try {
    const { data: html } = await axios.get(url, {
      timeout: 30000, // 30 second timeout
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.4664.110 Safari/537.36'
      }
    });
    
    const $ = cheerio.load(html);
    const links = [];

    $('a[href*="/sport/baseball/mlb/matchup/"]').each((_, el) => {
      const href = $(el).attr('href');
      if (href && href.includes('/matchup/')) {
        const match = href.match(/\/matchup\/(\d+)/);
        if (match) links.push(match[1]);
      }
    });

    const uniqueMatchupIds = [...new Set(links)];
    console.log(`✅ Found ${uniqueMatchupIds.length} MLB matchups:`, uniqueMatchupIds);
    return uniqueMatchupIds;
  } catch (err) {
    console.error('❌ Failed to fetch MLB matchup IDs:', err);
    return [];
  }
}

// Run if script is executed directly
if (import.meta.url === import.meta.main) {
  getTodayMatchupIds();
}
