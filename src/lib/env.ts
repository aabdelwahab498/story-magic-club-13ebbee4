// src/lib/env.ts
// Centralised validation of required Vite environment variables.

interface FrontendEnv {
  supabaseUrl: string;
  supabaseKey: string;
}

const LOVABLE_CLOUD_URL = "https://obafpnloxexvyiodpsxz.supabase.co";
const LOVABLE_CLOUD_PUBLISHABLE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9iYWZwbmxveGV4dnlpb2Rwc3h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk4NzAyMTcsImV4cCI6MjA5NTQ0NjIxN30.YYsgYgpbYrNjvK37nZfxwruifT_66xMYUhT93yjOj3w";

function envString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  return fallback;
}

export const env: FrontendEnv = {
  supabaseUrl: envString(import.meta.env.VITE_SUPABASE_URL, LOVABLE_CLOUD_URL),
  supabaseKey: envString(
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    LOVABLE_CLOUD_PUBLISHABLE_KEY,
  ),
} as const;
