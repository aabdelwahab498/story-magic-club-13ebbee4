// Diagnostic helper: signs a fake Paddle subscription.created event with
// PADDLE_WEBHOOK_SECRET and POSTs it to the paddle-webhook function, then
// returns the webhook response plus the resulting DB row (if any).
// Safe to delete after verification.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const enc = new TextEncoder();
async function hmacHex(secret: string, msg: string) {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  const supaUrl = Deno.env.get('SUPABASE_URL')!;
  if (!secret) {
    return new Response(JSON.stringify({ error: 'PADDLE_WEBHOOK_SECRET not set' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const body = await req.json().catch(() => ({}));
  const userId = body.user_id ?? '5f7d729c-a0f4-4772-bbec-e435a1eb970e';
  const tier = body.tier ?? 'parent';
  const priceId = body.price_id ?? 'pri_test_dummy';
  const eventId = body.event_id ?? `evt_test_${crypto.randomUUID()}`;
  const subId = body.sub_id ?? `sub_test_${crypto.randomUUID()}`;

  const event = {
    event_id: eventId,
    event_type: 'subscription.created',
    occurred_at: new Date().toISOString(),
    data: {
      id: subId,
      status: 'active',
      customer_id: 'ctm_test_dummy',
      custom_data: { user_id: userId },
      current_billing_period: {
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 30 * 86400_000).toISOString(),
      },
      items: [{ price: { id: priceId } }],
    },
  };

  const raw = JSON.stringify(event);
  const ts = Math.floor(Date.now() / 1000).toString();
  const h1 = await hmacHex(secret, `${ts}:${raw}`);

  const res = await fetch(`${supaUrl}/functions/v1/paddle-webhook`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'paddle-signature': `ts=${ts};h1=${h1}`,
    },
    body: raw,
  });
  const text = await res.text();

  // Read back the row that should have been written
  const supabase = createClient(supaUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data: sub } = await supabase
    .from('paddle_subscriptions').select('*').eq('paddle_subscription_id', subId).maybeSingle();
  const { data: evt } = await supabase
    .from('paddle_webhook_events').select('event_id, event_type, processed_at, error')
    .eq('event_id', eventId).maybeSingle();

  return new Response(JSON.stringify({
    webhook_status: res.status,
    webhook_response: text,
    tier_requested: tier,
    paddle_subscription_row: sub,
    webhook_event_row: evt,
  }, null, 2), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
