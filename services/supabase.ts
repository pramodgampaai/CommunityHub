
import { createClient } from '@supabase/supabase-js';

// Read the environment variables from the global object defined in index.html
// This is a safe way to access configuration in the browser without crashing.
const env = (window as any).__env;

const supabaseUrl = env?.VITE_SUPABASE_URL;
const supabaseKey = env?.VITE_SUPABASE_KEY;

// Check if the variables are present and are not the placeholder values.
export const isSupabaseConfigured = 
  !!supabaseUrl && 
  !!supabaseKey &&
  supabaseUrl !== '__VITE_SUPABASE_URL__' &&
  supabaseKey !== '__VITE_SUPABASE_KEY__';

// Initialize the Supabase client.
// If the configuration is missing, use dummy values to prevent the client
// from throwing an error, allowing the app to show a friendly error message.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost', 
  isSupabaseConfigured ? supabaseKey : 'dummykey'
);