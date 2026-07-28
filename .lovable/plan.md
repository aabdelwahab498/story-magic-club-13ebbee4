## سبب الشاشة السوداء (مؤكَّد بالفحص)

```text
PAGEERROR: children.find is not a function
  at ChildPicker (src/components/ChildPicker.tsx)
  at Navigation → Layout → RenderedRoute
body text length = 0
```

1. **مصدر بيانات خاطئ**: `src/api/children.api.ts` ينادي `apiClient('/users/me/children')`، و`src/api/client.ts` يستخدم `VITE_API_URL || '/api/v2'` — خادم NestJS (`backend-core`) غير مُشغَّل، فيرجع الطلب `index.html` (نص) بدل مصفوفة، و`children.find(...)` داخل `useActiveChild` يرمي استثناء.
2. **لا يوجد Error Boundary**: `ChildPicker` داخل `Navigation` داخل `Layout` → الاستثناء يُفرّغ شجرة React كلها → شاشة سوداء في كل الصفحات.

جدول `child_profiles` موجود فعلًا في Lovable Cloud: `id, parent_user_id, name, age, avatar, preferred_language, emotional_focus, bedtime_preferences, reading_level` (وعليه 5 سياسات RLS).

## خطة الإصلاح

### 1. تحويل بيانات الأطفال إلى Lovable Cloud
إعادة كتابة `src/api/children.api.ts` ليستعمل عميل Supabase على `child_profiles` بدل `apiClient`:
- `getChildren` → `select` مُقيَّد بـ `parent_user_id = auth.uid()`
- `getChild` / `createChild` / `updateChild` / `deleteChild` بنفس التواقيع الحالية
- طبقة تحويل بين أعمدة الجدول و`ChildProfile` (`preferred_language ↔ language`، `emotional_focus ↔ emotionalGoals`، `reading_level ↔ readingLevel`) حتى لا تتغيّر أي شاشة مستدعية
- مراجعة سياسات RLS الحالية والتأكد أنها تسمح لولي الأمر بأطفاله فقط

### 2. تحصين ضد الانهيار الكامل
- `useChildren` / `useActiveChild`: ضمان أن القيمة دائمًا مصفوفة (`Array.isArray(data) ? data : []`)
- إضافة `ErrorBoundary` حول محتوى `Layout` والـ `Suspense` في `App.tsx` مع رسالة خطأ مقروءة وزر "إعادة المحاولة" بدل الشاشة السوداء

### 3. المسارات الأخرى المعتمدة على نفس الخادم المفقود
`src/api/stories.api.ts` و`auth.api.ts` تُستهلك عبر `useStories` و`useStoryGeneration` و`useRoles` بنفس الأسلوب الهش — تحصين أماكن الاستهلاك (قوائم فارغة + حالة خطأ ظاهرة) دون تغيير سلوك أي شاشة تعمل، وتأجيل نقلها الكامل إلى Cloud لخطوة لاحقة.

### 4. تنظيف تحذير React
إزالة/تصحيح تمرير خاصية `playSound` إلى عنصر `<button>` في `src/pages/Index.tsx`.

### 5. التحقق
- إعادة فتح التطبيق في متصفح فعلي والتقاط لقطات لـ `/`، `/stories`، `/ai-storyteller`، `/family` والتأكد من صفر `pageerror`
- تشغيل فحص الأنواع

## ملاحظة
لن يتم حذف `backend-core` ولا تغيير أي شيء في تصدير TXT/PDF/MP3 — العمل محصور في إصلاح انهيار الواجهة ومصدر بيانات الأطفال.
