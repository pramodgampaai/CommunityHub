
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
    const { action, id, data, communityId, userId, itemId, rentalId, otherUserId } = body
    if (!action) throw new Error('Missing action')

    const { data: profile, error: profileErr } = await supabaseAdmin
        .from('users')
        .select('role, community_id, name, flat_number')
        .eq('id', user.id)
        .single()
        
    if (profileErr || !profile) throw new Error('User profile registry missing');

    let resultData = null;
    let auditDesc = "";

    if (action === 'LIST_ITEMS') {
        const targetId = communityId || profile.community_id;
        const { data: items, error: fetchErr } = await supabaseAdmin
            .from('marketplace_items')
            .select('*')
            .eq('community_id', targetId)
            .order('created_at', { ascending: false });
            
        if (fetchErr) throw fetchErr;
        resultData = items;

    } else if (action === 'LIST_MESSAGES') {
        const targetUserId = userId || user.id;
        const { data: msgs, error: msgErr } = await supabaseAdmin
            .from('marketplace_messages')
            .select('*, marketplace_items(title), real_estate_listings(rent_amount)')
            .or(`sender_id.eq.${targetUserId},receiver_id.eq.${targetUserId}`)
            .order('created_at', { ascending: false });
            
        if (msgErr) throw msgErr;
        
        resultData = msgs.map((m: any) => ({
            ...m,
            item_title: m.marketplace_items?.title || 'Marketplace Item',
            rental_title: m.real_estate_listings ? `Property Rental (₹${m.real_estate_listings.rent_amount})` : 'Property Listing'
        }));

    } else if (action === 'SEND_MESSAGE') {
        if ((!data.itemId && !data.rentalId) || !data.receiverId || !data.message) {
            throw new Error('Incomplete message payload');
        }

        const { error: msgError } = await supabaseAdmin
            .from('marketplace_messages')
            .insert({
                item_id: data.itemId || null,
                rental_id: data.rentalId || null,
                sender_id: user.id,
                sender_name: profile.name || 'Resident',
                sender_flat: profile.flat_number || 'N/A',
                receiver_id: data.receiverId,
                message: data.message,
                is_read: false
            });

        if (msgError) throw new Error(`Failed to transmit message: ${msgError.message}`);
        resultData = { success: true };

    } else if (action === 'MARK_READ') {
        if (!otherUserId) throw new Error('Missing parameters for MARK_READ');
        
        let query = supabaseAdmin
            .from('marketplace_messages')
            .update({ is_read: true })
            .eq('receiver_id', user.id)
            .eq('sender_id', otherUserId);
            
        if (itemId) query = query.eq('item_id', itemId);
        if (rentalId) query = query.eq('rental_id', rentalId);
            
        const { error: updateErr } = await query;
        if (updateErr) throw updateErr;
        resultData = { success: true };

    } else if (action === 'CREATE_ITEM') {
        const { data: item, error: createError } = await supabaseAdmin
            .from('marketplace_items')
            .insert({
                seller_id: user.id,
                seller_name: profile.name || 'Resident',
                seller_flat: profile.flat_number || 'N/A',
                community_id: profile.community_id,
                title: data.title,
                description: data.description,
                price: data.price,
                category: data.category,
                image_url: data.imageUrl,
                status: 'Active'
            })
            .select()
            .single();

        if (createError) throw createError;
        resultData = item;
        auditDesc = `Listed item: ${data.title}`;

    } else if (action === 'MARK_SOLD') {
        const { error: updateError } = await supabaseAdmin
            .from('marketplace_items')
            .update({ status: 'Sold' })
            .eq('id', id)
            .eq('seller_id', user.id);

        if (updateError) throw updateError;
        auditDesc = `Marked item ${id} as sold`;
    }

    if (auditDesc) {
        try {
            await supabaseAdmin.from('audit_logs').insert({
                community_id: profile.community_id, actor_id: user.id, action: 'UPDATE', entity: 'Marketplace', entity_id: id || resultData?.id || 'event', details: { description: auditDesc }
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
