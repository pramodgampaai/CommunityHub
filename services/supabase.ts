import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration Logic
 * 
 * In production (Vercel), values are injected via esbuild --define in package.json.
 * The build script ensures these are injected as quoted string literals.
 */

// These are replaced at build-time by esbuild
const envUrl = process.env.VITE_SUPABASE_URL;
const envKey = process.env.VITE_SUPABASE_KEY;

const supabaseUrlPlaceholder = "YOUR_SUPABASE_URL";
const supabaseKeyPlaceholder = "YOUR_SUPABASE_KEY";

/**
 * Validates if the injected value is a real configuration string.
 * It checks for:
 * 1. Existence and non-emptiness
 * 2. Not being the literal placeholder name (happens if build fails or local dev)
 * 3. Not being a literal shell variable string (happens if shell expansion fails)
 */
const isValidValue = (val: string | undefined): boolean => {
  if (!val) return false;
  if (val === "" || val === "undefined" || val === "null") return false;
  if (val === supabaseUrlPlaceholder || val === supabaseKeyPlaceholder) return false;
  
  // If shell expansion fails, sometimes we get literal strings like "${VITE_...}" or "$VITE_..."
  if (val.startsWith('$') || val.startsWith('{')) return false;
  
  return true;
};

// Use injected values if available and valid, otherwise fallback to placeholders
export const isSupabaseConfigured = isValidValue(envUrl) && isValidValue(envKey);

const supabaseUrl = isSupabaseConfigured ? envUrl! : supabaseUrlPlaceholder;
export const supabaseKey = isSupabaseConfigured ? envKey! : supabaseKeyPlaceholder;

// Initialize the Supabase client
// We use a dummy URL/Key if not configured to prevent the client from throwing immediately
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabaseKey : 'placeholder-anon-key'
);