
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

    // Fetch Communities
    const { data: communities, error: commError } = await supabaseClient
      .from('communities')
      .select('*')
      .order('name');

    if (commError) throw commError;

    // Fetch All Users (Lightweight: only need role and community_id)
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('community_id, role')
      .eq('status', 'active');

    if (usersError) throw usersError;

    // --- Payment Calculation (Robust) ---
    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
    
    let totalPaidMap: Record<string, number> = {};

    // 1. Try fetching from 'community_payments' table
    try {
        const { data: payData, error: payError } = await supabaseClient
            .from('community_payments')
            .select('community_id, amount')
            .gte('payment_date', startOfMonth);
            
        if (!payError && payData) {
            payData.forEach((p: any) => {
                totalPaidMap[p.community_id] = (totalPaidMap[p.community_id] || 0) + (Number(p.amount) || 0);
            });
        }
    } catch (ignore) {
        // Table might not exist yet, ignore error to prevent crash
    }

    // 2. Try fetching from 'audit_logs' (Fallback for missing table or failed inserts)
    // The record-payment function writes to audit_logs if the main table fails.
    try {
        const { data: auditData, error: auditError } = await supabaseClient
            .from('audit_logs')
            .select('community_id, details')
            .eq('entity', 'Billing')
            .eq('action', 'UPDATE')
            .gte('created_at', startOfMonth);

        if (!auditError && auditData) {
            auditData.forEach((log: any) => {
                // Only count if it has an amount in details (format used by fallback)
                if (log.details && log.details.amount) {
                     totalPaidMap[log.community_id] = (totalPaidMap[log.community_id] || 0) + (Number(log.details.amount) || 0);
                }
            });
        }
    } catch (ignore) {}

    // Aggregation Logic
    const stats = communities.map((community: any) => {
      const communityUsers = users.filter((u: any) => u.community_id === community.id);
      
      const resident_count = communityUsers.filter((u: any) => u.role === 'Resident').length;
      const admin_count = communityUsers.filter((u: any) => u.role === 'Admin').length;
      
      // Granular Counts
      const helpdesk_admin_count = communityUsers.filter((u: any) => u.role === 'HelpdeskAdmin' || u.role === 'Helpdesk').length;
      const security_admin_count = communityUsers.filter((u: any) => u.role === 'SecurityAdmin').length;

      // Full Staff Count for Billing
      const staff_count = communityUsers.filter((u: any) => 
          u.role === 'HelpdeskAdmin' || 
          u.role === 'Helpdesk' ||
          u.role === 'HelpdeskAgent' || 
          u.role === 'SecurityAdmin' ||
          u.role === 'Security'
      ).length;

      // Use the aggregated sum from both sources
      const current_month_paid = totalPaidMap[community.id] || 0;

      return {
        ...community,
        resident_count,
        admin_count,
        helpdesk_count: helpdesk_admin_count, 
        security_count: security_admin_count,
        staff_count,
        income_generated: 0,
        current_month_paid
      };
    });

    return new Response(
      JSON.stringify({ data: stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
