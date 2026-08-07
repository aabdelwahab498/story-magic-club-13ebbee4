# Full Project Audit — Najmah / Starry Tales

> تقرير هندسي شامل مبني على الكود الفعلي في المستودع (لا اقتراحات لميزات جديدة، ولا تعديلات على الكود).
> تاريخ التقرير: 2026-08-07 — النسخة: `VERSION` = v1.0.0

---

## 1. Project Overview

| البند | التفصيل |
| :--- | :--- |
| اسم المشروع | **Najmah / Starry Tales** (المستودع: `story-magic-club`) |
| الوظيفة الأساسية | منصة توليد قصص أطفال بالذكاء الاصطناعي، مبنية على إطار التعلّم الاجتماعي–العاطفي (SEL)، مع رسوم توضيحية وسرد صوتي وتصدير TXT / PDF / MP3 / EPUB |
| الهدف التجاري | SaaS اشتراكي: خطط (`subscription_plans`) بحدود يومية/شهرية للقصص + رصيد رسومات (`illustration_credits`)، مبيعات منتجات رقمية (`products` / `orders` / `cart_items`)، ودفع عبر Paddle أو تحويل يدوي (InstaPay / Vodafone Cash / Payoneer / بنكي) |
| المستخدمون المستهدفون | الأهل (حساب رئيسي + ملفات أطفال)، الأطفال (وضع القراءة/الاستماع)، المعلمون، وفريق التشغيل: `admin` / `editor` / `support` / `super_admin` |

### أهم الـ User Flows (مستخرجة من `src/App.tsx` و الصفحات الفعلية)

```text
1) تسجيل/دخول:            /auth  → Supabase Auth → user_roles → ProtectedRoute
2) توليد قصة:             /ai-storyteller → compose-story (Planner→Writer→Safety→Length→Quality)
                            → ai_story_history → /my-stories/:id
3) الرسوم:                 IllustrateButton → illustrate-story → generated_illustrations (خصم credits)
4) التصدير:                StoryExportBar → export-story-txt | export-story-pdf | export-story-audio | export-story-epub
5) الاشتراك والدفع:        /pricing → Paddle (usePaddle) أو /checkout/manual → manual_payment_requests → موافقة الأدمن
6) المتجر:                 /store → cart_items → /checkout/order → orders / order_items
7) الأهل:                  /family → child_profiles، /parent → متابعة + bedtime_schedules + reading_streaks
8) المسابقة والمدونة:      /drawing-competition (drawing_entries/votes)، /blog، /blog/submit
9) الإدارة:                /admin/dashboard/** (≈35 صفحة) خلف ProtectedRoute requireStaff + PermissionGuard
```

---

## 2. Frontend Architecture

| الطبقة | التقنية الفعلية |
| :--- | :--- |
| Framework | React **18.3** |
| اللغة | TypeScript **5.5** |
| Build System | Vite **5.4** + `@vitejs/plugin-react-swc` |
| UI Framework | Tailwind CSS **3.4** (+ `tailwindcss-animate`, `@tailwindcss/typography`) |
| Component Library | shadcn/ui فوق Radix UI (48 primitive في `src/components/ui/`) |
| State Management | TanStack Query v5 لبيانات الخادم + React Context (`useAuth`, `useTheme`, `useAdminDataSource`) — لا يوجد Redux/Zustand |
| Routing | React Router **7** مع `lazy()` لكل مسار عدا الصفحة الرئيسية |
| Forms | React Hook Form 7 + `@hookform/resolvers` |
| Validation | Zod 3 |
| i18n | i18next 26 + react-i18next 17 + LanguageDetector (localStorage key: `starry-tales-language`) |
| اللغات | en, ar, de, fr, it, es (6 ملفات في `src/i18n/locales/`) |
| RTL | مُفعّل: `applyDirection()` في `src/i18n/config.ts` يضبط `dir`/`lang` على `<html>` عند تغيّر اللغة (`RTL_LANGUAGES = ["ar"]`) |
| PWA | `vite-plugin-pwa` (generateSW, autoUpdate) + `public/manifest.webmanifest` + `src/pwa/` |
| رسوم بيانية | Recharts 3 (لوحات الأدمن) |
| ملفات/تصدير في المتصفح | jspdf, docx, jszip (`src/lib/productStoryPdf.ts`, `storyVideoExport.ts`) |

