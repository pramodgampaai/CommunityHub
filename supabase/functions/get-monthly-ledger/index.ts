
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

    // 2. Parse Request
    const { community_id, month, year } = await req.json()
    if (!community_id || !month || !year) throw new Error('Missing required fields')

    // 3. Verify Community Access
    const { data: profile } = await supabaseClient.from('users').select('community_id').eq('id', user.id).single();
    if (profile?.community_id !== community_id) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 4. Date Logic
    // Selected Month Start (e.g., 2023-10-01)
    const startDate = new Date(Date.UTC(year, month - 1, 1)).toISOString().split('T')[0];
    
    // Next Month Start (for strictly less than comparisons)
    const nextMonthDate = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];

    // --- AGGREGATION QUERIES ---

    // A. Historical Income (Before this month)
    const { data: prevIncomeData } = await supabaseClient
        .from('maintenance_records')
        .select('amount')
        .eq('community_id', community_id)
        .eq('status', 'Paid')
        .lt('period_date', startDate);
    
    const prevIncome = prevIncomeData?.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) || 0;

    // B. Historical Expenses (Before this month)
    const { data: prevExpenseData } = await supabaseClient
        .from('expenses')
        .select('amount')
        .eq('community_id', community_id)
        .eq('status', 'Approved')
        .lt('date', startDate);

    const prevExpenses = prevExpenseData?.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) || 0;

    // C. This Month Income (Paid)
    // Note: Maintenance records use period_date (usually 1st of month).
    const { data: currIncomeData } = await supabaseClient
        .from('maintenance_records')
        .select('amount')
        .eq('community_id', community_id)
        .eq('status', 'Paid')
        .gte('period_date', startDate)
        .lt('period_date', nextMonthDate);

    const collectedThisMonth = currIncomeData?.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) || 0;

    // D. This Month Pending (Pending or Submitted)
    const { data: currPendingData } = await supabaseClient
        .from('maintenance_records')
        .select('amount')
        .eq('community_id', community_id)
        .neq('status', 'Paid') // Not Paid
        .gte('period_date', startDate)
        .lt('period_date', nextMonthDate);

    const pendingThisMonth = currPendingData?.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) || 0;

    // E. This Month Expenses
    const { data: currExpenseData } = await supabaseClient
        .from('expenses')
        .select('amount')
        .eq('community_id', community_id)
        .eq('status', 'Approved')
        .gte('date', startDate)
        .lt('date', nextMonthDate);

    const expensesThisMonth = currExpenseData?.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0) || 0;

    // --- FINAL CALCULATIONS ---
    const previousBalance = prevIncome - prevExpenses;
    const closingBalance = previousBalance + collectedThisMonth - expensesThisMonth;

    return new Response(
      JSON.stringify({ 
          previousBalance,
          collectedThisMonth,
          pendingThisMonth,
          expensesThisMonth,
          closingBalance
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
