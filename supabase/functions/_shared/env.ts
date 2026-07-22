// supabase/functions/_shared/env.ts
// Centralised validation of required Deno environment variables for edge functions.
interface BackendEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
}

function requiredString(value: string | undefined, name: string): string {
  if (value && value.trim().length > 0) return value;
  throw new Error(`Missing required environment variable: ${name}`);
}

export const env: BackendEnv = {
  supabaseUrl: requiredString(Deno.env.get("SUPABASE_URL"), "SUPABASE_URL"),
  serviceRoleKey: requiredString(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"), "SUPABASE_SERVICE_ROLE_KEY"),
} as const;
