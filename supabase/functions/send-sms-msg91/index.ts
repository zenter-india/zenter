// Supabase Auth "Send SMS" hook — delivers phone-login OTPs through MSG91.
// Supabase Auth generates and later verifies the code itself (so the client's
// signInWithOtp / verifyOtp calls are unchanged); this function only handles
// delivery. Replaces the former Twilio Verify provider.
//
// Hook requests are authenticated by a Standard Webhooks signature, not a
// user JWT — deploy with `--no-verify-jwt`, then register the function URL under
// Auth → Hooks → Send SMS and copy the generated secret into
// SEND_SMS_HOOK_SECRET.
//
// Required secrets: MSG91_AUTH_KEY, MSG91_TEMPLATE_ID (DLT-approved OTP
// template containing the ##OTP## variable), SEND_SMS_HOOK_SECRET.
import { Webhook } from 'https://esm.sh/standardwebhooks@1.0.0';

const AUTH_KEY = Deno.env.get('MSG91_AUTH_KEY')!;
const TEMPLATE_ID = Deno.env.get('MSG91_TEMPLATE_ID')!;
const MSG91_OTP_URL = 'https://control.msg91.com/api/v5/otp';

type HookPayload = {
  user: { phone: string };
  sms: { otp: string };
};

function errorResponse(httpCode: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return errorResponse(405, 'Method not allowed');

  // Read per request: Supabase only reveals the hook secret after the hook URL
  // is registered, so the function must deploy and boot before it exists.
  const hookSecret = Deno.env.get('SEND_SMS_HOOK_SECRET')?.replace('v1,whsec_', '');
  if (!hookSecret) return errorResponse(500, 'Hook secret not configured');

  const body = await req.text();
  let payload: HookPayload;
  try {
    payload = new Webhook(hookSecret).verify(body, Object.fromEntries(req.headers)) as HookPayload;
  } catch {
    return errorResponse(401, 'Invalid hook signature');
  }

  // MSG91 wants the mobile as country code + number, no "+".
  const mobile = payload.user.phone.replace(/\D/g, '');
  const otp = payload.sms.otp;
  if (!/^\d{10,15}$/.test(mobile) || !otp) return errorResponse(400, 'Invalid phone or OTP');

  const url = new URL(MSG91_OTP_URL);
  url.searchParams.set('template_id', TEMPLATE_ID);
  url.searchParams.set('mobile', mobile);
  url.searchParams.set('otp', otp);

  let result: { type?: string; message?: string } = {};
  try {
    // The DLT-approved ZENTER_OTP template has two more variables besides
    // ##OTP##; they must be filled or the operator rejects the text for
    // not matching the registered template.
    const templateVars = { URL: 'zenter.in', MAIL: 'support@zenter.in' };
    const res = await fetch(url, { method: 'POST', headers: { authkey: AUTH_KEY, 'Content-Type': 'application/json' }, body: JSON.stringify(templateVars) });
    result = await res.json().catch(() => ({}));
    if (!res.ok || result.type !== 'success') {
      console.error('[send-sms-msg91] MSG91 rejected send', { status: res.status, result });
      return errorResponse(502, 'SMS provider error');
    }
    // MSG91's request_id ties this send to a row in its SendOTP logs; the
    // masked mobile is enough to spot a wrong country code without leaking it.
    console.log('[send-sms-msg91] MSG91 accepted send', {
      mobile: `${mobile.slice(0, 4)}******${mobile.slice(-2)}`,
      template_id: TEMPLATE_ID,
      result,
    });
  } catch (e) {
    console.error('[send-sms-msg91] MSG91 request failed', e);
    return errorResponse(502, 'SMS provider unreachable');
  }

  return new Response(JSON.stringify({}), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
