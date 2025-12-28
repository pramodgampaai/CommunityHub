
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

    const { users, community_id } = await req.json()

    if (!users || !Array.isArray(users) || !community_id) {
      throw new Error('Invalid payload: users array and community_id required')
    }

    // --- PERMISSION CHECK ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');
    const { data: { user: requesterAuth } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (!requesterAuth) throw new Error('Invalid token');

    const { data: requesterProfile } = await supabaseClient.from('users').select('role, community_id').eq('id', requesterAuth.id).single();
    if (!requesterProfile || (requesterProfile.role !== 'Admin' && requesterProfile.role !== 'SuperAdmin')) {
        throw new Error('Unauthorized: Admin access required');
    }

    if (requesterProfile.role !== 'SuperAdmin' && requesterProfile.community_id !== community_id) {
         throw new Error('Unauthorized community scope');
    }

    // Fetch Community Rates
    const { data: community } = await supabaseClient.from('communities').select('*').eq('id', community_id).single();
    if (!community) throw new Error('Community not found');

    const results = [];
    
    // Processing in serial to avoid overwhelming Supabase Auth API limits 
    // and ensure record consistency. For very large files (>500), consider batching.
    for (const userData of users) {
        try {
            const { name, email, password, unit_data } = userData;

            // 1. Create Auth User
            const { data: { user }, error: createError } = await supabaseClient.auth.admin.createUser({
                email, password, email_confirm: true, 
                user_metadata: { 
                    name, 
                    community_id, 
                    role: 'Resident',
                    flat_number: unit_data.flat_number
                }
            });

            if (createError) throw createError;
            if (!user) throw new Error('Auth creation failed');

            // 2. Profile Creation
            const displayFlatNumber = unit_data.block ? `${unit_data.block}-${unit_data.flat_number}` : unit_data.flat_number;

            const { error: profileError } = await supabaseClient
                .from('users')
                .upsert({
                    id: user.id,
                    email, name, role: 'Resident',
                    community_id,
                    flat_number: displayFlatNumber, 
                    status: 'active',
                    avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
                });

            if (profileError) {
                await supabaseClient.auth.admin.deleteUser(user.id);
                throw profileError;
            }

            // 3. Unit Assignment
            const { data: unit, error: unitError } = await supabaseClient.from('units').insert({
                community_id,
                user_id: user.id,
                flat_number: unit_data.flat_number,
                block: unit_data.block,
                floor: unit_data.floor,
                flat_size: unit_data.flat_size,
                maintenance_start_date: unit_data.maintenance_start_date
            }).select().single();

            if (unitError) throw unitError;

            // 4. Initial Maintenance Record Generation
            let monthlyAmount = 0;
            const isStandalone = (community.community_type || '').toLowerCase().includes('standalone');
            if (isStandalone) {
                monthlyAmount = Number(community.fixed_maintenance_amount) || 0;
            } else {
                monthlyAmount = (Number(community.maintenance_rate) || 0) * Number(unit_data.flat_size);
            }

            if (monthlyAmount > 0 && unit_data.maintenance_start_date) {
                const start = new Date(unit_data.maintenance_start_date);
                const now = new Date();
                let currentPeriod = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
                let iter = new Date(Date.UTC(start.getFullYear(), start.getMonth(), 1));
                
                const records = [];
                while (iter <= currentPeriod) {
                    let amt = monthlyAmount;
                    if (iter.getUTCFullYear() === start.getFullYear() && iter.getUTCMonth() === start.getMonth()) {
                        const dim = new Date(Date.UTC(start.getFullYear(), start.getMonth() + 1, 0)).getUTCDate();
                        const dr = dim - start.getDate() + 1;
                        if (dr < dim) amt = Math.round((monthlyAmount / dim) * dr);
                    }
                    records.push({
                        user_id: user.id, unit_id: unit.id, community_id,
                        amount: Math.round(amt),
                        period_date: iter.toISOString().split('T')[0],
                        status: 'Pending'
                    });
                    iter.setUTCMonth(iter.getUTCMonth() + 1);
                }
                if (records.length > 0) await supabaseClient.from('maintenance_records').insert(records);
            }

            results.push({ email, status: 'success' });
        } catch (err: any) {
            results.push({ email: userData.email, status: 'failed', error: err.message });
        }
    }

    return new Response(
      JSON.stringify({ results, message: 'Bulk processing completed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
