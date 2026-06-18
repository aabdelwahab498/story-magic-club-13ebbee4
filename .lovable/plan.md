# خطة: توسيع نظام التحميل للقصص (Paywall فقط)

تصدير PDF موجود بالفعل خلف Paywall — هنبني على نفس النمط.

## الميزات الجديدة

### 1. زر "Download Audio" (MP3)
- في `StoryDetail.tsx` و `MyAiStoryDetail.tsx` و `SelStoryViewer.tsx`: زر بجوار مشغل الصوت.
- لو السرد جاهز في bucket `story-audio` → تنزيل مباشر بـ `fetch` + `downloadBlob` باسم `{story-title}.mp3`.
- لو غير موجود → استدعاء `narrate-story-full` أولاً ثم التنزيل.
- التحقق من الصلاحية عبر `has_paid_feature(uid, 'audio')`.

### 2. تصدير TXT
- زر "Download TXT" في صفحة القصة.
- توليد client-side: عنوان + فصول/صفحات نص خام UTF-8.
- اسم الملف: `{story-title}.txt`.
- خلف Paywall (`has_paid_feature(uid, 'pdf')` كنفس فئة المستندات).

### 3. تصدير EPUB
- Edge Function جديدة `export-story-epub`:
  - تأخذ `storyId`، تتحقق من ملكية القصة + الاشتراك المدفوع.
  - تبني EPUB 3.0 (مجلد META-INF + OEBPS + content.opf + nav.xhtml + فصل لكل صفحة + صور من `story-images`).
  - تستخدم مكتبة `jszip` (Deno npm:) لتجميع الـ ZIP.
  - ترفع الناتج إلى bucket جديد `story-epubs` (public) وتعيد URL موقّع.
- زر "Download EPUB" يستدعي الـ function ثم يفتح الرابط.

### 4. Batch Download لقصص الطفل
- في صفحة Child Profile / "My Stories": زر "Download All (ZIP)" مع dropdown لاختيار الصيغ (PDF / MP3 / EPUB / TXT).
- Edge Function جديدة `batch-download-stories`:
  - Input: `childId` أو `userId` + `formats[]`.
  - التحقق من المالك + `has_paid_feature`.
  - حد أقصى 50 قصة لكل عملية (لتجنب timeout).
  - تجمع الملفات الموجودة من buckets (`story-pdfs`, `story-audio`, `story-epubs`) — تولّد الناقص on-demand.
  - تبني ZIP بـ `jszip` وترفعه إلى bucket جديد `story-bundles` (private, signed URL صلاحية 1 ساعة).
  - تُرجع signed URL.
- شريط تقدم بسيط في الـ UI بناءً على polling لجدول `batch_export_jobs`.

### 5. PDF بعد الدفع
موجود بالفعل (`export-story-pdf` + Paywall) — هنتأكد إن الزر ظاهر بوضوح ونوحّد مكانه مع أزرار التحميل الجديدة في "Downloads" group واحد.

## التغييرات على قاعدة البيانات

- جدول جديد `batch_export_jobs` (id, user_id, child_id, formats[], status, total, completed, bundle_path, error, timestamps) + RLS (المستخدم يرى الخاص به فقط) + GRANTs.
- bucket `story-epubs` (public) للحفظ المؤقت.
- bucket `story-bundles` (private) للـ ZIPs.
- تحديث `subscription_plans` لو لزم: التأكد إن `allow_pdf` / `allow_audio` يغطّوا TXT/EPUB/Batch (هنستخدم `allow_pdf` كـ "downloads" flag).

## Edge Functions جديدة
1. `export-story-epub` — توليد EPUB مع جميع الصور والفصول.
2. `batch-download-stories` — تجميع متعدد الصيغ في ZIP.

## مكونات UI جديدة
- `<DownloadMenu story={} />` موحّد: PDF / MP3 / TXT / EPUB. يفحص الصلاحيات ويظهر Paywall للزوار غير المدفوعين.
- `<BatchDownloadDialog childId={} />`: اختيار صيغ + شريط تقدم.

## حماية Paywall
- كل edge function تتحقق من JWT + `has_paid_feature` قبل أي عمل.
- التحقق من الفرونت لتحسين UX فقط، الحماية الحقيقية في الـ functions.

## نطاق العمل
المستخدمين المدفوعين فقط (نفس سياسة PDF الحالية). غير المشتركين يرون الأزرار مع قفل ويُوجَّهون لصفحة الاشتراك.

## ما لن يتغير
- لا تعديل على توليد القصص نفسها.
- لا تعديل على نظام الـ Admin أو Audit Logs.
- لا تغيير على تصدير الفيديو الموجود.
