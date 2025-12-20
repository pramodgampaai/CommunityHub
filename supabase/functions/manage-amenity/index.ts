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

    // Fetch Profile for Role Check
    const { data: profile } = await supabaseClient.from('users').select('role, community_id').eq('id', user.id).single()
    const allowedRoles = ['Admin', 'SuperAdmin'];
    if (!profile || !allowedRoles.includes(profile.role)) {
        throw new Error('Unauthorized: Insufficient permissions to manage amenities')
    }

    const { action, id, data } = await req.json()
    if (!action) throw new Error('Missing action')

    let resultData = null;
    let auditDesc = "";

    // Strictly whitelist columns to avoid PostgREST cache errors (PGRST204)
    const mapToSnakeCase = (input: any) => {
        const mapped: any = {};
        if (input.name !== undefined) mapped.name = input.name;
        if (input.description !== undefined) mapped.description = input.description;
        
        // Handle both camelCase and snake_case variants from frontend
        const img = input.image_url || input.imageUrl;
        if (img !== undefined) mapped.image_url = img;
        
        if (input.capacity !== undefined) mapped.capacity = input.capacity;
        
        const dur = input.max_duration || input.maxDuration;
        if (dur !== undefined) mapped.max_duration = dur;
        
        if (input.community_id !== undefined) mapped.community_id = input.community_id;
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
        auditDesc = `Amenity created: ${payload.name}`;

    } else if (action === 'UPDATE') {
        if (!id) throw new Error('Missing ID for update');
        
        const updates = mapToSnakeCase(data);
        
        const { data: updated, error: updateError } = await supabaseClient
            .from('amenities')
            .update(updates)
            .eq('id', id)
            .select()
            .single();

        if (updateError) throw updateError;
        resultData = updated;
        auditDesc = `Amenity updated: ${updated.name}`;

    } else if (action === 'DELETE') {
        if (!id) throw new Error('Missing ID for delete');
        
        const { data: old } = await supabaseClient.from('amenities').select('name').eq('id', id).single();

        const { error: deleteError } = await supabaseClient
            .from('amenities')
            .delete()
            .eq('id', id);

        if (deleteError) throw deleteError;
        auditDesc = `Amenity deleted: ${old?.name || id}`;
    }

    // Server-side Audit Logging
    try {
        await supabaseClient.from('audit_logs').insert({
            community_id: profile.community_id,
            actor_id: user.id,
            action,
            entity: 'Amenity',
            entity_id: id || resultData?.id || 'unknown',
            details: { 
                description: auditDesc,
                data: action === 'DELETE' ? null : data 
            }
        });
    } catch (e) {
        console.warn("Audit logging failed during amenity management", e);
    }

    return new Response(
      JSON.stringify({ success: true, data: resultData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Manage Amenity Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})