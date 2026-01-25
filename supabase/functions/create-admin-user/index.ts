
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

    // 1. Authenticate & Authorize Requester
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization')
    const { data: { user: requesterAuth } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!requesterAuth) throw new Error('Security context invalid')

    const { data: requesterProfile } = await supabaseClient.from('users').select('role').eq('id', requesterAuth.id).single();
    if (requesterProfile?.role !== 'SuperAdmin') {
        throw new Error('Unauthorized: SuperAdmin privileges required.');
    }

    const { name, email, password, community_id } = await req.json()
    if (!email || !password || !name || !community_id) {
      throw new Error('Missing identity parameters.');
    }
    
    // Normalize email to prevent case-sensitivity collisions
    const cleanEmail = email.toLowerCase().trim();

    // 2. DEEP SCRUB IDENTITY (THE FIX)
    // Clear Public table first
    await supabaseClient.from('users').delete().eq('email', cleanEmail);

    // Clear Auth system
    const { data: { users: allUsers } } = await supabaseClient.auth.admin.listUsers();
    const existingInAuth = allUsers.find(u => u.email?.toLowerCase() === cleanEmail);
    if (existingInAuth) {
        await supabaseClient.auth.admin.deleteUser(existingInAuth.id);
    }

    // 3. PROVISION NEW IDENTITY (AUTO CONFIRM)
    const { data: newUser, error: createError } = await supabaseClient.auth.admin.createUser({
        email: cleanEmail,
        password,
        email_confirm: true, // AUTO CONFIRM OPTION: TRUE
        user_metadata: { name, community_id, role: 'Admin' }
    });

    if (createError) {
        throw new Error(`Auth Engine Rejection: ${createError.message}`);
    }

    const targetUserId = newUser.user.id;

    // 4. SYNC PUBLIC PROFILE
    const { error: profileError } = await supabaseClient
      .from('users')
      .upsert({
        id: targetUserId,
        email: cleanEmail,
        name: name,
        role: 'Admin',
        community_id: community_id,
        status: 'active',
        avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=0d9488&color=fff`
      }, { onConflict: 'id' });

    if (profileError) {
        await supabaseClient.auth.admin.deleteUser(targetUserId);
        throw new Error(`Database profile sync failed: ${profileError.message}`);
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Manager provisioned successfully', userId: targetUserId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("FATAL PROVISIONING EXCEPTION:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Provisioning Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
