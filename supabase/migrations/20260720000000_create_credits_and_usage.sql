-- Create user_credits table
CREATE TABLE IF NOT EXISTS public.user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    CONSTRAINT positive_balance CHECK (balance >= 0)
);

CREATE UNIQUE INDEX user_credits_user_id_idx ON public.user_credits(user_id);

-- Create credit_transactions table
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    reference_id UUID NULL,
    description TEXT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX credit_transactions_user_id_idx ON public.credit_transactions(user_id);

-- Create usage_events table
CREATE TABLE IF NOT EXISTS public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    resource_id UUID NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE INDEX usage_events_user_id_idx ON public.usage_events(user_id);
CREATE INDEX usage_events_event_type_idx ON public.usage_events(event_type);

-- RLS Policies
ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own credits and transactions
CREATE POLICY "Users can read own credits" ON public.user_credits
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own credit transactions" ON public.credit_transactions
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can read own usage events" ON public.usage_events
    FOR SELECT USING (auth.uid() = user_id);

-- Only service role can insert/update (backend)
CREATE POLICY "Service role full access user_credits" ON public.user_credits
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access credit_transactions" ON public.credit_transactions
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access usage_events" ON public.usage_events
    FOR ALL USING (auth.role() = 'service_role');
