
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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )
    
    const authHeader = req.headers.get('Authorization')
    const { data: { user } } = await supabaseAdmin.auth.getUser(authHeader?.replace('Bearer ', '') || '')
    if (!user) throw new Error('Unauthorized');

    const { action, id, data } = await req.json()
    const { data: profile } = await supabaseAdmin.from('users').select('role, community_id').eq('id', user.id).single();
    if (!profile) throw new Error('Profile not found');

    const isSuperAdmin = profile.role === 'SuperAdmin';
    const isAdmin = ['Admin', 'SuperAdmin', 'HelpdeskAdmin'].includes(profile.role);
    if (!isAdmin) throw new Error('Permission denied');

    // Mapping Helper
    const mapNoticeData = (input: any) => {
        const mapped: any = {};
        if (input.title !== undefined) mapped.title = input.title;
        if (input.content !== undefined) mapped.content = input.content;
        if (input.type !== undefined) mapped.type = input.type;
        if (input.author !== undefined) mapped.author = input.author;
        if (input.validFrom !== undefined) mapped.valid_from = input.validFrom;
        if (input.validUntil !== undefined) mapped.valid_until = input.validUntil;
        return mapped;
    };

    let result = null;

    if (action === 'CREATE') {
        const insertData = { 
            ...mapNoticeData(data), 
            community_id: profile.community_id || data.community_id
        };
        const { data: notice, error } = await supabaseAdmin.from('notices').insert(insertData).select().single();
        if (error) throw error;
        result = notice;
        
    } else if (action === 'UPDATE') {
        if (!id) throw new Error('Missing ID for update');
        const updateData = mapNoticeData(data);
        
        let query = supabaseAdmin.from('notices').update(updateData).eq('id', id);
        
        // Only enforce community isolation for regular Admins
        if (!isSuperAdmin) {
            query = query.eq('community_id', profile.community_id);
        }

        const { data: notice, error } = await query.select().single();
        if (error) throw error;
        result = notice;
        
    } else if (action === 'DELETE') {
        if (!id) throw new Error('Missing ID for delete');
        
        let query = supabaseAdmin.from('notices').delete().eq('id', id);
        if (!isSuperAdmin) {
            query = query.eq('community_id', profile.community_id);
        }
            
        const { error } = await query;
        if (error) throw error;
    }

    return new Response(
        JSON.stringify({ data: result, success: true }), 
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: any) {
    console.error("Manage Notice Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
  }
})
