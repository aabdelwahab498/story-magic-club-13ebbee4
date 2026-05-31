// Returns the public client token + environment so the frontend can init Paddle.js.
// Also returns the active plan -> paddle_price_id mapping.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const clientToken = Deno.env.get('PADDLE_CLIENT_TOKEN') ?? '';
    const environment = (Deno.env.get('PADDLE_ENVIRONMENT') ?? 'sandbox').toLowerCase();

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: plans } = await supabase
      .from('subscription_plans')
      .select('tier, paddle_price_id, paddle_product_id, price_usd, name')
      .eq('active', true)
      .order('sort_order', { ascending: true });

    return new Response(
      JSON.stringify({
        clientToken,
        environment: environment === 'production' ? 'production' : 'sandbox',
        plans: plans ?? [],
        configured: Boolean(clientToken),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: (e as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
