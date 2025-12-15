
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

    // 1. Auth Check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token')

    // 2. Fetch User Profile to check permissions
    const { data: profile } = await supabaseClient.from('users').select('role').eq('id', user.id).single()
    if (!profile || profile.role !== 'SuperAdmin') {
        return new Response(
            JSON.stringify({ error: 'Unauthorized: Only Platform Owners can record community payments.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
        );
    }

    // 3. Parse Body
    const { communityId, amount, date, receiptUrl, notes, recordedBy } = await req.json();

    if (!communityId || amount === undefined || amount === null || !date) {
        throw new Error('Missing required payment fields.');
    }

    // 4. Insert Payment Record
    const { error: insertError } = await supabaseClient
        .from('community_payments')
        .insert({
            community_id: communityId,
            amount: amount,
            payment_date: date,
            receipt_url: receiptUrl,
            notes: notes,
            recorded_by: recordedBy || user.id
        });

    if (insertError) {
        console.warn("Payment insert failed, falling back to audit log:", insertError);
        
        // Fallback: Log to audit_logs so the record isn't lost
        // This handles cases where the table doesn't exist or other DB constraints fail
        const { error: auditError } = await supabaseClient.from('audit_logs').insert({
            community_id: communityId,
            actor_id: user.id,
            action: 'UPDATE', // Categorize as Update to Billing
            entity: 'Billing',
            entity_id: 'payment_fallback_' + Date.now(),
            details: { 
                description: `Payment of ${amount} recorded (Fallback: ${insertError.message || insertError.code})`,
                amount: amount,
                receiptUrl: receiptUrl,
                notes: notes,
                originalError: insertError
            }
        });

        if (auditError) {
            console.error("Audit log fallback also failed:", auditError);
            throw insertError; // Throw original error if even fallback fails
        }
        
        return new Response(
            JSON.stringify({ message: 'Payment recorded (Audit Log Fallback)' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    return new Response(
      JSON.stringify({ message: 'Payment recorded successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
