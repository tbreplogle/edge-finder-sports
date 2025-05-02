
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Print debug info when env vars are missing
if (!process.env.SUPABASE_URL) {
  console.error('❌ SUPABASE_URL environment variable is not set');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
}

// Log sanitized versions of credentials for debugging
console.log(`SUPABASE_URL set: ${process.env.SUPABASE_URL ? 'Yes (starts with: ' + process.env.SUPABASE_URL.substring(0, 8) + '...)' : 'No'}`);
console.log(`SUPABASE_SERVICE_ROLE_KEY set: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Yes (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : 'No'}`);

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
    const { data, error } = await supabase.from('mlb_team_hitting_stats').select('count(*)', { count: 'exact' });
    
    if (error) {
      console.error('Failed to connect to Supabase:', error);
      
      // Create a failure report for GitHub Actions
      fs.writeFileSync('scrape-result.json', JSON.stringify({
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
        stats: { seven_day: 0, fourteen_day: 0 }
      }, null, 2));
      
      return false;
    }
    
    console.log('Successfully connected to Supabase. Current row count:', data);
    return true;
  } catch (err) {
    console.error('Error testing Supabase connection:', err.message);
    
    // Create a failure report for GitHub Actions
    fs.writeFileSync('scrape-result.json', JSON.stringify({
      success: false,
      error: err.message,
      timestamp: new Date().toISOString(),
      stats: { seven_day: 0, fourteen_day: 0 }
    }, null, 2));
    
    return false;
  }
}
