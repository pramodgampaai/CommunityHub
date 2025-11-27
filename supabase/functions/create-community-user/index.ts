

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

    // Parse request body
    const { name, email, password, community_id, role, units, flat_number } = await req.json()

    if (!email || !password || !name || !community_id || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, password, community_id, role' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    
    // For Residents, we expect 'units' array
    if (role === 'Resident' && (!units || !Array.isArray(units) || units.length === 0)) {
         if (!units && flat_number) {
             // Fallback support
         } else {
            return new Response(
                JSON.stringify({ error: 'Residents must have at least one Unit/Flat assigned.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
            )
         }
    }

    // --- PERMISSION CHECK ---
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
    
    if (!requesterProfile) throw new Error('Requester profile not found');

    if (requesterProfile.community_id !== community_id && requesterProfile.role !== 'SuperAdmin') {
         return new Response(
            JSON.stringify({ error: 'Unauthorized: Cannot create users for a different community' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    // Helpdesk Admin (formerly 'Helpdesk') can only create Agents
    if (requesterProfile.role === 'HelpdeskAdmin' && role !== 'HelpdeskAgent') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders });
    }
    // Security Admin can only create Security (Guard)
    if (requesterProfile.role === 'SecurityAdmin' && role !== 'Security') {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403, headers: corsHeaders });
    }

    // Admins restrictions
    if (requesterProfile.role === 'Admin') {
         if (role === 'HelpdeskAgent') {
              return new Response(JSON.stringify({ error: 'Unauthorized: Only Helpdesk Admin can create Agents' }), { status: 403, headers: corsHeaders });
         }
         if (role === 'Security') {
              return new Response(JSON.stringify({ error: 'Unauthorized: Only Security Admin can create Security Guards' }), { status: 403, headers: corsHeaders });
         }
         // Admins can create SecurityAdmin, HelpdeskAdmin, Resident
    }

    // 1. Create Auth User
    const { data: { user }, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })

    if (createError) throw createError
    if (!user) throw new Error('User creation failed')

    // 2. Insert into Public Users (Profile)
    const displayFlatNumber = role === 'Resident' && units && units.length > 0 
        ? units[0].flat_number 
        : flat_number; 

    const { error: profileError } = await supabaseClient
      .from('users')
      .upsert({
        id: user.id,
        email: email,
        name: name,
        role: role,
        community_id: community_id,
        flat_number: displayFlatNumber, 
        status: 'active',
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      })

    if (profileError) {
      await supabaseClient.auth.admin.deleteUser(user.id);
      throw profileError
    }

    // 3. Insert Units & Calculate Maintenance (Only for Residents)
    if (role === 'Resident' && units && Array.isArray(units)) {
        const { data: community } = await supabaseClient
            .from('communities')
            .select('*')
            .eq('id', community_id)
            .single();

        for (const unit of units) {
            const { data: createdUnit, error: unitError } = await supabaseClient
                .from('units')
                .insert({
                    community_id,
                    user_id: user.id,
                    flat_number: unit.flat_number,
                    block: unit.block,
                    floor: unit.floor,
                    flat_size: unit.flat_size,
                    maintenance_start_date: unit.maintenance_start_date
                })
                .select()
                .single();

            if (unitError) {
                console.error("Failed to create unit", unitError);
                continue; 
            }

            if (community && unit.maintenance_start_date) {
                let monthlyAmount = 0;
                const type = community.community_type ? community.community_type.toLowerCase() : 'gated';
                
                if (type === 'standalone') {
                    monthlyAmount = Number(community.fixed_maintenance_amount) || 0;
                } else {
                    monthlyAmount = (Number(community.maintenance_rate) || 0) * (Number(unit.flat_size) || 0);
                }

                if (monthlyAmount > 0) {
                    const startDate = new Date(unit.maintenance_start_date);
                    const year = startDate.getFullYear();
                    const month = startDate.getMonth();
                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                    const daysRemaining = daysInMonth - startDate.getDate() + 1;
                    
                    const proRataAmount = Math.round((monthlyAmount / daysInMonth) * daysRemaining);

                    if (proRataAmount > 0) {
                        const periodDate = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];
                        await supabaseClient.from('maintenance_records').insert({
                            user_id: user.id,
                            unit_id: createdUnit.id,
                            community_id: community_id,
                            amount: proRataAmount,
                            period_date: periodDate,
                            status: 'Pending'
                        });
                    }
                }
            }
        }
    }

    return new Response(
      JSON.stringify({ user, message: 'User created successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})