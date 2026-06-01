// Verifies Paddle webhook signatures and reconciles subscriptions into our DB.
// Reference: https://developer.paddle.com/webhooks/signature-verification
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const enc = new TextEncoder();

async function hmacSha256Hex(secret: string, msg: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

// Map Paddle status -> our internal status
function normalizeStatus(s?: string): string {
  switch (s) {
    case 'active': return 'active';
    case 'trialing': return 'trialing';
    case 'past_due': return 'past_due';
    case 'paused': return 'paused';
    case 'canceled': return 'canceled';
    default: return s ?? 'unknown';
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return new Response('method not allowed', { status: 405, headers: corsHeaders });

  const secret = Deno.env.get('PADDLE_WEBHOOK_SECRET');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'webhook_secret_missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const sigHeader = req.headers.get('paddle-signature') ?? '';
  const raw = await req.text();

  // Format: ts=...;h1=hex
  const parts = Object.fromEntries(sigHeader.split(';').map(p => {
    const i = p.indexOf('=');
    return [p.slice(0, i).trim(), p.slice(i + 1).trim()];
  }));
  const ts = parts['ts'];
  const h1 = parts['h1'];

  if (!ts || !h1) {
    return new Response(JSON.stringify({ error: 'invalid_signature_header' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const expected = await hmacSha256Hex(secret, `${ts}:${raw}`);
  if (!timingSafeEqual(expected, h1)) {
    return new Response(JSON.stringify({ error: 'invalid_signature' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let event: any;
  try { event = JSON.parse(raw); } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const eventId = event?.event_id ?? event?.notification_id ?? event?.id ?? crypto.randomUUID();
  const eventType = event?.event_type ?? 'unknown';

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // Idempotency: skip if already processed
  const { data: existing } = await supabase
    .from('paddle_webhook_events')
    .select('id, processed_at')
    .eq('event_id', eventId)
    .maybeSingle();

  if (existing?.processed_at) {
    return new Response(JSON.stringify({ ok: true, duplicate: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  await supabase.from('paddle_webhook_events').upsert({
    event_id: eventId, event_type: eventType, payload: event,
  }, { onConflict: 'event_id' });

  try {
    const data = event?.data ?? {};

    if (eventType.startsWith('subscription.')) {
      const paddleSubId: string | undefined = data.id;
      const customerId: string | undefined = data.customer_id;
      const status = normalizeStatus(data.status);
      const cancelAtPeriodEnd = data?.scheduled_change?.action === 'cancel';
      const canceledAt = data?.canceled_at ?? null;
      const periodStart = data?.current_billing_period?.starts_at ?? null;
      const periodEnd = data?.current_billing_period?.ends_at ?? null;
      const firstItem = (data.items ?? [])[0];
      const priceId: string | undefined = firstItem?.price?.id ?? firstItem?.price_id;
      const userId: string | undefined =
        data?.custom_data?.user_id ?? event?.custom_data?.user_id;

      // Resolve tier from priceId
      let tier = 'free';
      if (priceId) {
        const { data: plan } = await supabase
          .from('subscription_plans')
          .select('tier')
          .eq('paddle_price_id', priceId)
          .maybeSingle();
        if (plan?.tier) tier = plan.tier;
      }

      if (paddleSubId && userId) {
        await supabase.from('paddle_subscriptions').upsert({
          user_id: userId,
          paddle_subscription_id: paddleSubId,
          paddle_customer_id: customerId,
          paddle_price_id: priceId,
          tier,
          status,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at_period_end: cancelAtPeriodEnd,
          canceled_at: canceledAt,
          raw: data,
        }, { onConflict: 'paddle_subscription_id' });
      }
    }

    // ---- One-time store purchases ----
    // Paddle fires `transaction.completed` for any paid transaction. We only treat
    // it as a store order when there's no subscription_id (i.e. it's not a sub renewal)
    // and the custom_data marks it as a store checkout.
    if (eventType === 'transaction.completed' || eventType === 'transaction.paid') {
      const txId: string | undefined = data.id;
      const subId: string | undefined = data.subscription_id;
      const checkoutId: string | undefined = data.checkout?.id;
      const customerId: string | undefined = data.customer_id;
      const customData = data?.custom_data ?? {};
      const userId: string | undefined = customData.user_id;
      const kind: string | undefined = customData.kind; // 'store_order'
      const currency: string = data?.currency_code ?? 'USD';
      const totalCents = Number(data?.details?.totals?.total ?? data?.totals?.total ?? 0);
      const totalAmount = totalCents > 0 ? totalCents / 100 : 0;

      if (txId && userId && !subId && kind === 'store_order') {
        // Idempotency on tx id
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('id')
          .eq('paddle_transaction_id', txId)
          .maybeSingle();

        if (!existingOrder) {
          // Build line items from transaction
          const txItems: any[] = data?.items ?? [];
          const priceIds = txItems
            .map((it) => it?.price?.id ?? it?.price_id)
            .filter(Boolean) as string[];

          const { data: matchedProducts } = await supabase
            .from('products')
            .select('id, sku, name, image, price_usd, paddle_price_id')
            .in('paddle_price_id', priceIds.length ? priceIds : ['__none__']);

          const { data: newOrder, error: orderErr } = await supabase
            .from('orders')
            .insert({
              user_id: userId,
              status: 'paid',
              total_amount: totalAmount,
              currency,
              payment_method: 'paddle',
              paddle_transaction_id: txId,
              paddle_checkout_id: checkoutId,
              paid_at: new Date().toISOString(),
            })
            .select('id')
            .single();

          if (!orderErr && newOrder) {
            const orderItems = txItems.map((it) => {
              const pid = it?.price?.id ?? it?.price_id;
              const qty = Number(it?.quantity ?? 1);
              const unitCents = Number(it?.unit_totals?.subtotal ?? it?.price?.unit_price?.amount ?? 0);
              const unit = unitCents > 0 ? unitCents / 100 : 0;
              const prod = matchedProducts?.find((mp) => mp.paddle_price_id === pid);
              return {
                order_id: newOrder.id,
                product_id: prod?.id ?? null,
                quantity: qty,
                unit_price: unit,
                snapshot: {
                  name: prod?.name ?? {},
                  image: prod?.image ?? null,
                  sku: prod?.sku ?? null,
                  paddle_price_id: pid,
                },
              };
            }).filter((oi) => oi.product_id !== null);

            if (orderItems.length > 0) {
              await supabase.from('order_items').insert(orderItems);
            }

            // Clear purchased items from the user's cart
            const purchasedProductIds = orderItems.map((oi) => oi.product_id).filter(Boolean);
            if (purchasedProductIds.length > 0) {
              await supabase
                .from('cart_items')
                .delete()
                .eq('user_id', userId)
                .in('product_id', purchasedProductIds);
            }
          }
        }
      }
    }

    await supabase.from('paddle_webhook_events')
      .update({ processed_at: new Date().toISOString() })
      .eq('event_id', eventId);

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    await supabase.from('paddle_webhook_events')
      .update({ error: (e as Error).message })
      .eq('event_id', eventId);
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
