
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

    // Check Role
    const { data: profile } = await supabaseClient.from('users').select('role').eq('id', user.id).single();
    if (profile?.role !== 'SuperAdmin') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { year } = await req.json();
    const targetYear = year || new Date().getFullYear();
    const startDate = new Date(Date.UTC(targetYear, 0, 1)).toISOString();
    const endDate = new Date(Date.UTC(targetYear + 1, 0, 1)).toISOString();

    // Data Structures
    const monthlyData = Array(12).fill(0).map((_, i) => ({ 
        month: new Date(0, i).toLocaleString('default', { month: 'short' }), 
        amount: 0,
        transactionCount: 0 
    }));
    
    const communityTotals: Record<string, number> = {};
    const communityNames: Record<string, string> = {};

    // Helper to process a payment record
    const processPayment = (amount: any, dateStr: string, commId: string) => {
        const val = Number(amount) || 0;
        const date = new Date(dateStr);
        if (date.getFullYear() === targetYear) {
            const monthIdx = date.getMonth();
            monthlyData[monthIdx].amount += val;
            monthlyData[monthIdx].transactionCount += 1;
            
            communityTotals[commId] = (communityTotals[commId] || 0) + val;
        }
    };

    // 1. Fetch Communities for Names
    const { data: communities } = await supabaseClient.from('communities').select('id, name');
    communities?.forEach((c: any) => communityNames[c.id] = c.name);

    // 2. Fetch from 'community_payments' table
    try {
        const { data: payData } = await supabaseClient
            .from('community_payments')
            .select('community_id, amount, payment_date')
            .gte('payment_date', startDate)
            .lt('payment_date', endDate);
            
        if (payData) {
            payData.forEach((p: any) => processPayment(p.amount, p.payment_date, p.community_id));
        }
    } catch (ignore) {}

    // 3. Fetch from 'audit_logs' (Fallback)
    try {
        const { data: auditData } = await supabaseClient
            .from('audit_logs')
            .select('community_id, details, created_at')
            .eq('entity', 'Billing')
            .eq('action', 'UPDATE')
            .gte('created_at', startDate)
            .lt('created_at', endDate);

        if (auditData) {
            auditData.forEach((log: any) => {
                if (log.details && log.details.amount) {
                     processPayment(log.details.amount, log.created_at, log.community_id);
                }
            });
        }
    } catch (ignore) {}

    // 4. Format Output
    const communityBreakdown = Object.entries(communityTotals).map(([id, total]) => ({
        communityName: communityNames[id] || 'Unknown Community',
        totalPaid: total
    })).sort((a, b) => b.totalPaid - a.totalPaid);

    const totalCollected = monthlyData.reduce((acc, curr) => acc + curr.amount, 0);

    return new Response(
      JSON.stringify({ 
          year: targetYear,
          totalCollected,
          monthlyBreakdown: monthlyData,
          communityBreakdown
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
