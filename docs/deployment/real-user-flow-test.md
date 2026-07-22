# Real User Flow Test

Before officially announcing the launch, perform an end-to-end user journey test on the **Production URL** to ensure all integrated services operate correctly.

## Prerequisites
- Frontend successfully deployed to production URL (e.g., `najmah.ai`).
- Backend successfully deployed to production URL (e.g., `api.najmah.ai`).
- Database migrations completed.

## Steps

1. **Register User**
   - Navigate to the frontend production URL.
   - Click "Sign Up" and register a new test user account.
   - *Verification*: Ensure the user appears in the Supabase Authentication dashboard and the `public.users` table.

2. **Login**
   - Log out and log back in.
   - *Verification*: JWT token is correctly stored, and the dashboard loads without CORS errors.

3. **Create Child Profile**
   - Navigate to the Family dashboard.
   - Create a child profile with specific interests.
   - *Verification*: Profile appears in the UI and is saved in the `children` table.

4. **Request Story**
   - Use the AI Storyteller to request a story for the created child.
   - Select a prompt or enter custom text.
   - *Verification*: The UI transitions to the "Generating" state. The backend logs show the generation starting.

5. **AI Generation Completes**
   - Wait for the generation to finish (approx 10-30 seconds depending on LLM).
   - *Verification*: The story is generated and saved to the database. The user's AI usage limits are deducted.

6. **Open Story Reader**
   - Click the completed story.
   - *Verification*: The story reader loads properly. Pages render correctly. Text-to-speech features function (if enabled).

7. **Update Reading Progress**
   - Navigate through the pages to the end.
   - *Verification*: The `child_learning_progress` or equivalent tracker updates the completed story count.

8. **Check Parent Dashboard**
   - Navigate back to the Parent Dashboard.
   - *Verification*: The dashboard correctly reflects the new story, activity logs, and AI usage metrics.

## Troubleshooting
If any step fails:
- Check the **Network Tab** for API `5xx` or `4xx` (CORS) errors.
- Check the **Backend Logs** via the Railway/Render dashboard for Stack Traces.
- Check the **Supabase Logs** for Postgres exceptions or RLS violations.
