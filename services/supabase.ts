
import { createClient } from '@supabase/supabase-js';

// Safely access the env object to prevent a crash if import.meta.env is undefined.
// This is the key fix for the "blank screen" error.
const env = (import.meta as any)?.env || {};

const supabaseUrl = env.VITE_SUPABASE_URL;
const supabaseKey = env.VITE_SUPABASE_KEY;

// Check if the variables were provided.
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey;

// Initialize the Supabase client.
// If the configuration is missing, use dummy values to prevent the client
// from throwing an error, allowing the app to show a friendly error message.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseKey : 'dummykey'
);