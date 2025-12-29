
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Auth header missing');
    
    // Robust token extraction
    const token = authHeader.split(' ').pop();
    if (!token || token === 'undefined' || token === 'null') {
        throw new Error('Malformed Authorization token');
    }
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) {
        console.error("Auth validation failed:", userError?.message);
        throw new Error(`Invalid token: ${userError?.message || 'Identity verification failed'}`);
    }

    // 1. Fetch Profile
    const { data: profile, error: profileError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) throw new Error(`Database Profile Fetch Error: ${profileError.message}`);
    
    if (!profile) {
        throw new Error(`Profile not found in database for ${user.email}. User exists in Auth but not in Public schema.`);
    }

    // 2. Fetch Community Name safely (bypass RLS)
    if (profile.community_id) {
        const { data: comm } = await supabaseClient
            .from('communities')
            .select('name')
            .eq('id', profile.community_id)
            .maybeSingle();
        if (comm) {
            profile.community_name = comm.name;
        }
    }

    // 3. Fetch Associated Units
    let units = [];
    const roleStr = String(profile.role || '').toLowerCase();
    const isTenant = roleStr === 'tenant' || (profile.profile_data?.is_tenant);

    if (isTenant && profile.flat_number && profile.community_id) {
        const { data } = await supabaseClient
            .from('units')
            .select('*')
            .eq('community_id', profile.community_id)
            .eq('flat_number', profile.flat_number);
        if (data) units = data;
    } else {
        const { data } = await supabaseClient
            .from('units')
            .select('*')
            .eq('user_id', user.id);
        if (data) units = data;
    }

    return new Response(
      JSON.stringify({ ...profile, units }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Profile Fetcher Crash:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
