
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req: any) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL') ?? '', Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '')
    const authHeader = req.headers.get('Authorization')
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader?.replace('Bearer ', '') || '')
    if (!user) throw new Error('Unauthorized');

    const { action, data, community_id } = await req.json()
    const { data: profile } = await supabaseAdmin.from('users').select('role, community_id, name, flat_number').eq('id', user.id).single();
    if (!profile) throw new Error('Profile not found');

    if (action === 'CREATE') {
        const payload = {
            ...data,
            user_id: user.id,
            community_id: profile.community_id,
            resident_name: profile.name,
            flat_number: profile.flat_number,
            start_time: data.startTime, // Mapping camelCase to snake_case
            end_time: data.endTime,
            amenity_id: data.amenityId
        };
        delete payload.startTime;
        delete payload.endTime;
        delete payload.amenityId;

        const { data: booking, error } = await supabaseAdmin.from('bookings').insert(payload).select().single();
        if (error) throw error;
        
        await supabaseAdmin.from('audit_logs').insert({
            community_id: profile.community_id, actor_id: user.id, action: 'CREATE', entity: 'Booking', entity_id: booking.id, details: { description: `Facility reserved: ${booking.amenity_id}` }
        });

        return new Response(JSON.stringify({ data: booking }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    throw new Error('Unsupported action');
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})
