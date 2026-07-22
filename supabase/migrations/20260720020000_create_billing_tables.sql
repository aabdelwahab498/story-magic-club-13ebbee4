-- Create payment_customers table
CREATE TABLE IF NOT EXISTS public.payment_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

-- Create payment_transactions table
CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    transaction_id TEXT,
    amount NUMERIC,
    currency TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create subscription_events table
CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE SET NULL,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.payment_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- Admins can read all
CREATE POLICY "Admins can read payment_customers" ON public.payment_customers FOR SELECT USING (public.has_role('admin'));
CREATE POLICY "Admins can read payment_transactions" ON public.payment_transactions FOR SELECT USING (public.has_role('admin'));
CREATE POLICY "Admins can read subscription_events" ON public.subscription_events FOR SELECT USING (public.has_role('admin'));

-- Users can read their own
CREATE POLICY "Users can read own payment_customers" ON public.payment_customers FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own payment_transactions" ON public.payment_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can read own subscription_events" ON public.subscription_events FOR SELECT USING (auth.uid() = user_id);
