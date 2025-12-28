
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration Logic
 * 
 * We use direct references to process.env variables so that the bundler (esbuild)
 * can perform static text replacement during the build process.
 */

// These literals will be replaced by esbuild's --define flags during build
const envUrl = process.env.VITE_SUPABASE_URL;
const envKey = process.env.VITE_SUPABASE_KEY;

// Fallback credentials for local/preview mode if build-time variables are missing
const fallbackUrl = "";
const fallbackKey = "";

/**
 * Validates if a string is a legitimate configuration value.
 */
const isValid = (val: any): boolean => {
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
const supabaseUrl = isValid(envUrl) ? envUrl! : (isValid(fallbackUrl) ? fallbackUrl : 'https://placeholder.supabase.co');
export const supabaseKey = isValid(envKey) ? envKey! : (isValid(fallbackKey) ? fallbackKey : 'placeholder-key');
export const supabaseProjectUrl = supabaseUrl;

// Initialize client
export const supabase = createClient(supabaseUrl, supabaseKey);
