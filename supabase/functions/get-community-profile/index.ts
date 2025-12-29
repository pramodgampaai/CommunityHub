
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

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token')

    const { id } = await req.json()
    if (!id) throw new Error('Missing community ID')

    const { data: profile } = await supabaseClient.from('users').select('role, community_id').eq('id', user.id).single()
    if (!profile) throw new Error('User profile not found')

    if (profile.role !== 'SuperAdmin' && profile.community_id !== id) {
        throw new Error('Unauthorized community scope')
    }

    // Defensive: select '*' instead of naming specific potentially non-existent columns
    const { data: community, error: fetchError } = await supabaseClient
      .from('communities')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError) throw fetchError

    return new Response(
      JSON.stringify({ data: community }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Get Community Error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
