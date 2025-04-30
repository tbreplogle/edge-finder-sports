
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.4';

// Get Supabase URL and service role key from environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

// Create and export the Supabase admin client with service role permissions
export const supabaseAdmin = () => createClient(supabaseUrl, supabaseServiceRoleKey);
