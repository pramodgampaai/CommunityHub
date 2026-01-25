
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Auth required');
    
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) throw new Error('Invalid token');

    const body = await req.json()
    const { action, id, data, communityId, status } = body
    if (!action) throw new Error('Missing action')

    const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role, community_id, name, flat_number')
        .eq('id', user.id)
        .single()
        
    if (!profile) throw new Error('User registry missing');

    let resultData = null;
    let auditDesc = "";

    if (action === 'LIST_LISTINGS') {
        const targetId = communityId || profile.community_id;
        const { data: listings, error: fetchErr } = await supabaseAdmin
            .from('real_estate_listings')
            .select('*, units(flat_number, block, flat_size, floor), users!owner_id(name, flat_number)')
            .eq('community_id', targetId)
            .order('created_at', { ascending: false });
            
        if (fetchErr) throw fetchErr;
        
        resultData = listings.map((l: any) => ({
            ...l,
            owner_name: l.users?.name,
            owner_flat: l.users?.flat_number,
            unit_flat: l.units?.flat_number,
            unit_block: l.units?.block,
            unit_size: l.units?.flat_size,
            unit_floor: l.units?.floor
        }));

    } else if (action === 'CREATE_LISTING') {
        const { data: listing, error: createError } = await supabaseAdmin
            .from('real_estate_listings')
            .insert({
                owner_id: user.id,
                unit_id: data.unitId,
                community_id: profile.community_id,
                rent_amount: data.rentAmount,
                deposit_amount: data.depositAmount,
                available_from: data.availableFrom,
                furnishing_status: data.furnishingStatus,
                description: data.description,
                image_url: data.imageUrl,
                status: 'Active'
            })
            .select()
            .single();

        if (createError) throw createError;
        resultData = listing;
        auditDesc = `Listed property for rent: Unit ${data.unitId}`;

    } else if (action === 'UPDATE_STATUS') {
        const { error: updateError } = await supabaseAdmin
            .from('real_estate_listings')
            .update({ status })
            .eq('id', id)
            .eq('owner_id', user.id);

        if (updateError) throw updateError;
        auditDesc = `Updated rental status for ${id} to ${status}`;
    }

    // Audit Logging
    if (auditDesc) {
        try {
            await supabaseAdmin.from('audit_logs').insert({
                community_id: profile.community_id,
                actor_id: user.id,
                action: 'UPDATE',
                entity: 'RealEstate',
                entity_id: id || resultData?.id || 'event',
                details: { description: auditDesc }
            });
        } catch (e) { console.warn("Audit log failed", e); }
    }

    return new Response(
      JSON.stringify({ success: true, data: resultData }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
