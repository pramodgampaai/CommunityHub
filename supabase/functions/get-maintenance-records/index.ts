
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
    if (userError || !user) throw new Error('Session invalid');

    const body = await req.json().catch(() => ({}));
    const { community_id, user_id } = body;
    if (!community_id) throw new Error('Missing community_id');

    // Strict DB Lookups Only
    const { data: profile, error: pErr } = await supabaseClient.from('users').select('community_id, role').eq('id', user.id).maybeSingle();
    if (pErr) throw new Error(`Auth Registry Verification Failed: ${pErr.message}`);
    if (!profile) throw new Error('Profile missing from community registry.');

    const userRole = String(profile.role || '').toLowerCase();
    const userCommId = profile.community_id;

    if (userRole !== 'superadmin' && userCommId !== community_id) {
        throw new Error('Access Denied: Community scope violation.');
    }

    let query = supabaseClient
        .from('maintenance_records')
        .select('*, users(name), units(flat_number)')
        .eq('community_id', community_id);

    const isLimitedRole = ['resident', 'tenant'].includes(userRole);

    if (isLimitedRole) {
        query = query.eq('user_id', user.id);
    } else if (user_id) {
        query = query.eq('user_id', user_id);
    }

    query = query.order('period_date', { ascending: false });

    const { data, error } = await query;
    if (error) throw new Error(`Ledger Fetch Failure: ${error.message}`);

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("Maintenance Ledger Crash:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
