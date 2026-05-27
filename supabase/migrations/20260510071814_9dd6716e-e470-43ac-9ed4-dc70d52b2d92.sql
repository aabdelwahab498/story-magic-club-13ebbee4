
-- Plans
CREATE TABLE public.subscription_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tier text NOT NULL UNIQUE,
  name jsonb NOT NULL DEFAULT '{}'::jsonb,
  description jsonb NOT NULL DEFAULT '{}'::jsonb,
  price_egp numeric NOT NULL DEFAULT 0,
  price_usd numeric NOT NULL DEFAULT 0,
  monthly_story_limit integer NOT NULL DEFAULT 0,
  allow_illustrations boolean NOT NULL DEFAULT false,
  allow_pdf boolean NOT NULL DEFAULT false,
  allow_audio boolean NOT NULL DEFAULT false,
  features jsonb NOT NULL DEFAULT '[]'::jsonb,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads active plans" ON public.subscription_plans FOR SELECT USING (active = true OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage plans" ON public.subscription_plans FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_plans_updated BEFORE UPDATE ON public.subscription_plans FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User subscriptions
CREATE TABLE public.user_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_tier text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  starts_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz,
  payment_method text,
  payment_request_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_user_subs_user ON public.user_subscriptions(user_id);
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own subs" ON public.user_subscriptions FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Admins manage subs" ON public.user_subscriptions FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE POLICY "Users insert own free sub" ON public.user_subscriptions FOR INSERT WITH CHECK (auth.uid() = user_id AND plan_tier = 'free');
CREATE TRIGGER trg_subs_updated BEFORE UPDATE ON public.user_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Manual payment requests
CREATE TABLE public.manual_payment_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_tier text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  method text NOT NULL,
  proof_url text,
  sender_name text,
  sender_phone text,
  transaction_ref text,
  status text NOT NULL DEFAULT 'pending',
  admin_note text,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_payreq_user ON public.manual_payment_requests(user_id);
CREATE INDEX idx_payreq_status ON public.manual_payment_requests(status);
ALTER TABLE public.manual_payment_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users view own payment reqs" ON public.manual_payment_requests FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(),'admin'));
CREATE POLICY "Users create own payment reqs" ON public.manual_payment_requests FOR INSERT WITH CHECK (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Users update own pending" ON public.manual_payment_requests FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');
CREATE POLICY "Admins manage payment reqs" ON public.manual_payment_requests FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_payreq_updated BEFORE UPDATE ON public.manual_payment_requests FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payment settings (single row)
CREATE TABLE public.payment_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instapay_handle text,
  vodafone_number text,
  bank_info jsonb NOT NULL DEFAULT '{}'::jsonb,
  instructions_ar text,
  instructions_en text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone reads payment settings" ON public.payment_settings FOR SELECT USING (true);
CREATE POLICY "Admins manage payment settings" ON public.payment_settings FOR ALL USING (has_role(auth.uid(),'admin')) WITH CHECK (has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_paysettings_updated BEFORE UPDATE ON public.payment_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Storage bucket
INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs','payment-proofs', false) ON CONFLICT DO NOTHING;
CREATE POLICY "Users upload own proofs" ON storage.objects FOR INSERT WITH CHECK (bucket_id='payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);
CREATE POLICY "Users view own proofs" ON storage.objects FOR SELECT USING (bucket_id='payment-proofs' AND (auth.uid()::text = (storage.foldername(name))[1] OR has_role(auth.uid(),'admin')));
CREATE POLICY "Users delete own proofs" ON storage.objects FOR DELETE USING (bucket_id='payment-proofs' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Seed plans
INSERT INTO public.subscription_plans (tier, name, description, price_egp, price_usd, monthly_story_limit, allow_illustrations, allow_pdf, allow_audio, features, sort_order) VALUES
('free',
  '{"ar":"مجاني","en":"Free"}'::jsonb,
  '{"ar":"للتجربة","en":"Try it out"}'::jsonb,
  0, 0, 5, false, false, false,
  '[{"ar":"5 قصص شهرياً","en":"5 stories/month"},{"ar":"بدون رسومات","en":"No illustrations"}]'::jsonb,
  1),
('family',
  '{"ar":"عائلة","en":"Family"}'::jsonb,
  '{"ar":"للأسرة الصغيرة","en":"For small families"}'::jsonb,
  149, 4.99, 30, true, true, false,
  '[{"ar":"30 قصة شهرياً","en":"30 stories/month"},{"ar":"رسومات تلقائية","en":"AI illustrations"},{"ar":"تصدير PDF","en":"PDF export"}]'::jsonb,
  2),
('premium',
  '{"ar":"بريميوم","en":"Premium"}'::jsonb,
  '{"ar":"بدون حدود + صوت","en":"Unlimited + audio"}'::jsonb,
  299, 9.99, 999, true, true, true,
  '[{"ar":"قصص غير محدودة","en":"Unlimited stories"},{"ar":"رسومات + PDF","en":"Illustrations + PDF"},{"ar":"تعليق صوتي","en":"Audio narration"},{"ar":"أولوية الدعم","en":"Priority support"}]'::jsonb,
  3);

INSERT INTO public.payment_settings (instapay_handle, vodafone_number, instructions_ar, instructions_en) VALUES
('starrytales@instapay', '01000000000',
 'حوّل المبلغ بالضبط ثم ارفع لقطة شاشة إثبات التحويل. ستتم المراجعة خلال 24 ساعة.',
 'Transfer the exact amount, then upload a screenshot as proof. Reviewed within 24h.');
