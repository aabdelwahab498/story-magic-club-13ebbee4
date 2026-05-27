import { supabase } from "@/integrations/supabase/client";

export type PlanTier = "free" | "family" | "premium";
export type Currency = "EGP" | "USD";
export type PaymentMethod = "instapay" | "vodafone_cash" | "payoneer" | "bank_transfer";
export type PaymentStatus = "pending" | "approved" | "rejected";

export interface SubscriptionPlan {
  id: string;
  tier: PlanTier;
  name: { ar?: string; en?: string };
  description: { ar?: string; en?: string };
  price_egp: number;
  price_usd: number;
  monthly_story_limit: number;
  allow_illustrations: boolean;
  allow_pdf: boolean;
  allow_audio: boolean;
  features: { ar?: string; en?: string }[];
  active: boolean;
  sort_order: number;
}

export interface UserSubscription {
  id: string;
  user_id: string;
  plan_tier: PlanTier;
  status: "active" | "expired" | "cancelled";
  starts_at: string;
  expires_at: string | null;
  payment_method: string | null;
}

export interface ManualPaymentRequest {
  id: string;
  user_id: string;
  plan_tier: PlanTier;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  proof_url: string | null;
  sender_name: string | null;
  sender_phone: string | null;
  transaction_ref: string | null;
  status: PaymentStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export type PayCurrency = "EGP" | "USD";

export interface PaymentSettings {
  id: string;
  instapay_handle: string | null;
  vodafone_number: string | null;
  bank_info: Record<string, unknown>;
  instructions_ar: string | null;
  instructions_en: string | null;
  instapay_enabled: boolean;
  instapay_currencies: PayCurrency[];
  vodafone_enabled: boolean;
  vodafone_currencies: PayCurrency[];
  payoneer_enabled: boolean;
  payoneer_email: string | null;
  payoneer_currencies: PayCurrency[];
  bank_enabled: boolean;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_iban: string | null;
  bank_swift: string | null;
  bank_currencies: PayCurrency[];
}

export async function fetchPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .eq("active", true)
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as SubscriptionPlan[];
}

// Admin: include inactive plans too
export async function fetchAllPlans(): Promise<SubscriptionPlan[]> {
  const { data, error } = await supabase
    .from("subscription_plans")
    .select("*")
    .order("sort_order");
  if (error) throw error;
  return (data ?? []) as unknown as SubscriptionPlan[];
}

export async function updatePlan(
  id: string,
  patch: Partial<Omit<SubscriptionPlan, "id">>,
): Promise<void> {
  const { error } = await supabase
    .from("subscription_plans")
    .update(patch)
    .eq("id", id);
  if (error) throw error;
}

export async function fetchPaymentSettings(): Promise<PaymentSettings | null> {
  const { data, error } = await supabase
    .from("payment_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as PaymentSettings) ?? null;
}

export async function fetchActiveSubscription(userId: string): Promise<UserSubscription | null> {
  const { data, error } = await supabase
    .from("user_subscriptions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("starts_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data as unknown as UserSubscription) ?? null;
}

export async function fetchMyPaymentRequests(userId: string): Promise<ManualPaymentRequest[]> {
  const { data, error } = await supabase
    .from("manual_payment_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as unknown as ManualPaymentRequest[];
}

export async function uploadPaymentProof(
  userId: string,
  file: File,
): Promise<string> {
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${userId}/${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from("payment-proofs")
    .upload(path, file, { upsert: false });
  if (error) throw error;
  return path;
}

export async function getProofSignedUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage
    .from("payment-proofs")
    .createSignedUrl(path, 3600);
  if (error) throw error;
  return data.signedUrl;
}

export interface CreatePaymentRequestInput {
  userId: string;
  planTier: PlanTier;
  amount: number;
  currency: Currency;
  method: PaymentMethod;
  proofPath: string;
  senderName: string;
  senderPhone?: string;
  transactionRef?: string;
}

export async function createPaymentRequest(input: CreatePaymentRequestInput) {
  const { error, data } = await supabase
    .from("manual_payment_requests")
    .insert({
      user_id: input.userId,
      plan_tier: input.planTier,
      amount: input.amount,
      currency: input.currency,
      method: input.method,
      proof_url: input.proofPath,
      sender_name: input.senderName,
      sender_phone: input.senderPhone ?? null,
      transaction_ref: input.transactionRef ?? null,
      status: "pending",
    })
    .select()
    .single();
  if (error) throw error;
  return data as unknown as ManualPaymentRequest;
}

// ───────── Admin ─────────
export async function fetchAllPaymentRequests(status?: PaymentStatus) {
  let q = supabase
    .from("manual_payment_requests")
    .select("*")
    .order("created_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as unknown as ManualPaymentRequest[];
}

export async function approvePaymentRequest(req: ManualPaymentRequest, _reviewerId: string, months = 1) {
  // Atomic server-side approval via SECURITY DEFINER RPC
  const { error } = await supabase.rpc("approve_manual_payment" as never, {
    _request_id: req.id,
    _months: months,
  } as never);
  if (error) throw error;
}

export async function rejectPaymentRequest(reqId: string, _reviewerId: string, note: string) {
  const { error } = await supabase.rpc("reject_manual_payment" as never, {
    _request_id: reqId,
    _reason: note,
  } as never);
  if (error) throw error;
}

export async function updatePaymentSettings(input: Partial<PaymentSettings> & { id: string }) {
  const { id, ...rest } = input;
  const { error } = await supabase
    .from("payment_settings")
    .update(rest as never)
    .eq("id", id);
  if (error) throw error;
}

export async function countStoriesThisMonth(userId: string): Promise<number> {
  const start = new Date();
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("ai_story_history")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", start.toISOString());
  if (error) throw error;
  return count ?? 0;
}
