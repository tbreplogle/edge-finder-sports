
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Robust environment variable checking with detailed errors
if (!process.env.SUPABASE_URL) {
  console.error('❌ ERROR: SUPABASE_URL environment variable is not set!');
  console.error('This is required for connecting to your Supabase project.');
  console.error('Make sure to add this as a GitHub repository secret.');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: SUPABASE_SERVICE_ROLE_KEY environment variable is not set!');
  console.error('This is required for authenticating with your Supabase project.');
  console.error('Make sure to add this as a GitHub repository secret.');
}

// Log sanitized versions of credentials for debugging
console.log(`SUPABASE_URL set: ${process.env.SUPABASE_URL ? '✅ Yes (starts with: ' + process.env.SUPABASE_URL.substring(0, 8) + '...)' : '❌ No'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY set: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Yes (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : '❌ No'}`);

// Create the Supabase client with service role key
export const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
);

// Export a function to test the connection
export async function testConnection() {
  try {
    console.log('Testing Supabase connection...');
    // Fix: Use proper syntax for count query
    const { data, error } = await supabase
      .from('mlb_team_hitting_stats')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error('❌ Failed to connect to Supabase:', error.message);
      console.error('Detailed error:', JSON.stringify(error, null, 2));
      
      // Always create a report even on failure
      createScrapeReport({
        success: false,
        error: `Supabase connection error: ${error.message}`,
        timestamp: new Date().toISOString(),
        stats: { seven_day: 0, fourteen_day: 0 }
      });
      
      return false;
    }
    
    console.log('✅ Successfully connected to Supabase!');
    console.log(`Current row count in mlb_team_hitting_stats: ${data?.length || 0}`);
    return true;
  } catch (err) {
    console.error('❌ Error testing Supabase connection:', err.message);
    console.error('Stack trace:', err.stack);
    
    // Always create a report even on exception
    createScrapeReport({
      success: false,
      error: `Supabase connection exception: ${err.message}`,
      timestamp: new Date().toISOString(),
      stats: { seven_day: 0, fourteen_day: 0 }
    });
    
    return false;
  }
}

// Helper function to create the scrape report
export function createScrapeReport(data) {
  try {
    console.log('Creating scrape report:', JSON.stringify(data, null, 2));
    fs.writeFileSync('scrape-result.json', JSON.stringify(data, null, 2));
    console.log('✅ Scrape report saved to scrape-result.json');
    
    // Also write to a log file for permanent record
    const logData = `${new Date().toISOString()} - ${JSON.stringify(data)}\n`;
    fs.appendFileSync('scrape-history.log', logData);
  } catch (err) {
    console.error('❌ Error writing scrape report file:', err.message);
    
    // Try writing to a differently named file in case of permission issues
    try {
      fs.writeFileSync('scrape-result-fallback.json', JSON.stringify(data, null, 2));
      console.log('✅ Fallback scrape report saved to scrape-result-fallback.json');
    } catch (fallbackErr) {
      console.error('❌ Critical error: Could not write report file:', fallbackErr.message);
      // Last resort - output to console so it appears in GitHub Actions logs
      console.log('SCRAPE_RESULT_JSON:', JSON.stringify(data));
    }
  }
}
