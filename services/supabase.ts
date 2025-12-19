import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration Logic
 * 
 * In production (Vercel), values are injected via esbuild --define in package.json.
 * In development, we fallback to placeholders that users can manually edit.
 */

// esbuild will replace these exact strings with the values from Vercel's env
const injectedUrl = process.env.VITE_SUPABASE_URL;
const injectedKey = process.env.VITE_SUPABASE_KEY;

const supabaseUrlPlaceholder = "YOUR_SUPABASE_URL";
const supabaseKeyPlaceholder = "YOUR_SUPABASE_KEY";

// Use injected values if available and valid, otherwise fallback to placeholders
const supabaseUrl = (injectedUrl && injectedUrl !== "$VITE_SUPABASE_URL" && injectedUrl !== "") ? injectedUrl : supabaseUrlPlaceholder;
export const supabaseKey = (injectedKey && injectedKey !== "$VITE_SUPABASE_KEY" && injectedKey !== "") ? injectedKey : supabaseKeyPlaceholder;

// Check if the configuration is valid
export const isSupabaseConfigured = (
  supabaseUrl && 
  supabaseKey && 
  supabaseUrl !== "YOUR_SUPABASE_URL" && 
  supabaseKey !== "YOUR_SUPABASE_KEY" &&
  !supabaseUrl.startsWith('$') // Safety check for failed shell expansion
);

// Initialize the Supabase client
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseKey : 'dummykey'
);