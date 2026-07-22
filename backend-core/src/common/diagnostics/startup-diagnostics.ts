import { INestApplication, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../../supabase/supabase.service.js';
import type { Env } from '../../config/env.config.js';

export async function runStartupDiagnostics(app: INestApplication): Promise<void> {
  const logger = new Logger('StartupDiagnostics');
  const configService = app.get<ConfigService<Env, true>>(ConfigService);
  const supabaseService = app.get(SupabaseService);

  logger.log('Starting Enterprise Startup Diagnostics...');

  const version = '1.0.0';
  const nodeEnv = configService.get('NODE_ENV') || 'development';

  const requiredKeys = [
    'PORT',
    'NODE_ENV',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'CORS_ALLOWED_ORIGINS',
  ];

  const optionalKeys = [
    'GEMINI_API_KEY',
    'GOOGLE_API_KEY',
    'REDIS_URL',
    'JWT_SECRET',
    'JWT_AUDIENCE',
    'JWT_ISSUER',
    'MASTER_ENCRYPTION_KEY',
  ];

  const loadedConfigKeys: string[] = [];
  const missingOptionalConfig: string[] = [];
  const missingRequiredConfig: string[] = [];

  for (const key of requiredKeys) {
    if (configService.get(key as keyof Env)) {
      loadedConfigKeys.push(key);
    } else {
      missingRequiredConfig.push(key);
    }
  }

  for (const key of optionalKeys) {
    if (configService.get(key as keyof Env)) {
      loadedConfigKeys.push(key);
    } else {
      missingOptionalConfig.push(key);
    }
  }

  // 1. Validate Database Connectivity
  let databaseStatus: 'healthy' | 'unhealthy' = 'healthy';
  let dbErrorMsg = '';
  try {
    const client = supabaseService.getClient();
    const { error } = await client.from('profiles').select('id').limit(1);
    if (error) throw error;
  } catch (err: any) {
    databaseStatus = 'unhealthy';
    dbErrorMsg = err.message || String(err);
  }

  // 2. Validate AI Service Availability
  let pythonAiStatus: 'healthy' | 'unhealthy' | 'mocked' = 'healthy';
  const pythonUrl = configService.get('PYTHON_AI_URL') || 'http://localhost:8000';
  try {
    const res = await fetch(`${pythonUrl}/health`, { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      pythonAiStatus = 'unhealthy';
    }
  } catch (err) {
    pythonAiStatus = 'unhealthy';
  }

  if (configService.get('USE_MOCK_LLM') === 'true') {
    pythonAiStatus = 'mocked';
  }

  // 3. Validate Storage Configuration
  let storageStatus: 'healthy' | 'unhealthy' = 'healthy';
  try {
    const client = supabaseService.getAdminClient();
    const { error } = await client.storage.listBuckets();
    if (error) throw error;
  } catch (err) {
    storageStatus = 'unhealthy';
  }

  const emailStatus = 'not_configured';
  const paymentProvider = configService.get('PAYMENT_PROVIDER') || 'mock';
  const paymentsStatus = paymentProvider === 'mock' ? 'configured (mock)' : 'configured';

  // Output Diagnostics Report
  logger.log('=== STARTUP DIAGNOSTICS REPORT ===');
  logger.log(`App Version:                  ${version}`);
  logger.log(`Environment:                  ${nodeEnv}`);
  logger.log(`Loaded Config Keys:           [${loadedConfigKeys.join(', ')}]`);
  logger.log(`Missing Optional Config:      [${missingOptionalConfig.join(', ')}]`);
  logger.log(`Missing Required Config:      [${missingRequiredConfig.join(', ')}]`);
  logger.log(`Dependency - Database:        ${databaseStatus} ${dbErrorMsg ? `(${dbErrorMsg})` : ''}`);
  logger.log(`Dependency - Python AI:       ${pythonAiStatus}`);
  logger.log(`Dependency - Storage:         ${storageStatus}`);
  logger.log(`Dependency - Email Service:   ${emailStatus}`);
  logger.log(`Dependency - Payment Gateway: ${paymentsStatus}`);
  logger.log('==================================');

  if (databaseStatus === 'unhealthy') {
    logger.error('CRITICAL: Database connection is unhealthy. Failing fast.');
    throw new Error(`Database connection check failed: ${dbErrorMsg}`);
  }

  logger.log('Diagnostics completed successfully.');
}
