import { createClient } from '@supabase/supabase-js';

// In different build environments, public environment variables can be exposed
// in different ways. To make the app more robust, we'll try to read from
// both `process.env` (common in tools like Create React App or Next.js) and
// `import.meta.env` (the standard for Vite). Vercel's build system should
// populate one of these based on the project type it detects.

// We check `typeof process` to avoid a ReferenceError in browser environments
// where `process` is not defined at runtime.
// FIX: Cast `import.meta` to `any` to bypass TypeScript error when Vite types are not present.
const supabaseUrl = (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined) || (import.meta as any).env?.VITE_SUPABASE_URL;
// FIX: Cast `import.meta` to `any` to bypass TypeScript error when Vite types are not present.
const supabaseKey = (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_KEY : undefined) || (import.meta as any).env?.VITE_SUPABASE_KEY;


// Check if the variables were provided.
export const isSupabaseConfigured = !!supabaseUrl && !!supabaseKey;

// Initialize the Supabase client.
// If the configuration is missing, use dummy values to prevent the client
// from throwing an error, allowing the app to show a friendly error message.
export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'http://localhost',
  isSupabaseConfigured ? supabaseKey : 'dummykey'
);
