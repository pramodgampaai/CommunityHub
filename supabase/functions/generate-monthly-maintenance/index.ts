
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

    // Calculate the "Current Month" Period (YYYY-MM-01)
    // We want to ensure bills exist for every month from Start Date up to THIS month.
    const now = new Date();
    const currentPeriodDateStr = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1)).toISOString().split('T')[0];
    const currentPeriodDate = new Date(currentPeriodDateStr);

    console.log(`Running maintenance generation up to period: ${currentPeriodDateStr}`);

    // Fetch active communities
    const { data: communities, error: communityError } = await supabaseClient
        .from('communities')
        .select('id, community_type')
        .eq('status', 'active');

    if (communityError) throw communityError;

    let totalRecordsGenerated = 0;

    for (const community of communities) {
        // 1. Fetch Config History (descending by date)
        const { data: configs } = await supabaseClient
            .from('maintenance_configurations')
            .select('*')
            .eq('community_id', community.id)
            .order('effective_date', { ascending: false });

        // Fallback legacy config from community table
        const { data: legacyData } = await supabaseClient
            .from('communities')
            .select('maintenance_rate, fixed_maintenance_amount')
            .eq('id', community.id)
            .single();

        // 2. Fetch All Units with a start date
        const { data: units } = await supabaseClient
            .from('units')
            .select('id, user_id, flat_size, maintenance_start_date')
            .eq('community_id', community.id)
            .not('maintenance_start_date', 'is', null);

        if (!units || units.length === 0) continue;

        // 3. Fetch All Existing Records for this community
        // We fetch unit_id and period_date to build a map of what already exists
        const { data: existingRecords } = await supabaseClient
            .from('maintenance_records')
            .select('unit_id, period_date')
            .eq('community_id', community.id);
        
        // Create a Set for O(1) lookups: "unitId_YYYY-MM-DD"
        const existingSet = new Set(existingRecords?.map((r: any) => `${r.unit_id}_${r.period_date}`));

        const newRecords: any[] = [];

        for (const unit of units) {
            const startDate = new Date(unit.maintenance_start_date);
            
            // Normalize Start Date to the 1st of that month for iteration
            // Note: We use UTC to match the ISO string outputs
            let iterDate = new Date(Date.UTC(startDate.getFullYear(), startDate.getMonth(), 1));
            
            // Loop from the Unit's Start Month up to the Current Month
            // This handles backfilling if the cron didn't run, or if user was added late with a past start date
            while (iterDate <= currentPeriodDate) {
                const iterPeriodStr = iterDate.toISOString().split('T')[0];
                const recordKey = `${unit.id}_${iterPeriodStr}`;

                // If record already exists for this unit & month, skip
                if (existingSet.has(recordKey)) {
                    iterDate.setUTCMonth(iterDate.getUTCMonth() + 1);
                    continue;
                }

                // --- Calculate Amount for this specific historical/current month ---
                
                // 1. Find Rate Config applicable for this period (Effective Date <= Period Date)
                let activeConfig = configs?.find((c: any) => c.effective_date <= iterPeriodStr);
                
                // 2. Determine Rates
                let rate = activeConfig?.maintenance_rate ?? legacyData?.maintenance_rate ?? 0;
                let fixed = activeConfig?.fixed_maintenance_amount ?? legacyData?.fixed_maintenance_amount ?? 0;

                // 3. Calculate Base Monthly Total
                let monthlyTotal = 0;
                const type = community.community_type ? community.community_type.toLowerCase() : '';

                if (type.includes('standalone')) {
                    monthlyTotal = Number(fixed);
                } else {
                    monthlyTotal = Number(rate) * Number(unit.flat_size);
                }

                let finalAmount = 0;

                if (monthlyTotal > 0) {
                    // 4. Check for Pro-Rata (First Month Only)
                    // If the iteration month is the same as the start date month
                    if (iterDate.getFullYear() === startDate.getFullYear() && iterDate.getMonth() === startDate.getMonth()) {
                        const year = startDate.getFullYear();
                        const month = startDate.getMonth();
                        const daysInMonth = new Date(year, month + 1, 0).getDate(); // Get days in specific month
                        const startDay = startDate.getDate();
                        const daysActive = daysInMonth - startDay + 1;
                        
                        if (daysActive > 0 && daysActive < daysInMonth) {
                            finalAmount = Math.round((monthlyTotal / daysInMonth) * daysActive);
                        } else {
                            finalAmount = Math.round(monthlyTotal);
                        }
                    } else {
                        // Full Month
                        finalAmount = Math.round(monthlyTotal);
                    }

                    if (finalAmount > 0) {
                        newRecords.push({
                            user_id: unit.user_id,
                            unit_id: unit.id,
                            community_id: community.id,
                            amount: finalAmount,
                            period_date: iterPeriodStr,
                            status: 'Pending'
                        });
                    }
                }

                // Move to next month
                iterDate.setUTCMonth(iterDate.getUTCMonth() + 1);
            }
        }

        // 4. Batch Insert New Records
        if (newRecords.length > 0) {
            const { error: insertError } = await supabaseClient
                .from('maintenance_records')
                .insert(newRecords);
            
            if (insertError) {
                console.error(`Error inserting records for community ${community.id}`, insertError);
            } else {
                totalRecordsGenerated += newRecords.length;
            }
        }
    }

    return new Response(
      JSON.stringify({ 
          success: true, 
          message: `Process complete. Generated ${totalRecordsGenerated} new maintenance records.` 
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