### شجرة `src/` الحالية

```text
src/
├── api/            طبقة عميل HTTP قديمة (axios) موجّهة لـ NestJS: client.ts (baseURL = VITE_API_URL || /api/v2)
│                   + admin/auth/audio/children/illustrations/stories .api.ts  →  إرث معماري (انظر §5)
├── assets/         صور الأغلفة والصفحات (ملفات .asset.json مرجعية)
├── components/     60+ مكوّن جذر + admin/ cart/ payment/ story/ ui/
├── hooks/          31 hook: auth, subscription, credits, stories, illustrations, audio, export, theme, pwa…
├── i18n/           config.ts + locales/*.json (6 لغات)
├── integrations/   supabase/client.ts + types.ts (مولّدة) و lovable/
├── lib/            40 وحدة: طبقة الوصول للبيانات (‎*Api.ts‎)، أدوات (rbac, multilingual, rateLimit,
│                   edgeErrors, emotionColors, narrators) + بيانات وهمية (mockStore/mockBlog/adminMockData)
├── pages/          72 صفحة (37 عامة/حساب + 35 تحت pages/admin/ + pages/test/)
├── pwa/            registerSw.ts, swUpdate.ts
├── test/           إعداد Vitest + اختبارات تكامل (RLS, idempotency, tts)
├── App.tsx         تعريف كل المسارات والمزوّدات (Providers)
├── index.css       نظام التصميم (CSS variables / tokens)
└── types.ts        أنواع مشتركة للواجهة
```

ملاحظة: لا يوجد مجلدان `services/` و`contexts/` و`utils/` بالاسم — وظائفهم موزّعة على `lib/` و`hooks/` و`api/`.

---

## 3. Pages Inventory

### الصفحات العامة وحساب المستخدم

| الملف | Route | الهدف | مكونات رئيسية | الحالة |
| :--- | :--- | :--- | :--- | :--- |
| `Index.tsx` | `/` | الصفحة الرئيسية | Hero, CountersSection, HomeBlogPreview, HomeCompetitionHighlight, WinnerOfTheWeek | مكتملة |
| `StoryLibrary.tsx` | `/stories` | مكتبة القصص | StoryCard, PageBackground | مكتملة |
| `StoryDetail.tsx` | `/stories/:id` | قراءة قصة | ReadingMode, StoryBackgroundMusic, DownloadMenu | مكتملة |
| `AIStoryteller.tsx` | `/ai-storyteller` | مولّد القصص SEL | OptionSelector, ChildPicker, SelStoryViewer, CreditCounter, UsageSummary | مكتملة (المحور الأساسي) |
| `MyAiStories.tsx` | `/my-stories` | قصص المستخدم | StoryCard | مكتملة |
| `MyAiStoryDetail.tsx` | `/my-stories/:id` | عرض/تصدير قصة | SelStoryViewer, StoryExportBar, IllustrateButton | مكتملة |
| `MyDownloads.tsx` | `/my-downloads` | سجل التنزيلات | DownloadMenu | مكتملة |
| `MyBackups.tsx` | `/my-backups` | نسخ احتياطية للمستخدم | — | تحتاج تطوير (يعتمد على run-user-backups) |
| `DrawingCompetition.tsx` | `/drawing-competition` | مسابقة الرسم والتصويت | DrawingEntry, HallOfFame, WinnerCard, CountdownTimer | مكتملة |
| `Blog.tsx` / `BlogPost.tsx` / `BlogSubmit.tsx` | `/blog`, `/blog/:slug`, `/blog/submit` | المدونة | BlogCard, Seo | مكتملة |
| `Store.tsx` | `/store` | المتجر الرقمي | CartDrawer | مكتملة |
| `CheckoutOrder.tsx` | `/checkout/order` | إتمام طلب المتجر | PaymentModal, PaymentSummary | مكتملة |
| `CheckoutManual.tsx` | `/checkout/manual` | دفع يدوي + إثبات | PaymentMethodSelector, PaymentMethodForms, SecureFileUpload | مكتملة |
| `Pricing.tsx` | `/pricing` | الخطط | PaddleSubscriptionCard, UpgradeModal | مكتملة |
| `PaymentResult.tsx` | `/payment/result` | نتيجة الدفع | PaymentSuccess, PaymentError | مكتملة |
| `AccountSubscription.tsx` | `/account/subscription` | إدارة الاشتراك | PaddleSubscriptionCard | مكتملة |
| `AccountProfile.tsx` | `/account/profile` | الملف الشخصي | AvatarCreator | مكتملة |
| `ApiKeys.tsx` | `/account/api-keys` | مفاتيح المستخدم (BYOK) | — | مكتملة |
| `Family.tsx` / `ChildProfile.tsx` | `/family`, `/family/:id` | ملفات الأطفال | ChildPicker, AvatarCreator | مكتملة |
| `ParentDashboard.tsx` | `/parent` | متابعة الأهل | StreakCard, WeeklyChallenge, UsageSummary | مكتملة |
| `Auth.tsx` / `AdminAuth.tsx` | `/auth`, `/admin/auth` | الدخول | ResendConfirmation | مكتملة |
| `ForgotPassword.tsx` / `ResetPassword.tsx` | `/forgot-password`, `/reset-password` | استعادة كلمة المرور | — | مكتملة |
| `About` `Contact` `Privacy` `Terms` `Install` `Offline` | `/about` `/contact` `/privacy` `/terms` `/install` `/offline` | صفحات ثابتة | LegalPage, InstallPwaButton, OfflineBanner | مكتملة |
| `Admin.tsx` | `/admin` | تحويل/بوابة قديمة للأدمن | — | إرث (الواجهة الحقيقية `/admin/dashboard`) |
| `DownloadTest.tsx` | `/download-test` | اختبار تنزيل | — | أداة تطوير |
| `pages/test/IllustrateHarness.tsx` | `/test/illustrate-harness` | اختبار مسار الرسوم | — | أداة تطوير (مسار عام غير محمي) |
| `NotFound.tsx` | `*` | 404 | — | مكتملة |

