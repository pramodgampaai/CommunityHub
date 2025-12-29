
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
    if (!profile) throw new Error('Profile not found')

    const { action, id, data, community_id } = await req.json()
    if (!action) throw new Error('Missing action')

    // Helper to map camelCase to snake_case
    const mapToDb = (input: any) => {
        const mapped: any = {};
        if (input.name !== undefined) mapped.name = input.name;
        if (input.description !== undefined) mapped.description = input.description;
        if (input.category !== undefined) mapped.category = input.category;
        if (input.quantity !== undefined) mapped.quantity = input.quantity;
        if (input.status !== undefined) mapped.status = input.status;
        if (input.purchaseDate !== undefined) mapped.purchase_date = input.purchaseDate;
        if (input.warrantyExpiry !== undefined) mapped.warranty_expiry = input.warrantyExpiry;
        if (input.nextServiceDate !== undefined) mapped.next_service_date = input.nextServiceDate;
        if (input.communityId !== undefined) mapped.community_id = input.communityId;
        return mapped;
    };

    let resultData = null;
    let auditDesc = "";

    if (action === 'LIST') {
        const targetCommId = community_id || profile.community_id;
        if (profile.role !== 'SuperAdmin' && targetCommId !== profile.community_id) throw new Error('Unauthorized community scope');
        
        const { data: assets, error: fetchError } = await supabaseClient
            .from('assets')
            .select('*')
            .eq('community_id', targetCommId);
            
        if (fetchError) throw fetchError;
        resultData = assets;

    } else {
        // CRUD Operations require Admin role
        if (!['Admin', 'SuperAdmin'].includes(profile.role)) {
            throw new Error('Unauthorized: Admin access required to modify assets');
        }

        if (action === 'CREATE') {
            const payload = mapToDb(data);
            payload.community_id = payload.community_id || profile.community_id;
            
            const { data: asset, error: createError } = await supabaseClient
                .from('assets')
                .insert(payload)
                .select()
                .single();

            if (createError) throw createError;
            resultData = asset;
            auditDesc = `Asset registered: ${payload.name}`;

        } else if (action === 'UPDATE') {
            if (!id) throw new Error('Missing ID for update');
            const updates = mapToDb(data);
            
            const { data: updated, error: updateError } = await supabaseClient
                .from('assets')
                .update(updates)
                .eq('id', id)
                .select()
                .single();

            if (updateError) throw updateError;
            resultData = updated;
            auditDesc = `Asset updated: ${updated.name}`;

        } else if (action === 'DELETE') {
            if (!id) throw new Error('Missing ID for delete');
            const { data: old } = await supabaseClient.from('assets').select('name').eq('id', id).single();
            const { error: deleteError } = await supabaseClient.from('assets').delete().eq('id', id);
            if (deleteError) throw deleteError;
            auditDesc = `Asset removed: ${old?.name || id}`;
        }
    }

    // Server-side Audit Logging for mutations
    if (auditDesc) {
        try {
            await supabaseClient.from('audit_logs').insert({
                community_id: profile.community_id,
                actor_id: user.id,
                action: action === 'CREATE' ? 'CREATE' : (action === 'DELETE' ? 'DELETE' : 'UPDATE'),
                entity: 'Asset',
                entity_id: id || resultData?.id || 'unknown',
                details: { description: auditDesc }
            });
        } catch (e) { console.warn("Audit failed", e); }
    }

    return new Response(
      JSON.stringify({ success: true, data: resultData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
