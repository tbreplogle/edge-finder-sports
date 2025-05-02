
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Tests the connection to Supabase
 * @returns {Promise<boolean>} True if connection is successful
 */
export async function testConnection() {
  try {
    // Use a simple query to test connection
    const { data, error } = await supabase
      .from('mlb_team_hitting_stats')
      .select('id')
      .limit(1);
    
    if (error) {
      console.error('❌ Failed to connect to Supabase:', error.message);
      console.error('Detailed error:', JSON.stringify(error, null, 2));
      return false;
    }
    
    console.log('✅ Successfully connected to Supabase');
    return true;
  } catch (err) {
    console.error('❌ Failed to connect to Supabase:', err.message);
    console.error('Detailed error:', JSON.stringify(err, null, 2));
    return false;
  }
}

/**
 * Creates a scrape report file
 * @param {object} report The report object to save
 */
export function createScrapeReport(report) {
  try {
    console.log('Creating scrape report:', JSON.stringify(report, null, 2));
    fs.writeFileSync('scrape-result.json', JSON.stringify(report, null, 2));
    console.log('✅ Scrape report saved to scrape-result.json');
    
    // Also save to a fallback location just in case
    try {
      fs.writeFileSync('scrape-result-fallback.json', JSON.stringify(report, null, 2));
    } catch (fallbackErr) {
      console.warn('Warning: Could not write fallback report file:', fallbackErr.message);
    }
    
    // Append to a log file for history
    try {
      const logEntry = `${new Date().toISOString()}: ${JSON.stringify(report)}\n`;
      fs.appendFileSync('scrape-history.log', logEntry);
    } catch (logErr) {
      console.warn('Warning: Could not append to scrape history log:', logErr.message);
    }
  } catch (err) {
    console.error('Error creating scrape report:', err.message);
    // Last resort attempt to write to a different location
    try {
      fs.writeFileSync('/tmp/scrape-result-emergency.json', JSON.stringify(report, null, 2));
    } catch (emergencyErr) {
      console.error('Failed even emergency report save:', emergencyErr.message);
    }
  }
}
