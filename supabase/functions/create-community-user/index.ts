
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

    const { name, email, password, community_id, role, flat_number, unit_data } = await req.json()
    if (!email || !password || !name || !community_id || !role) {
      throw new Error('Incomplete identity payload');
    }

    const cleanEmail = email.toLowerCase().trim();

    // 1. SECURITY VALIDATION
    const authHeader = req.headers.get('Authorization');
    const { data: { user: requesterAuth } } = await supabaseClient.auth.getUser(authHeader?.replace('Bearer ', '') || '');
    if (!requesterAuth) throw new Error('Invalid security session');

    const { data: requesterProfile } = await supabaseClient.from('users').select('role, community_id').eq('id', requesterAuth.id).single();
    if (!requesterProfile || (requesterProfile.role !== 'SuperAdmin' && requesterProfile.community_id !== community_id)) {
         throw new Error('Unauthorized scope violation');
    }

    // 2. IDENTITY SCRUB (Critical Fix)
    // Clear public table first to avoid trigger collisions
    await supabaseClient.from('users').delete().eq('email', cleanEmail);
    
    // Clear Auth system
    const { data: { users: allUsers } } = await supabaseClient.auth.admin.listUsers();
    const existingInAuth = allUsers.find(u => u.email?.toLowerCase() === cleanEmail);
    if (existingInAuth) {
        await supabaseClient.auth.admin.deleteUser(existingInAuth.id);
    }

    // 3. FRESH PROVISIONING
    const { data: { user }, error: createError } = await supabaseClient.auth.admin.createUser({
      email: cleanEmail, 
      password, 
      email_confirm: true, 
      user_metadata: { name, community_id, role, flat_number: flat_number || (unit_data ? unit_data.flat_number : null) }
    });

    if (createError) throw new Error(`Auth Rejection: ${createError.message}`);
    if (!user) throw new Error('Identity creation failed');

    // 4. PROFILE SYNC
    let displayFlatNumber = flat_number;
    if (role === 'Resident' && unit_data) {
        displayFlatNumber = unit_data.block ? `${unit_data.block}-${unit_data.flat_number}` : unit_data.flat_number;
    }

    const { error: profileError } = await supabaseClient
      .from('users')
      .upsert({
        id: user.id,
        email: cleanEmail, name, role,
        community_id,
        flat_number: displayFlatNumber, 
        status: 'active',
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      }, { onConflict: 'id' });

    if (profileError) {
      await supabaseClient.auth.admin.deleteUser(user.id);
      throw profileError;
    }

    // 5. UNIT ALLOCATION
    if (role === 'Resident' && unit_data) {
        const { data: unit, error: unitError } = await supabaseClient.from('units').insert({
            community_id,
            user_id: user.id,
            flat_number: unit_data.flat_number,
            block: unit_data.block,
            floor: unit_data.floor,
            flat_size: unit_data.flat_size,
            maintenance_start_date: unit_data.maintenance_start_date
        }).select().single();

        if (!unitError && unit) {
            const { data: community } = await supabaseClient.from('communities').select('*').eq('id', community_id).single();
            if (community) {
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
            }
        }
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Identity provisioned and verified.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Provisioning Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
