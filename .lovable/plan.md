
# ملخص مشروع NajmaH / Starry Tales

## نظرة عامة
منصة قصص أطفال تفاعلية بالذكاء الاصطناعي، متعددة اللغات (عربي/إنجليزي + 4 لغات أخرى)، مع توليد قصص مخصصة وصور وسرد صوتي ومسابقات رسم أسبوعية ومدوّنة وتعليم اجتماعي عاطفي (SEL).

## التقنيات (Stack)
- **Frontend**: React 18 + Vite 5 + TypeScript + Tailwind + shadcn/ui
- **i18n**: i18next (ar, en, fr, es, de, it)
- **State/Data**: TanStack Query + React Router v6 (lazy routes)
- **Backend**: Lovable Cloud (Supabase) — Auth, DB, Storage, Edge Functions
- **AI**: Lovable AI Gateway (Gemini/GPT) للقصص + ElevenLabs للسرد
- **Payments**: Paddle
- **PWA حالياً**: manifest فقط (بدون Service Worker)، مع أيقونات وmeta tags

## الميزات الرئيسية
1. **AI Storyteller** — توليد قصص مخصصة بسن/شخصيات/قيم (SEL)، مع صور وصوت
2. **Story Library** — قصص جاهزة مع قارئ تفاعلي (ReadingMode, NarratorPicker, موسيقى خلفية)
3. **My AI Stories** — حفظ القصص بحساب المستخدم + History مع pagination
4. **Drawing Competition** — مسابقات أسبوعية، تصويت، Hall of Fame
5. **Blog** — مقالات بنظام submission (المؤلف يرسل → الأدمن يراجع/يقبل/يرفض بسبب)
6. **Store + Checkout** — منتجات، عربة، دفع Paddle/يدوي
7. **Parent Dashboard** — متابعة الطفل + streaks
8. **Subscription** — خطط مدفوعة + free trial + spin wheel
9. **Admin Dashboard** — لوحة شاملة: قصص، Story Engine، AI Models، Illustration Analytics, AI Usage, Audio & Narration، فيديوهات، blog review، مدفوعات، اشتراكات، خطط، منتجات، طلبات، webhooks، لغات، إعدادات

## بنية المجلدات الأساسية
- `src/pages/` — صفحات عامة + `admin/` (20+ صفحة أدمن)
- `src/components/` — UI + `admin/`, `story/`, `payment/`, `cart/`
- `src/lib/` — APIs (aiStoryApi, blogAdminApi, subscriptionApi, ...)
- `src/hooks/` — useAuth, useTheme, useSubscription, useStreak ...
- `supabase/functions/` — 25+ Edge Function (generate-story, illustrate-story, narrate-story-full, paddle-webhook, ...)
- `docs/CHILDRENS_LITERATURE_KNOWLEDGE_BASE.md` — قاعدة المعرفة المرجعية للقصص

## الأمان
- RLS على كل الجداول، أدوار في `user_roles` منفصلة، `has_role()` security definer
- ProtectedRoute مع `requireAdmin` / `requireStaff`

## الحالة الحالية للـ PWA
- ✅ `manifest.webmanifest` كامل (أيقونات 192/512/maskable، theme color، standalone)
- ✅ Meta tags في `index.html` (apple-touch-icon, theme-color, ...)
- ❌ لا يوجد Service Worker
- ❌ لا يوجد دعم Offline
- ❌ لا يوجد install prompt مخصص

---

# خطة تحويل المشروع إلى PWA كامل

## تنبيه مهم قبل البدء
حالياً المشروع **قابل للتثبيت بالفعل** من المتصفح (Add to Home Screen) بفضل الـ manifest الموجود. السؤال: هل تحتاج فعلاً Service Worker مع offline support؟

| الخيار | المزايا | العيوب |
|--------|--------|--------|
| **A. Manifest فقط (الحالي + تحسينات)** | بسيط، يعمل فوراً، لا مشاكل تخزين مؤقت، لا يكسر preview | بدون offline، بدون push notifications |
| **B. PWA كامل بـ Service Worker** | offline، تحديثات في الخلفية، تجربة native أكثر | معقد، يكسر preview الـ Lovable، تخزين مؤقت قد يعرض نسخ قديمة |

