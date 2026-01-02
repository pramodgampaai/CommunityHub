
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const authHeader = req.headers.get('Authorization')
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader?.replace('Bearer ', '') || '')
    if (!user) throw new Error('Unauthorized');

    const { action, id, data } = await req.json()
    const { data: profile } = await supabaseAdmin.from('users').select('role, community_id').eq('id', user.id).single();
    if (!profile) throw new Error('Profile not found');

    const isAdmin = ['Admin', 'SuperAdmin', 'HelpdeskAdmin'].includes(profile.role);
    if (!isAdmin) throw new Error('Access denied: Staff/Admins only');

    // Internal Mapping Helper to ensure only valid snake_case columns are sent to DB
    const mapExpenseData = (input: any) => {
        const mapped: any = {};
        if (input.title !== undefined) mapped.title = input.title;
        if (input.amount !== undefined) mapped.amount = input.amount;
        if (input.category !== undefined) mapped.category = input.category;
        if (input.description !== undefined) mapped.description = input.description;
        if (input.date !== undefined) mapped.date = input.date;
        
        // Map camelCase receiptUrl to snake_case receipt_url
        if (input.receiptUrl !== undefined) mapped.receipt_url = input.receiptUrl;
        if (input.receipt_url !== undefined) mapped.receipt_url = input.receipt_url;
        
        return mapped;
    };

    if (action === 'CREATE') {
        const insertData = { 
            ...mapExpenseData(data), 
            submitted_by: user.id, 
            community_id: profile.community_id, 
            status: 'Pending' 
        };
        
        const { data: expense, error } = await supabaseAdmin
            .from('expenses')
            .insert(insertData)
            .select()
            .single();
            
        if (error) throw error;
        
        await supabaseAdmin.from('audit_logs').insert({
            community_id: profile.community_id, 
            actor_id: user.id, 
            action: 'CREATE', 
            entity: 'Expense', 
            entity_id: expense.id, 
            details: { description: `Expense logged: ${expense.title}` }
        });
        
    } else if (action === 'APPROVE') {
        // Guard: Prevent self-approval
        const { data: exp } = await supabaseAdmin.from('expenses').select('submitted_by').eq('id', id).single();
        if (exp?.submitted_by === user.id) throw new Error('Integrity Violation: You cannot approve your own expenses.');

        const { error } = await supabaseAdmin.from('expenses').update({ status: 'Approved', approved_by: user.id }).eq('id', id);
        if (error) throw error;
        
        await supabaseAdmin.from('audit_logs').insert({
            community_id: profile.community_id, 
            actor_id: user.id, 
            action: 'UPDATE', 
            entity: 'Expense', 
            entity_id: id, 
            details: { description: `Expense approved for record ${id}` }
        });

    } else if (action === 'REJECT') {
        const { error } = await supabaseAdmin.from('expenses').update({ status: 'Rejected', approved_by: user.id, description: data.reason }).eq('id', id);
        if (error) throw error;
        
        await supabaseAdmin.from('audit_logs').insert({
            community_id: profile.community_id, 
            actor_id: user.id, 
            action: 'UPDATE', 
            entity: 'Expense', 
            entity_id: id, 
            details: { description: `Expense rejected: ${data.reason}` }
        });
    }

    return new Response(
        JSON.stringify({ success: true }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error("Manage Expense Function Error:", error.message);
    return new Response(
        JSON.stringify({ error: error.message }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
