
import { createClient } from '@supabase/supabase-js';

// Print debug info when env vars are missing
if (!process.env.SUPABASE_URL) {
  console.error('❌ SUPABASE_URL environment variable is not set');
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is not set');
}

export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
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
    const { data, error } = await supabase.from('mlb_team_hitting_stats').select('count(*)', { count: 'exact' });
    if (error) {
      console.error('Failed to connect to Supabase:', error);
      return false;
    }
    console.log('Successfully connected to Supabase. Current row count:', data);
    return true;
  } catch (err) {
    console.error('Error testing Supabase connection:', err.message);
    return false;
  }
}