### لوحة الإدارة (`/admin/dashboard/*` — 35 صفحة)

| المجموعة | الصفحات | الحماية |
| :--- | :--- | :--- |
| نظرة عامة | `AdminDashboard`, `AdminDashboardOverview`, `AdminDashboardLayout` | requireStaff |
| المحتوى | `Stories`, `Videos`, `Blog`, `Languages`, `Products` | requireStaff |
| محرّك القصص/AI | `StoryEngine`, `AiModels`, `AiUsage`, `Audio`, `IllustrationAnalytics` | requireStaff |
| إعدادات AI المتقدمة | `AiAgents`, `AiPrompts`, `AiFeatureToggles`, `AiUsageLimits`, `AiAnalytics`, `PdfTemplates`, `AudioVoices` | PermissionGuard حسب المفتاح |
| الحوكمة | `Rbac` (adminOnly), `AuditLogs`, `Downloads` (adminOnly) | PermissionGuard |
| المال | `Payments`, `Subscriptions`, `PaymentSettings`, `Plans`, `Orders`, `PaymentLogs`, `WebhookLogs` | requireStaff |
| التشغيل | `Settings`, `ContactInbox`, `N8nIntegration` (adminOnly) | PermissionGuard |

> `AdminN8nIntegrationPage` + `src/lib/adminN8nApi.ts` + `n8n-*` edge functions = بقايا مرحلة n8n التي تم التراجع عنها معماريًا (المنتج الآن مستقل داخل Lovable Cloud). حالتها: **إرث قابل للحذف**.

---

## 4. Components Map

