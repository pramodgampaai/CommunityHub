
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
    // This is required to create users with specific passwords and modify roles
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
    const { name, email, password, community_id } = await req.json()

    // Validate inputs
    if (!email || !password || !name || !community_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, password, community_id' }),
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
      email_confirm: true, // Auto-confirm email since an admin is creating it
      user_metadata: { name }
    })

    if (createError) {
      throw createError
    }

    if (!user) {
      throw new Error('User creation failed')
    }

    // 2. Create or Update the user profile in the public.users table
    // We use upsert here to handle cases where a database trigger (e.g., on auth.users insert)
    // might have already created a basic row for the user.
    // We force the role to 'Admin' and set the community_id.
    const { error: profileError } = await supabaseClient
      .from('users')
      .upsert({
        id: user.id,
        email: email,
        name: name,
        role: 'Admin',
        community_id: community_id,
        status: 'active',
        flat_number: null, // Explicitly set to NULL for Admins
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      })

    if (profileError) {
      // In a production scenario, you might want to rollback (delete the auth user)
      // if the profile creation fails, to maintain data consistency.
      throw profileError
    }

    return new Response(
      JSON.stringify({ user, message: 'Admin user created successfully' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Server Error' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400, // Using 400 to ensure the client receives the error message body
      }
    )
  }
})
