// Admin-only: creates Paddle products + monthly USD prices for each subscription plan
// that doesn't yet have a paddle_price_id, then writes the new IDs back to the DB.
// Call once per environment (sandbox / production).
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: userData } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
  const user = userData?.user;
  if (!user) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const apiKey = Deno.env.get('PADDLE_API_KEY');
  const env = (Deno.env.get('PADDLE_ENVIRONMENT') ?? 'sandbox').toLowerCase();
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'paddle_api_key_missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  const base = env === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

  // Fetch active paid plans that still need a Paddle price.
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('id, tier, name, description, price_usd, paddle_price_id, paddle_product_id')
    .eq('active', true)
    .gt('price_usd', 0);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const results: any[] = [];
  for (const plan of plans ?? []) {
    if (plan.paddle_price_id) {
      results.push({ tier: plan.tier, skipped: true, reason: 'already_has_price_id' });
      continue;
    }
    const enName = (plan.name as any)?.en ?? plan.tier;
    const enDesc = (plan.description as any)?.en ?? '';

    try {
      let productId = plan.paddle_product_id;

      if (!productId) {
        const prodRes = await fetch(`${base}/products`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: `NajmaH ${enName}`,
            description: enDesc || `NajmaH ${enName} subscription`,
            tax_category: 'standard',
            type: 'standard',
          }),
        });
        const prodJson = await prodRes.json();
        if (!prodRes.ok) {
          results.push({ tier: plan.tier, error: 'product_create_failed', details: prodJson });
          continue;
        }
        productId = prodJson?.data?.id;
      }

      const amountCents = Math.round(Number(plan.price_usd) * 100);
      const priceRes = await fetch(`${base}/prices`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          product_id: productId,
          description: `${enName} — Monthly USD`,
          unit_price: { amount: String(amountCents), currency_code: 'USD' },
          billing_cycle: { interval: 'month', frequency: 1 },
          quantity: { minimum: 1, maximum: 1 },
          tax_mode: 'account_setting',
        }),
      });
      const priceJson = await priceRes.json();
      if (!priceRes.ok) {
        results.push({ tier: plan.tier, error: 'price_create_failed', details: priceJson });
        continue;
      }
      const priceId = priceJson?.data?.id as string;

      await supabase.from('subscription_plans')
        .update({ paddle_product_id: productId, paddle_price_id: priceId })
        .eq('id', plan.id);

      results.push({ tier: plan.tier, productId, priceId, amount_usd: plan.price_usd });
    } catch (e) {
      results.push({ tier: plan.tier, error: (e as Error).message });
    }
  }

  return new Response(JSON.stringify({ environment: env, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
