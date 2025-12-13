
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

    // 1. Auth Check (Must be Security or Admin)
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Missing Authorization header')
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid token')

    // Fetch user profile to check role
    const { data: profile } = await supabaseClient.from('users').select('role, community_id').eq('id', user.id).single();
    
    // Strict Role Check: Only Security, SecurityAdmin, or Admin can verify entry
    const allowedRoles = ['Security', 'SecurityAdmin', 'Admin', 'SuperAdmin'];
    if (!allowedRoles.includes(profile.role)) {
        return new Response(JSON.stringify({ error: 'Unauthorized: Only Security can verify entry.' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { visitor_id, entry_token, action } = await req.json()

    if (!visitor_id || !entry_token) {
      throw new Error('Missing visitor_id or entry_token')
    }

    // 2. Fetch Visitor Record
    const { data: visitor, error: fetchError } = await supabaseClient
        .from('visitors')
        .select('*')
        .eq('id', visitor_id)
        .single();

    if (fetchError || !visitor) throw new Error('Visitor not found');

    // 3. Community Check
    if (visitor.community_id !== profile.community_id) {
        throw new Error('Visitor does not belong to this community');
    }

    // 4. Token & Status Validation
    // Fallback: If DB doesn't have entry_token column, use ID.
    // The frontend sends either the real token or the ID if the token is missing.
    const validToken = visitor.entry_token || visitor.id;
    
    if (entry_token !== validToken) {
        throw new Error('Invalid Entry Token');
    }

    if (visitor.status === 'Checked In') {
        throw new Error('Visitor already Checked In (Replay Attack Detected)');
    }

    if (visitor.status === 'Denied' || visitor.status === 'Checked Out') {
        throw new Error(`Entry Denied. Current status: ${visitor.status}`);
    }

    // 5. Date Validation
    const now = new Date();
    // Fallback if valid_until column missing: use expected_at + 24h
    const expiryDate = visitor.valid_until ? new Date(visitor.valid_until) : new Date(new Date(visitor.expected_at).getTime() + 24 * 60 * 60 * 1000);
    
    if (now > expiryDate) {
        // Auto-expire if date passed
        // We only attempt to update 'Expired' status if valid_until exists or simply fail
        await supabaseClient.from('visitors').update({ status: 'Expired' }).eq('id', visitor_id);
        throw new Error('Entry Pass Expired');
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

    // 7. Audit Log (Optional but good practice)
    await supabaseClient.from('audit_logs').insert({
        community_id: profile.community_id,
        actor_id: user.id,
        action: 'UPDATE',
        entity: 'Visitor',
        entity_id: visitor_id,
        details: { description: `Verified entry for ${visitor.name}` }
    });

    return new Response(
      JSON.stringify({ data: updatedVisitor, message: 'Verified Successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
