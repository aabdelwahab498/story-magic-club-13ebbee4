/* eslint-disable @typescript-eslint/no-explicit-any */
// New tables not yet in generated types; using untyped casts.
import { supabase } from "@/integrations/supabase/client";

// ============== TYPES ==============
export type AiTone = "professional" | "friendly" | "educational" | "marketing" | "custom";

export interface AiAgent {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  system_prompt: string;
  tone: AiTone;
  custom_tone_text: string | null;
  model: string;
  temperature: number;
  max_tokens: number;
  active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface AiPromptTemplate {
  id: string;
  name: string;
  slug: string;
  category: string;
  body: string;
  variables: unknown;
  active: boolean;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface AiPromptVersion {
  id: string;
  template_id: string;
  version_no: number;
  body: string;
  variables: unknown;
  changelog: string | null;
  published: boolean;
  created_at: string;
}

export interface AiFeatureToggle {
  id: string;
  feature_key: string;
  label: string;
  description: string | null;
  enabled: boolean;
  config: Record<string, unknown>;
  updated_at: string;
}

export interface AiUsageLimit {
  id: string;
  scope: "global" | "role" | "user";
  role: string | null;
  user_id: string | null;
  feature_key: string | null;
  daily_limit: number | null;
  monthly_limit: number | null;
  notes: string | null;
}

export interface AiUsageLog {
  id: string;
  user_id: string | null;
  agent_id: string | null;
  feature_key: string;
  model: string | null;
  tokens_in: number | null;
  tokens_out: number | null;
  cost_usd: number | null;
  latency_ms: number | null;
  status: string;
  error: string | null;
  created_at: string;
}

export interface AiAuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before: unknown;
  after: unknown;
  created_at: string;
}

export interface PdfTemplate {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  layout: Record<string, unknown>;
  header_html: string | null;
  footer_html: string | null;
  branding: Record<string, unknown>;
  page_size: string;
  orientation: string;
  active: boolean;
  is_default: boolean;
}

export interface VoiceProfile {
  id: string;
  name: string;
  provider: string;
  voice_id: string;
  language: string | null;
  gender: string | null;
  sample_url: string | null;
  description: string | null;
  active: boolean;
  is_default: boolean;
}

export interface RbacPermission {
  id: string;
  role: string;
  permission_key: string;
  granted: boolean;
}

// ============== AGENTS ==============
export async function fetchAgents() {
  const { data, error } = await supabase
    .from("ai_agents" as any)
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AiAgent[];
}

export async function upsertAgent(agent: Partial<AiAgent> & { id?: string }) {
  const payload = {
    name: agent.name,
    slug: agent.slug,
    description: agent.description ?? null,
    system_prompt: agent.system_prompt ?? "",
    tone: agent.tone ?? "friendly",
    custom_tone_text: agent.custom_tone_text ?? null,
    model: agent.model ?? "google/gemini-3-flash-preview",
    temperature: agent.temperature ?? 0.7,
    max_tokens: agent.max_tokens ?? 2048,
    active: agent.active ?? true,
    is_default: agent.is_default ?? false,
  };
  const q = agent.id
    ? supabase.from("ai_agents" as any).update(payload).eq("id", agent.id)
    : supabase.from("ai_agents" as any).insert(payload);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteAgent(id: string) {
  const { error } = await supabase.from("ai_agents" as any).delete().eq("id", id);
  if (error) throw error;
}

// ============== PROMPT TEMPLATES ==============
export async function fetchPromptTemplates() {
  const { data, error } = await supabase
    .from("ai_prompt_templates" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AiPromptTemplate[];
}

export async function upsertPromptTemplate(t: Partial<AiPromptTemplate> & { id?: string }) {
  const payload = {
    name: t.name,
    slug: t.slug,
    category: t.category ?? "general",
    body: t.body ?? "",
    variables: t.variables ?? [],
    active: t.active ?? true,
  };
  if (t.id) {
    // Save current as version then update
    const { data: existing } = await supabase
      .from("ai_prompt_templates" as any)
      .select("*")
      .eq("id", t.id)
      .maybeSingle();
    if (existing) {
      const ex = existing as unknown as AiPromptTemplate;
      await supabase.from("ai_prompt_versions" as any).insert({
        template_id: t.id,
        version_no: ex.current_version,
        body: ex.body,
        variables: ex.variables,
        changelog: "Auto-snapshot before edit",
      });
      const { error } = await supabase
        .from("ai_prompt_templates" as any)
        .update({ ...payload, current_version: ex.current_version + 1 })
        .eq("id", t.id);
      if (error) throw error;
    }
  } else {
    const { error } = await supabase.from("ai_prompt_templates" as any).insert(payload);
    if (error) throw error;
  }
}

export async function deletePromptTemplate(id: string) {
  const { error } = await supabase.from("ai_prompt_templates" as any).delete().eq("id", id);
  if (error) throw error;
}

export async function fetchPromptVersions(templateId: string) {
  const { data, error } = await supabase
    .from("ai_prompt_versions" as any)
    .select("*")
    .eq("template_id", templateId)
    .order("version_no", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AiPromptVersion[];
}

export async function rollbackPromptVersion(templateId: string, versionId: string) {
  const { data: ver } = await supabase
    .from("ai_prompt_versions" as any)
    .select("*")
    .eq("id", versionId)
    .maybeSingle();
  if (!ver) throw new Error("Version not found");
  const v = ver as unknown as AiPromptVersion;
  const { data: tpl } = await supabase
    .from("ai_prompt_templates" as any)
    .select("current_version")
    .eq("id", templateId)
    .maybeSingle();
  const nextVer = ((tpl as unknown as AiPromptTemplate)?.current_version ?? 1) + 1;
  const { error } = await supabase
    .from("ai_prompt_templates" as any)
    .update({ body: v.body, variables: v.variables, current_version: nextVer })
    .eq("id", templateId);
  if (error) throw error;
}

// ============== FEATURE TOGGLES ==============
export async function fetchFeatureToggles() {
  const { data, error } = await supabase
    .from("ai_feature_toggles" as any)
    .select("*")
    .order("label");
  if (error) throw error;
  return (data ?? []) as unknown as AiFeatureToggle[];
}

export async function setFeatureToggle(featureKey: string, enabled: boolean) {
  const { error } = await supabase
    .from("ai_feature_toggles" as any)
    .update({ enabled })
    .eq("feature_key", featureKey);
  if (error) throw error;
}

// ============== USAGE LIMITS ==============
export async function fetchUsageLimits() {
  const { data, error } = await supabase
    .from("ai_usage_limits" as any)
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as AiUsageLimit[];
}

export async function upsertUsageLimit(l: Partial<AiUsageLimit> & { id?: string }) {
  const payload = {
    scope: l.scope ?? "global",
    role: l.role ?? null,
    user_id: l.user_id ?? null,
    feature_key: l.feature_key ?? null,
    daily_limit: l.daily_limit ?? null,
    monthly_limit: l.monthly_limit ?? null,
    notes: l.notes ?? null,
  };
  const q = l.id
    ? supabase.from("ai_usage_limits" as any).update(payload).eq("id", l.id)
    : supabase.from("ai_usage_limits" as any).insert(payload);
  const { error } = await q;
  if (error) throw error;
}

export async function deleteUsageLimit(id: string) {
  const { error } = await supabase.from("ai_usage_limits" as any).delete().eq("id", id);
  if (error) throw error;
}

// ============== USAGE LOGS / ANALYTICS ==============
export async function fetchUsageLogs(limit = 200) {
  const { data, error } = await supabase
    .from("ai_usage_logs" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AiUsageLog[];
}

export interface UsageStats {
  totalRequests: number;
  failed: number;
  avgLatency: number;
  totalCost: number;
  activeUsers: number;
  byFeature: { feature: string; count: number }[];
  byDay: { day: string; count: number; cost: number }[];
}

export async function fetchUsageStats(days = 30): Promise<UsageStats> {
  const since = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();
  const { data, error } = await supabase
    .from("ai_usage_logs" as any)
    .select("user_id,feature_key,latency_ms,cost_usd,status,created_at")
    .gte("created_at", since)
    .limit(10000);
  if (error) throw error;
  const rows = ((data ?? []) as unknown) as Array<{
    user_id: string | null;
    feature_key: string;
    latency_ms: number | null;
    cost_usd: number | null;
    status: string;
    created_at: string;
  }>;
  const totalRequests = rows.length;
  const failed = rows.filter((r) => r.status !== "success").length;
  const avgLatency = rows.length
    ? Math.round(rows.reduce((s, r) => s + (r.latency_ms ?? 0), 0) / rows.length)
    : 0;
  const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd ?? 0), 0);
  const activeUsers = new Set(rows.map((r) => r.user_id).filter(Boolean)).size;
  const feat: Record<string, number> = {};
  rows.forEach((r) => (feat[r.feature_key] = (feat[r.feature_key] ?? 0) + 1));
  const byFeature = Object.entries(feat)
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count);
  const dayMap: Record<string, { count: number; cost: number }> = {};
  rows.forEach((r) => {
    const day = r.created_at.slice(0, 10);
    dayMap[day] = dayMap[day] ?? { count: 0, cost: 0 };
    dayMap[day].count++;
    dayMap[day].cost += Number(r.cost_usd ?? 0);
  });
  const byDay = Object.entries(dayMap)
    .map(([day, v]) => ({ day, ...v }))
    .sort((a, b) => a.day.localeCompare(b.day));
  return { totalRequests, failed, avgLatency, totalCost, activeUsers, byFeature, byDay };
}

// ============== AUDIT LOGS ==============
export async function fetchAuditLogs(limit = 200) {
  // Defense-in-depth: require an authenticated session before issuing the query.
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) throw new Error("not_authenticated");
  const { data, error } = await supabase
    .from("ai_audit_logs" as any)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as unknown as AiAuditLog[];
}

export async function fetchAuditLogsPaged(opts: {
  page: number;
  pageSize: number;
  userId?: string;
  from?: string;
  to?: string;
  search?: string;
}) {
  const { data: sess } = await supabase.auth.getSession();
  if (!sess.session) throw new Error("not_authenticated");
  const start = opts.page * opts.pageSize;
  const end = start + opts.pageSize - 1;
  let q = supabase
    .from("ai_audit_logs" as any)
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false });
  if (opts.userId) q = q.eq("actor_id", opts.userId);
  if (opts.from) q = q.gte("created_at", new Date(opts.from).toISOString());
  if (opts.to) {
    const toDate = new Date(opts.to);
    toDate.setDate(toDate.getDate() + 1);
    q = q.lt("created_at", toDate.toISOString());
  }
  if (opts.search) q = q.or(
    `action.ilike.%${opts.search}%,entity_type.ilike.%${opts.search}%,entity_id.ilike.%${opts.search}%`,
  );
  const { data, error, count } = await q.range(start, end);
  if (error) throw error;
  return { rows: (data ?? []) as unknown as AiAuditLog[], total: count ?? 0 };
}

