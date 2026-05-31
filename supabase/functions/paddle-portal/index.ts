// Returns the URL to manage / cancel a subscription via Paddle Customer Portal.
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

  const { data: sub } = await supabase
    .from('paddle_subscriptions')
    .select('paddle_customer_id, paddle_subscription_id')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!sub?.paddle_customer_id) {
    return new Response(JSON.stringify({ error: 'no_subscription' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const env = (Deno.env.get('PADDLE_ENVIRONMENT') ?? 'sandbox').toLowerCase();
  const base = env === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';

  const apiKey = Deno.env.get('PADDLE_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'api_key_missing' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const res = await fetch(
    `${base}/customers/${sub.paddle_customer_id}/portal-sessions`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subscription_ids: sub.paddle_subscription_id ? [sub.paddle_subscription_id] : [],
      }),
    },
  );

  const json = await res.json();
  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'paddle_error', details: json }), {
      status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const url = json?.data?.urls?.general?.overview ?? json?.data?.urls?.general?.subscription;

  return new Response(JSON.stringify({ url }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
