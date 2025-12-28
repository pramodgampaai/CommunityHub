
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: any) => {
  // Handle CORS preflight
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
    if (userError || !user) throw new Error('Invalid authentication token')

    const body = await req.json().catch(() => ({}));
    const { community_id } = body;
    if (!community_id) throw new Error('Missing community_id parameter')

    // Strict validation via database source of truth
    const { data: profile, error: pErr } = await supabaseClient.from('users').select('community_id, role').eq('id', user.id).single();
    if (pErr) throw new Error(`Identity Verification Failed: ${pErr.message}`);
    if (!profile) throw new Error('User record missing in registry.');

    // Community Isolation Check
    if (profile.community_id !== community_id && profile.role !== 'SuperAdmin') {
        throw new Error('Unauthorized community scope access.');
    }

    const { data, error } = await supabaseClient
        .from('expenses')
        .select('*, submitted_user:users!submitted_by(name), approved_user:users!approved_by(name)')
        .eq('community_id', community_id)
        .order('date', { ascending: false });

    if (error) throw new Error(`Expense Lookup Error: ${error.message}`);

    return new Response(
      JSON.stringify({ data: data || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Expense Fetcher Crash:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
