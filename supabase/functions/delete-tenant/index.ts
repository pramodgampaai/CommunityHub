
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
    const { data: { user: requester }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !requester) throw new Error('Invalid token')

    const { tenantId } = await req.json()
    if (!tenantId) throw new Error('Missing tenant ID')

    // 1. Verify Requester is the Owner of the Tenant's Unit
    // Fetch Requester Profile
    const { data: ownerProfile } = await supabaseClient.from('users').select('flat_number, community_id, role').eq('id', requester.id).single();
    
    // Fetch Tenant Profile
    const { data: tenantProfile } = await supabaseClient.from('users').select('flat_number, community_id, role').eq('id', tenantId).single();

    if (!ownerProfile || !tenantProfile) throw new Error('User not found');

    // Security Check: Must be in same community, same flat, and requester must be Resident (Owner) or Admin
    const isOwner = ownerProfile.role === 'Resident' && ownerProfile.flat_number === tenantProfile.flat_number && ownerProfile.community_id === tenantProfile.community_id;
    const isAdmin = ownerProfile.role === 'Admin' || ownerProfile.role === 'SuperAdmin';

    if (!isOwner && !isAdmin) {
        throw new Error('Unauthorized: You can only remove tenants from your own unit.');
    }

    // 2. Delete Public Profile
    const { error: profileError } = await supabaseClient.from('users').delete().eq('id', tenantId);
    if (profileError) throw profileError;

    // 3. Delete Auth User
    const { error: authError } = await supabaseClient.auth.admin.deleteUser(tenantId);
    if (authError) {
        console.error("Auth deletion failed (orphan might exist):", authError);
        // Continue anyway as profile is gone
    }

    // 4. Audit Log
    await supabaseClient.from('audit_logs').insert({
        community_id: ownerProfile.community_id,
        actor_id: requester.id,
        action: 'DELETE',
        entity: 'User',
        entity_id: tenantId,
        details: { description: `Tenant removed: ${tenantId} from unit ${ownerProfile.flat_number}` }
    });

    return new Response(
      JSON.stringify({ message: 'Tenant removed successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
