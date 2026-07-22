// Server integration: the illustration_analytics_audit table must reject
// reads from anon (unauthenticated) clients due to RLS. Insert must require
// the admin role with admin_user_id = auth.uid(). We can't easily get an
// admin session here, but we CAN verify the negative cases: anon SELECT
// returns empty (RLS hides rows) and anon INSERT is rejected.
import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_SUPABASE_URL ?? "";
const ANON_KEY =
  (import.meta as unknown as { env: Record<string, string> }).env
    .VITE_SUPABASE_PUBLISHABLE_KEY ?? "";

const ENABLE =
  !!SUPABASE_URL &&
  !!ANON_KEY &&
  (globalThis as { process?: { env?: Record<string, string> } }).process?.env
    ?.SKIP_INTEGRATION !== "1";

describe.skipIf(!ENABLE)("illustration_analytics_audit RLS", () => {
  const anon = ENABLE ? createClient(SUPABASE_URL, ANON_KEY) : null;

  it("anon SELECT returns no rows (RLS hides everything)", async () => {
    const { data, error } = await anon!
      .from("illustration_analytics_audit")
      .select("id")
      .limit(5);
    // Either RLS hides rows (empty array, no error) or a permission error.
    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|rls/);
    } else {
      expect(data ?? []).toEqual([]);
    }
  }, 20000);

  it("anon INSERT is rejected by RLS", async () => {
    const { error } = await anon!
      .from("illustration_analytics_audit")
      .insert({
        admin_user_id: "00000000-0000-0000-0000-000000000000",
        filter_range: "24h",
      });
    expect(error).toBeTruthy();
    expect(error!.message.toLowerCase()).toMatch(/policy|permission|rls|row-level/);
  }, 20000);

  it("anon SELECT with filters still returns no rows (filters do not bypass RLS)", async () => {
    const { data, error } = await anon!
      .from("illustration_analytics_audit")
      .select("id")
      .ilike("user_agent", "%Chrome%")
      .gte("viewed_at", new Date(Date.now() - 86400000).toISOString())
      .limit(5);
    if (error) {
      expect(error.message.toLowerCase()).toMatch(/permission|policy|rls/);
    } else {
      expect(data ?? []).toEqual([]);
    }
  }, 20000);
});
