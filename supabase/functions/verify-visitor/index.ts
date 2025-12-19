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

    // 1. Auth Check
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token')

    // Fetch user profile to check role
    const { data: profile } = await supabaseClient.from('users').select('role, community_id').eq('id', user.id).single();
    
    if (!profile) {
        throw new Error('User profile not found');
    }

    // Strict Role Check: Case-insensitive
    const allowedRoles = ['security', 'securityadmin', 'admin', 'superadmin'];
    const currentRole = (profile.role || '').toLowerCase();
    
    if (!allowedRoles.includes(currentRole)) {
        return new Response(
            JSON.stringify({ error: 'Unauthorized: Access restricted to Security and Admin roles.' }), 
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    const { visitor_id, entry_token } = await req.json()

    if (!visitor_id || !entry_token) {
      throw new Error('Missing visitor identification data')
    }

    // 2. Fetch Visitor Record
    const { data: visitor, error: fetchError } = await supabaseClient
        .from('visitors')
        .select('*')
        .eq('id', visitor_id)
        .single();

    if (fetchError || !visitor) throw new Error('Visitor record not found in manifest');

    // 3. Community Check
    if (visitor.community_id !== profile.community_id) {
        throw new Error('Security Alert: Visitor manifest belongs to a different community');
    }

    // 4. Token & Status Validation
    // Support matching against either the token or the ID (for generic scans)
    const submittedToken = String(entry_token).trim().toUpperCase();
    const dbToken = String(visitor.entry_token || '').trim().toUpperCase();
    const dbId = String(visitor.id).trim();

    if (submittedToken !== dbToken && entry_token !== dbId) {
        throw new Error('Invalid Access Token: Verification failed');
    }

    if (visitor.status === 'Checked In') {
        throw new Error('Replay Error: Visitor is already checked in');
    }

    if (visitor.status === 'Denied' || visitor.status === 'Checked Out') {
        throw new Error(`Access Denied: Current status is ${visitor.status}`);
    }

    // 5. Date Validation
    const now = new Date();
    // Default to 24 hour expiry from expected arrival if not specified
    const expiryDate = visitor.valid_until 
        ? new Date(visitor.valid_until) 
        : new Date(new Date(visitor.expected_at).getTime() + 24 * 60 * 60 * 1000);
    
    if (now > expiryDate) {
        await supabaseClient.from('visitors').update({ status: 'Expired' }).eq('id', visitor_id);
        throw new Error('Access Denied: This pass has expired');
    }

    // 6. Perform Check-In
    const { data: updatedVisitor, error: updateError } = await supabaseClient
        .from('visitors')
        .update({
            status: 'Checked In',
            entry_time: now.toISOString()
        })
        .eq('id', visitor_id)
        .select()
        .single();

    if (updateError) throw updateError;

    // 7. Audit Log
    await supabaseClient.from('audit_logs').insert({
        community_id: profile.community_id,
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'Visitor',
        entity_id: visitor_id,
        details: { description: `Gate security verified check-in for ${visitor.name}` }
    });

    return new Response(
      JSON.stringify({ data: updatedVisitor, message: 'Check-in Authorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || 'Internal Verification Error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})