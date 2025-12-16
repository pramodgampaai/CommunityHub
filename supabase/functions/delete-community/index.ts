
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Declare Deno to fix 'Cannot find name Deno'
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
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )

    // 1. Auth Check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token')

    // 2. Permission Check (SuperAdmin only)
    const { data: profile } = await supabaseClient.from('users').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'SuperAdmin') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
    }

    const { community_id } = await req.json()
    if (!community_id) throw new Error('Missing community_id')

    console.log(`Starting deletion for community: ${community_id}`);

    // 3. Fetch User IDs to delete from Auth later
    // We fetch this before deleting public.users
    const { data: usersToDelete } = await supabaseClient
        .from('users')
        .select('id')
        .eq('community_id', community_id);

    const userIds = usersToDelete?.map((u: any) => u.id) || [];

    // 4. Cascade Delete Operations
    // Deleting operational data first to avoid FK constraints if CASCADE is not configured on DB
    const tablesToDelete = [
        'maintenance_records',
        'expenses',
        'complaints',
        'visitors',
        'bookings',
        'notices',
        'audit_logs',
        'community_payments',
        'maintenance_configurations',
        'units' // Links users to community
    ];

    for (const table of tablesToDelete) {
        const { error } = await supabaseClient.from(table).delete().eq('community_id', community_id);
        if (error) console.error(`Error deleting from ${table}:`, error);
    }

    // 5. Delete Users (Public Profiles)
    const { error: usersError } = await supabaseClient.from('users').delete().eq('community_id', community_id);
    if (usersError) throw usersError;

    // 6. Delete Community
    const { error: commError } = await supabaseClient.from('communities').delete().eq('id', community_id);
    if (commError) throw commError;

    // 7. Delete Auth Users (Cleanup Supabase Auth)
    if (userIds.length > 0) {
        for (const uid of userIds) {
            // Safety check: Do not delete the requester (SuperAdmin)
            if (uid === user.id) continue; 
            
            const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(uid);
            if (authDeleteError) console.error(`Failed to delete auth user ${uid}`, authDeleteError);
        }
    }

    return new Response(
      JSON.stringify({ message: 'Community and associated data deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
