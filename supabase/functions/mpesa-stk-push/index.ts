const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { phone, amount, user_id } = await req.json()

    if (!phone || !amount || !user_id) {
      return new Response(JSON.stringify({ error: 'phone, amount, and user_id are required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const consumerKey = Deno.env.get('MPESA_CONSUMER_KEY')
    const consumerSecret = Deno.env.get('MPESA_CONSUMER_SECRET')
    const shortcode = Deno.env.get('MPESA_SHORTCODE') || '174379'
    const passkey = Deno.env.get('MPESA_PASSKEY') || 'bfb279f9aa9bdbcf158e97dd71a467cd2e0c893059b10f78e6b72ada1ed2c919'

    if (!consumerKey || !consumerSecret) {
      return new Response(JSON.stringify({ error: 'M-Pesa API keys not configured' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 1: Get OAuth token
    const authString = btoa(`${consumerKey}:${consumerSecret}`)
    const tokenRes = await fetch(
      'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
      { headers: { Authorization: `Basic ${authString}` } }
    )
    const tokenData = await tokenRes.json()
    const accessToken = tokenData.access_token

    if (!accessToken) {
      return new Response(JSON.stringify({ error: 'Failed to get M-Pesa access token' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    // Step 2: STK Push
    const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14)
    const password = btoa(`${shortcode}${passkey}${timestamp}`)

    // Format phone: ensure 254 prefix
    let formattedPhone = phone.replace(/\s+/g, '').replace(/^\+/, '')
    if (formattedPhone.startsWith('0')) {
      formattedPhone = '254' + formattedPhone.slice(1)
    }

    const stkPayload = {
      BusinessShortCode: shortcode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: formattedPhone,
      PartyB: shortcode,
      PhoneNumber: formattedPhone,
      CallBackURL: `${Deno.env.get('SUPABASE_URL')}/functions/v1/mpesa-callback`,
      AccountReference: 'ShalitAfia',
      TransactionDesc: 'Clinic Payment',
    }

    const stkRes = await fetch(
      'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(stkPayload),
      }
    )
    const stkData = await stkRes.json()

    // Step 3: Record payment in DB
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    if (stkData.ResponseCode === '0') {
      await supabase.from('payments').insert({
        user_id,
        amount: Math.ceil(amount),
        method: 'mpesa',
        status: 'pending',
        transaction_reference: stkData.CheckoutRequestID,
      })
    }

    return new Response(JSON.stringify(stkData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
