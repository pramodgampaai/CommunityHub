
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
    const { name, email, password, community_id, role, flat_number, block, floor, flat_size } = await req.json()

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
    // Get the JWT from the request header to identify the requester
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Missing Authorization header');

    // We use the admin client to get the user object from the token safely
    const { data: { user: requesterAuth }, error: userError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (userError || !requesterAuth) throw new Error('Invalid token');

    // Fetch the requester's profile to get their Role and Community ID
    const { data: requesterProfile, error: requesterError } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', requesterAuth.id)
        .single();
    
    if (requesterError || !requesterProfile) throw new Error('Requester profile not found');

    // Rule 1: Must belong to the same community (except SuperAdmin, though this function focuses on community users)
    if (requesterProfile.community_id !== community_id && requesterProfile.role !== 'SuperAdmin') {
         return new Response(
            JSON.stringify({ error: 'Unauthorized: Cannot create users for a different community' }),
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // Rule 2: Role-based creation logic
    if (requesterProfile.role === 'Helpdesk') {
        if (role !== 'HelpdeskAgent') {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Helpdesk Admins can only create Helpdesk Agents.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
    } else if (requesterProfile.role === 'Admin') {
        // Admin can create Resident, Security, Helpdesk. 
        // Admin CANNOT create HelpdeskAgent.
        if (role === 'HelpdeskAgent') {
            return new Response(
                JSON.stringify({ error: 'Unauthorized: Community Admins cannot create Helpdesk Agents. Please ask a Helpdesk Admin.' }),
                { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
        }
    } else if (requesterProfile.role === 'SuperAdmin') {
        // SuperAdmin can create anyone anywhere
        // Pass through
    } else {
        // Residents, Security, Agents cannot create users
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
        status: 'active',
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      })

    if (profileError) {
      // Rollback logic (delete auth user)
      console.error("Profile update error:", profileError);
      await supabaseClient.auth.admin.deleteUser(user.id);
      throw profileError
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
