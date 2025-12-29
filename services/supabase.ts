
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration Logic
 */

// These literals match your specific project deployment
const envUrl = process.env.VITE_SUPABASE_URL;
const envKey = process.env.VITE_SUPABASE_KEY;

// Fallback credentials
const fallbackUrl = "";
const fallbackKey = "";

/**
 * Validates if a string is a legitimate configuration value.
 */
const isValid = (val: any): boolean => {
  if (!val) return false;
  const v = String(val).trim();
  if (v === "" || v === "undefined" || v === "null") return false;
  return true;
};

export const isSupabaseConfigured = isValid(envUrl) || isValid(fallbackUrl);

const supabaseUrl = isValid(envUrl) ? envUrl! : (isValid(fallbackUrl) ? fallbackUrl : 'https://placeholder.supabase.co');
export const supabaseKey = isValid(envKey) ? envKey! : (isValid(fallbackKey) ? fallbackKey : 'placeholder-key');
export const supabaseProjectUrl = supabaseUrl;

export const supabase = createClient(supabaseUrl, supabaseKey);
