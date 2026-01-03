
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Declare Deno to fix 'Property env does not exist on type typeof Deno'
declare const Deno: any;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, subject, message } = await req.json()

    if (!name || !email || !message) {
      throw new Error('Name, email, and message are required.')
    }

    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    if (!RESEND_API_KEY) {
        return new Response(
            JSON.stringify({ error: 'System Configuration Error: RESEND_API_KEY is not set in Supabase Secrets.' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }

    /**
     * RESEND FREE-TIER COMPLIANCE:
     * 1. 'from' must be 'onboarding@resend.dev'
     * 2. 'to' must be the email associated with your Resend account: 'pramod.gampa.ai@gmail.com'
     */
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Nilayam App <onboarding@resend.dev>', 
        to: ['pramod.gampa.ai@gmail.com'], 
        reply_to: email, 
        subject: `[Enquiry] ${subject || 'New Community Interest'}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0d9488;">New Inquiry from ${name}</h2>
            <p><strong>From:</strong> ${name} (${email})</p>
            <p><strong>Subject:</strong> ${subject || 'General'}</p>
            <hr style="border: 1px solid #eee;" />
            <p style="white-space: pre-wrap; line-height: 1.6;">${message}</p>
            <hr style="border: 1px solid #eee;" />
            <p style="font-size: 12px; color: #999;">Sent via Nilayam Edge Function</p>
          </div>
        `,
      }),
    })

    const result = await res.json();
    
    if (!res.ok) {
        console.error("Resend API Rejection:", result);
        throw new Error(result.message || 'The mail server rejected the request.');
    }

    return new Response(
      JSON.stringify({ message: 'Enquiry delivered to system administrator.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
