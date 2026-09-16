/** Guards that every canonical /api/v2 request carries the Supabase bearer token. */
import { describe, it, expect, vi } from "vitest";

const getSession = vi.fn(async () => ({ data: { session: { access_token: "tok-123" } } }));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getSession } },
}));

import { axiosInstance } from "@/api/client";

const runInterceptor = async (config: Record<string, unknown>) => {
  const handlers = (axiosInstance.interceptors.request as unknown as {
    handlers: Array<{ fulfilled: (c: unknown) => unknown }>;
  }).handlers;
  let next = config;
  for (const h of handlers) {
    next = (await h.fulfilled(next)) as Record<string, unknown>;
  }
  return next;
};

describe("canonical api client", () => {
  it("resolves to the canonical backend base url", () => {
    expect(axiosInstance.defaults.baseURL).toBe("https://najmah-api.nextnext-gen.com/api/v2");
  });

  it("adds the Supabase bearer token", async () => {
    const config = await runInterceptor({ headers: {} as Record<string, unknown> });
    expect((config.headers as Record<string, string>).Authorization).toBe("Bearer tok-123");
  });

  it("does not overwrite an explicit Authorization header", async () => {
    const config = await runInterceptor({ headers: { Authorization: "Bearer explicit" } });
    expect((config.headers as Record<string, string>).Authorization).toBe("Bearer explicit");
  });
});
