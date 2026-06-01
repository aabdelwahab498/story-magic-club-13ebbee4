// Records an order notification, and (if Lovable Email infrastructure is configured)
// enqueues a transactional email. Falls back to logging-only when no email queue exists.
import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

type Payload = {
  order_id: string;
  event: 'paid' | 'fulfilled' | 'shipped' | 'delivered' | 'cancelled';
  admin_note?: string;
};

const SUBJECTS: Record<string, { en: string; ar: string }> = {
  paid:       { en: 'Payment received',           ar: 'تم استلام الدفع' },
  fulfilled:  { en: 'Your order is ready',        ar: 'طلبك جاهز للتسليم' },
  shipped:    { en: 'Your order has shipped',     ar: 'تم شحن طلبك' },
  delivered:  { en: 'Your order has been delivered', ar: 'تم تسليم طلبك' },
  cancelled:  { en: 'Your order was cancelled',   ar: 'تم إلغاء طلبك' },
};

function renderHtml(opts: {
  event: string;
  shortId: string;
  total: string;
  currency: string;
  tracking?: string | null;
  carrier?: string | null;
  note?: string | null;
  lang: 'en' | 'ar';
}) {
  const isAr = opts.lang === 'ar';
  const dir = isAr ? 'rtl' : 'ltr';
  const lines: Record<string, string> = isAr
    ? {
        paid: 'تم تأكيد دفع طلبك بنجاح. سنبدأ التحضير قريبًا.',
        fulfilled: 'طلبك تمت مراجعته والموافقة عليه وجاهز لتسليمه إليك.',
        shipped: 'تم شحن طلبك. يمكنك تتبعه باستخدام البيانات أدناه.',
        delivered: 'تم تسليم طلبك بنجاح. نتمنى لك تجربة ممتعة!',
        cancelled: 'تم إلغاء طلبك. إذا كان لديك أي استفسار تواصل معنا.',
      }
    : {
        paid: 'Your payment was received successfully. We will start preparing your order shortly.',
        fulfilled: 'Your order has been reviewed and approved for delivery.',
        shipped: 'Your order is on its way. Use the tracking details below to follow it.',
        delivered: 'Your order has been delivered. We hope you enjoy it!',
        cancelled: 'Your order has been cancelled. Please contact us if you have any questions.',
      };

  const body = lines[opts.event] ?? '';
  const tracking = opts.tracking
    ? `<p style="margin:8px 0"><b>${isAr ? 'رقم الشحن:' : 'Tracking:'}</b> ${opts.carrier ?? ''} ${opts.tracking}</p>`
    : '';
  const note = opts.note ? `<p style="margin:8px 0;color:#555">${opts.note}</p>` : '';

  return `<!doctype html><html dir="${dir}"><body style="font-family:system-ui,sans-serif;background:#faf7ff;padding:24px">
    <div style="max-width:520px;margin:auto;background:#fff;border-radius:16px;padding:24px;border:1px solid #eee">
      <h2 style="margin:0 0 8px;color:#5b21b6">${isAr ? 'تحديث طلبك' : 'Order update'}</h2>
      <p style="margin:0 0 16px;color:#333">${body}</p>
      <p style="margin:4px 0"><b>${isAr ? 'رقم الطلب:' : 'Order:'}</b> #${opts.shortId}</p>
      <p style="margin:4px 0"><b>${isAr ? 'الإجمالي:' : 'Total:'}</b> ${opts.total} ${opts.currency}</p>
      ${tracking}
      ${note}
      <p style="margin:24px 0 0;color:#888;font-size:12px">Starry Tales</p>
    </div></body></html>`;
}

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

  let body: Payload;
  try { body = await req.json() as Payload; } catch {
    return new Response(JSON.stringify({ error: 'invalid_json' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
  if (!body?.order_id || !body?.event) {
    return new Response(JSON.stringify({ error: 'missing_fields' }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: order, error: orderErr } = await supabase
    .from('orders')
    .select('id, user_id, total_amount, currency, tracking_number, tracking_carrier, shipping_name')
    .eq('id', body.order_id)
    .maybeSingle();
  if (orderErr || !order) {
    return new Response(JSON.stringify({ error: 'order_not_found' }), {
      status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Resolve recipient email + language from auth user / profile
  const { data: ownerData } = await supabase.auth.admin.getUserById(order.user_id);
  const email = ownerData?.user?.email ?? null;
  const { data: prof } = await supabase
    .from('profiles')
    .select('preferred_language')
    .eq('user_id', order.user_id)
    .maybeSingle();
  const lang: 'en' | 'ar' = (prof?.preferred_language ?? 'en').startsWith('ar') ? 'ar' : 'en';

  const subject = SUBJECTS[body.event]?.[lang] ?? 'Order update';
  const html = renderHtml({
    event: body.event,
    shortId: order.id.slice(0, 8),
    total: Number(order.total_amount).toFixed(2),
    currency: order.currency,
    tracking: order.tracking_number,
    carrier: order.tracking_carrier,
    note: body.admin_note ?? null,
    lang,
  });

  // Try to enqueue via Lovable Email infra (table created by setup_email_infra).
  // If the RPC doesn't exist, we silently fall back to log-only.
  let emailStatus: 'sent' | 'queued' | 'skipped' | 'failed' = 'skipped';
  let emailError: string | null = null;
  if (email) {
    try {
      const { error: enqErr } = await supabase.rpc('enqueue_email', {
        queue_name: 'transactional_emails',
        payload: {
          to: email,
          subject,
          html,
          purpose: 'transactional',
          template_name: 'order_status',
          template_vars: { event: body.event, order_id: order.id },
        },
      });
      if (enqErr) {
        // Function probably not installed yet — leave as skipped (log only).
        emailStatus = 'skipped';
        emailError = enqErr.message;
      } else {
        emailStatus = 'queued';
      }
    } catch (e) {
      emailStatus = 'failed';
      emailError = (e as Error).message;
    }
  } else {
    emailStatus = 'skipped';
    emailError = 'no_recipient_email';
  }

  await supabase.from('order_notifications').insert({
    order_id: order.id,
    user_id: order.user_id,
    event: body.event,
    channel: 'email',
    recipient: email,
    status: emailStatus,
    error: emailError,
    payload: { subject, admin_note: body.admin_note ?? null, lang },
    sent_at: emailStatus === 'queued' ? new Date().toISOString() : null,
  });

  return new Response(JSON.stringify({
    ok: true, email_status: emailStatus, recipient: email,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
