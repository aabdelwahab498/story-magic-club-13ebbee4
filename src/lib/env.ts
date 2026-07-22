// src/lib/env.ts
// Centralised validation of required Vite environment variables.

interface FrontendEnv {
  supabaseUrl: string;
  supabaseKey: string;
}

function requiredString(value: unknown, name: string): string {
  if (typeof value === "string" && value.trim().length > 0) return value;
  throw new Error(`Missing required environment variable: ${name}`);
}

export const env: FrontendEnv = {
  supabaseUrl: requiredString(import.meta.env.VITE_SUPABASE_URL, "VITE_SUPABASE_URL"),
  supabaseKey: requiredString(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, "VITE_SUPABASE_PUBLISHABLE_KEY"),
} as const;
