
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

    const { name, email, password, community_id } = await req.json()

    if (!email || !password || !name || !community_id) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: name, email, password, community_id' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200, // Return 200 so client can read error message
        }
      )
    }

    // 1. Check if user already exists in Auth
    let userId;
    const { data: existingUsers } = await supabaseClient.auth.admin.listUsers();
    // Simple filter (in prod, use pagination or search)
    const existingUser = existingUsers?.users.find(u => u.email === email);

    if (existingUser) {
        userId = existingUser.id;
        // Check if public profile exists
        const { data: profile } = await supabaseClient.from('users').select('id').eq('id', userId).single();
        if (profile) {
             return new Response(
                JSON.stringify({ error: 'User with this email already exists in the system.' }),
                { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
            );
        }
        // If no profile, we can proceed to "recover" the account by creating the profile
    } else {
        // 2. Create new Auth User
        const { data: { user }, error: createError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true, 
            user_metadata: { name, community_id, role: 'Admin' }
        })

        if (createError) throw createError;
        if (!user) throw new Error('User creation failed');
        userId = user.id;
    }

    // 3. Create/Upsert Profile
    const { error: profileError } = await supabaseClient
      .from('users')
      .upsert({
        id: userId,
        email: email,
        name: name,
        role: 'Admin',
        community_id: community_id,
        status: 'active',
        flat_number: null,
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`
      })

    if (profileError) {
      throw profileError
    }

    return new Response(
      JSON.stringify({ message: 'Admin user created successfully' }),
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
        status: 200, // Return 200 to allow client SDK to parse JSON body
      }
    )
  }
})