export async function logAudit(
  action: string,
  entity_type: string,
  entity_id: string | null,
  before: unknown,
  after: unknown,
) {
  const { data: u } = await supabase.auth.getUser();
  await supabase.from("ai_audit_logs" as any).insert({
    actor_id: u.user?.id ?? null,
    action,
    entity_type,
    entity_id,
    before,
    after,
  });
}

// ============== PDF TEMPLATES ==============
export async function fetchPdfTemplates() {
  const { data, error } = await supabase
    .from("pdf_templates" as any)
    .select("*")
    .order("is_default", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as PdfTemplate[];
}
export async function upsertPdfTemplate(t: Partial<PdfTemplate> & { id?: string }) {
  const payload = {
    name: t.name,
    slug: t.slug,
    description: t.description ?? null,
    layout: t.layout ?? {},
    header_html: t.header_html ?? null,
    footer_html: t.footer_html ?? null,
    branding: t.branding ?? {},
    page_size: t.page_size ?? "A4",
    orientation: t.orientation ?? "portrait",
    active: t.active ?? true,
    is_default: t.is_default ?? false,
  };
  const q = t.id
    ? supabase.from("pdf_templates" as any).update(payload).eq("id", t.id)
    : supabase.from("pdf_templates" as any).insert(payload);
  const { error } = await q;
  if (error) throw error;
}
export async function deletePdfTemplate(id: string) {
  const { error } = await supabase.from("pdf_templates" as any).delete().eq("id", id);
  if (error) throw error;
}

// ============== VOICE PROFILES ==============
export async function fetchVoices() {
  const { data, error } = await supabase
    .from("audio_voice_profiles" as any)
    .select("*")
    .order("is_default", { ascending: false })
    .order("name");
  if (error) throw error;
  return (data ?? []) as unknown as VoiceProfile[];
}
export async function upsertVoice(v: Partial<VoiceProfile> & { id?: string }) {
  const payload = {
    name: v.name,
    provider: v.provider ?? "openai",
    voice_id: v.voice_id,
    language: v.language ?? "en",
    gender: v.gender ?? null,
    sample_url: v.sample_url ?? null,
    description: v.description ?? null,
    active: v.active ?? true,
    is_default: v.is_default ?? false,
  };
  const q = v.id
    ? supabase.from("audio_voice_profiles" as any).update(payload).eq("id", v.id)
    : supabase.from("audio_voice_profiles" as any).insert(payload);
  const { error } = await q;
  if (error) throw error;
}
export async function deleteVoice(id: string) {
  const { error } = await supabase.from("audio_voice_profiles" as any).delete().eq("id", id);
  if (error) throw error;
}

// ============== RBAC ==============
export async function fetchPermissions() {
  const { data, error } = await supabase
    .from("rbac_permissions" as any)
    .select("*")
    .order("role")
    .order("permission_key");
  if (error) throw error;
  return (data ?? []) as unknown as RbacPermission[];
}
export async function setPermission(role: string, permission_key: string, granted: boolean) {
  const { error } = await supabase
    .from("rbac_permissions" as any)
    .upsert({ role, permission_key, granted }, { onConflict: "role,permission_key" });
  if (error) throw error;
}
