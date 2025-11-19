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
    const { name, email, password, community_id, role, flat_number } = await req.json()

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

    // 1. Create the user in Supabase Auth
    const { data: { user }, error: createError } = await supabaseClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, flat_number }
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
        role: role, // 'Resident', 'Security', 'Admin'
        community_id: community_id,
        flat_number: flat_number,
        status: 'active',
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      })

    if (profileError) {
      // Rollback logic could go here (delete auth user)
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