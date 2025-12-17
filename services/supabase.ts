
import { createClient } from '@supabase/supabase-js';

// --- Vercel/Production Environment ---
// The app will first attempt to use environment variables, which is the
// secure, standard way for deployments on Vercel, Netlify, etc.
const supabaseUrlFromEnv = (import.meta as any).env?.VITE_SUPABASE_URL ?? (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_URL : undefined);
const supabaseKeyFromEnv = (import.meta as any).env?.VITE_SUPABASE_KEY ?? (typeof process !== 'undefined' ? process.env?.VITE_SUPABASE_KEY : undefined);


// --- AI Studio Preview / Local Fallback ---
// If environment variables are not found, it falls back to these placeholders.
// This allows the AI Studio preview to work after you manually edit them.
const supabaseUrlPlaceholder = "YOUR_SUPABASE_URL";
const supabaseKeyPlaceholder = "YOUR_SUPABASE_KEY";
const supabaseUrl = supabaseUrlFromEnv || supabaseUrlPlaceholder;
export const supabaseKey = supabaseKeyFromEnv || supabaseKeyPlaceholder;

// Check if the configuration is valid. It's configured if we have keys from the environment
// OR if the placeholder values have been changed from their default.
export const isSupabaseConfigured = (supabaseUrl && supabaseKey && supabaseUrl !== "YOUR_SUPABASE_URL" && supabaseKey !== "YOUR_SUPABASE_KEY");

// Initialize the Supabase client.
// We removed the custom global.fetch override as it was interfering with Edge Function headers.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseKey : 'dummykey'
);
