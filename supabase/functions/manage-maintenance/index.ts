
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const authHeader = req.headers.get('Authorization')
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader?.replace('Bearer ', '') || '')
    if (!user) throw new Error('Unauthorized');

    const { action, id, data } = await req.json()
    const { data: profile } = await supabaseAdmin.from('users').select('role, community_id').eq('id', user.id).single();
    if (!profile) throw new Error('Profile not found');

    if (action === 'SUBMIT_PAYMENT') {
        const { error } = await supabaseAdmin.from('maintenance_records')
            .update({ 
                status: 'Submitted', 
                payment_receipt_url: data.receiptUrl, 
                upi_transaction_id: data.upiId, 
                transaction_date: data.date 
            })
            .eq('id', id)
            .eq('user_id', user.id); // Security: Can only submit for own record
        if (error) throw error;
    } else if (action === 'VERIFY_PAYMENT') {
        if (!['Admin', 'SuperAdmin', 'HelpdeskAdmin'].includes(profile.role)) throw new Error('Permission denied');
        
        // Logical Guard: Prevent self-verification
        const { data: record } = await supabaseAdmin.from('maintenance_records').select('user_id').eq('id', id).single();
        if (record?.user_id === user.id) throw new Error('Integrity Violation: You cannot verify your own payments.');

        const { error } = await supabaseAdmin.from('maintenance_records').update({ status: 'Paid' }).eq('id', id);
        if (error) throw error;
        
        await supabaseAdmin.from('audit_logs').insert({
            community_id: profile.community_id, actor_id: user.id, action: 'UPDATE', entity: 'MaintenanceRecord', entity_id: id, details: { description: `Payment verified for record ${id}` }
        });
    }

    return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})
