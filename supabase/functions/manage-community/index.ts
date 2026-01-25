
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
    if (!authHeader) throw new Error('Missing Authorization header')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized session')

    const body = await req.json()
    const { action, community_id, data } = body

    if (!action) throw new Error("Missing action");

    const { data: profile } = await supabaseAdmin
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .single();

    if (!profile) throw new Error('User profile not found');

    // Robust Mapping Layer: Frontend camelCase -> Database snake_case
    const mapToDb = (input: any) => {
        if (!input) return input;
        const mapped: any = { ...input };
        
        // Map 'communityType' to 'community_type'
        if (input.communityType !== undefined) {
            mapped.community_type = input.communityType;
            delete mapped.communityType;
        } else if (input.type !== undefined && action === 'CREATE') {
            // Fallback for some creation payloads
            mapped.community_type = input.type;
            delete mapped.type;
        }
        
        // Map 'pricePerUser' to 'pricing_config'
        if (input.pricePerUser !== undefined) {
            mapped.pricing_config = input.pricePerUser;
            delete mapped.pricePerUser;
        }
        
        // Maintenance Settings maps
        if (input.maintenanceRate !== undefined) {
            mapped.maintenance_rate = input.maintenanceRate;
            delete mapped.maintenanceRate;
        }
        if (input.fixedMaintenanceAmount !== undefined) {
            mapped.fixed_maintenance_amount = input.fixedMaintenanceAmount;
            delete mapped.fixedMaintenanceAmount;
        }
        
        // Opening balance maps
        if (input.openingBalance !== undefined) {
            mapped.opening_balance = input.openingBalance;
            delete mapped.openingBalance;
        }
        if (input.openingBalanceLocked !== undefined) {
            mapped.opening_balance_locked = input.openingBalanceLocked;
            delete mapped.openingBalanceLocked;
        }
        
        return mapped;
    };

    let resultData = null;
    let auditDesc = "";

    switch (action) {
        case 'CREATE': {
            if (profile.role !== 'SuperAdmin') throw new Error('Unauthorized: Only SuperAdmins can register communities');
            
            const payload = mapToDb(data);
            const { data: community, error: cErr } = await supabaseAdmin
                .from('communities')
                .insert(payload)
                .select()
                .single();

            if (cErr) throw cErr;
            resultData = community;
            auditDesc = `Community infrastructure initialized: ${community.name}`;
            break;
        }

        case 'UPDATE_PROFILE': {
            if (profile.role !== 'SuperAdmin' && (profile.role !== 'Admin' || profile.community_id !== community_id)) {
                throw new Error('Unauthorized community modification attempt');
            }
            
            const payload = mapToDb(data);
            const { data: updated, error: uErr } = await supabaseAdmin
                .from('communities')
                .update(payload)
                .eq('id', community_id)
                .select()
                .single();

            if (uErr) throw uErr;
            resultData = updated;
            auditDesc = "Community profile attributes updated.";
            break;
        }

        case 'SET_INITIAL_BALANCE': {
            if (profile.role !== 'Admin' || profile.community_id !== community_id) throw new Error('Unauthorized');
            const { error: bErr } = await supabaseAdmin
                .from('communities')
                .update({ opening_balance: data.balance, opening_balance_locked: true })
                .eq('id', community_id);
            if (bErr) throw bErr;
            auditDesc = `Opening balance locked at ₹${data.balance}`;
            break;
        }

        case 'REQUEST_BALANCE_UPDATE': {
            const { error: rErr } = await supabaseAdmin
                .from('communities')
                .update({ 
                    pending_balance_update: { 
                        amount: data.amount, reason: data.reason, 
                        requesterId: user.id, requesterName: data.requesterName 
                    } 
                })
                .eq('id', community_id);
            if (rErr) throw rErr;
            auditDesc = `Ledger adjustment requested: ₹${data.amount}`;
            break;
        }

        case 'APPROVE_BALANCE_UPDATE': {
            const { error: aErr } = await supabaseAdmin
                .from('communities')
                .update({ opening_balance: data.amount, pending_balance_update: null })
                .eq('id', community_id);
            if (aErr) throw aErr;
            auditDesc = `Ledger adjustment approved: ₹${data.amount}`;
            break;
        }

        case 'REJECT_BALANCE_UPDATE': {
            const { error: jErr } = await supabaseAdmin.from('communities').update({ pending_balance_update: null }).eq('id', community_id);
            if (jErr) throw jErr;
            auditDesc = "Ledger adjustment request discarded.";
            break;
        }
    }

    // Audit Logging
    const targetId = community_id || resultData?.id;
    if (targetId && auditDesc) {
        await supabaseAdmin.from('audit_logs').insert({
            community_id: targetId, actor_id: user.id, action: 'UPDATE', entity: 'Community', entity_id: targetId, details: { description: auditDesc }
        });
    }

    return new Response(JSON.stringify({ success: true, data: resultData }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });

  } catch (error: any) {
    console.error("Manage Community Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})