```text
Layout
 └─ Layout.tsx ─┬─ Navigation.tsx ─ LanguageSwitcher, ThemeToggle, NotificationBell, CreditCounter
                ├─ <Outlet/>  (كل الصفحات)
                ├─ BottomNav.tsx (موبايل)
                ├─ Footer.tsx ─ SocialIcons / SocialMediaIcons
                └─ OfflineBanner, SwUpdateIndicator, AiAssistantButton

Guards / Infra
 ├─ ProtectedRoute.tsx        (auth / requireAdmin / requireStaff)
 ├─ admin/PermissionGuard.tsx (مفاتيح صلاحيات RBAC)
 ├─ ErrorBoundary.tsx         (يغلّف الراوتر والتخطيط)
 └─ Seo.tsx, PageBackground.tsx, AdPlaceholder.tsx

Feature: Story
 ├─ SelStoryViewer, ReadingMode, StoryCard, StoryBackgroundMusic, NarratorPicker/NarratorAvatar
 ├─ IllustrateButton  →  useGenerateIllustrations → illustrate-story
 └─ story/  StoryExportBar → useStoryExport → storyExportApi → export-story-*
            DownloadMenu, DownloadNowButton, BatchDownloadDialog, StoryPreviewDialog, StoryVideoPlayer

Feature: Payments & Store
 ├─ payment/  PaymentModal, PaymentMethodSelector, PaymentMethodForms, PaymentSummary,
 │            CurrencySelector, PaymentSuccess, PaymentError
 ├─ cart/CartDrawer, PaddleSubscriptionCard, UpgradeModal, PremiumBadge
 └─ FreeTrialDialog, SpinWheelModal, SubscriptionWheelTeaser

Feature: Family & Engagement
 ├─ ChildPicker, AvatarCreator, StreakBadge/StreakCard, WeeklyChallenge
 └─ DrawingEntry, HallOfFame, WinnerCard, WinnerOfTheWeek, CountdownTimer, SubmissionInstructions

Feature: Admin
 └─ admin/ BlogReviewSection, MultilingualField, FileUploadField, SocialLinksManager, PermissionGuard

UI Primitives
 └─ ui/ 48 ملف shadcn (button, dialog, table, sidebar, form, chart, …) — تُستهلك من كل ما سبق
```

العلاقة العامة: **Page → Feature Component → Hook → lib/\*Api.ts → Supabase (DB أو Edge Function)**.

---

## 5. Data Layer

### 5.1 مسارَان متوازيان (نقطة الدين التقني الأهم)

1. **المسار الفعّال:** `@/integrations/supabase/client` مستخدم مباشرة داخل `src/lib/*Api.ts` و`src/hooks/*` — استعلامات جدولية + `functions.invoke`.
2. **المسار الإرثي:** `src/api/client.ts` (axios، `baseURL = VITE_API_URL || '/api/v2'`) الموجّه إلى خدمة NestJS في `backend-core/`. لا توجد هذه الخدمة في بيئة Lovable، ومع ذلك ما زال 20 ملفًا يستورد من `@/api` (منها `storyExportApi.ts` الذي يستورد `axiosInstance`، و`useStories.ts`، `useRoles.ts`، `AIStoryteller.tsx`، `ParentDashboard.tsx`). هذا هو نفس السبب الجذري لأعطال «الشاشة السوداء» التي عولجت سابقًا في `children.api.ts`.

### 5.2 الجداول الأكثر استخدامًا من الواجهة (بالعدّ الفعلي)

`blog_posts` (13) · `ai_story_history` (9) · `stories` (8) · `profiles` (7) · `drawing_entries` (7) · `user_api_keys` (6) · `cart_items` (6) · `products` (5) · `orders` (5) · `illustration_analytics_audit` (5) · `videos`, `manual_payment_requests`, `contact_messages`, `bedtime_schedules` (4) · `user_roles`, `subscription_plans`, `drawing_votes` (3) · وباقي الجداول أقل. إجمالي المخطط: **69 جدولًا** + enum `app_role` + 26 دالة قاعدة بيانات.

### 5.3 Authentication Flow

```text
supabase.auth.onAuthStateChange  →  session/user في AuthProvider
        ↓ (setTimeout 0 لتفادي القفل داخل الـ callback)
   SELECT role FROM user_roles WHERE user_id = …  →  roles[]
        ↓
 isAdmin / isEditor / isStaff  →  ProtectedRoute + PermissionGuard
```

الأدوار مخزّنة في جدول منفصل `user_roles` مع الدالة `has_role()` (SECURITY DEFINER) — مطابق للممارسة الآمنة. تسجيل مستخدم جديد يُشغّل `handle_new_user()`: إنشاء `profiles` + دور `user` + 20 رصيد رسومات + اشتراك `free` نشِط.

