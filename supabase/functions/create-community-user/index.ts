
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

// Declare Deno to fix 'Cannot find name Deno'
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create a Supabase client with the Admin Service Role Key
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
    const { name, email, password, community_id, role, flat_number, block, floor, flat_size, maintenance_start_date } = await req.json()

    // Validate inputs
    if (!email || !password || !name || !community_id || !role) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, password, community_id, role' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }
    
    // Check for required maintenance date for Residents
    if (role === 'Resident' && !maintenance_start_date) {
       return new Response(
        JSON.stringify({ error: 'Maintenance Start Date is required for Residents.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // Validate Allowed Roles
    const allowedRoles = ['Resident', 'Security', 'Admin', 'Helpdesk', 'HelpdeskAgent'];
    if (!allowedRoles.includes(role)) {
       return new Response(
        JSON.stringify({ error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      )
    }

    // --- PERMISSION CHECK START ---
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    const { data: { user: requesterAuth }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !requesterAuth) throw new Error('Invalid token');

    const { data: requesterProfile, error: requesterError } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', requesterAuth.id)
        .single();
    
    if (requesterError || !requesterProfile) throw new Error('Requester profile not found');

    if (requesterProfile.community_id !== community_id && requesterProfile.role !== 'SuperAdmin') {
         return new Response(
            JSON.stringify({ error: 'Unauthorized: Cannot create users for a different community' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    if (requesterProfile.role === 'Helpdesk') {
        if (role !== 'HelpdeskAgent') {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Helpdesk Admins can only create Helpdesk Agents.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
    } else if (requesterProfile.role === 'Admin') {
        if (role === 'HelpdeskAgent') {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Community Admins cannot create Helpdesk Agents. Please ask a Helpdesk Admin.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
    } else if (requesterProfile.role === 'SuperAdmin') {
        // SuperAdmin can create anyone
    } else {
        return new Response(
            JSON.stringify({ error: 'Unauthorized: You do not have permission to create users.' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }
    // --- PERMISSION CHECK END ---

    // 1. Create the user in Supabase Auth
    const { data: { user }, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, flat_number, block, floor, flat_size }
    })

    if (createError) {
      throw createError
    }

    if (!user) {
      throw new Error('User creation failed')
    }

    // 2. Create or Update the user profile in the public.users table
    const { error: profileError } = await supabaseClient
      .from('users')
      .upsert({
        id: user.id,
        email: email,
        name: name,
        role: role,
        community_id: community_id,
        flat_number: flat_number,
        block: block,
        floor: floor,
        flat_size: flat_size,
        maintenance_start_date: maintenance_start_date,
        status: 'active',
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      })

    if (profileError) {
      console.error("Profile update error:", profileError);
      await supabaseClient.auth.admin.deleteUser(user.id);
      throw profileError
    }

    // 3. Logic for Pro-Rata Maintenance (Only for Residents)
    if (role === 'Resident' && maintenance_start_date) {
        // Fetch Community Details to get rates
        const { data: community, error: commError } = await supabaseClient
            .from('communities')
            .select('*')
            .eq('id', community_id)
            .single();
        
        if (!commError && community) {
            let monthlyAmount = 0;
            
            // Robust check: Ensure case-insensitive comparison and numeric conversion
            const type = community.community_type ? community.community_type.toLowerCase() : 'gated';
            
            if (type === 'standalone') {
                monthlyAmount = Number(community.fixed_maintenance_amount) || 0;
            } else {
                // Gated
                monthlyAmount = (Number(community.maintenance_rate) || 0) * (Number(flat_size) || 0);
            }

            if (monthlyAmount > 0) {
                const startDate = new Date(maintenance_start_date);
                const year = startDate.getFullYear();
                const month = startDate.getMonth(); // 0-indexed
                
                // Days in this specific month
                const daysInMonth = new Date(year, month + 1, 0).getDate();
                const startDay = startDate.getDate();
                
                // Calculate days remaining (inclusive of start date)
                // e.g. if starts on 1st of 30-day month, days remaining = 30 - 1 + 1 = 30.
                const daysRemaining = daysInMonth - startDay + 1;
                
                // Pro-rata amount
                const proRataAmount = Math.round((monthlyAmount / daysInMonth) * daysRemaining);

                if (proRataAmount > 0) {
                    // Create initial maintenance record
                    // Set period_date to first of the month
                    const periodDate = new Date(Date.UTC(year, month, 1)).toISOString().split('T')[0];

                    await supabaseClient.from('maintenance_records').insert({
                        user_id: user.id,
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
      JSON.stringify({ user, message: 'User created successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, 
      }
    )
  }
})
