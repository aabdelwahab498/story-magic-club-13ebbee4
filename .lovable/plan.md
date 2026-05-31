# خطة دمج Paddle يدوي مع NajmaH

بما أن Lovable لا يدعم Paddle التلقائي لهذا النوع من المشاريع، سنستخدم **حساب Paddle الخاص بك** (Billing API v2 + Paddle.js للـ Checkout).

---

## ما تحتاج تجهيزه أنت في Paddle Dashboard

1. **حساب Paddle Billing** (Sandbox أولاً للاختبار، ثم Live).
2. **API Key** من: Developer Tools → Authentication.
3. **Client-side Token** من: Developer Tools → Authentication (للـ Paddle.js).
4. **Webhook Secret** من: Developer Tools → Notifications → أضف endpoint.
5. **المنتجات والأسعار** (سأرشدك لإنشائها أو تستخدم API):
   - Starter — $4.99/شهر
   - Pro Creator — $14.99/شهر
   - Elite Publisher — $39.99/شهر
   - (Free يبقى بدون Paddle)
6. **الدومين المعتمد** للـ checkout: ستضيف دومين المعاينة + دومين الإنتاج في: Checkout → Website Approval.

---

## ما سأنفذه أنا

### 1. الأسرار (Secrets)
سأطلب منك إضافة:
- `PADDLE_API_KEY` (سري — للسيرفر)
- `PADDLE_WEBHOOK_SECRET` (سري — للتحقق من التواقيع)
- `PADDLE_ENVIRONMENT` (`sandbox` أو `production`)
- `PADDLE_CLIENT_TOKEN` (يُكشف للفرونت — سأخزنه في `app_settings` بدلاً من secret)

### 2. تعديلات قاعدة البيانات (migration)
- جدول `subscription_plans`: إضافة عمود `paddle_price_id TEXT` لربط كل خطة بسعر Paddle.
- جدول جديد `subscriptions`:
  ```
  user_id, paddle_subscription_id, paddle_customer_id,
  tier, status (active/past_due/canceled/paused),
  current_period_start, current_period_end,
  cancel_at_period_end, created_at, updated_at
  ```
  مع RLS: المستخدم يقرأ اشتراكه فقط، الأدمن يقرأ الكل، الكتابة من السيرفر فقط (service role).
- جدول `paddle_webhook_events` لتسجيل الأحداث ومنع التكرار (idempotency على `event_id`).

### 3. Edge Functions
- **`paddle-create-checkout`**: تتلقى `tier` → ترجع `transaction_id` أو ترسل المستخدم لـ Paddle.js مع `priceId` و `customerEmail`. تتحقق من JWT.
- **`paddle-webhook`**: تستقبل أحداث Paddle، تتحقق من توقيع HMAC، تعالج:
  - `subscription.created` / `subscription.activated` → تفعيل الـ tier للمستخدم
  - `subscription.updated` → تحديث الحالة
  - `subscription.canceled` / `subscription.past_due` → تخفيض للـ Free
  - `transaction.completed` → سجل الدفعة
- **`paddle-portal`**: ترجع رابط Customer Portal لإدارة الاشتراك/إلغاءه.

### 4. الفرونت
- تحميل `Paddle.js` ديناميكياً في `Pricing.tsx`.
- زر **Subscribe** لكل خطة → يفتح Paddle Overlay Checkout مع `customer.email` من الجلسة.
- بعد نجاح الـ Checkout: toast + redirect لصفحة شكر.
- زر **Manage Subscription** في `AccountProfile` يفتح Customer Portal.
- إخفاء/حذف نظام الدفع اليدوي (InstaPay/Vodafone/إثبات الدفع) من الـ UI.
- إزالة تبديل عملة EGP — العرض بالدولار فقط.

### 5. ربط مع Quota
- `_shared/quota.ts` يقرأ `subscriptions.status = 'active'` لتحديد الـ tier الفعلي بدل الاعتماد على نظام يدوي.

---

## ما يبقى يدوي عليك بعد التنفيذ

1. إنشاء المنتجات والأسعار في Paddle (يمكنني توليد script يستخدم Paddle API لإنشائها تلقائياً بعد إعطائي مفتاح Sandbox).
2. إضافة الـ Webhook URL (سأعطيك الرابط بعد نشر الـ Edge Function).
3. اعتماد الدومينات في Paddle Checkout settings.
4. الانتقال من Sandbox → Production بعد الاختبار.

---

## ترتيب التنفيذ المقترح

1. أنشئ حساب Paddle Sandbox الآن.
2. أعطني إشارة، فأضيف الـ secrets (سيظهر لك form آمن).
3. أنفذ migration + Edge Functions + Frontend.
4. أعطيك Webhook URL لتضعه في Paddle.
5. سكربت ينشئ الأسعار الأربعة في حسابك تلقائياً.
6. اختبار end-to-end بطلب وهمي.

هل أبدأ بإضافة الـ Secrets الآن؟
