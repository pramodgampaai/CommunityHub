
import { createClient } from '@supabase/supabase-js';

// Vercel's build process will replace `import.meta.env.VITE_...`
// with the actual values from the project's environment variables.
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_KEY;

// Check if the variables were provided during the build.
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey;

// Initialize the Supabase client.
// If the configuration is missing, use dummy values to prevent the client
// from throwing an error, allowing the app to show a friendly error message.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseKey : 'dummykey'
);