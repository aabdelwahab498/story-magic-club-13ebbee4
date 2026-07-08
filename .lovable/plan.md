
## ملخص الوضع

**يعمل الآن:**
- توليد النص (Gemini عبر `compose-story` / `generate-story`)
- تحميل TXT (من الواجهة مباشرة)
- تحميل PDF (عبر `export-story-pdf` و `trial-pdf`)
- تشغيل الصوت داخل المتصفح فقط (Web Speech API)

**المفقود:** تحميل ملف صوتي (MP3) للقصة.

## الحل: Microsoft Edge TTS (مجاني، بدون مفتاح)

مكتبة `rany2/edge-tts` تستخدم خدمة Microsoft Edge Read Aloud مجاناً بدون API key. لا يمكن تشغيلها في المتصفح مباشرة (تعتمد على WebSocket خاص + توقيع)، لذلك سنستدعيها من **Edge Function** ونعيد ملف MP3 للمستخدم.

### 1) إنشاء Edge Function جديدة: `narrate-story-edge`

- تستقبل: `{ storyId?, text, language, voice? }`
- تتحقق من:
  - تسجيل دخول المستخدم (JWT)
  - طول النص (حد 20KB)
  - صحة اللغة (ar/en)
- تختار صوت افتراضي حسب اللغة:
  - عربي: `ar-EG-SalmaNeural` (أو `ar-SA-HamedNeural`)
  - إنجليزي: `en-US-AriaNeural`
- تفتح WebSocket مع `wss://speech.platform.bing.com/consumer/speech/synthesize/readaloud/edge/v1`
- تُرسل SSML وتستقبل chunks بصيغة `audio-24khz-48kbitrate-mono-mp3`
- تُجمّع chunks وتحفظ الملف في bucket `story-audio` باسم `{userId}/{storyId|hash}.mp3`
- تُعيد: `{ success: true, url, duration }`

سيتم تطبيق منطق edge-tts داخل الـ function مباشرة بدون مكتبة خارجية (بروتوكول WebSocket بسيط ومعروف) لضمان التوافق مع Deno runtime وتجنب مشاكل npm packages.

### 2) chunking للنصوص الطويلة

القصص قد تكون طويلة. سنقسم النص إلى فقرات ≤3000 حرف، ونولّد كل جزء عبر WebSocket منفصل، ثم نجمع bytes الـ MP3 بالتسلسل (MP3 يدعم concatenation المباشر).

### 3) معالجة الأخطاء (كما اتفقنا سابقاً)

كل الأخطاء تُعاد بـ HTTP 200 + `{ success: false, code, message }`:
- `unauthorized` — لا يوجد session
- `text_too_long`
- `tts_upstream_failed` — مع retry تلقائي 3 مرات مع exponential backoff (1s/2s/4s)
- `storage_upload_failed`

### 4) تحديث الواجهة

**`src/lib/storyTtsApi.ts`:**
- دالة `generateStoryMp3({ storyId, text, language, voice })` تستدعي `narrate-story-edge` وترجع URL
- دالة `downloadStoryMp3(url, filename)` تُنزل الملف

**`src/pages/AIStoryteller.tsx` و `src/components/SelStoryViewer.tsx`:**
- إضافة زر **"تحميل صوت MP3"** بجانب أزرار TXT/PDF الحالية
- عند الضغط: يظهر spinner + رسالة "جاري توليد الصوت..." (قد تستغرق 10–30 ثانية)
- بعد النجاح: تحميل تلقائي + toast نجاح
- عند الفشل: toast ودود بالرسالة العربية/الإنجليزية

**`src/components/BrowserNarratorSettings.tsx`:** يبقى كما هو للتشغيل داخل المتصفح.

### 5) اختيار الصوت للمستخدم (اختياري)

في `BrowserNarratorSettings` نضيف قسم "صوت التحميل" مع dropdown للأصوات المتوفرة على Edge TTS:
- عربي: Salma, Hamed, Zariyah, Shakir
- إنجليزي: Aria, Guy, Jenny, Christopher

يُحفظ التفضيل في `localStorage` ويُرسل عند التحميل.

### 6) Caching

قبل التوليد، نفحص إذا كان الملف موجوداً في `story-audio/{userId}/{storyId}-{voice}.mp3`. لو موجود → نعيد الـ URL مباشرة بدون إعادة توليد. يوفّر وقت وعرض نطاق.

## تقنية (للمرجع)

بروتوكول Edge TTS المستخدم داخل Function:
```
1. GET wss://speech.platform.bing.com/... مع Trusted-Client-Token=6A5AA1D4EAFF4E9FB37E23D68491D6F4
2. إرسال speech.config JSON
3. إرسال SSML mkssml
4. استقبال binary frames: header + MP3 chunks
5. إغلاق عند "turn.end"
```

## ما لن يتغير

- `narrate-story-full` القديم (Google TTS) سيبقى محذوف الاستدعاء منه — لا نُعيد مفاتيح Google.
- Web Speech API يبقى للتشغيل الفوري داخل المتصفح.
- منطق النص و PDF لا يتغير.

## الملفات المتأثرة

- **جديد:** `supabase/functions/narrate-story-edge/index.ts`
- **جديد:** `supabase/functions/_shared/edgeTts.ts` (بروتوكول WebSocket)
- **معدّل:** `src/lib/storyTtsApi.ts`
- **معدّل:** `src/pages/AIStoryteller.tsx`
- **معدّل:** `src/components/SelStoryViewer.tsx`
- **معدّل:** `src/components/BrowserNarratorSettings.tsx` (اختياري: dropdown أصوات التحميل)
