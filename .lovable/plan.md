
# ما ينقص لتسليم "Starry Tales / NajmaH" للعميل

تحديث لخطة التسليم بناءً على آخر حالة للمشروع. ما تم إنجازه مؤخراً مُستثنى (Trigger الـ profiles، `update-streak` edge function، `expire-subscriptions`، الصفحات القانونية، عداد الرصيد، BYOK، حدّ الاشتراك، Audit Logs، Illustration reuse، PDF reuse).

---

## 🔴 P0 — حواجز تسليم فعلية

### 1) اعتماد المدفوعات اليدوية (Approve Manual Payment)
- **الوضع:** جدول `manual_payment_requests` موجود، لا يوجد UI ولا edge function `approve-payment`.
- **الأثر:** الأدمن يضطر لكتابة SQL يدوي لتفعيل أي اشتراك مدفوع → غير قابل للتسليم.
- **المطلوب:** زر "اعتماد/رفض" في `AdminPaymentsPage` + edge function تنشئ صف في `user_subscriptions` وتُحدّث الحالة، مع إشعار للعميل.

### 2) إعدادات الـ Auth في Cloud (Redirect URLs + Site URL)
- **الوضع:** الكود يستخدم `emailRedirectTo`، لكن دومين الإنتاج لم يُضَف في Cloud → روابط التحقق ستُكسر بعد النشر.
- **المطلوب:** تثبيت Site URL + Redirect allow-list للدومين النهائي قبل التسليم (خطوة يدوية في Cloud → Users → URL Configuration).

### 3) اختبار E2E كامل للـ Free Trial والاشتراكات
- التحقق من: fingerprint → 3 صفحات بصور → تسجيل خروج → منع تكرار التجربة → ترقية → bypass عبر BYOK.
- بدون هذا الاختبار لا يمكن ضمان أن أهم funnel للعميل يعمل.

### 4) إزالة Mock Data من صفحات الإنتاج
- `mockBlog.ts`, `mockCompetition.ts`, `mockStore.ts`, `adminMockData.ts` لا تزال مستخدمة في:
  - `HomeCompetitionHighlight`, `WeeklyChallenge`, `AdminVideosPage`, `AdminStoriesPage`, `AdminDashboardOverview`, `AdminLanguagesPage`.
- **المطلوب:** التبديل لقراءة فعلية من DB أو إخفاء الأقسام التي لا توجد لها بيانات.

---

## 🟠 P1 — وظائف مُعلَن عنها لكن غير مكتملة

### 5) Worker فحص الملفات (`scan-file`)
- جدول `file_scan_jobs` يستقبل jobs من `upload-finalize` بدون processor فعلي.
- **الأثر:** صور مسابقات الرسم تُقبل بلا فحص ClamAV → مخاطرة قانونية في منتج موجّه للأطفال.
- **المطلوب:** edge function تستهلك الـ jobs (cron كل دقيقة) + تحديث `status` على الملف.

### 6) تفعيل Bedtime Mode تلقائياً
- جدول `bedtime_schedules` و `useBedtimeAutoTheme` موجودان لكن لا يوجد UI لإدارة الجدول داخل `ParentDashboard`.
- **المطلوب:** فورم إنشاء/تعديل/حذف جدول لكل طفل + التحقق من تطبيقه فعلياً على الواجهة.

### 7) إشعارات بريدية أساسية (Lovable Emails)
- لا توجد قوالب: ترحيب بعد التسجيل، تأكيد دفع، اقتراب انتهاء اشتراك.
- يتطلب أولاً إعداد Email Domain، ثم scaffold للقوالب.

### 8) تنظيف Edge Functions غير المستخدمة
- `get-file-url` (إن وُجدت) ومراجعة أي function يتيمة لتقليل سطح الهجوم.

### 9) مراجعة RLS + Security Scan شامل
- تشغيل Security Scan قبل التسليم وإغلاق أي High/Critical.
- التركيز على جداول الأطفال (`profiles`, `child_profiles`, `generated_illustrations`, `audit_logs`).

---

## 🟡 P2 — تحسينات جودة موصى بها قبل التسليم

### 10) SEO Production-ready
- meta tags لكل صفحة، تحديث `sitemap.xml`، JSON-LD للقصص، canonical للروابط.

### 11) صفحة AdminPaymentSettings والربط مع Stripe/Paddle (لو مطلوب)
- حالياً يدوي بالكامل. لو العميل يريد دفع آلي، يلزم تفعيل بوابة دفع + webhook.

### 12) i18n cleanup
- التأكد من عدم تسرّب نصوص hardcoded بعد آخر إعادة هيكلة، خاصة في صفحات الأدمن.

### 13) Performance pass
- Lighthouse على Home/Stories/AI Storyteller، صور WebP، lazy-load كل ما يمكن.

---

## 🟢 P3 — اختياري للإصدار الأول

- TTS مجاني بديل ElevenLabs.
- `generate-story-video` (الحقول موجودة بدون generator).
- جدولة `cleanup_*` (rate_limit، upload_pipeline قديم).
- لوحة Analytics للأهل (تقدم الطفل أسبوعياً).

---

## يحتاج قرار العميل (خارج الكود)

- **الدومين النهائي** لإكمال إعداد Site URL + Email DNS.
- **اختيار بوابة الدفع** (يدوي فقط / Stripe / Paddle).
- **هوية بريدية** (شعار + لون + نبرة) للقوالب.

---

## أسأل قبل تنفيذ الخطة

اختر نطاق التسليم وأرجع لك بخطة تنفيذ مفصّلة:

- **(أ) الحد الأدنى:** P0 فقط (1–4) — جاهز للإطلاق خلال 2–3 أيام.
- **(ب) احترافي:** P0 + P1 (1–9) — منتج كامل وآمن.
- **(ج) كامل:** P0 + P1 + P2 (1–13) — جاهز للنمو والتسويق.
- **(د) مخصّص:** اذكر أرقام البنود التي تريدها.
