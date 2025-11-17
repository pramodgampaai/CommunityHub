
import { createClient } from '@supabase/supabase-js';

// Environment variables are exposed via process.env in this environment.
// Variables prefixed with VITE_ are commonly used for client-side exposure on platforms like Vercel.
const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseKey);

// Provide dummy values if the environment variables are not set.
// This prevents the app from crashing on startup.
// API calls will fail until the variables are configured correctly.
export const supabase = createClient(
  supabaseUrl || 'http://localhost', 
  supabaseKey || 'dummykey'
);