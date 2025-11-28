
import { createClient } from '@supabase/supabase-js';

// --- Vercel/Production Environment ---
// The app will first attempt to use environment variables, which is the
// secure, standard way for deployments on Vercel, Netlify, etc.
const supabaseUrlFromEnv = (import.meta as any).env?.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const supabaseKeyFromEnv = (import.meta as any).env?.VITE_SUPABASE_KEY ?? process.env.VITE_SUPABASE_KEY;


// --- AI Studio Preview / Local Fallback ---
// If environment variables are not found, it falls back to these placeholders.
// This allows the AI Studio preview to work after you manually edit them.
//
// 1. Replace "YOUR_SUPABASE_URL" with your actual Supabase project URL.
// 2. Replace "YOUR_SUPABASE_KEY" with your Supabase public anon key.
//
// WARNING: Do not commit your keys to a public repository.
const supabaseUrlPlaceholder = "YOUR_SUPABASE_URL";
const supabaseKeyPlaceholder = "YOUR_SUPABASE_KEY";

const supabaseUrl = supabaseUrlFromEnv || supabaseUrlPlaceholder;
export const supabaseKey = supabaseKeyFromEnv || supabaseKeyPlaceholder;

// Check if the configuration is valid. It's configured if we have keys from the environment
// OR if the placeholder values have been changed from their default.
export const isSupabaseConfigured = (supabaseUrl && supabaseKey && supabaseUrl !== "YOUR_SUPABASE_URL" && supabaseKey !== "YOUR_SUPABASE_KEY");

// Initialize the Supabase client.
// If the configuration is missing, use dummy values to prevent the client
// from throwing an error, allowing the app to show a friendly error message.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseKey : 'dummykey'
);
