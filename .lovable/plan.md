# خطة تنفيذ الطلبات

## Phase 1 — UI (يبدأ فوراً)

**1.1 Profile Icon في الـ Navbar**
- إضافة Avatar dropdown في `src/components/Navigation.tsx` يمين اللوجو
- يعرض صورة المستخدم من `profiles.avatar_url` أو fallback بأول حرف من الاسم
- Dropdown menu: Profile, My Stories, Subscription, Sign Out
- يظهر Sign In button لو مفيش user

**1.2 تحويل الواجهة للإنجليزية كافتراضي**
- تغيير `src/i18n/config.ts`: `fallbackLng: "en"` (موجود بالفعل) + التأكد إن `en` هي الاختيار الأول
- الإبقاء على العربي كخيار في اللغة (زي ما اتفقنا)
- مسح أي `localStorage` قديم لو محفوظ فيه `ar` تلقائياً — لا؛ الأفضل نسيبها للمستخدم

## Phase 2 — تفكيك دوال الـ AI (أهم جزء لتوفير الـ API)

**2.1 Generate Story = Text + Audio فقط**
- تعديل `compose-story` و `trial-story`: يرجع النص + يستدعي TTS للنطق فقط
- **ما يستدعيش** `illustrate-story` نهائياً
- الصور تفضل `null` في response

**2.2 Illustrate عند الطلب فقط**
- الـ frontend عنده بالفعل زر Illustrate (موجود في `IllustrateButton.tsx`)
- إضافة check صارم في `illustrate-story/index.ts`:
  ```
  if (story.pages.every(p => p.image_url)) 
    return { blocked: true, reason: "already_illustrated" }
  ```
- إضافة flag `illustrated_at` في story record

**2.3 Save & Download PDF**
- `export-story-pdf` موجود ويشتغل — سنتأكد إنه يحفظ ويعطي download URL
- إضافة زر PDF واضح بعد الترسيم

## Phase 3 — Audio Player Pause/Resume Fix

- المشكلة في `SelStoryViewer.tsx` أو narrator hook: عند pause بيعمل `audio.src = ""` بدل `audio.pause()`
- الحل: استخدام `audio.pause()` فقط + الاحتفاظ بـ `audio.currentTime` عند resume
- إضافة state `isPaused` منفصل عن `isPlaying`

## Phase 4 — Auth Email Confirmation

- فحص `supabase/functions/auth-email-hook/index.ts` (لو موجود)
- التأكد من `emailRedirectTo: window.location.origin/` في signup
- ملاحظة للعميل: تفعيل الإيميلات يحتاج domain مضبوط من Cloud → Emails

## قرارات AI Services (تم التأكيد)

- **Text/Chat/Translation**: Google Gemini مباشر عبر Google AI Studio API
  - Model: `gemini-2.5-flash` (fallback: `gemini-1.5-flash`)
  - يتطلب سر جديد: `GEMINI_API_KEY`
  - سنعدل `supabase/functions/_shared/sel/gateway.ts` ليكون Gemini-first
- **TTS**: OpenAI `gpt-4o-mini-tts` عبر Lovable Gateway (LOVABLE_API_KEY الحالي)
- **حذف/تعطيل**: OpenRouter, Claude, DeepSeek references من الكود

## ترتيب التنفيذ

سأنفذ بالترتيب: Phase 1 → 2 → 3 → 4. كل Phase أختبرها وأأكدلك قبل ما أعدي للي بعدها.

**سنبدأ الآن بـ Phase 1.1: Profile Icon.**
