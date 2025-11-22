
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
      {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        }
      }
    )

    const { user_id, maintenance_start_date, community_id } = await req.json()

    if (!user_id || !maintenance_start_date || !community_id) {
      throw new Error('Missing required fields')
    }

    // 1. Check Permissions (Requester must be Admin of the community)
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    
    const { data: { user: requesterAuth }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (userError || !requesterAuth) throw new Error('Invalid token');

    const { data: requesterProfile } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', requesterAuth.id)
        .single();

    if (!requesterProfile || (requesterProfile.role !== 'Admin' && requesterProfile.role !== 'SuperAdmin')) {
         if (requesterProfile?.role === 'Admin' && requesterProfile.community_id !== community_id) {
             throw new Error('Unauthorized');
         }
    }

    // 2. Update the User Record
    const { error: updateError } = await supabaseClient
        .from('users')
        .update({ maintenance_start_date })
        .eq('id', user_id);

    if (updateError) throw updateError;

    // 3. Fetch User Details (for Flat Size) and Community Details (for Rates)
    const { data: targetUser } = await supabaseClient
        .from('users')
        .select('flat_size')
        .eq('id', user_id)
        .single();

    const { data: community } = await supabaseClient
        .from('communities')
        .select('*')
        .eq('id', community_id)
        .single();

    // 4. Calculate Pro-Rata Amount
    if (targetUser && community) {
        let monthlyAmount = 0;
        const type = community.community_type ? community.community_type.toLowerCase() : 'gated';
        
        if (type === 'standalone') {
            monthlyAmount = Number(community.fixed_maintenance_amount) || 0;
        } else {
            monthlyAmount = (Number(community.maintenance_rate) || 0) * (Number(targetUser.flat_size) || 0);
        }

        if (monthlyAmount > 0) {
            const startDate = new Date(maintenance_start_date);
            const year = startDate.getFullYear();
            const month = startDate.getMonth();
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            const startDay = startDate.getDate();
            const daysRemaining = daysInMonth - startDay + 1;
            
            const proRataAmount = Math.round((monthlyAmount / daysInMonth) * daysRemaining);

            if (proRataAmount > 0) {
                const periodDate = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];

                // Check if a record already exists for this month to avoid duplicates
                const { data: existingRecord } = await supabaseClient
                    .from('maintenance_records')
                    .select('id')
                    .eq('user_id', user_id)
                    .eq('period_date', periodDate)
                    .single();

                if (existingRecord) {
                     // Update existing
                     await supabaseClient
                        .from('maintenance_records')
                        .update({ amount: proRataAmount, status: 'Pending' })
                        .eq('id', existingRecord.id);
                } else {
                    // Create new
                    await supabaseClient.from('maintenance_records').insert({
                        user_id: user_id,
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
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    )
  }
})
