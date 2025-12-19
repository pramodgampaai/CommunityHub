
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Declare Deno to fix 'Cannot find name Deno'
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
        },
      }
    )

    // Get Auth User
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token')

    const { unitData, communityId, userId } = await req.json()

    if (!unitData || !communityId || !userId) {
        throw new Error("Missing required fields");
    }

    console.log(`Assigning unit for user ${userId} in community ${communityId}. Type: Standalone check incoming.`);

    // 1. Insert Unit (Service Role bypasses RLS)
    const { data: unit, error: unitError } = await supabaseClient
        .from('units')
        .insert({
            community_id: communityId,
            user_id: userId,
            flat_number: unitData.flatNumber,
            block: unitData.block,
            floor: unitData.floor,
            flat_size: unitData.flatSize,
            maintenance_start_date: unitData.maintenanceStartDate
        })
        .select()
        .single();

    if (unitError) throw unitError;

    // 2. Fetch Community for Rates
    const { data: community, error: comError } = await supabaseClient
        .from('communities')
        .select('*')
        .eq('id', communityId)
        .single();
    
    if (comError || !community) throw new Error('Community not found');

    // 3. Maintenance Logic
    let monthlyAmount = 0;
    const rawType = community.community_type || '';
    const type = rawType.toLowerCase();
    
    const fixedAmount = Number(community.fixed_maintenance_amount) || 0;
    const rate = Number(community.maintenance_rate) || 0;

    // Robust Standalone Detection: Check string OR check if only fixed amount is present
    const isStandalone = type.includes('standalone') || (fixedAmount > 0 && rate === 0);

    if (isStandalone) {
        monthlyAmount = fixedAmount;
        console.log(`Identified as STANDALONE community. Using fixed amount: ${monthlyAmount}`);
    } else {
        monthlyAmount = rate * (Number(unitData.flatSize) || 0);
        console.log(`Identified as AREA-BASED community. Rate: ${rate}, Size: ${unitData.flatSize}, Total: ${monthlyAmount}`);
    }

    if (monthlyAmount > 0 && unitData.maintenanceStartDate) {
        // Robust Date Parsing (YYYY-MM-DD to UTC)
        const parts = unitData.maintenanceStartDate.split('-');
        if (parts.length === 3) {
            const startYear = parseInt(parts[0]);
            const startMonth = parseInt(parts[1]) - 1;
            const startDay = parseInt(parts[2]);

            const now = new Date();
            // Server 'current month' period start
            let currentPeriodDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
            // User 'start date' period start
            let iterDate = new Date(Date.UTC(startYear, startMonth, 1));
            
            // Fix for Timezone Drifts: 
            if (iterDate > currentPeriodDate) {
                currentPeriodDate = new Date(iterDate);
            }
            
            const newRecords = [];

            while (iterDate <= currentPeriodDate) {
                let finalAmount = monthlyAmount;

                // Pro-rata check: If we are in the exact start month
                if (iterDate.getUTCFullYear() === startYear && iterDate.getUTCMonth() === startMonth) {
                    const daysInMonth = new Date(Date.UTC(startYear, startMonth + 1, 0)).getUTCDate();
                    const daysRemaining = daysInMonth - startDay + 1;
                    
                    if (daysRemaining > 0 && daysRemaining < daysInMonth) {
                        finalAmount = Math.round((monthlyAmount / daysInMonth) * daysRemaining);
                    }
                }
                
                finalAmount = Math.round(finalAmount);

                if (finalAmount > 0) {
                    newRecords.push({
                        user_id: userId,
                        unit_id: unit.id,
                        community_id: communityId,
                        amount: finalAmount,
                        period_date: iterDate.toISOString().split('T')[0],
                        status: 'Pending'
                    });
                }
                iterDate.setUTCMonth(iterDate.getUTCMonth() + 1);
            }

            if (newRecords.length > 0) {
                console.log(`Generating ${newRecords.length} maintenance records for user.`);
                const { error: recordsError } = await supabaseClient.from('maintenance_records').insert(newRecords);
                if (recordsError) throw recordsError;
            }
        }
    } else {
        console.warn(`Skipping record generation: monthlyAmount is ${monthlyAmount} or startDate is missing.`);
    }

    return new Response(
      JSON.stringify({ success: true, unit }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error(`Edge Function Error (assign-unit): ${error.message}`);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
