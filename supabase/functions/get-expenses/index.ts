
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
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header' }), { status: 401, headers: corsHeaders });
    }
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid authentication token' }), { status: 401, headers: corsHeaders });
    }

    const body = await req.json().catch(() => ({}));
    const { community_id } = body;
    if (!community_id) {
      return new Response(JSON.stringify({ error: 'Missing community_id parameter' }), { status: 400, headers: corsHeaders });
    }

    // Strict validation via database source of truth
    const { data: profile, error: pErr } = await supabaseClient.from('users').select('community_id, role').eq('id', user.id).maybeSingle();
    if (pErr) throw new Error(`Identity Verification Failed: ${pErr.message}`);
    
    if (!profile) {
      // It's possible the user auth exists but the profile table hasn't synced yet
      return new Response(JSON.stringify({ error: 'User record missing in registry. Please re-login.' }), { status: 403, headers: corsHeaders });
    }

    // Community Isolation Check
    if (profile.role !== 'SuperAdmin' && profile.community_id !== community_id) {
        return new Response(JSON.stringify({ error: 'Unauthorized community scope access.' }), { status: 403, headers: corsHeaders });
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
    // Return 200 with an error object to avoid browser fetch interrupts on some platforms
    return new Response(
      JSON.stringify({ error: error.message, data: [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  }
})
