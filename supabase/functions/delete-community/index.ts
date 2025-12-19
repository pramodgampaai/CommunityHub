
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

    console.log(`Starting deep deletion for community: ${community_id}`);

    // 3. Fetch User IDs to delete from Auth later
    // We fetch this before deleting public.users
    const { data: usersToDelete } = await supabaseClient
        .from('users')
        .select('id')
        .eq('community_id', community_id);

    const userIds = usersToDelete?.map((u: any) => u.id) || [];

    // 4. Cascade Delete Operations (Order matters for some FKs, but we handle errors gracefully)
    const tablesToDelete = [
        'maintenance_records',
        'expenses',
        'complaints',
        'visitors',
        'bookings',
        'amenities', // Added missing table
        'notices',
        'audit_logs',
        'community_payments',
        'maintenance_configurations',
        'units'
    ];

    for (const table of tablesToDelete) {
        try {
            const { error } = await supabaseClient.from(table).delete().eq('community_id', community_id);
            if (error) {
                console.warn(`Non-fatal error deleting from ${table}:`, error.message);
            }
        } catch (e) {
            console.warn(`Exception during deletion from ${table}:`, e);
        }
    }

    // 5. Delete Users (Public Profiles)
    const { error: usersError } = await supabaseClient.from('users').delete().eq('community_id', community_id);
    if (usersError) {
        console.error("Failed to delete public user profiles:", usersError);
        throw new Error(`User profile deletion failed: ${usersError.message}`);
    }

    // 6. Delete Community
    const { error: commError } = await supabaseClient.from('communities').delete().eq('id', community_id);
    if (commError) {
        console.error("Failed to delete community record:", commError);
        throw new Error(`Community record deletion failed: ${commError.message}`);
    }

    // 7. Delete Auth Users (Cleanup Supabase Auth)
    // We do this last so that any errors in DB deletion don't leave orphaned DB rows with no Auth user
    if (userIds.length > 0) {
        console.log(`Cleaning up ${userIds.length} auth users...`);
        for (const uid of userIds) {
            // Safety check: Do not delete the requester (SuperAdmin)
            if (uid === user.id) continue; 
            
            const { error: authDeleteError } = await supabaseClient.auth.admin.deleteUser(uid);
            if (authDeleteError) {
                console.warn(`Failed to delete auth user ${uid}:`, authDeleteError.message);
                // We don't throw here to ensure we finish the rest of the users
            }
        }
    }

    return new Response(
      JSON.stringify({ message: 'Community and associated data deleted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Fatal deletion error:", error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
