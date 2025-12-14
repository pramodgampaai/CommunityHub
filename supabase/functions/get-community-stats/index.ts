
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

    // Fetch Communities
    const { data: communities, error: commError } = await supabaseClient
      .from('communities')
      .select('*')
      .order('name');

    if (commError) throw commError;

    // Fetch All Users (Lightweight: only need role and community_id)
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('community_id, role')
      .eq('status', 'active');

    if (usersError) throw usersError;

    // Aggregation Logic
    const stats = communities.map((community: any) => {
      const communityUsers = users.filter((u: any) => u.community_id === community.id);
      
      const resident_count = communityUsers.filter((u: any) => u.role === 'Resident').length;
      const admin_count = communityUsers.filter((u: any) => u.role === 'Admin').length;
      
      // Granular Counts (Admins only as per dashboard view request)
      const helpdesk_admin_count = communityUsers.filter((u: any) => u.role === 'HelpdeskAdmin' || u.role === 'Helpdesk').length;
      const security_admin_count = communityUsers.filter((u: any) => u.role === 'SecurityAdmin').length;

      // Full Staff Count for Billing (All Service Roles)
      const staff_count = communityUsers.filter((u: any) => 
          u.role === 'HelpdeskAdmin' || 
          u.role === 'Helpdesk' ||
          u.role === 'HelpdeskAgent' || 
          u.role === 'SecurityAdmin' ||
          u.role === 'Security'
      ).length;

      return {
        ...community,
        resident_count,
        admin_count,
        helpdesk_count: helpdesk_admin_count, // Keeps backward compatibility for Dashboard
        security_count: security_admin_count, // Keeps backward compatibility for Dashboard
        staff_count, // New aggregate for Billing
        income_generated: 0 
      };
    });

    return new Response(
      JSON.stringify({ data: stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
