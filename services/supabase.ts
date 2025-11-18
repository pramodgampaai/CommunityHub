import { createClient } from '@supabase/supabase-js';

// In a Vercel environment (or a Vite project), environment variables
// prefixed with VITE_ are exposed to the frontend.
// The build environment makes them available on `process.env`.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

// Check if the variables were provided.
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey;

// Initialize the Supabase client.
// If the configuration is missing, use dummy values to prevent the client
// from throwing an error, allowing the app to show a friendly error message.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseKey : 'dummykey'
);
