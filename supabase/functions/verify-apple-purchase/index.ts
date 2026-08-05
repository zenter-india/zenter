// Verifies an Apple In-App Purchase transaction server-side and grants
// Zenter Plus — the App Store counterpart of verify-razorpay-payment. A
// transaction id is attacker-supplied input; it is never trusted without
// validating it against Apple's own App Store Server API first.
//
// react-native-iap@16 returns a StoreKit 2 JWS transaction, not a classic
// base64 receipt, so verification uses the App Store Server API
// (GET /inApps/v1/transactions/{id}) rather than the legacy verifyReceipt
// endpoint — Apple's response is itself a signed JWS, decoded below without
// re-verifying its embedded signature since the request that fetched it was
// already authenticated directly to Apple over TLS with our own signed JWT.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// App Store Connect → Users and Access → Integrations → In-App Purchase Key.
const ISSUER_ID = Deno.env.get('APPLE_ISSUER_ID')!;
const KEY_ID = Deno.env.get('APPLE_KEY_ID')!;
const PRIVATE_KEY_PEM = Deno.env.get('APPLE_IAP_PRIVATE_KEY')!.replace(/\\n/g, '\n');
const BUNDLE_ID = 'in.zenter.app';
const PRODUCTION_HOST = 'https://api.storekit.itunes.apple.com';
const SANDBOX_HOST = 'https://api.storekit-sandbox.itunes.apple.com';

function base64url(bytes: Uint8Array | string): string {
  const raw = typeof bytes === 'string' ? bytes : String.fromCharCode(...bytes);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(segment: string): string {
  const padded = segment.replace(/-/g, '+').replace(/_/g, '/').padEnd(segment.length + ((4 - (segment.length % 4)) % 4), '=');
  return atob(padded);
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const body = pem
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const der = Uint8Array.from(atob(body), (c) => c.charCodeAt(0));
  return crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
}

/** Signs the ES256 JWT the App Store Server API requires on every call. */
async function buildAppStoreServerJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'ES256', kid: KEY_ID, typ: 'JWT' };
  const claims = {
    iss: ISSUER_ID,
    iat: now,
    exp: now + 1200, // 20 minutes — Apple caps this at 1 hour
    aud: 'appstoreconnect-v1',
    bid: BUNDLE_ID,
  };
  const encoder = new TextEncoder();
  const unsigned = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claims))}`;
  const key = await importPrivateKey(PRIVATE_KEY_PEM);
  const sig = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, encoder.encode(unsigned));
  return `${unsigned}.${base64url(new Uint8Array(sig))}`;
}

/** Decodes a JWS's payload segment without verifying its own embedded signature (see file header). */
function decodeJwsPayload<T>(jws: string): T {
  const [, payload] = jws.split('.');
  return JSON.parse(base64urlDecode(payload)) as T;
}

type TransactionInfo = { productId: string; transactionId: string; bundleId: string };

async function fetchTransaction(host: string, transactionId: string, jwt: string) {
  const resp = await fetch(`${host}/inApps/v1/transactions/${transactionId}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!resp.ok) return { ok: false as const, status: resp.status };
  const body = await resp.json();
  const info = decodeJwsPayload<TransactionInfo>(body.signedTransactionInfo);
  return { ok: true as const, info };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });

  try {
    const { product_id, transaction_id, user_id } = await req.json();
    if (!product_id || !transaction_id || !user_id) {
      throw new Error('Missing required payment fields');
    }

    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
    const jwt = await buildAppStoreServerJwt();

    // Sandbox transactions 404 against the production host — Apple gives no
    // separate error code for this, so fall back on a plain not-found.
    let result = await fetchTransaction(PRODUCTION_HOST, transaction_id, jwt);
    if (!result.ok) result = await fetchTransaction(SANDBOX_HOST, transaction_id, jwt);

    const matched =
      result.ok && result.info.bundleId === BUNDLE_ID && result.info.productId === product_id ? result.info : null;

    if (!matched) {
      await supabase.from('analytics_events').insert({
        event_name: 'payment_failure',
        user_id,
        properties: { reason: 'apple_transaction_invalid', transaction_id, product_id },
      });
      return new Response(JSON.stringify({ error: 'Transaction verification failed.' }), {
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
        payment_reference: matched.transactionId,
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
      { event_name: 'payment_success', user_id, properties: { transaction_id: matched.transactionId, product_id } },
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
