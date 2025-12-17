
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
    
    // NOTE: Removed previous check that enforced 'units' for Residents.
    // We now allow creating residents without units to support deferred setup on first login.

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

    const requesterRole = requesterProfile.role;

    // 1. Community Scope Check (SuperAdmin exempt)
    if (requesterRole !== 'SuperAdmin' && requesterProfile.community_id !== community_id) {
         return new Response(
            JSON.stringify({ error: 'Unauthorized: Cannot create users for a different community' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 2. Role Hierarchy Check
    let isAllowed = false;
    let errorMessage = 'Unauthorized operation.';

    switch (requesterRole) {
        case 'SuperAdmin':
            isAllowed = true;
            break;
            
        case 'Admin':
            // Admins can create: Resident, Admin, SecurityAdmin, HelpdeskAdmin
            // Admins CANNOT create: HelpdeskAgent, Security (Must use sub-admins)
            if (role === 'HelpdeskAgent' || role === 'Security') {
                isAllowed = false;
                errorMessage = 'Unauthorized: Admins cannot create Agents or Guards directly. Please assign this to the respective Sub-Admin.';
            } else {
                isAllowed = true;
            }
            break;
            
        case 'HelpdeskAdmin':
        case 'Helpdesk': // Legacy Role Support
            if (role === 'HelpdeskAgent') {
                isAllowed = true;
            } else {
                errorMessage = 'Unauthorized: Helpdesk Admin can only create Helpdesk Agents.';
            }
            break;
            
        case 'SecurityAdmin':
            if (role === 'Security') {
                isAllowed = true;
            } else {
                errorMessage = 'Unauthorized: Security Admin can only create Security Guards.';
            }
            break;
            
        default:
            isAllowed = false;
            errorMessage = 'Unauthorized: Your role does not have user creation privileges.';
    }

    if (!isAllowed) {
        return new Response(
            JSON.stringify({ error: errorMessage }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 1. Create Auth User
    const { data: { user }, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name }
    })

    if (createError) {
        // If user already exists, check if they are in the 'users' table.
        // If not in 'users' table, we might want to recover them or just error out.
        // Usually clearer to just pass the message.
        return new Response(
            JSON.stringify({ error: createError.message }),
            { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    
    if (!user) throw new Error('User creation failed');

    // 2. Insert into Public Users (Profile)
    let displayFlatNumber = role === 'Resident' && units && units.length > 0 
        ? units[0].flat_number 
        : flat_number; 
    
    // Sanitize: If it's an empty string, convert to null
    if (typeof displayFlatNumber === 'string' && !displayFlatNumber.trim()) {
        displayFlatNumber = null;
    }

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
      // Rollback auth creation if profile fails (keep DB clean)
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
                const type = community.community_type ? community.community_type.toLowerCase() : 'high-rise apartment';
                
                // Check for 'standalone' or 'standalone apartment'
                if (type.includes('standalone')) {
                    monthlyAmount = Number(community.fixed_maintenance_amount) || 0;
                } else {
                    monthlyAmount = (Number(community.maintenance_rate) || 0) * (Number(unit.flat_size) || 0);
                }

                if (monthlyAmount > 0) {
                    const parts = unit.maintenance_start_date.split('-');
                    const startYear = parseInt(parts[0]);
                    const startMonth = parseInt(parts[1]) - 1;
                    const startDay = parseInt(parts[2]);

                    const now = new Date();
                    let currentPeriodDate = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
                    let iterDate = new Date(Date.UTC(startYear, startMonth, 1));
                    
                    // Fix: If start date is ahead of server month (Timezone diff), extend loop range
                    if (iterDate > currentPeriodDate) {
                        currentPeriodDate = new Date(iterDate);
                    }
                    
                    const newRecords = [];

                    while (iterDate <= currentPeriodDate) {
                        let finalAmount = monthlyAmount;
                        
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
                                user_id: user.id,
                                unit_id: createdUnit.id,
                                community_id: community_id,
                                amount: finalAmount,
                                period_date: iterDate.toISOString().split('T')[0],
                                status: 'Pending'
                            });
                        }
                        
                        iterDate.setUTCMonth(iterDate.getUTCMonth() + 1);
                    }

                    if (newRecords.length > 0) {
                        await supabaseClient.from('maintenance_records').insert(newRecords);
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
