
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

    const { title, description, category, community_id, user_id, resident_name, flat_number, unit_id } = await req.json()

    if (!title || !community_id || !user_id) {
      throw new Error('Missing required fields')
    }

    // 1. Insert Complaint
    const { data: complaint, error: complaintError } = await supabaseClient
        .from('complaints')
        .insert({
            title,
            description,
            category,
            status: 'Pending',
            resident_name,
            flat_number,
            user_id,
            community_id,
            unit_id,
            assigned_to: null 
        })
        .select()
        .single();

    if (complaintError) throw complaintError;

    // 2. Add Audit Log for Creation
    await supabaseClient.from('audit_logs').insert({
        community_id,
        actor_id: user_id,
        action: 'CREATE',
        entity: 'Complaint',
        entity_id: complaint.id,
        details: { description: `Ticket created: ${title}`, new: complaint }
    });

    return new Response(
      JSON.stringify({ data: complaint }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
