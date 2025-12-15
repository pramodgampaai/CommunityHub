
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

    // 1. Verify User Authentication
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token')

    // 2. Parse Payload
    const { community_id } = await req.json()
    if (!community_id) throw new Error('Missing community_id')

    // 3. Verify Role
    const { data: profile } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .single();

    if (!profile || profile.community_id !== community_id) {
        throw new Error('Unauthorized access to community data');
    }

    // Allowed roles now includes 'resident'
    const allowedRoles = ['admin', 'helpdeskadmin', 'securityadmin', 'superadmin', 'helpdeskagent', 'resident'];
    const currentRole = profile.role ? profile.role.toLowerCase() : '';
    const isAllowed = allowedRoles.includes(currentRole);

    if (!isAllowed) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized: Access denied' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
    }

    // 4. Fetch Complaints (Bypassing RLS via Service Role)
    let query = supabaseClient
        .from('complaints')
        .select('*, assigned_user:users!assigned_to(name)')
        .eq('community_id', community_id);

    // If Resident, strictly filter by their own ID
    if (currentRole === 'resident') {
        query = query.eq('user_id', user.id);
    }

    query = query.order('created_at', { ascending: false });

    const { data: complaints, error: fetchError } = await query;

    if (fetchError) throw fetchError;

    return new Response(
      JSON.stringify({ data: complaints }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
