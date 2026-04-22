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
    const body = await req.json()
    const callback = body?.Body?.stkCallback

    if (!callback) {
      return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: 'No callback data' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const checkoutRequestID = callback.CheckoutRequestID
    const resultCode = callback.ResultCode

    if (resultCode === 0) {
      // Payment successful
      const metadata = callback.CallbackMetadata?.Item || []
      const mpesaReceipt = metadata.find((i: any) => i.Name === 'MpesaReceiptNumber')?.Value || ''

      await supabase
        .from('payments')
        .update({
          status: 'completed',
          transaction_reference: mpesaReceipt || checkoutRequestID,
        })
        .eq('transaction_reference', checkoutRequestID)
    } else {
      // Payment failed
      await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('transaction_reference', checkoutRequestID)
    }

    return new Response(JSON.stringify({ ResultCode: 0, ResultDesc: 'OK' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ ResultCode: 1, ResultDesc: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
