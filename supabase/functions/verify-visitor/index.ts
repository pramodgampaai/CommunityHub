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

    // 1. Identify Actor (Security Staff)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('[AUTH_01] Authentication header missing');
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('[AUTH_02] Unauthorized session or expired token');

    // Fetch Actor Profile (Using service role to ensure read access)
    const { data: profile, error: profileError } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .single();
    
    if (profileError || !profile) {
        console.error("Profile fetch error:", profileError);
        throw new Error('[AUTH_03] Security staff profile not found in system registry');
    }

    // Role check (Case-insensitive)
    const allowedRoles = ['security', 'securityadmin', 'admin', 'superadmin'];
    const currentRole = (profile.role || '').toLowerCase();
    if (!allowedRoles.includes(currentRole)) {
        return new Response(
            JSON.stringify({ error: `[PERM_01] Access Denied: Your role (${profile.role}) is not authorized for gate verification.` }), 
            { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
    }

    // 2. Process Payload
    let body;
    try {
        body = await req.json();
    } catch (e) {
        throw new Error('[REQ_01] Malformed JSON payload');
    }

    const { visitor_id, entry_token } = body;
    if (!visitor_id) throw new Error('[REQ_02] Missing mandatory visitor_id');
    if (!entry_token) throw new Error('[REQ_03] Missing mandatory entry_token');

    // 3. Retrieve Visitor Record
    const { data: visitor, error: fetchError } = await supabaseClient
        .from('visitors')
        .select('*')
        .eq('id', visitor_id)
        .single();

    if (fetchError || !visitor) {
        console.error("Visitor fetch error:", fetchError);
        throw new Error('[DATA_01] Visitor record not found in the manifest');
    }

    // 4. Security Bounds
    if (visitor.community_id !== profile.community_id) {
        throw new Error('[SEC_01] Security Alert: This pass belongs to a different community');
    }

    // 5. Verification Logic (Case Insensitive)
    const submittedCode = String(entry_token).trim().toLowerCase();
    const dbToken = String(visitor.entry_token || '').trim().toLowerCase();
    const dbId = String(visitor.id).trim().toLowerCase();

    // Support verification by Token (6-char) or Visitor UUID
    const isTokenMatch = submittedCode === dbToken;
    const isIdMatch = submittedCode === dbId;

    if (!isTokenMatch && !isIdMatch) {
        throw new Error(`[VAL_01] Invalid Pass: Scanned code does not match record tokens`);
    }

    // 6. Status & Expiry Validation
    if (visitor.status === 'Checked In') {
        throw new Error('[VAL_02] Duplicate Entry: Visitor is already recorded as Checked In');
    }

    if (visitor.status === 'Denied' || visitor.status === 'Checked Out') {
        throw new Error(`[VAL_03] Pass Inactive: Current status is ${visitor.status}`);
    }

    const now = new Date();
    // Use valid_until if set, otherwise fallback to expected_at + 24 hours
    const expiryTimestamp = visitor.valid_until 
        ? new Date(visitor.valid_until).getTime()
        : new Date(visitor.expected_at).getTime() + (24 * 60 * 60 * 1000);
    
    if (now.getTime() > expiryTimestamp) {
        await supabaseClient.from('visitors').update({ status: 'Expired' }).eq('id', visitor_id);
        throw new Error('[VAL_04] Access Denied: This pass has expired');
    }

    // 7. Commit Check-In
    const { data: updatedVisitor, error: updateError } = await supabaseClient
        .from('visitors')
        .update({
            status: 'Checked In',
            entry_time: now.toISOString()
        })
        .eq('id', visitor_id)
        .select()
        .single();

    if (updateError) {
        console.error("Update commit error:", updateError);
        throw new Error('[DB_01] Failed to commit check-in status to database');
    }

    // 8. Log Event
    await supabaseClient.from('audit_logs').insert({
        community_id: profile.community_id,
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'Visitor',
        entity_id: visitor_id,
        details: { description: `Gate Verified: ${visitor.name} arrived at Unit ${visitor.flat_number}` }
    });

    return new Response(
      JSON.stringify({ data: updatedVisitor, message: 'Verification Successful' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("verify-visitor-runtime-error:", error.message);
    return new Response(
      JSON.stringify({ error: error.message || 'Internal logic failure' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})