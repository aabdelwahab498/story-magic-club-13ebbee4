import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PlanAPI {
  id: string;
  name: Record<string, string>;
  slug: string;
  description: Record<string, string>;
  price_usd: number;
  price_egp: number;
  is_featured: boolean;
  features: string[];
  limits: Record<string, number | null>;
}

const asRecord = (v: unknown): Record<string, string> =>
  v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, string>) : {};

/** Reads active subscription plans straight from the database (public read policy). */
export async function fetchPlans(): Promise<PlanAPI[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("active", true)
    .order("sort_order", { ascending: true });
  if (error) throw error;

  return (data ?? []).map((row) => {
    const r = row as Record<string, unknown>;
    const features: string[] = ["STORY_GENERATION"];
    if (r.allow_illustrations) features.push("ILLUSTRATION_GENERATION", "REGENERATE_ILLUSTRATION");
    if (r.allow_pdf) features.push("PDF_EXPORT");
    if (r.allow_audio) features.push("AUDIO_NARRATION");

    return {
      id: r.id as string,
      slug: r.tier as string,
      name: asRecord(r.name),
      description: asRecord(r.description),
      price_usd: Number(r.price_usd ?? 0),
      price_egp: Number(r.price_egp ?? 0),
      is_featured: (r.tier as string) === "growth",
      features,
      limits: {
        STORIES_PER_MONTH: (r.monthly_story_limit as number) ?? null,
        STORIES_PER_DAY: (r.daily_story_limit as number) ?? null,
        ILLUSTRATION_CREDITS: (r.illustration_credits as number) ?? null,
      },
    } satisfies PlanAPI;
  });
}

export const usePlans = (enabled = true) =>
  useQuery({
    queryKey: ["subscription_plans_public"],
    queryFn: fetchPlans,
    staleTime: 5 * 60_000,
    enabled,
  });
