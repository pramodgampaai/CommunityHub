
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    if (authError || !user) throw new Error('Invalid or expired session token')

    // Fetch Profile for Role Check
    const { data: profile, error: profileErr } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .single()

    if (profileErr || !profile) {
        throw new Error('User registry verification failed. Please re-login.');
    }

    const allowedRoles = ['Admin', 'SuperAdmin'];
    if (!allowedRoles.includes(profile.role)) {
        throw new Error('Unauthorized: Administrative privileges required.');
    }

    const body = await req.json()
    const { action, id, data } = body
    if (!action) throw new Error('Action identifier missing')

    let resultData = null;
    let auditDesc = "";

    // Strictly whitelist columns to avoid PostgREST cache errors (PGRST204)
    const mapToSnakeCase = (input: any) => {
        if (!input) return {};
        const mapped: any = {};
        if (input.name !== undefined) mapped.name = input.name;
        if (input.description !== undefined) mapped.description = input.description;
        
        // Handle both camelCase and snake_case variants from frontend
        const img = input.image_url || input.imageUrl;
        if (img !== undefined) mapped.image_url = img;
        
        const cap = input.capacity !== undefined ? input.capacity : input.capacity;
        if (cap !== undefined) mapped.capacity = Number(cap);
        
        const dur = input.max_duration !== undefined ? input.max_duration : input.maxDuration;
        if (dur !== undefined) mapped.max_duration = Number(dur);
        
        if (input.community_id !== undefined) mapped.community_id = input.community_id;
        else if (input.communityId !== undefined) mapped.community_id = input.communityId;
        
        if (input.status !== undefined) mapped.status = input.status;
        
        return mapped;
    };

    if (action === 'CREATE') {
        const payload = mapToSnakeCase(data);
        if (!payload.community_id) payload.community_id = profile.community_id;
        
        const { data: amenity, error: createError } = await supabaseClient
            .from('amenities')
            .insert(payload)
            .select()
            .single();

        if (createError) throw createError;
        resultData = amenity;
        auditDesc = `Facility Registered: ${payload.name}`;

    } else if (action === 'UPDATE') {
        if (!id) throw new Error('Target identifier (ID) missing for update');
        
        const updates = mapToSnakeCase(data);
        
        const { data: updated, error: updateError } = await supabaseClient
            .from('amenities')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;
        resultData = updated;
        auditDesc = `Facility Configuration Modified: ${updated.name}`;

    } else if (action === 'DELETE') {
        if (!id) throw new Error('Target identifier (ID) missing for deletion');
        
        const { data: old } = await supabaseClient.from('amenities').select('name').eq('id', id).single();

        const { error: deleteError } = await supabaseClient
            .from('amenities')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;
        auditDesc = `Facility Decommissioned: ${old?.name || id}`;
    }

    // Server-side Audit Logging
    try {
        await supabaseClient.from('audit_logs').insert({
            community_id: profile.community_id,
            actor_id: user.id,
            action: action === 'CREATE' ? 'CREATE' : (action === 'DELETE' ? 'DELETE' : 'UPDATE'),
            entity: 'Amenity',
            entity_id: id || resultData?.id || 'event',
            details: { 
                description: auditDesc,
                data: action === 'DELETE' ? null : data 
            }
        });
    } catch (e) {
        console.warn("Audit registry sync failed (non-fatal):", e.message);
    }

    return new Response(
      JSON.stringify({ success: true, data: resultData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("CRITICAL AMENITY FAILURE:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal processing error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
