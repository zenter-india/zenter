// Push notifications for connection requests, accepted requests, and chat
// messages. Recipient is ALWAYS re-derived server-side from the referenced
// row (connection_id / conversation_id + message_id) — never trusted from
// the client — so a forged payload can't be used to spam an arbitrary user.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PushBody =
  | { type: 'connection_request'; connection_id: string }
  | { type: 'connection_accepted'; connection_id: string }
  | { type: 'chat_message'; conversation_id: string; message_id: string };

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  const j = (b: unknown, s = 200) =>
    new Response(JSON.stringify(b), { status: s, headers: { ...cors, 'Content-Type': 'application/json' } });

  const sb = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    const body = (await req.json()) as PushBody;

    let recipientId: string | null = null;
    let title = '';
    let message = '';
    const data: Record<string, string> = { type: body.type };

    if (body.type === 'connection_request' || body.type === 'connection_accepted') {
      const { data: conn } = await sb
        .from('connections')
        .select('sender_id, receiver_id, status')
        .eq('id', body.connection_id)
        .maybeSingle();
      if (!conn) return j({ success: true, sent: 0 });

      if (body.type === 'connection_request') {
        if (conn.status !== 'pending') return j({ success: true, sent: 0 });
        recipientId = conn.receiver_id;
        const { data: sender } = await sb.from('users').select('full_name').eq('id', conn.sender_id).maybeSingle();
        title = 'New connection request';
        message = `${sender?.full_name || 'Someone'} wants to connect with you.`;
      } else {
        if (conn.status !== 'accepted') return j({ success: true, sent: 0 });
        recipientId = conn.sender_id;
        const { data: accepter } = await sb.from('users').select('full_name').eq('id', conn.receiver_id).maybeSingle();
        title = 'Request accepted';
        message = `${accepter?.full_name || 'Someone'} accepted your connection request.`;
      }
      data.connection_id = body.connection_id;
    } else if (body.type === 'chat_message') {
      const { data: msg } = await sb
        .from('messages')
        .select('sender_id, conversation_id, body')
        .eq('id', body.message_id)
        .maybeSingle();
      if (!msg || msg.conversation_id !== body.conversation_id) return j({ success: true, sent: 0 });

      const { data: conv } = await sb
        .from('conversations')
        .select('user_a, user_b')
        .eq('id', body.conversation_id)
        .maybeSingle();
      if (!conv || (msg.sender_id !== conv.user_a && msg.sender_id !== conv.user_b)) {
        return j({ success: true, sent: 0 });
      }
      recipientId = msg.sender_id === conv.user_a ? conv.user_b : conv.user_a;

      const { data: sender } = await sb.from('users').select('full_name').eq('id', msg.sender_id).maybeSingle();
      title = sender?.full_name || 'New message';
      message = msg.body.length > 120 ? `${msg.body.slice(0, 117)}...` : msg.body;
      data.conversation_id = body.conversation_id;
    } else {
      return j({ error: 'Unknown notification type' }, 400);
    }

    if (!recipientId) return j({ success: true, sent: 0 });

    const { data: tokens } = await sb.from('device_tokens').select('token').eq('user_id', recipientId);
    if (!tokens || tokens.length === 0) return j({ success: true, sent: 0 });

    const messages = tokens.map((t) => ({
      to: t.token,
      title,
      body: message,
      data,
      sound: 'default',
    }));

    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(messages),
    });

    return j({ success: true, sent: messages.length });
  } catch (err) {
    return j({ error: (err as Error).message }, 500);
  }
});
