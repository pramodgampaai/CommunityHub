
import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Production Configuration
 * These values are synchronized with your specific deployment at vnfmtbkhptkntaqzfdcx.supabase.co
 */

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_KEY;

export const isSupabaseConfigured = true;
export const supabaseKey = anonKey;
export const supabaseProjectUrl = supabaseUrl;

export const supabase = createClient(supabaseUrl, anonKey);