**توصيتي**: ابدأ بالخيار A، وانتقل لـ B فقط إذا احتجت offline فعلاً.

## الخيار A — تحسين التثبيت (موصى به، سريع)
1. **زر تثبيت مخصص**: إنشاء `src/components/InstallPwaButton.tsx` يستمع لحدث `beforeinstallprompt` ويعرض زر "تثبيت التطبيق" في:
   - Navigation (desktop)
   - BottomNav أو AccountProfile (mobile)
2. **صفحة `/install`**: شرح بصري لكيفية التثبيت على iOS (Share → Add to Home Screen) وAndroid (تلقائي).
3. **iOS splash screens**: إضافة `apple-touch-startup-image` لأحجام شاشات iOS الشائعة في `index.html`.
4. **تحسين الـ manifest**: إضافة `shortcuts` (مثل: "قصة جديدة"، "مكتبتي"، "مسابقة الرسم") و `share_target` إن لزم.
5. **تحقق Lighthouse PWA score** بعد النشر.

## الخيار B — PWA كامل بـ Service Worker (متقدم)
> ⚠️ سيؤثر على preview داخل Lovable editor؛ يعمل فقط في النسخة المنشورة.

1. **تثبيت**: `vite-plugin-pwa` + `workbox-window`.
2. **إعداد `vite.config.ts`**:
   - `registerType: "autoUpdate"`
   - `devOptions: { enabled: false }` ⚠️ ضروري
   - `navigateFallbackDenylist: [/^\/~oauth/, /^\/admin/, /^\/api/]`
   - استراتيجية `NetworkFirst` لـ HTML navigation
   - استراتيجية `CacheFirst` للأصول الثابتة (صور قصص، fonts)
   - استراتيجية `StaleWhileRevalidate` لـ API GET (story library، blog)
3. **حماية التسجيل من iframe/preview** في `src/main.tsx`:
   - عدم تسجيل SW إذا `window.self !== window.top` أو host يحتوي `lovableproject.com` / `id-preview--`
   - تنظيف أي SW مسجل سابقاً في هذه السياقات
4. **توعية المستخدم بالتحديثات**: استخدام `workbox-window` لإظهار toast "نسخة جديدة متاحة — تحديث" بدلاً من إعادة تحميل صامتة.
5. **استبعاد المسارات الحساسة من الكاش**: `/auth`, `/checkout/*`, `/admin/*`, كل Supabase auth/storage endpoints.
6. **تجنب كاش الصوت/الفيديو الكبير**: تحديد حد أقصى (مثلاً 50 MB) للـ cache مع LRU.
7. **kill-switch SW جاهز** في `public/sw.js` احتياطياً (لو احتجنا إلغاء التسجيل لاحقاً للمستخدمين القدامى).
8. **اختبار**:
   - بناء production + معاينة محلية (`npm run build && npm run preview`)
   - فحص Lighthouse PWA
   - اختبار offline في الـ DevTools
   - اختبار تدفق OAuth (يجب ألا يُكاش)
   - اختبار checkout (يجب أن يكون شبكة دائماً)

## التفاصيل التقنية (للمراجعة)
- لا تعديل على `src/integrations/supabase/*` ولا `.env`
- لا حاجة لـ migration قاعدة بيانات
- التغييرات frontend بالكامل: `vite.config.ts`, `index.html`, `src/main.tsx`, مكونات جديدة فقط
- المحافظة على routes الـ OAuth والـ admin خارج الكاش
- بعد النشر يحتاج المستخدمون فتح الموقع مرة في متصفح حديث ثم تثبيته

## سؤال للمستخدم
أي خيار تفضّل؟
- **A** فقط (سريع، آمن، تثبيت بدون offline)
- **B** كامل (offline، تجربة native، يحتاج اختبار أكثر بعد النشر)
- **A ثم B** على مرحلتين
