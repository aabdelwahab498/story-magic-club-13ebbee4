-- 1. Create tables

CREATE TABLE IF NOT EXISTS public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

CREATE TABLE public.plan_features (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    feature_key TEXT NOT NULL,
    enabled BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE (plan_id, feature_key)
);

CREATE TABLE public.plan_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plan_id UUID REFERENCES public.subscription_plans(id) ON DELETE CASCADE,
    limit_key TEXT NOT NULL,
    limit_value INTEGER,
    period TEXT DEFAULT 'MONTHLY',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE (plan_id, limit_key)
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
    status TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, CANCELLED, EXPIRED
    started_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    expires_at TIMESTAMP WITH TIME ZONE NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE (user_id) -- currently 1 active subscription per user
);

-- 2. Setup RLS

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Plans, features, limits are readable by all authenticated users
CREATE POLICY "Subscription plans are viewable by all authenticated users."
    ON public.subscription_plans FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Plan features are viewable by all authenticated users."
    ON public.plan_features FOR SELECT
    USING (auth.role() = 'authenticated');

CREATE POLICY "Plan limits are viewable by all authenticated users."
    ON public.plan_limits FOR SELECT
    USING (auth.role() = 'authenticated');

-- User subscriptions are viewable by the user who owns them
CREATE POLICY "Users can view their own subscriptions."
    ON public.user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Admins can view/modify everything (Assuming 'admin' role check logic)
CREATE POLICY "Admins have full access to subscription_plans"
    ON public.subscription_plans
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins have full access to plan_features"
    ON public.plan_features
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins have full access to plan_limits"
    ON public.plan_limits
    USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins have full access to user_subscriptions"
    ON public.user_subscriptions
    USING (public.has_role(auth.uid(), 'admin'));


-- 3. Seed initial plans and limits

DO $$
DECLARE
    free_plan_id UUID := gen_random_uuid();
    premium_plan_id UUID := gen_random_uuid();
BEGIN
    -- Insert Plans
    INSERT INTO public.subscription_plans (id, tier, name, slug, description)
    VALUES 
        (free_plan_id, 'FREE', jsonb_build_object('en','Free'), 'FREE', jsonb_build_object('en','Basic access to Najmah AI Story Studio')),
        (premium_plan_id, 'PREMIUM', jsonb_build_object('en','Premium'), 'PREMIUM', jsonb_build_object('en','Full access with higher limits and premium features'));

    -- Insert Free Plan Features
    INSERT INTO public.plan_features (plan_id, feature_key, enabled)
    VALUES 
        (free_plan_id, 'STORY_GENERATION', true),
        (free_plan_id, 'ILLUSTRATION_GENERATION', true),
        (free_plan_id, 'PDF_EXPORT', false),
        (free_plan_id, 'REGENERATE_ILLUSTRATION', false);

    -- Insert Free Plan Limits
    INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
    VALUES 
        (free_plan_id, 'STORIES_PER_MONTH', 3),
        (free_plan_id, 'ILLUSTRATIONS_PER_MONTH', 20);

    -- Insert Premium Plan Features
    INSERT INTO public.plan_features (plan_id, feature_key, enabled)
    VALUES 
        (premium_plan_id, 'STORY_GENERATION', true),
        (premium_plan_id, 'ILLUSTRATION_GENERATION', true),
        (premium_plan_id, 'PDF_EXPORT', true),
        (premium_plan_id, 'REGENERATE_ILLUSTRATION', true);

    -- Insert Premium Plan Limits
    INSERT INTO public.plan_limits (plan_id, limit_key, limit_value)
    VALUES 
        (premium_plan_id, 'STORIES_PER_MONTH', 100),
        (premium_plan_id, 'ILLUSTRATIONS_PER_MONTH', 500);

END $$;

-- 4. Trigger to give new users the FREE plan automatically
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
DECLARE
    free_plan_id UUID;
BEGIN
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE slug = 'FREE' LIMIT 1;
    
    IF free_plan_id IS NOT NULL THEN
        INSERT INTO public.user_subscriptions (user_id, plan_id, status)
        VALUES (NEW.id, free_plan_id, 'ACTIVE');
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Note: In Supabase, the user creation happens in auth.users. 
-- We assume there is already a trigger for public.users. 
-- We will just add this to the existing trigger or create a new one.
CREATE TRIGGER on_auth_user_created_subscription
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_subscription();

-- Backfill existing users
DO $$
DECLARE
    free_plan_id UUID;
    user_record RECORD;
BEGIN
    SELECT id INTO free_plan_id FROM public.subscription_plans WHERE slug = 'FREE' LIMIT 1;
    
    IF free_plan_id IS NOT NULL THEN
        FOR user_record IN SELECT id FROM auth.users WHERE id NOT IN (SELECT user_id FROM public.user_subscriptions)
        LOOP
            INSERT INTO public.user_subscriptions (user_id, plan_id, status)
            VALUES (user_record.id, free_plan_id, 'ACTIVE');
        END LOOP;
    END IF;
END $$;
