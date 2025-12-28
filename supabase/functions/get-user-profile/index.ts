
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
    if (!authHeader) throw new Error('Auth required');
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token');

    // Strict fetch from database
    const { data: profile, error: profileError } = await supabaseClient
        .from('users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

    if (profileError) throw new Error(`Database Profile Fetch Error: ${profileError.message}`);
    
    if (!profile) {
        throw new Error(`Profile not found in database for ${user.email}. Contact administrator.`);
    }

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
