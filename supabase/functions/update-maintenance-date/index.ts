


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

    const { user_id, maintenance_start_date, community_id, unit_id } = await req.json()

    if (!user_id || !maintenance_start_date || !community_id || !unit_id) {
      throw new Error('Missing required fields: unit_id is required now.')
    }

    // Check Auth (Admin Only)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const { data: { user: requesterAuth } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!requesterAuth) throw new Error('Invalid token');

    // 1. Update the UNIT Record (Not User)
    const { error: updateError } = await supabaseClient
        .from('units')
        .update({ maintenance_start_date })
        .eq('id', unit_id);

    if (updateError) throw updateError;

    // 2. Fetch Unit Details
    const { data: targetUnit } = await supabaseClient
        .from('units')
        .select('flat_size')
        .eq('id', unit_id)
        .single();

    const { data: community } = await supabaseClient
        .from('communities')
        .select('*')
        .eq('id', community_id)
        .single();

    // 3. Recalculate Logic
    if (targetUnit && community) {
        let monthlyAmount = 0;
        const type = community.community_type ? community.community_type.toLowerCase() : 'high-rise apartment';
        
        // Check for 'standalone' or 'standalone apartment'
        if (type.includes('standalone')) {
            monthlyAmount = Number(community.fixed_maintenance_amount) || 0;
        } else {
            monthlyAmount = (Number(community.maintenance_rate) || 0) * (Number(targetUnit.flat_size) || 0);
        }

        if (monthlyAmount > 0) {
            const startDate = new Date(maintenance_start_date);
            const year = startDate.getFullYear();
            const month = startDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const daysRemaining = daysInMonth - startDate.getDate() + 1;
            const proRataAmount = Math.round((monthlyAmount / daysInMonth) * daysRemaining);

            if (proRataAmount > 0) {
                const periodDate = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];

                const { data: existingRecord } = await supabaseClient
                    .from('maintenance_records')
                    .select('id')
                    .eq('unit_id', unit_id) // Check by Unit ID
                    .eq('period_date', periodDate)
                    .single();

                if (existingRecord) {
                     await supabaseClient.from('maintenance_records')
                        .update({ amount: proRataAmount, status: 'Pending' })
                        .eq('id', existingRecord.id);
                } else {
                    await supabaseClient.from('maintenance_records').insert({
                        user_id: user_id,
                        unit_id: unit_id,
                        community_id: community_id,
                        amount: proRataAmount,
                        period_date: periodDate,
                        status: 'Pending'
                    });
                }
            }
        }
    }

    return new Response(
      JSON.stringify({ message: 'Date updated and maintenance calculated.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})