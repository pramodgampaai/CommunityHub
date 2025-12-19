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
    
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Unauthorized session');

    const { data: profile } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .single();
    
    if (!profile) throw new Error('Security profile not found');

    const currentRole = (profile.role || '').toLowerCase();
    const allowedRoles = ['security', 'securityadmin', 'admin', 'superadmin'];
    if (!allowedRoles.includes(currentRole)) {
        return new Response(JSON.stringify({ error: 'Access Denied' }), { status: 403, headers: corsHeaders });
    }

    const { visitor_id, entry_token } = await req.json();
    if (!visitor_id || !entry_token) throw new Error('ID and Token required');

    const { data: visitor, error: fetchError } = await supabaseClient
        .from('visitors')
        .select('*')
        .eq('id', visitor_id)
        .single();

    if (fetchError || !visitor) throw new Error('Visitor not found');

    if (currentRole !== 'superadmin' && visitor.community_id !== profile.community_id) {
        throw new Error('Community mismatch');
    }

    const submitted = String(entry_token).trim().toLowerCase();
    const dbToken = String(visitor.entry_token || '').trim().toLowerCase();
    const dbId = String(visitor.id).trim().toLowerCase();

    if (submitted !== dbToken && submitted !== dbId) {
        throw new Error('Invalid Pass Code');
    }

    if (visitor.status === 'Checked In') {
        throw new Error('Visitor already checked in');
    }

    // Only update status as entry_time column does not exist
    const { data: updatedVisitor, error: updateError } = await supabaseClient
        .from('visitors')
        .update({ status: 'Checked In' })
        .eq('id', visitor_id)
        .select()
        .single();

    if (updateError) throw new Error('Database update failed');

    // Audit Logging
    try {
        await supabaseClient.from('audit_logs').insert({
            community_id: visitor.community_id,
            actor_id: user.id,
            action: 'UPDATE',
            entity: 'Visitor',
            entity_id: visitor_id,
            details: { description: `Gate Verified: ${visitor.name} checked in.` }
        });
    } catch (e) { console.warn("Audit failed", e); }

    return new Response(
      JSON.stringify({ data: updatedVisitor, message: 'Check-in Confirmed' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})