### 5.4 Storage

| Bucket | عام؟ | الاستخدام في الكود |
| :--- | :--- | :--- |
| `story-pdfs` | خاص | 4 مواضع — روابط موقّعة (تم تحويله للخصوصية سابقًا) |
| `temp-uploads` | خاص | 5 مواضع — `upload-init` / `upload-finalize` + فحص ClamAV |
| `story-audio`, `story-images`, `story-music`, `video-thumbnails` | **عام** | روابط عامة مباشرة |
| `story-epubs`, `story-bundles`, `story-exports`, `user-backups`, `user-files`, `payment-proofs`, `drawing-entries`, `video-uploads` | خاص | روابط موقّعة |

### 5.5 External Services

Paddle (اشتراكات + Webhook)، Lovable AI Gateway (نصوص/صور/صوت)، Google Cloud TTS (`GOOGLE_CLOUD_TTS_API_KEY`)، Gemini API (`GEMINI_API_KEY`)، بريد المعاملات (`send-welcome-email`, `send-contact-email`, `send-order-notification`)، ClamAV اختياري لفحص الملفات.

---

## 6. AI Features Analysis

### 6.1 خط أنابيب القصة (SEL) — `supabase/functions/compose-story`

```text
Rate limit → Fair-use quota → Moderation(input)
   → Planner   (_shared/sel/planner.ts)   بلوبرنت 4 فصول: بطل/مرشد/رفيق/مخرج SEL
   → Writer    (_shared/sel/writer.ts)    توليد الصفحات عبر البوابة
   → Safety    (_shared/sel/safety.ts)    فحص حتمي (reject-list)
   → Length    (_shared/sel/length.ts)    عدد الصفحات حسب الفئة العمرية (3-5 / 6-8 / 9-12)
   → Quality   (_shared/sel/quality.ts)   حكم LLM /25، العتبة ≥ 18
   → إعادة توليد حتى مرتين (DEFAULT_MAX_REGENERATIONS = 2)
   → حفظ في ai_story_history + story_safety_reports
   → characterVisualHash (_shared/sel/visual.ts) لثبات شكل الشخصية
   → localFallback.ts عند فشل البوابة
```

كل الاستدعاءات تمر عبر `_shared/sel/gateway.ts` (Lovable AI Gateway) مع `withUserAI` في `_shared/userKeys.ts` لدعم BYOK (مفتاح المستخدم المشفّر في `user_api_keys`).

### 6.2 النماذج المستخدمة فعليًا

| الغرض | الموديل | الملف |
| :--- | :--- | :--- |
| كتابة/تخطيط القصة | `google/gemini-2.5-flash` | `_shared/sel/gateway.ts` |
| الإشراف على المحتوى | `google/gemini-2.5-flash-lite`, `openai/gpt-5-nano`, `openai/gpt-5-mini` | `_shared/moderation.ts` |
| الرسوم | `google/gemini-2.5-flash-image`, `google/gemini-3.1-flash-image-preview`, `gpt-image-1` | `illustrate-story/index.ts` |
| السرد الصوتي | `openai/gpt-4o-mini-tts` | `_shared/tts.ts`, `_shared/tts/openaiProvider.ts` |
| BYOK افتراضي | `openai/gpt-4o-mini` | `_shared/userKeys.ts` |

### 6.3 مواضع الـ Prompts

- القصة: `_shared/sel/planner.ts` / `writer.ts` / `quality.ts` (مدمجة في الكود).
- قوالب قابلة للتحرير من لوحة الإدارة: جدولا `ai_prompt_templates` + `ai_prompt_versions` (صفحة `AdminAiPromptsPage`).
- الوكلاء: `ai_agents` + `ai_capabilities` + `ai_feature_toggles` + `ai_usage_limits`.
- الأساس المرجعي الإلزامي: `docs/CHILDRENS_LITERATURE_KNOWLEDGE_BASE.md`.

### 6.4 الحصص والتدقيق

`check_story_quota()` (يومي/شهري حسب الخطة، admin = unlimited)، `consume_illustration_credits()` / `refund_illustration_credits()`، وتسجيل في `ai_usage_logs` و`ai_audit_logs`.

### 6.5 تدفق التصدير

