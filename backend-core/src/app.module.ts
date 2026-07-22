import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware.js';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { MetricsModule } from './modules/metrics/metrics.module.js';
import { MetricsInterceptor } from './modules/metrics/metrics.interceptor.js';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/env.config.js';
import { SupabaseModule } from './supabase/supabase.module.js';
import { RedisModule } from './modules/redis/redis.module.js';
import { EncryptionModule } from './modules/encryption/encryption.module.js';
import { HealthModule } from './health/health.module.js';
import { AuthGuard } from './auth/auth.guard.js';
import { AuthModule } from './auth/auth.module.js';
import { RbacModule } from './modules/rbac/rbac.module.js';
import { RolesGuard } from './modules/rbac/guards/roles.guard.js';
import { PermissionsGuard } from './modules/rbac/guards/permissions.guard.js';
import { MeModule } from './modules/me/me.module.js';
import { UsersModule } from './modules/users/users.module.js';
import { ChildrenModule } from './modules/children/children.module.js';
import { StoriesModule } from './modules/stories/stories.module.js';
import { MediaModule } from './modules/media/media.module.js';
import { AIModule } from './modules/ai/ai.module.js';
import { CreditsModule } from './modules/credits/credits.module.js';
import { UsageModule } from './modules/usage/usage.module.js';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module.js';
import { BillingModule } from './modules/billing/billing.module.js';
import { AdminModule } from './modules/admin/admin.module.js';
import { JobsModule } from './common/jobs/jobs.module.js';

/**
 * Root application module.
 *
 * Guard execution order (via APP_GUARD registration order):
 *   1. AuthGuard     — JWT verification + UserContext creation
 *   2. RolesGuard    — @Roles() enforcement (if present)
 *   3. PermissionsGuard — @Permissions() enforcement (if present)
 */
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SupabaseModule,
    RedisModule,
    EncryptionModule,
    MetricsModule,
    AuthModule,
    HealthModule,
    RbacModule,
    MeModule,
    UsersModule,
    ChildrenModule,
    StoriesModule,
    MediaModule,
    AIModule,
    CreditsModule,
    UsageModule,
    SubscriptionsModule,
    BillingModule,
    AdminModule,
    JobsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    // ── Global Guards (order matters) ────────────────────────────────────
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: PermissionsGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
