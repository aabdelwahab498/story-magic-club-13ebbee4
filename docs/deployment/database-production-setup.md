# Database Production Setup

Before deploying the frontend or backend, you must prepare the Production Supabase Database to receive real user data securely.

## 1. Create Production Project
1. Log into your [Supabase Dashboard](https://supabase.com/dashboard).
2. Create a new project named `Najmah AI Platform (Production)`.
3. Select a region closest to your target audience.
4. Note down the **Database Password** securely.

## 2. Apply Migrations
Production migrations should be run via the Supabase CLI to ensure consistency.

1. Ensure your Supabase CLI is authenticated:
   ```bash
   npx supabase login
   ```
2. Link your local project to the production instance:
   ```bash
   npx supabase link --project-ref <your_production_ref>
   ```
3. Push all migrations to production:
   ```bash
   npx supabase db push
   ```

## 3. Verify Database Objects
Verify that the following core tables are created:
- `users`
- `children`
- `stories`
- `ai_story_history`
- `story_requests`
- `child_learning_progress`

## 4. Verify Row-Level Security (RLS)
Check the Supabase Dashboard -> Authentication -> Policies. Ensure RLS is active on all public schema tables.
- Users should only be able to query `SELECT` where `user_id = auth.uid()`.
- Service roles (backend) bypass RLS automatically.

## 5. Configure Authentication
1. Go to **Authentication -> Providers**.
2. Ensure **Email** is enabled (and configure SMTP if you plan to use custom emails).
3. Disable **Confirm email** if you want seamless MVP onboarding (or configure redirect URLs if keeping it enabled).
4. Update the **Site URL** and **Redirect URLs** to match your production frontend URL (e.g., `https://najmah.ai/*`).

## 6. Configure Storage (Optional/Future)
1. If stories require image uploads, go to **Storage** and ensure the `illustrations` bucket is created.
2. Ensure Storage Policies only allow authenticated users to read/write their own objects.
