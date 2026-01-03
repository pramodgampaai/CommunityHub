
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

// Declare Deno to fix 'Property env does not exist on type typeof Deno'
declare const Deno: any;

/**
 * This Edge Function handles anonymous enquiries from the login page.
 * It is configured to allow public access so prospective residents/admins can reach out.
 */

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { name, email, subject, message } = await req.json()

    // 1. Validation
    if (!name || !email || !message) {
      throw new Error('Missing required fields')
    }

    /**
     * 2. SENDING LOGIC
     * You should set up an account with an email provider like Resend (resend.com).
     * Add your API key to Supabase project secrets:
     * supabase secrets set RESEND_API_KEY=re_your_key
     */
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    
    // Fallback: If no API key is set, we log it and return success for the UI demo,
    // but in production, this will use the fetch call below.
    if (!RESEND_API_KEY) {
        console.log("Enquiry Received (Dev Mode):", { name, email, subject, message });
        return new Response(
            JSON.stringify({ message: 'Enquiry received successfully (simulation mode)' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Nilayam Support <onboarding@resend.dev>', // Update with your verified domain
        to: ['nilayam.app@gmail.com'],
        reply_to: email,
        subject: `[Enquiry] ${subject || 'New Community Interest'}`,
        html: `
          <div style="font-family: sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #0d9488;">New Nilayam Enquiry</h2>
            <p><strong>From:</strong> ${name} (${email})</p>
            <p><strong>Subject:</strong> ${subject}</p>
            <div style="background: #f4f4f5; padding: 15px; border-radius: 8px; margin-top: 10px;">
              ${message.replace(/\n/g, '<br>')}
            </div>
          </div>
        `,
      }),
    })

    const result = await res.json();
    if (!res.ok) throw new Error(result.message || 'Failed to transmit email');

    return new Response(
      JSON.stringify({ message: 'Enquiry transmitted successfully' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
