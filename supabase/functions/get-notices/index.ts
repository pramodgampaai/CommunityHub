
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !user) throw new Error('Invalid session');

    const body = await req.json().catch(() => ({}));
    const { community_id } = body;
    if (!community_id) throw new Error('Missing community_id parameter');

    // Strict User Validation
    const { data: profile, error: profileErr } = await supabaseClient
        .from('users')
        .select('community_id, role')
        .eq('id', user.id)
        .maybeSingle();
    
    if (profileErr) throw profileErr;
    if (!profile) throw new Error('User record not found in database. Access denied.');

    const userRole = String(profile.role || '').toLowerCase();
    const userCommId = profile.community_id;

    if (userRole !== 'superadmin' && userCommId !== community_id) {
        throw new Error(`Unauthorized: You do not belong to community ${community_id}.`);
    }

    const { data, error } = await supabaseClient
        .from('notices')
        .select('*')
        .eq('community_id', community_id)
        .order('created_at', { ascending: false });

    if (error) throw error;

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("Notice Fetch Exception:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
