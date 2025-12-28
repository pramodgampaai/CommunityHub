
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    if (!authHeader) throw new Error('Missing Authorization header')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token')

    const { community_id } = await req.json()
    if (!community_id) throw new Error('Missing community_id')

    // Validate access strictly via DB
    const { data: profile, error: pErr } = await supabaseClient.from('users').select('community_id, role').eq('id', user.id).single();
    if (pErr) throw new Error(`Access Verification Error: ${pErr.message}`);
    if (!profile) throw new Error('Profile registry not found.');

    if (profile.community_id !== community_id && profile.role !== 'SuperAdmin') {
        throw new Error('Unauthorized community scope access prohibited.');
    }

    const { data, error } = await supabaseClient
        .from('users')
        .select('*, units(*)')
        .eq('community_id', community_id);

    if (error) throw new Error(`Registry Fetch Error: ${error.message}`);

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Directory Fetcher Crash:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
