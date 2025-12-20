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

    // Fetch Profile for Role Check
    const { data: profile } = await supabaseClient.from('users').select('role, community_id').eq('id', user.id).single()
    
    if (!profile || profile.community_id !== community_id) {
        throw new Error('Unauthorized access to community data')
    }

    const userRole = (profile.role || '').toLowerCase();
    
    // Allowed roles
    const allowedRoles = ['security', 'securityadmin', 'admin', 'superadmin', 'resident'];
    const isAllowed = allowedRoles.includes(userRole);

    if (!isAllowed) {
         return new Response(
            JSON.stringify({ error: 'Unauthorized: Access denied' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
    }

    // Fetch Visitors (Service Role bypasses RLS)
    let query = supabaseClient
        .from('visitors')
        .select('*')
        .eq('community_id', community_id);

    // If Resident OR Property Admin, strictly filter by their own ID
    // Property Admins are treated as residents for visitor management
    if (userRole === 'resident' || userRole === 'admin') {
        query = query.eq('user_id', user.id);
    }

    query = query.order('expected_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    return new Response(
      JSON.stringify({ data }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})