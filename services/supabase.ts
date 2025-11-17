import { createClient } from '@supabase/supabase-js';

// Access environment variables safely, assuming the platform provides `process.env`.
// This prevents a "process is not defined" ReferenceError in environments without it.
const supabaseUrl = (typeof process !== 'undefined' && process.env) ? process.env.VITE_SUPABASE_URL : undefined;
const supabaseKey = (typeof process !== 'undefined' && process.env) ? process.env.VITE_SUPABASE_KEY : undefined;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

// Provide dummy values if the environment variables are not set.
// This prevents the app from crashing on startup.
// The App component will show a configuration error message.
export const supabase = createClient(
  supabaseUrl || 'http://localhost', 
  supabaseKey || 'dummykey'
);