`StoryExportBar` → `useStoryExport` → `storyExportApi` → `export-story-txt` (UTF-8 + BOM) / `export-story-pdf` (pdf-lib + خط عربي، سقف 4 صور لتفادي WORKER_RESOURCE_LIMIT) / `export-story-audio` (TTS ثم رفع إلى `story-audio`) / `export-story-epub` / `batch-download-stories` (ZIP عبر `batch_export_jobs`).

---

## 7. Environment Configuration

### Frontend (Vite)

| المتغير | الحالة |
| :--- | :--- |
| `VITE_SUPABASE_URL` | يُقرأ في `src/lib/env.ts` مع **fallback ثابت** لمشروع Lovable Cloud |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | نفس الآلية (مفتاح publishable — آمن في العميل) |
| `VITE_SUPABASE_PROJECT_ID` | مولّد تلقائيًا في `.env` |
| `VITE_API_URL` | اختياري، يستخدمه `src/api/client.ts` الإرثي فقط |

### Edge Functions (أسماء الأسرار فقط — بدون قيم)

`LOVABLE_API_KEY`, `GEMINI_API_KEY`, `GOOGLE_CLOUD_TTS_API_KEY`, `PADDLE_API_KEY`, `PADDLE_CLIENT_TOKEN`, `PADDLE_ENVIRONMENT`, `PADDLE_WEBHOOK_SECRET`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`.

### الخدمات الإرثية (غير مشغّلة داخل Lovable)

`backend-core/.env.example`: `PORT`, `NODE_ENV`, `SUPABASE_*`, `CORS_ALLOWED_ORIGINS`, `REDIS_URL`, `PYTHON_AI_URL`, `JWT_COOKIE_NAME`, `ILLUSTRATION_PROVIDER`, `AUDIO_PROVIDER`, `MEDIA_IMAGE_PROVIDER`.
`ai-service/.env.example`: `GEMINI_API_KEY`, `PORT`, `HOST`.

### ملفات الإعداد

`vite.config.ts` (PWA + alias `@`؛ بدون `manualChunks` عمدًا بعد عطل الشاشة البيضاء)، `tailwind.config.ts`، `tsconfig*.json`، `postcss.config.cjs/js` (**مكرر — نقطة تنظيف**)، `eslint.config.js`، `vitest.config.ts`، `playwright.config.ts`، `supabase/config.toml`، `Dockerfile`، `docker-compose{,.dev,.production}.yml`، `docker/nginx/nginx.conf`، `.github/workflows/ci.yml`.

---

## 8. Security Review

**نقاط القوة المؤكَّدة من الكود/المخطط**

- الأدوار في جدول منفصل `user_roles` + `has_role()` SECURITY DEFINER — لا صلاحيات على `profiles`.
- RLS مفعّل على كل جداول `public` مع سياسات (69 جدولًا، عدد السياسات مذكور لكل جدول في المخطط).
- حماية المسارات بطبقتين: `ProtectedRoute` (auth/admin/staff) + `PermissionGuard` (مفاتيح صلاحيات).
- مفاتيح المستخدم (BYOK) مشفّرة، ولا يمكن كتابتها إلا عبر `manage-user-api-key` (trigger `guard_user_api_key_secrets`).
- تحقق من الدفع اليدوي داخل قاعدة البيانات (`validate_manual_payment_request` + `lock_manual_payment_immutable_fields`) — المبلغ والعملة والطريقة تُتحقق خادميًا.
- Rate limiting (`_shared/rateLimit.ts` + `rate_limit_events/blocks`)، وModeration إلزامي قبل أي استدعاء AI.
- رفع الملفات عبر `upload-init/upload-finalize` مع تحقق نوع/حجم وفحص ClamAV وسجل `upload_security_logs`.
- تشديدات سابقة موثقة: تحويل `story-pdfs` إلى خاص، تقييد قراءة `ai_agents` / `ai_prompt_templates` (admin/editor) و`ai_capabilities` (admin)، ومنع استدعاء دوال SECURITY DEFINER من العميل عدا اللازم.

**النقاط المفتوحة / تحتاج قرارًا**

1. `verify_jwt = false` على 5 دوال: `paddle-webhook`, `paddle-config`, `paddle-webhook-test`, `send-welcome-email`, `send-contact-email`. مبرَّر لـ webhook الدفع (يتحقق بالتوقيع)، لكن **`paddle-webhook-test` يجب ألا يوجد في الإنتاج**.
2. `/test/illustrate-harness` و`/download-test` مساران عامان غير محميين في الإنتاج.
3. الباكتات العامة `story-audio` / `story-images` / `story-music`: أي شخص يملك الرابط يصل للمحتوى (مقبول للمحتوى غير الحساس، لكنه محتوى مولَّد لأطفال بأسمائهم — يستحق مراجعة).
4. مفاتيح Supabase publishable مضمّنة نصًا في `src/lib/env.ts` — آمنة بحكم النوع، لكنها تربط الكود بمشروع واحد وتعيق النقل.
5. `SUPABASE_SERVICE_ROLE_KEY` غير مستخدم في الواجهة (تم التحقق) — جيد.

---

## 9. Deployment Readiness

### التشغيل محليًا (الواجهة فقط — وهو ما يعمل فعليًا)

```bash
npm install
npm run dev        # http://localhost:8080
npm run build      # إنتاج dist/ مع Service Worker
npm run preview
npm test           # Vitest
npm run e2e        # Playwright
```

### ما يلزم للنشر

`dist/` + إعادة توجيه SPA إلى `index.html` + متغيرات `VITE_SUPABASE_*` + مشروع Supabase يحوي: الهجرات، الـ 49 edge function، الباكتات الـ14، والأسرار.

### هل المشروع جاهز للخروج من Lovable؟

**جزئيًا.** الواجهة قابلة للنقل فورًا (Vite قياسي). القيود:

- الخلفية بالكامل على Lovable Cloud (Supabase مُدار): يلزم مشروع Supabase خاص + نشر الدوال + نقل البيانات.
- `src/lib/env.ts` يحوي URL/Key ثابتين لمشروع Lovable Cloud — يجب جعلهما من البيئة عند النقل.
- `backend-core/` و`ai-service/` موجودان في المستودع لكن **غير مستخدمين من الواجهة الحيّة**؛ إبقاؤهما يربك الفريق الجديد.
- التوثيق في `README.md`/`deployment.md` يصف المعمارية القديمة (NestJS + FastAPI) ولا يطابق الواقع الحالي.

---

## 10. Export Plan

### 10.1 GitHub

1. من Lovable: **GitHub → Connect / Push** (المستودع الحالي `story-magic-club`).
2. تأكد من أن `.env` غير مرفوع، وأن `.env.example` يعكس المتغيرات الحقيقية للواجهة (`VITE_*`).
3. الفروع: `main` للإنتاج؛ CI الحالي في `.github/workflows/ci.yml`.

### 10.2 Local Development

```bash
git clone <repo> && cd story-magic-club
npm install
cp .env.example .env      # املأ VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev
```

للخلفية: `supabase link --project-ref <ref>` ثم `supabase db push` و`supabase functions deploy <name>` لكل دالة، ثم ضبط الأسرار بـ `supabase secrets set`.

### 10.3 Vercel / Netlify

- Build command: `npm run build` — Output: `dist`.
- Env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (+ `VITE_API_URL` فقط إن أُعيد تشغيل NestJS).
- SPA rewrite: Vercel `{"rewrites":[{"source":"/(.*)","destination":"/index.html"}]}` أو Netlify `/* /index.html 200`.
- تأكد من أن Service Worker لا يخدم HTML قديمًا (الإعداد الحالي NetworkFirst للتنقلات — سليم).

### 10.4 Docker

`Dockerfile` الجذري يبني الواجهة ويقدّمها عبر NGINX (`docker/nginx/nginx.conf`).

```bash
docker build -t najmah-web .
docker run -p 8080:80 najmah-web
# أو الحزمة الكاملة القديمة:
docker compose -f docker-compose.production.yml up -d --build
```

ملاحظة: `docker-compose*.yml` يشغّل أيضًا `backend-core` و`ai-service` و`redis` — غير مطلوبة للتشغيل الحالي.

---

## 11. Final Assessment

### نسبة الاكتمال (تقدير مبني على الكود)

| المجال | النسبة |
| :--- | ---: |
| الواجهة والصفحات (72 صفحة) | 90% |
| محرّك القصص SEL + الرسوم | 85% |
| التصدير TXT / PDF / MP3 / EPUB | 75% |
| لوحة الإدارة (35 صفحة) | 85% |
| المدفوعات والاشتراكات | 80% |
| الأمن و RLS | 85% |
| التوثيق ومطابقته للواقع | 45% |
| جاهزية النقل خارج Lovable | 60% |
| **الإجمالي المرجّح** | **≈ 78%** |

### أهم المشاكل الحالية

1. طبقة `src/api/*` الإرثية (axios → NestJS غير موجود) ما زالت مستوردة في ~20 ملفًا — مصدر أعطال وقت التشغيل.
2. بقايا n8n (صفحة أدمن + 5 edge functions + `adminN8nApi.ts` + `n8nConfig.ts`) بعد التراجع عن n8n.
3. `export-story-pdf` مقيّد بحد 4 صور بسبب حدود CPU — نتيجة منقوصة للقصص الطويلة.
4. تكرار الدوال الصوتية (`narrate-story`, `narrate-story-edge`, `narrate-story-full`, `narrate-classic-story`) بلا مالك واضح.
5. بيانات وهمية ما زالت في الشجرة (`mockStore`, `mockBlog`, `adminMockData`, `mockCompetition`).
6. `postcss.config.cjs` و`postcss.config.js` متكرران.
7. مساران للاختبار مكشوفان في الإنتاج + دالة `paddle-webhook-test`.
8. `README.md` و`deployment.md` يصفان معمارية لم تعد قائمة.
9. Publishable key و URL مضمّنان نصًا في `src/lib/env.ts` (يعيقان النقل).
10. لا توجد تغطية اختبارات حقيقية لمسار التصدير من طرف إلى طرف رغم أنه محور المنتج.

### أهم 10 خطوات قبل Production Launch

1. حذف/استبدال كل استيراد من `@/api` وتوحيد الوصول عبر Supabase مباشرة.
2. إزالة كامل بقايا n8n (صفحة + دوال + مكتبات).
3. تثبيت مسار التصدير الثلاثي (TXT/PDF/MP3) واختباره على قصة 15 صفحة بالعربية والإنجليزية.
4. حل حد الصور في PDF (تقسيم المهمة أو معالجة غير متزامنة عبر `batch_export_jobs`).
5. توحيد دوال السرد الصوتي في مسار واحد وحذف الباقي.
6. إزالة `paddle-webhook-test` وحماية `/test/*` و`/download-test`.
7. جعل `VITE_SUPABASE_*` من البيئة فقط (مع إبقاء fallback للمعاينة إن لزم) قبل أي نقل.
8. مراجعة الباكتات العامة (`story-audio`, `story-images`, `story-music`) وقرار التحويل لروابط موقّعة.
9. إعادة كتابة `README.md` + `deployment.md` لتطابق المعمارية الحالية (Vite SPA + Lovable Cloud)، وأرشفة `backend-core/` و`ai-service/`.
10. تشغيل فحص أمني كامل + تشغيل `npm run build` و`npm test` و`npm run e2e` في CI كبوابة إطلاق.

### التوصية النهائية

**لا تُجمَّد الواجهة الآن.** الواجهة ناضجة بصريًا ووظيفيًا (90%)، لكنها تحمل طبقتَي بيانات متناقضتين وبقايا تكاملات ملغاة. التوصية: **تجميد نطاق الميزات (Feature Freeze) مع فترة تنظيف تقنية قصيرة** تنفّذ البنود 1–6 أعلاه، ثم تجميد الواجهة رسميًا والانتقال إلى تصلّب الإنتاج (خطوات 7–10).

---

*تم إعداد هذا التقرير بقراءة الكود الفعلي: `src/App.tsx`، 72 صفحة، مكونات `src/components/**`، 31 hook، 40 وحدة في `src/lib`، 49 edge function، مخطط قاعدة البيانات الحيّ (69 جدولًا / 26 دالة)، وملفات الإعداد والنشر. أي بند لم يُتحقق منه بالكود لم يُدرَج.*
