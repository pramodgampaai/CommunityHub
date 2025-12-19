
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

    const { data: profile } = await supabaseClient.from('users').select('role').eq('id', user.id).single();
    const role = profile?.role ? profile.role.toLowerCase() : '';

    const { data: oldComplaint, error: fetchError } = await supabaseClient.from('complaints').select('*').eq('id', id).single();
    if (fetchError || !oldComplaint) throw new Error('Complaint not found');

    const isAdmin = role === 'admin' || role === 'superadmin' || role === 'helpdeskadmin';
    const isAgent = role === 'helpdeskagent';

    if (isAgent) {
        const isAssignedToSelf = oldComplaint.assigned_to === user.id;
        const isUnassigned = oldComplaint.assigned_to === null;
        if (status && !isAssignedToSelf && !isUnassigned) throw new Error('You can only update status of your own tickets');
        if (assigned_to && assigned_to !== user.id) throw new Error('Agents cannot reassign tickets to others');
    }

    const updates: any = {};
    let auditDesc = "Complaint updated";
    if (status) {
        updates.status = status;
        auditDesc = `Status transitioned to ${status}`;
    }
    if (assigned_to) {
        updates.assigned_to = assigned_to;
        auditDesc = assigned_to === user.id ? "Ticket claimed by staff" : "Ticket routed to new agent";
    }

    const { data: updated, error: updateError } = await supabaseClient
        .from('complaints')
        .update(updates)
        .eq('id', id)
        .select('*, assigned_user:users!assigned_to(name)')
        .single();

    if (updateError) throw updateError;

    // Record Event in Audit Logs for Trace
    await supabaseClient.from('audit_logs').insert({
        community_id: updated.community_id,
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'Complaint',
        entity_id: id,
        details: { 
            description: auditDesc, 
            old: { status: oldComplaint.status, assigned_to: oldComplaint.assigned_to }, 
            new: { status: updated.status, assigned_to: updated.assigned_to } 
        }
    });

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
