
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

    const body = await req.json()
    const { action, id, data } = body

    if (!action) throw new Error('Missing action')

    // Fetch Requester Profile for validation
    const { data: profile } = await supabaseClient.from('users').select('role, community_id').eq('id', user.id).single()
    if (!profile) throw new Error('User profile not found')

    let resultData = null
    let auditDesc = ""

    // Helper to map camelCase to snake_case for DB
    const mapToSnakeCase = (input: any) => {
        const mapped: any = { ...input };
        if (input.visitorType) { mapped.visitor_type = input.visitorType; delete mapped.visitorType; }
        if (input.expectedAt) { mapped.expected_at = input.expectedAt; delete mapped.expectedAt; }
        if (input.vehicleNumber !== undefined) { mapped.vehicle_number = input.vehicleNumber; delete mapped.vehicleNumber; }
        return mapped;
    };

    if (action === 'CREATE') {
        const entryToken = Math.random().toString(36).substring(2, 8).toUpperCase();
        const payload = mapToSnakeCase(data);
        
        const { data: visitor, error: createError } = await supabaseClient
            .from('visitors')
            .insert({
                ...payload,
                status: 'Expected',
                entry_token: entryToken,
                community_id: profile.community_id,
                user_id: user.id
            })
            .select()
            .single();

        if (createError) throw createError;
        resultData = visitor;
        auditDesc = `Visitor invite created for: ${visitor.name}`;

    } else if (action === 'UPDATE') {
        if (!id) throw new Error('Missing ID for update');
        const updates = mapToSnakeCase(data);
        
        const { data: updated, error: updateError } = await supabaseClient
            .from('visitors')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;
        resultData = updated;
        auditDesc = `Visitor details updated for: ${updated.name}`;

    } else if (action === 'DELETE') {
        if (!id) throw new Error('Missing ID for delete');
        
        const { data: old } = await supabaseClient.from('visitors').select('name').eq('id', id).single();
        const { error: deleteError } = await supabaseClient.from('visitors').delete().eq('id', id);
        
        if (deleteError) throw deleteError;
        auditDesc = `Visitor invite revoked for: ${old?.name || id}`;
    }

    // Server-side Audit Logging
    try {
        await supabaseClient.from('audit_logs').insert({
            community_id: profile.community_id,
            actor_id: user.id,
            action,
            entity: 'Visitor',
            entity_id: id || resultData?.id || 'unknown',
            details: { description: auditDesc }
        });
    } catch (e) { console.warn("Audit failed", e); }

    return new Response(
      JSON.stringify({ success: true, data: resultData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Manage Visitor Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
