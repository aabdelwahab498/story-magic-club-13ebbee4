-- Create ai_usage_costs table
CREATE TABLE IF NOT EXISTS public.ai_usage_costs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type TEXT NOT NULL,
    provider TEXT NOT NULL,
    units INTEGER NOT NULL DEFAULT 0,
    estimated_cost NUMERIC DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE public.ai_usage_costs ENABLE ROW LEVEL SECURITY;

-- Admins can read all
CREATE POLICY "Admins can read ai_usage_costs" ON public.ai_usage_costs FOR SELECT USING (public.has_role('admin'));

-- Only service role can insert (via backend)
-- so no INSERT policy needed for public/authenticated
