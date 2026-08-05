// Verifies an Apple In-App Purchase receipt server-side and grants Zenter
// Plus — the App Store counterpart of verify-razorpay-payment. A receipt is
// attacker-supplied input; it is never trusted without validating it against
// Apple's own verifyReceipt endpoint first.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Apps → Zenter → App Information → App-Specific Shared Secret.
const SHARED_SECRET = Deno.env.get('APPLE_SHARED_SECRET')!;
const PRODUCTION_URL = 'https://buy.itunes.apple.com/verifyReceipt';
const SANDBOX_URL = 'https://sandbox.itunes.apple.com/verifyReceipt';
// App Review always tests via Sandbox against the production build/endpoint,
// so this fallback is required, not optional — see Apple's status 21007.
const SANDBOX_RECEIPT_IN_PRODUCTION = 21007;

type AppleVerifyResponse = {
  status: number;
  receipt?: { in_app?: Array<{ product_id: string; transaction_id: string }> };
};

async function callApple(url: string, receipt: string): Promise<AppleVerifyResponse> {
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 'receipt-data': receipt, password: SHARED_SECRET, 'exclude-old-transactions': true }),
  });
  return await resp.json();
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { product_id, receipt, user_id } = await req.json();
    if (!product_id || !receipt || !user_id) {
      throw new Error('Missing required payment fields');
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    let result = await callApple(PRODUCTION_URL, receipt);
    if (result.status === SANDBOX_RECEIPT_IN_PRODUCTION) {
      result = await callApple(SANDBOX_URL, receipt);
    }

    const matched = result.status === 0 && result.receipt?.in_app?.find((tx) => tx.product_id === product_id);
    if (!matched) {
      await supabase.from('analytics_events').insert({
        event_name: 'payment_failure',
        user_id,
        properties: { reason: 'apple_receipt_invalid', apple_status: result.status, product_id },
      });
      return new Response(JSON.stringify({ error: 'Receipt verification failed.' }), {
        status: 400,
        headers: { ...cors, 'Content-Type': 'application/json' },
      });
    }

    const { error: updateErr } = await supabase
      .from('users')
      .update({
        plus_member: true,
        premium_plan: 'zenter_plus_neet_2026',
        premium_status: 'active',
        premium_purchase_date: new Date().toISOString(),
        premium_expiry_date: null,
        payment_provider: 'apple_iap',
        payment_reference: matched.transaction_id,
        contact_reveals_used: 0,
      })
      .eq('id', user_id);

    if (updateErr) {
      if (updateErr.code === '23505') {
        return new Response(JSON.stringify({ success: true, note: 'already_granted' }), {
          headers: { ...cors, 'Content-Type': 'application/json' },
        });
      }
      throw updateErr;
    }

    await supabase.from('analytics_events').insert([
      { event_name: 'payment_success', user_id, properties: { transaction_id: matched.transaction_id, product_id } },
      { event_name: 'premium_activated', user_id, properties: { plan: 'zenter_plus_neet_2026', provider: 'apple_iap' } },
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('verify-apple-purchase error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
