
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

    if (commError) throw new Error(`Community Fetch Error: ${commError.message}`);

    // Fetch All Users
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('community_id, role')
      .eq('status', 'active');

    if (usersError) throw new Error(`User Aggregation Error: ${usersError.message}`);

    const now = new Date();
    const startOfMonth = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString();
    
    let totalPaidMap: Record<string, number> = {};

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
    } catch (ignore) {}

    try {
        const { data: auditData, error: auditError } = await supabaseClient
            .from('audit_logs')
            .select('community_id, details')
            .eq('entity', 'Billing')
            .eq('action', 'UPDATE')
            .gte('created_at', startOfMonth);

        if (!auditError && auditData) {
            auditData.forEach((log: any) => {
                if (log.details && log.details.amount) {
                     totalPaidMap[log.community_id] = (totalPaidMap[log.community_id] || 0) + (Number(log.details.amount) || 0);
                }
            });
        }
    } catch (ignore) {}

    const stats = communities.map((community: any) => {
      const communityUsers = users.filter((u: any) => u.community_id === community.id);
      const resident_count = communityUsers.filter((u: any) => u.role === 'Resident').length;
      const admin_count = communityUsers.filter((u: any) => u.role === 'Admin').length;
      const staff_count = communityUsers.filter((u: any) => ['HelpdeskAdmin', 'Helpdesk', 'HelpdeskAgent', 'SecurityAdmin', 'Security'].includes(u.role)).length;
      const current_month_paid = totalPaidMap[community.id] || 0;

      return {
        ...community,
        resident_count,
        admin_count,
        staff_count,
        current_month_paid
      };
    });

    return new Response(
      JSON.stringify({ data: stats }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Stats Aggregator Crash:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
