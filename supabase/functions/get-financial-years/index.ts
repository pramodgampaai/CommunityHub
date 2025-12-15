
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

    const yearsSet = new Set<number>();
    const currentYear = new Date().getFullYear();

    // 1. Fetch years from community_payments
    // Note: In a large scale production app, this should use a specific RPC to get DISTINCT years
    // directly from DB to avoid fetching all rows. For this scope, fetching 'payment_date' is acceptable.
    const { data: payments } = await supabaseClient
      .from('community_payments')
      .select('payment_date');
    
    if (payments) {
      payments.forEach((p: any) => {
        if (p.payment_date) yearsSet.add(new Date(p.payment_date).getFullYear());
      });
    }

    // 2. Fetch years from audit_logs (fallback mechanism)
    const { data: logs } = await supabaseClient
      .from('audit_logs')
      .select('created_at')
      .eq('entity', 'Billing')
      .eq('action', 'UPDATE');

    if (logs) {
      logs.forEach((l: any) => {
        if (l.created_at) yearsSet.add(new Date(l.created_at).getFullYear());
      });
    }

    // Always include current year if list is empty, or ensure it's an option if no data exists yet
    if (yearsSet.size === 0) {
        yearsSet.add(currentYear);
    }

    const sortedYears = Array.from(yearsSet).sort((a, b) => b - a);

    return new Response(
      JSON.stringify({ years: sortedYears }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
