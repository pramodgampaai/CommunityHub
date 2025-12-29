
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Declare Deno for the environment
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

    // 1. Authenticate Request
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized session')

    const body = await req.json()
    const { action, community_id, data } = body

    if (!action || !community_id) {
        throw new Error("Missing action or community_id");
    }

    // 2. Role Verification (Bypasses RLS recursion by using Service Role)
    const { data: profile, error: profileErr } = await supabaseAdmin
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .single();

    if (profileErr || !profile) throw new Error('User profile not found in registry.');

    const isSuper = profile.role === 'SuperAdmin';
    const isCommAdmin = profile.role === 'Admin' && profile.community_id === community_id;

    if (!isSuper && !isCommAdmin) {
        throw new Error('Unauthorized: Elevated privileges required to modify community data.');
    }

    let resultData = null;
    let auditDesc = "";

    // 3. Action Logic
    switch (action) {
        case 'UPDATE_PROFILE': {
            const updates: any = {};
            if (data.name !== undefined) updates.name = data.name;
            if (data.address !== undefined) updates.address = data.address;
            if (data.community_type !== undefined) updates.community_type = data.community_type;
            if (data.blocks !== undefined) updates.blocks = data.blocks;
            if (data.maintenance_rate !== undefined) updates.maintenance_rate = data.maintenance_rate;
            if (data.fixed_maintenance_amount !== undefined) updates.fixed_maintenance_amount = data.fixed_maintenance_amount;
            if (data.pricing_config !== undefined) updates.pricing_config = data.pricing_config;
            if (data.contact_info !== undefined) updates.contact_info = data.contact_info;
            
            // Financial Column Whitelist
            if (data.opening_balance !== undefined) updates.opening_balance = data.opening_balance;
            if (data.opening_balance_locked !== undefined) updates.opening_balance_locked = data.opening_balance_locked;

            const { data: updated, error: uErr } = await supabaseAdmin
                .from('communities')
                .update(updates)
                .eq('id', community_id)
                .select(); 

            if (uErr) {
                console.error("Update Profile Error:", uErr);
                if (uErr.message.includes('opening_balance') || uErr.code === 'PGRST204') {
                    throw new Error("DATABASE_MISMATCH: The 'opening_balance' column is missing from your 'communities' table. Please run the provided SQL migration script in your Supabase SQL Editor.");
                }
                throw uErr;
            }
            resultData = updated?.[0];
            auditDesc = "Community profile configuration updated.";
            break;
        }

        case 'SET_INITIAL_BALANCE': {
            // WHITESPACE: Using update without .select() to avoid PostgREST cache issues
            const { error: bErr } = await supabaseAdmin
                .from('communities')
                .update({ 
                    opening_balance: data.balance, 
                    opening_balance_locked: true 
                })
                .eq('id', community_id);

            if (bErr) {
                console.error("Set Initial Balance Error:", bErr);
                if (bErr.message.includes('opening_balance') || bErr.code === 'PGRST204') {
                    throw new Error("COLUMN_NOT_FOUND: The 'opening_balance' column does not exist in your database. Ensure you have run: ALTER TABLE communities ADD COLUMN opening_balance NUMERIC;");
                }
                throw bErr;
            }
            auditDesc = `Initial opening balance secured: ₹${data.balance}`;
            break;
        }

        case 'REQUEST_BALANCE_UPDATE': {
            const { error: rErr } = await supabaseAdmin
                .from('communities')
                .update({ 
                    pending_balance_update: { 
                        amount: data.amount, 
                        reason: data.reason, 
                        requesterId: user.id, 
                        requesterName: data.requesterName 
                    } 
                })
                .eq('id', community_id);

            if (rErr) throw rErr;
            auditDesc = `Modification request for opening balance submitted: ₹${data.amount}`;
            break;
        }

        case 'APPROVE_BALANCE_UPDATE': {
            const { error: aErr } = await supabaseAdmin
                .from('communities')
                .update({ 
                    opening_balance: data.amount, 
                    pending_balance_update: null 
                })
                .eq('id', community_id);

            if (aErr) throw aErr;
            auditDesc = `Opening balance modification approved and applied: ₹${data.amount}`;
            break;
        }

        case 'REJECT_BALANCE_UPDATE': {
            const { error: jErr } = await supabaseAdmin
                .from('communities')
                .update({ pending_balance_update: null })
                .eq('id', community_id);

            if (jErr) throw jErr;
            auditDesc = "Opening balance modification request rejected.";
            break;
        }

        default:
            throw new Error(`Unsupported action: ${action}`);
    }

    // 4. Audit Trail
    try {
        await supabaseAdmin.from('audit_logs').insert({
            community_id: community_id,
            actor_id: user.id,
            action: 'UPDATE',
            entity: 'Community',
            entity_id: community_id,
            details: { description: auditDesc, action_type: action }
        });
    } catch (e) {
        console.warn("Non-critical: Audit logging failed", e);
    }

    return new Response(
      JSON.stringify({ success: true, message: "Action completed successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error(`Edge Function Error (manage-community): ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
