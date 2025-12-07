
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
// We configure a custom fetch implementation to ensure no requests are cached by the client browser.
// This enforces "load everything from server side" behavior.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseKey : 'dummykey',
  {
    global: {
      fetch: (url, options) => {
        // Robust header handling:
        // options.headers can be a plain object, undefined, or a Headers instance.
        // Using `new Headers(...)` normalizes this input so we don't lose the Authorization token
        // which might be hidden inside a Headers prototype if we just spread it.
        const headers = new Headers(options?.headers);
        
        // Append cache-busting headers
        headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
        headers.set('Pragma', 'no-cache');
        headers.set('Expires', '0');

        return fetch(url, {
          ...options,
          cache: 'no-store', // Forces the browser to ignore the cache
          headers: headers
        });
      }
    }
  }
);
