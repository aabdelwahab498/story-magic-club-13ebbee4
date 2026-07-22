import { z } from 'zod';

/**
 * Zod schema that validates and coerces the raw process environment.
 * All required keys are listed explicitly — the server will refuse to
 * start if any key is missing or malformed.
 */
export const EnvSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  SUPABASE_URL: z.string().url('SUPABASE_URL must be a valid URL'),
  SUPABASE_ANON_KEY: z
    .string()
    .min(10, 'SUPABASE_ANON_KEY is too short to be valid'),
  SUPABASE_SERVICE_ROLE_KEY: z
    .string()
    .min(10, 'SUPABASE_SERVICE_ROLE_KEY is too short to be valid'),
  /**
   * Comma-separated list of allowed CORS origins.
   * Fail-closed: this is REQUIRED — the server refuses to start without it,
   * and only the listed origins are permitted for cross-origin requests.
   * Never hardcode production domains in source; configure per-environment.
   * @example "http://localhost:5173,https://app.najmah.example"
   */
  CORS_ALLOWED_ORIGINS: z
    .string()
    .min(
      1,
      'CORS_ALLOWED_ORIGINS is required (comma-separated allowed origins)',
    ),
  USE_MOCK_LLM: z.enum(['true', 'false']).default('false'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-1.5-flash'),
  GEMINI_TIMEOUT: z.coerce.number().default(30000),

  // Authentication Cookie Configuration
  JWT_COOKIE_NAME: z.string().default('najmah_token'),
  JWT_COOKIE_SECURE: z.coerce.boolean().default(true),
  JWT_COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  JWT_COOKIE_MAX_AGE: z.coerce.number().default(604800),

  // Infrastructure Config
  REDIS_URL: z.string().url().or(z.string().regex(/^redis:\/\/.*$/)).optional(),
  PYTHON_AI_URL: z.string().url().default('http://localhost:8000'),

  // Security Credentials (optional if delegated to Supabase/Providers)
  JWT_SECRET: z.string().optional(),
  JWT_AUDIENCE: z.string().optional(),
  JWT_ISSUER: z.string().optional(),
  GOOGLE_API_KEY: z.string().optional(),

  // Providers Configuration
  ILLUSTRATION_PROVIDER: z.enum(['google', 'mock']).default('google'),
  AUDIO_PROVIDER: z.enum(['edge', 'mock']).default('edge'),
  IMAGE_PROVIDER: z.enum(['google', 'mock']).default('mock'),
  MEDIA_IMAGE_PROVIDER: z.enum(['google', 'mock']).default('mock'),
  PAYMENT_PROVIDER: z.string().default('mock'),

  // Resilience & Storage Settings
  REQUEST_TIMEOUT: z.coerce.number().default(30000),
  RETRY_COUNT: z.coerce.number().default(3),
  STORAGE_BUCKETS: z.string().default('illustrations,audio,avatars,covers'),
  MASTER_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, 'MASTER_ENCRYPTION_KEY must be a 64-character hex string')
    .optional(),
});

/** Inferred type of the validated environment object. */
export type Env = z.infer<typeof EnvSchema>;

/**
 * Validates raw process.env against EnvSchema.
 * Used by ConfigModule's `validate` hook — throws on first failure.
 *
 * @param config - Raw environment key-value map.
 * @returns The validated and coerced Env object.
 * @throws Error if any required variable is missing or invalid.
 */
export function validateEnv(config: Record<string, unknown>): Env {
  const result = EnvSchema.safeParse(config);
  if (!result.success) {
    const formatted = JSON.stringify(result.error.format(), null, 2);
    throw new Error(`Invalid environment configuration:\n${formatted}`);
  }
  return result.data;
}
