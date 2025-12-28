
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') || '')
    if (userError || !user) throw new Error('Authentication failed');

    const body = await req.json().catch(() => ({}));
    const { community_id } = body;
    if (!community_id) throw new Error('Missing community_id');

    // Strict DB Check
    const { data: profile, error: pErr } = await supabaseClient.from('users').select('community_id, role').eq('id', user.id).maybeSingle();
    if (pErr) throw new Error(`User Registry Error: ${pErr.message}`);
    if (!profile) throw new Error('User profile missing in database.');

    const userRole = String(profile.role || '').toLowerCase();
    const userCommId = profile.community_id;

    if (userRole !== 'superadmin' && userCommId !== community_id) {
        throw new Error('Unauthorized community isolation access.');
    }

    const { data, error } = await supabaseClient
        .from('amenities')
        .select('*')
        .eq('community_id', community_id);

    if (error) throw new Error(`Amenity Fetch Error: ${error.message}`);

    return new Response(
      JSON.stringify({ data: data || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Amenity Fetcher Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
