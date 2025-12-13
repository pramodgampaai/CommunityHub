
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

    const { id, status, assigned_to } = await req.json()
    if (!id) throw new Error('Missing complaint ID')

    // Fetch User Role from Profile
    const { data: profile } = await supabaseClient.from('users').select('role').eq('id', user.id).single();
    const role = profile?.role ? profile.role.toLowerCase() : '';

    // Fetch Existing Complaint to verify permissions
    const { data: complaint, error: fetchError } = await supabaseClient.from('complaints').select('*').eq('id', id).single();
    
    if (fetchError || !complaint) throw new Error('Complaint not found');

    // Permission Logic
    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'helpdeskadmin';
    const isAgent = role === 'helpdeskagent';

    if (!isAdmin && !isAgent) {
        // Allow resident to update status to "Resolved" if it's their own complaint? 
        // For now, strict check based on original request context (Agents failing).
        // If resident, check ownership
        if (complaint.user_id !== user.id) throw new Error('Unauthorized');
    }

    if (isAgent) {
        const isAssignedToSelf = complaint.assigned_to === user.id;
        const isUnassigned = complaint.assigned_to === null;

        // 1. Changing Status
        if (status) {
            // Can update status if assigned to self OR if unassigned (cherry picking process)
            if (!isAssignedToSelf && !isUnassigned) {
                throw new Error('You can only update status of your own tickets');
            }
        }

        // 2. Changing Assignment
        if (assigned_to) {
            // Can assign to self if unassigned
            if (isUnassigned && assigned_to === user.id) {
                // Allowed (Claiming)
            } else if (isAssignedToSelf && assigned_to !== user.id) {
                // Agent re-assigning? Allow for flexibility or block? 
                // Let's block to keep it strict: Only Admins dispatch.
                throw new Error('Agents cannot reassign tickets to others');
            } else if (!isAssignedToSelf && !isUnassigned) {
                 throw new Error('Cannot change assignment of this ticket');
            }
        }
    }

    // Perform Update via Service Role
    const updates: any = {};
    if (status) updates.status = status;
    if (assigned_to) updates.assigned_to = assigned_to;

    const { data: updated, error: updateError } = await supabaseClient
        .from('complaints')
        .update(updates)
        .eq('id', id)
        .select('*, assigned_user:users!assigned_to(name)')
        .single();

    if (updateError) throw updateError;

    return new Response(
      JSON.stringify({ data: updated }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
