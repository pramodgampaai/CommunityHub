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

    // 1. Auth & Identity Verification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Authentication header missing')
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Unauthorized session')

    // Fetch actor profile (using service role to bypass RLS)
    const { data: profile, error: profileError } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .single();
    
    if (profileError || !profile) throw new Error('Security staff profile not found');

    // Case-insensitive role check
    const allowedRoles = ['security', 'securityadmin', 'admin', 'superadmin'];
    const currentRole = (profile.role || '').toLowerCase();
    
    if (!allowedRoles.includes(currentRole)) {
        return new Response(
            JSON.stringify({ error: 'Permission Denied: Unauthorized role for gate verification.' }), 
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 2. Parse Request Payload
    let body;
    try {
        body = await req.json();
    } catch (e) {
        throw new Error('Malformed request body');
    }

    const { visitor_id, entry_token } = body;
    if (!visitor_id || !entry_token) {
      throw new Error('Identification data (ID and Token) is mandatory for verification');
    }

    // 3. Fetch Visitor Record
    const { data: visitor, error: fetchError } = await supabaseClient
        .from('visitors')
        .select('*')
        .eq('id', visitor_id)
        .single();

    if (fetchError || !visitor) throw new Error('Visitor record not found in manifest for this community');

    // 4. Security Bound Check (Cross-community protection)
    if (visitor.community_id !== profile.community_id) {
        throw new Error('Security Alert: This pass belongs to a different community');
    }

    // 5. Token Validation - CRITICAL FIX: CASE INSENSITIVE COMPARISON
    const submittedCode = String(entry_token).trim().toLowerCase();
    const dbToken = String(visitor.entry_token || '').trim().toLowerCase();
    const dbId = String(visitor.id).trim().toLowerCase();

    // The code scanned could be either the 6-digit alphanumeric token OR the full visitor UUID
    const isTokenMatch = submittedCode === dbToken;
    const isIdMatch = submittedCode === dbId;

    if (!isTokenMatch && !isIdMatch) {
        throw new Error('Invalid Access Pass: Code/Token mismatch');
    }

    // 6. Status & Expiry Validation
    if (visitor.status === 'Checked In') {
        throw new Error('Duplicate Entry: Visitor is already recorded as inside the premises');
    }

    if (visitor.status === 'Denied' || visitor.status === 'Checked Out') {
        throw new Error(`Forbidden: Current pass status is ${visitor.status}`);
    }

    const now = new Date();
    // Default expiry: 24 hours after expected arrival if no valid_until is set
    const expiryDate = visitor.valid_until 
        ? new Date(visitor.valid_until) 
        : new Date(new Date(visitor.expected_at).getTime() + (24 * 60 * 60 * 1000));
    
    if (now > expiryDate) {
        await supabaseClient.from('visitors').update({ status: 'Expired' }).eq('id', visitor_id);
        throw new Error('Access Denied: This pass has expired');
    }

    // 7. Authorize Check-In
    const { data: updatedVisitor, error: updateError } = await supabaseClient
        .from('visitors')
        .update({
            status: 'Checked In',
            entry_time: now.toISOString()
        })
        .eq('id', visitor_id)
        .select()
        .single();

    if (updateError) throw new Error('Database Update Failed: Could not commit check-in');

    // 8. Audit Gate Activity
    await supabaseClient.from('audit_logs').insert({
        community_id: profile.community_id,
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'Visitor',
        entity_id: visitor_id,
        details: { description: `Gate security verified entry for ${visitor.name} (Unit ${visitor.flat_number})` }
    });

    return new Response(
      JSON.stringify({ data: updatedVisitor, message: 'Check-in successfully authorized' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("verify-visitor-error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Verification logic failure' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})