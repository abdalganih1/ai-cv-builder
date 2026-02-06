# 📊 Admin Dashboard Setup Guide

دليل إعداد لوحة التحكم والتحليلات لـ AI CV Builder.

---

## 🚀 الإعداد السريع (Local Development)

لوحة التحكم تعمل مباشرة في بيئة التطوير المحلي بدون إعداد إضافي:

```bash
npm run dev
# ثم افتح: http://localhost:3000/panel
```

> **ملاحظة:** في التطوير المحلي، لا يتم حفظ البيانات بشكل دائم (تُحفظ في الـ console فقط).

---

## ☁️ إعداد الإنتاج (Cloudflare)

### 1️⃣ إنشاء قاعدة البيانات D1

```bash
# سجل الدخول لـ Cloudflare
npx wrangler login

# أنشئ قاعدة البيانات
npx wrangler d1 create analytics-db
```

**انسخ الـ `database_id`** من الناتج وأضفه في `wrangler.toml`:

```toml
[[d1_databases]]
binding = "ANALYTICS_DB"
database_name = "analytics-db"
database_id = "YOUR_DATABASE_ID_HERE"  # ← استبدل هذا
```

### 2️⃣ إنشاء الجداول

```bash
# طبّق schema قاعدة البيانات
npx wrangler d1 execute analytics-db --file=./src/lib/analytics/schema.sql
```

### 3️⃣ إعداد Cloudflare Access (الأمان)

1. اذهب إلى [Cloudflare Dashboard](https://dash.cloudflare.com)
2. اختر **Zero Trust** → **Access** → **Applications**
3. أنشئ تطبيق جديد:
   - **Type:** Self-hosted
   - **Application domain:** `pdf.technoenjaz.com/panel*`
   - **Policy:** اختر Email أو GitHub للمصادقة

### 4️⃣ النشر

```bash
npm run build
npx wrangler pages deploy .vercel/output/static
```

---

## 📁 ملفات التحليلات

```
src/lib/analytics/
├── types.ts      # تعريفات TypeScript
├── tracker.ts    # Client-side tracker
├── storage.ts    # D1 storage adapter
├── provider.tsx  # React Context
├── schema.sql    # Database schema
└── index.ts      # Exports

src/app/api/analytics/
├── track/route.ts          # تسجيل الأحداث
├── sessions/route.ts       # قائمة الجلسات
├── sessions/[id]/route.ts  # تفاصيل جلسة
└── stats/route.ts          # إحصائيات

src/app/panel/
├── layout.tsx              # Auth layout
├── page.tsx                # Dashboard
└── sessions/
    ├── page.tsx            # Sessions list
    └── [id]/page.tsx       # Session detail
```

---

## 🔐 الأمان

- **Cloudflare Access:** يحمي `/panel/*` بمصادقة
- **API Protection:** الـ API endpoints تتحقق من `cf-access-jwt-assertion` header
- **Development:** يسمح بالوصول المباشر في `NODE_ENV=development`

---

## 📈 الأحداث المتتبعة

| الحدث | الوصف |
|-------|-------|
| `session_start` | بدء جلسة جديدة |
| `step_view` | عرض خطوة |
| `step_complete` | إكمال خطوة |
| `form_field_fill` | ملء حقل |
| `pdf_upload` | رفع ملف PDF |
| `payment_proof_upload` | رفع إثبات دفع |
| `tab_hidden` | مغادرة المتصفح |
| `tab_visible` | العودة للمتصفح |
| `page_exit` | مغادرة الصفحة |

---

## 🛠️ استخدام الـ Hook في Components

```tsx
import { useAnalytics } from '@/lib/analytics/provider';

function MyComponent() {
  const { trackClick, trackFieldFill, trackFileUpload } = useAnalytics();

  return (
    <button onClick={() => trackClick('submit-btn', 'إرسال')}>
      إرسال
    </button>
  );
}
```

---

## ❓ FAQ

**Q: لا تظهر البيانات في لوحة التحكم؟**
A: تأكد من إعداد D1 بشكل صحيح وتشغيل `schema.sql`.

**Q: كيف أحذف بيانات قديمة؟**
A: استخدم Cloudflare Dashboard → D1 → SQL Console.

**Q: هل يمكن تصدير البيانات؟**
A: نعم، استخدم API endpoint: `GET /api/analytics/sessions?limit=1000`
