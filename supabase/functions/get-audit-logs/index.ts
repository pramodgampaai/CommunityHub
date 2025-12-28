
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) throw new Error('Authentication required');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''))
    if (userError || !user) throw new Error('Invalid session');

    const body = await req.json().catch(() => ({}));
    const { community_id, entity, entity_id } = body;
    if (!community_id) throw new Error('Missing community_id');

    // 1. Fetch User Identity via Service Role (Bypasses RLS recursion entirely)
    const { data: profile, error: profileErr } = await supabaseClient
        .from('users')
        .select('role, community_id')
        .eq('id', user.id)
        .maybeSingle();
    
    if (profileErr || !profile) throw new Error('Registry identity lookup failed');

    const userRole = String(profile.role || '').toLowerCase();
    const isElevated = ['superadmin', 'admin', 'helpdeskadmin', 'securityadmin'].includes(userRole);

    // Security Perimeter: SuperAdmin is global, others are community-bound
    if (userRole !== 'superadmin' && profile.community_id !== community_id) {
        throw new Error('Access denied: Unauthorized community perimeter');
    }

    // 2. Construct Query
    let query = supabaseClient
        .from('audit_logs')
        .select('*, users(name, role)')
        .eq('community_id', community_id);

    // Optional Filters for specific entity history (e.g. Complaint Thread)
    if (entity) query = query.eq('entity', entity);
    if (entity_id) query = query.eq('entity_id', entity_id);

    // Filtering Logic for Standard Users:
    // If it's a specific entity lookup (like a complaint thread), we let the query proceed 
    // as the UI only calls this for objects the user already has access to.
    // For general "All Logs" view, non-elevated users only see their own footprints.
    if (!isElevated && !entity_id) {
        query = query.eq('actor_id', user.id);
    }

    const { data, error: fetchError } = await query
        .order('created_at', { ascending: entity_id ? true : false })
        .limit(200);
    
    if (fetchError) throw new Error(`Log retrieval failed: ${fetchError.message}`);

    return new Response(
      JSON.stringify({ data: data || [] }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: any) {
    console.error("Audit Fetcher Crash:", error.message);
    return new Response(
      JSON.stringify({ error: String(error.message) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
})
