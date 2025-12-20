import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration Logic
 * 
 * Prioritizes environment variables (Vercel/Production).
 * Falls back to hardcoded credentials for Preview/Local modes.
 */

// These are replaced at build-time by esbuild --define
const envUrl = process.env.VITE_SUPABASE_URL;
const envKey = process.env.VITE_SUPABASE_KEY;

// Fallback credentials for preview mode
const fallbackUrl = "";
const fallbackKey = "";

/**
 * Validates if a string is a legitimate configuration value.
 */
const isValid = (val: string | undefined): boolean => {
  if (!val) return false;
  const v = String(val).trim();
  if (v === "" || v === "undefined" || v === "null") return false;
  if (v === "YOUR_SUPABASE_URL" || v === "YOUR_SUPABASE_KEY") return false;
  
  // Ignore shell-escaped variable names if build injection fails
  if (v.startsWith('$') || (v.startsWith('{') && v.endsWith('}'))) return false;
  
  return true;
};

// The app is considered "configured" if we have valid production vars OR valid fallbacks
export const isSupabaseConfigured = isValid(envUrl) || isValid(fallbackUrl);

// Resolve final credentials
const supabaseUrl = isValid(envUrl) ? envUrl! : fallbackUrl;
export const supabaseKey = isValid(envKey) ? envKey! : fallbackKey;

// Initialize client with a safety fallback to a dummy URL to prevent crashes if both are invalid
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'placeholder-key'
);