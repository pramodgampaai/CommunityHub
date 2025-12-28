
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

    const { tenantData, ownerId, communityId, flatNumber } = await req.json()

    // 1. Validate Requester
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header');
    const { data: { user: requesterAuth }, error: authErr } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
    if (authErr || !requesterAuth) throw new Error('Unauthorized session');

    // 2. Prepare Profile Data
    const extendedProfile = {
        aadharNumber: tenantData.aadharNumber,
        panNumber: tenantData.panNumber,
        aadharUrl: tenantData.aadharUrl,
        panUrl: tenantData.panUrl,
        workInfo: tenantData.workInfo,
        maritalStatus: tenantData.maritalStatus,
        spouseName: tenantData.spouseName,
        kidsCount: tenantData.kidsCount,
        is_tenant: true
    };

    // 3. Create or Update Auth User
    let userId = null;
    const { data: { users } } = await supabaseClient.auth.admin.listUsers();
    const existingUser = users.find((u: any) => u.email === tenantData.email);

    if (existingUser) {
        userId = existingUser.id;
        const { error: updateError } = await supabaseClient.auth.admin.updateUserById(userId, {
            user_metadata: { name: tenantData.name, community_id: communityId, role: 'Tenant' },
            password: 'Welcome@123',
            email_confirm: true
        });
        if (updateError) throw new Error(`Auth Update Failure: ${updateError.message}`);
    } else {
        const { data: { user: newUser }, error: createError } = await supabaseClient.auth.admin.createUser({
            email: tenantData.email,
            password: 'Welcome@123',
            email_confirm: true,
            user_metadata: { name: tenantData.name, community_id: communityId, role: 'Tenant' }
        });
        if (createError) throw new Error(`Auth Creation Failure: ${createError.message}`);
        userId = newUser?.id;
    }

    if (!userId) throw new Error('Could not identify User ID');

    // 4. Create Database Profile (STRICT)
    const { error: profileError } = await supabaseClient
        .from('users')
        .upsert({
            id: userId,
            email: tenantData.email,
            name: tenantData.name,
            role: 'Tenant',
            community_id: communityId,
            flat_number: flatNumber,
            status: 'active',
            avatar_url: `https://ui-avatars.com/api/?name=${encodeURIComponent(tenantData.name)}&background=random`,
            profile_data: extendedProfile
        });

    if (profileError) {
        // Detailed logging for Supabase Console
        console.error("Strict Profile Creation Failed:", profileError);
        throw new Error(`Database Error: ${profileError.message}. Check users table constraints for 'Tenant' role.`);
    }

    // 5. Cleanup: Disable other tenants for this unit
    await supabaseClient
        .from('users')
        .update({ status: 'disabled' })
        .eq('community_id', communityId)
        .eq('flat_number', flatNumber)
        .neq('id', userId);

    return new Response(
      JSON.stringify({ message: 'Tenant onboarded', userId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("Onboarding Crash:", error.message);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
