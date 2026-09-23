-- ==============================================================================
-- 20260721000000_backend_canonical_compatibility.sql
-- CANONICAL SUPABASE PROJECT COMPATIBILITY MIGRATION (obafpnloxexvyiodpsxz)
-- 
-- PURPOSE:
-- Additive migration containing ONLY missing backend-core operational tables
-- and types required for NestJS backend capability when operating against obaf.
--
-- SAFETY ASSURANCES:
-- - 100% IDEMPOTENT (IF NOT EXISTS for types, tables, indexes)
-- - NO DROP, TRUNCATE, DELETE, or RENAME operations
-- - DOES NOT touch, alter, or recreate obaf.stories (editorial catalog)
-- - DOES NOT alter or replace profiles, child_profiles, user_roles, or illustration_credits
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. ENUM TYPES FOR STORY & MEDIA LIFECYCLE
-- Required by backend-core for async generation status & media processing.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'story_status') THEN
        CREATE TYPE story_status AS ENUM (
            'draft',
            'queued',
            'generating',
            'generated',
            'illustrating',
            'narrating',
            'completed',
            'failed'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_type') THEN
        CREATE TYPE media_type AS ENUM ('ILLUSTRATION', 'AUDIO', 'PDF');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'media_status') THEN
        CREATE TYPE media_status AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. STORY_REQUESTS TABLE
-- Required to track async generation lifecycle for NestJS backend requests
-- without mutating the editorial catalog in obaf.stories.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  child_id UUID NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  status story_status NOT NULL DEFAULT 'draft',
  language TEXT NOT NULL DEFAULT 'en',
  reading_level TEXT NOT NULL,
  theme TEXT NOT NULL,
  sel_goal TEXT NOT NULL,
  page_count INTEGER NOT NULL DEFAULT 5,
  estimated_reading_time INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS story_requests_user_id_idx ON public.story_requests(user_id);
CREATE INDEX IF NOT EXISTS story_requests_child_id_idx ON public.story_requests(child_id);

ALTER TABLE public.story_requests ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_requests' AND policyname = 'Users can view their own story requests') THEN
        CREATE POLICY "Users can view their own story requests" ON public.story_requests FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_requests' AND policyname = 'Users can create their own story requests') THEN
        CREATE POLICY "Users can create their own story requests" ON public.story_requests FOR INSERT WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_requests' AND policyname = 'Users can update their own story requests') THEN
        CREATE POLICY "Users can update their own story requests" ON public.story_requests FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_requests' AND policyname = 'Users can delete their own story requests') THEN
        CREATE POLICY "Users can delete their own story requests" ON public.story_requests FOR DELETE USING (auth.uid() = user_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. STORY_MEDIA TABLE
-- Required for background illustration, narration, and PDF asset state.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.story_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    story_id UUID NOT NULL,
    type media_type NOT NULL,
    provider TEXT NOT NULL,
    status media_status NOT NULL DEFAULT 'PENDING',
    url TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_media_story_id ON public.story_media(story_id);

ALTER TABLE public.story_media ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'story_media' AND policyname = 'Users can view their own story media') THEN
        CREATE POLICY "Users can view their own story media" ON public.story_media FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.story_requests 
                WHERE story_requests.id = story_media.story_id 
                AND story_requests.user_id = auth.uid()
            )
            OR EXISTS (
                SELECT 1 FROM public.ai_story_history 
                WHERE ai_story_history.id = story_media.story_id 
                AND ai_story_history.user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. CHILD_LEARNING_PROGRESS TABLE
-- Required for reading level progression tracking per child profile.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.child_learning_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID NOT NULL REFERENCES public.child_profiles(id) ON DELETE CASCADE,
  previous_level TEXT NOT NULL,
  new_level TEXT NOT NULL,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS child_learning_progress_child_id_idx ON public.child_learning_progress(child_id);

ALTER TABLE public.child_learning_progress ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'child_learning_progress' AND policyname = 'Users can view their children learning progress') THEN
        CREATE POLICY "Users can view their children learning progress" ON public.child_learning_progress FOR SELECT USING (
            EXISTS (
                SELECT 1 FROM public.child_profiles
                WHERE id = child_learning_progress.child_id
                AND parent_user_id = auth.uid()
            )
        );
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 5. GENERALIZED USER CREDITS & USAGE TABLES
-- Required for backend platform features (export, audio, etc.).
-- Kept separate from canonical illustration_credits to avoid double charging.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_credits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()),
    CONSTRAINT positive_balance CHECK (balance >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS user_credits_user_id_idx ON public.user_credits(user_id);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL,
    transaction_type TEXT NOT NULL,
    reference_id UUID NULL,
    description TEXT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS credit_transactions_user_id_idx ON public.credit_transactions(user_id);

CREATE TABLE IF NOT EXISTS public.usage_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    resource_id UUID NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS usage_events_user_id_idx ON public.usage_events(user_id);
CREATE INDEX IF NOT EXISTS usage_events_event_type_idx ON public.usage_events(event_type);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usage_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'user_credits' AND policyname = 'Users can read own credits') THEN
        CREATE POLICY "Users can read own credits" ON public.user_credits FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'credit_transactions' AND policyname = 'Users can read own credit transactions') THEN
        CREATE POLICY "Users can read own credit transactions" ON public.credit_transactions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usage_events' AND policyname = 'Users can read own usage events') THEN
        CREATE POLICY "Users can read own usage events" ON public.usage_events FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 6. PAYMENT TRANSACTIONS & SUBSCRIPTION EVENTS TABLES
-- Required for NestJS billing & webhook processing.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payment_customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    customer_id TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (user_id, provider)
);

CREATE TABLE IF NOT EXISTS public.payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    transaction_id TEXT,
    amount NUMERIC,
    currency TEXT,
    status TEXT NOT NULL DEFAULT 'PENDING',
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.subscription_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    event_type TEXT NOT NULL,
    plan_id UUID NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payment_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_customers' AND policyname = 'Users can read own payment_customers') THEN
        CREATE POLICY "Users can read own payment_customers" ON public.payment_customers FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payment_transactions' AND policyname = 'Users can read own payment_transactions') THEN
        CREATE POLICY "Users can read own payment_transactions" ON public.payment_transactions FOR SELECT USING (auth.uid() = user_id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'subscription_events' AND policyname = 'Users can read own subscription_events') THEN
        CREATE POLICY "Users can read own subscription_events" ON public.subscription_events FOR SELECT USING (auth.uid() = user_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. AI USAGE COSTS TABLE
-- Required for telemetry and LLM cost accounting.
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_usage_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    units INTEGER NOT NULL DEFAULT 0,
    estimated_cost NUMERIC DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ai_usage_costs ENABLE ROW LEVEL SECURITY;
