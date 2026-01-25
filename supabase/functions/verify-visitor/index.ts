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
    if (!authHeader) throw new Error('Missing Authorization header');
    
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (authError || !user) throw new Error('Unauthorized session');

    const { data: profile } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .single();
    
    if (!profile) throw new Error('Security profile not found');

    const currentRole = (profile.role || '').toLowerCase();
    // Verification restricted to security personnel and admins
    const allowedRoles = ['security', 'securityadmin', 'superadmin'];
    if (!allowedRoles.includes(currentRole)) {
        return new Response(JSON.stringify({ error: 'Access Denied: Verification restricted to security personnel' }), { status: 403, headers: corsHeaders });
    }

    const { visitor_id, entry_token, photo_data } = await req.json();
    if (!visitor_id || !entry_token) throw new Error('ID and Token required');

    const { data: visitor, error: fetchError } = await supabaseClient
        .from('visitors')
        .select('*')
        .eq('id', visitor_id)
        .single();

    if (fetchError || !visitor) throw new Error('Visitor pass not found in registry');

    // Community Isolation
    if (currentRole !== 'superadmin' && visitor.community_id !== profile.community_id) {
        throw new Error('Security Alert: Community registry mismatch');
    }

    // 1. Single Use Enforcement
    if (visitor.status === 'Checked In') {
        throw new Error('Access Denied: This pass has already been used.');
    }
    
    if (visitor.status !== 'Expected') {
        throw new Error(`Access Denied: Invalid pass status (${visitor.status})`);
    }

    // 2. Token Matching
    const submitted = String(entry_token).trim().toLowerCase();
    const dbToken = String(visitor.entry_token || '').trim().toLowerCase();
    const dbId = String(visitor.id).trim().toLowerCase();

    if (submitted !== dbToken && submitted !== dbId) {
        throw new Error('Invalid Credentials: The provided code does not match the registry.');
    }

    // 3. Today-Only Validation (Strict)
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const expectedDate = new Date(visitor.expected_at).toISOString().split('T')[0];

    if (expectedDate !== today) {
        throw new Error(`Access Denied: This pass was valid for ${expectedDate}. It cannot be used on ${today}.`);
    }

    // Mark as Checked In and save photo evidence
    const { data: updatedVisitor, error: updateError } = await supabaseClient
        .from('visitors')
        .update({ 
            status: 'Checked In',
            photo_url: photo_data || null,
            entry_time: now.toISOString()
        })
        .eq('id', visitor_id)
        .select()
        .single();

    if (updateError) throw new Error('Auth system failed to finalize check-in. Column "photo_url" may be missing.');

    // Audit Logging
    try {
        await supabaseClient.from('audit_logs').insert({
            community_id: visitor.community_id,
            actor_id: user.id,
            action: 'UPDATE',
            entity: 'Visitor',
            entity_id: visitor_id,
            details: { 
                description: `Gate Authorized: ${visitor.name} checked in. Identity photo recorded.`,
                timestamp: now.toISOString()
            }
        });
    } catch (e) { console.warn("Audit log non-fatal failure", e); }

    return new Response(
      JSON.stringify({ data: updatedVisitor, message: 'Authorization Granted: Welcome' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})