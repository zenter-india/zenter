// Verifies a Google Play purchase token server-side and grants Zenter Plus —
// the Play counterpart of verify-razorpay-payment. A purchase token is
// attacker-supplied input; it is never trusted without validating it against
// the Google Play Developer API first.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Same Play Console service account already used for `eas submit` (androidpublisher
// scope covers purchase verification, not just release management) — its client_email
// and private_key, set as separate Edge Function secrets (never the whole JSON file).
const CLIENT_EMAIL = Deno.env.get('GOOGLE_PLAY_CLIENT_EMAIL')!;
const PRIVATE_KEY_PEM = Deno.env.get('GOOGLE_PLAY_PRIVATE_KEY')!.replace(/\\n/g, '\n');
const PACKAGE_NAME = 'in.zenter.app';

function base64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey(
    'pkcs8',
    der,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
}

/** Exchange the service account's signed JWT for a short-lived OAuth access token. */
async function getAccessToken(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = {
    iss: CLIENT_EMAIL,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };
  const encoder = new TextEncoder();
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await importPrivateKey(PRIVATE_KEY_PEM);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, encoder.encode(unsigned));
  const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`;

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const data = await resp.json();
  if (!resp.ok || !data.access_token) {
    throw new Error(`Google auth failed: ${data.error_description ?? data.error ?? 'unknown'}`);
  }
  return data.access_token as string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { product_id, purchase_token, user_id } = await req.json();
    if (!product_id || !purchase_token || !user_id) {
      throw new Error('Missing required payment fields');
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

    const accessToken = await getAccessToken();
    const verifyUrl =
      `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/` +
      `${PACKAGE_NAME}/purchases/products/${product_id}/tokens/${purchase_token}`;
    const playResp = await fetch(verifyUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
    const play = await playResp.json();

    // purchaseState: 0 = purchased, 1 = cancelled, 2 = pending.
    const valid = playResp.ok && play.purchaseState === 0;
    if (!valid) {
      await supabase.from('analytics_events').insert({
        event_name: 'payment_failure',
        user_id,
        properties: { reason: 'play_purchase_invalid', purchase_state: play.purchaseState, product_id },
      });
      return new Response(JSON.stringify({ error: 'Purchase verification failed.' }), {
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
        payment_provider: 'play_billing',
        payment_reference: purchase_token,
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

    // Acknowledge with Google so the entitlement isn't auto-refunded after 3 days.
    await fetch(`${verifyUrl}:acknowledge`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    }).catch(() => undefined);

    await supabase.from('analytics_events').insert([
      { event_name: 'payment_success', user_id, properties: { purchase_token, product_id } },
      { event_name: 'premium_activated', user_id, properties: { plan: 'zenter_plus_neet_2026', provider: 'play_billing' } },
    ]);

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('verify-play-purchase error:', err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
});
