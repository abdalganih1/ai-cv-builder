# تقرير مشروع AI CV Builder

## نظرة عامة على المشروع

هذا المشروع هو **منشئ سيرة ذاتية ذكي (AI CV Builder)** مبني باستخدام Next.js و TypeScript. يتيح للمستخدمين إنشاء سيرهم الذاتية بمساعدة الذكاء الاصطناعي.

---

## هيكل المشروع

### ملفات الإعداد والتكوين

| الملف | الوصف |
|-------|-------|
| [`package.json`](package.json) | يحتوي على تبعيات المشروع والسكريبتات |
| [`tsconfig.json`](tsconfig.json) | إعدادات TypeScript |
| [`next.config.ts`](next.config.ts) | إعدادات Next.js |
| [`tailwind.config.ts`](tailwind.config.ts) | إعدادات Tailwind CSS |
| [`postcss.config.mjs`](postcss.config.mjs) | إعدادات PostCSS |
| [`eslint.config.mjs`](eslint.config.mjs) | إعدادات ESLint |
| [`wrangler.toml`](wrangler.toml) | إعدادات Cloudflare Workers |
| [`.npmrc`](.npmrc) | إعدادات npm |
| [`.gitignore`](.gitignore) | ملفات يتم تجاهلها من Git |

### ملفات التوثيق

| الملف | الوصف |
|-------|-------|
| [`README.md`](README.md) | ملف README الرئيسي للمشروع |
| [`WALKTHROUGH.md`](WALKTHROUGH.md) | دليل استخدام المشروع |
| [`DEPLOY_CLOUDFLARE.md`](DEPLOY_CLOUDFLARE.md) | دليل النشر على Cloudflare |

---

## المجلدات الرئيسية

### 📁 [`public/`](public/)

يحتوي على الملفات الثابتة والموارد:

- **الخطوط العربية:**
  - [`IBMPlexSansArabic-Bold.ttf`](public/IBMPlexSansArabic-Bold.ttf) - خط عربي غامق
  - [`IBMPlexSansArabic-Regular.ttf`](public/IBMPlexSansArabic-Regular.ttf) - خط عربي عادي

- **الصور والأيقونات:**
  - [`sham-cash-qr.png`](public/sham-cash-qr.png) - رمز QR للدفع
  - [`favicon.ico`](public/favicon.ico) - أيقونة الموقع
  - أيقونات SVG: [`file.svg`](public/file.svg), [`globe.svg`](public/globe.svg), [`next.svg`](public/next.svg), [`vercel.svg`](public/vercel.svg), [`window.svg`](public/window.svg)

---

### 📁 [`src/app/`](src/app/)

المجلد الرئيسي لتطبيق Next.js (App Router):

| الملف | الوصف |
|-------|-------|
| [`layout.tsx`](src/app/layout.tsx) | التخطيط الرئيسي للتطبيق |
| [`page.tsx`](src/app/page.tsx) | الصفحة الرئيسية |
| [`globals.css`](src/app/globals.css) | أنماط CSS العامة |
| [`favicon.ico`](src/app/favicon.ico) | أيقونة الموقع |

#### 📁 [`src/app/api/`](src/app/api/)

نقاط النهاية للـ API:

| الملف | الوصف |
|-------|-------|
| [`api/ai/chat/route.ts`](src/app/api/ai/chat/route.ts) | API للدردشة مع الذكاء الاصطناعي |
| [`api/upload-proof/route.ts`](src/app/api/upload-proof/route.ts) | API لرفع إثباتات الدفع |

---

### 📁 [`src/components/`](src/components/)

مكونات React المنفصلة:

#### 📁 [`src/components/chat/`](src/components/chat/)
مكونات الدردشة:
- [`EditChat.tsx`](src/components/chat/EditChat.tsx) - مكون تعديل الدردشة

#### 📁 [`src/components/payment/`](src/components/payment/)
مكونات الدفع:
- [`ShamCashPayment.tsx`](src/components/payment/ShamCashPayment.tsx) - مكون الدفع عبر ShamCash

#### 📁 [`src/components/preview/`](src/components/preview/)
مكونات المعاينة:
- [`CVPreview.tsx`](src/components/preview/CVPreview.tsx) - معاينة السيرة الذاتية
- [`PDFDocument.tsx`](src/components/preview/PDFDocument.tsx) - مستند PDF

#### 📁 [`src/components/wizard/`](src/components/wizard/)
مكونات معالج الإنشاء (Wizard):
- [`WelcomeStep.tsx`](src/components/wizard/WelcomeStep.tsx) - خطوة الترحيب
- [`QuestionnaireStep.tsx`](src/components/wizard/QuestionnaireStep.tsx) - خطوة الاستبيان
- [`ContactStep.tsx`](src/components/wizard/ContactStep.tsx) - خطوة معلومات الاتصال
- [`ProgressBar.tsx`](src/components/wizard/ProgressBar.tsx) - شريط التقدم

---

### 📁 [`src/lib/`](src/lib/)

المكتبات والأدوات المساعدة:

#### 📁 [`src/lib/ai/`](src/lib/ai/)
وظائف الذكاء الاصطناعي:

| الملف | الوصف |
|-------|-------|
| [`chat-editor.ts`](src/lib/ai/chat-editor.ts) | محرر الدردشة |
| [`questionnaire-agent.ts`](src/lib/ai/questionnaire-agent.ts) | وكيل الاستبيان |
| [`system-prompts.ts`](src/lib/ai/system-prompts.ts) | الـ Prompts الأساسية للنظام |
| [`zai-client.ts`](src/lib/ai/zai-client.ts) | عميل ZAI للذكاء الاصطناعي |

#### 📁 [`src/lib/types/`](src/lib/types/)
أنواع TypeScript:
- [`cv-schema.ts`](src/lib/types/cv-schema.ts) - مخطط بيانات السيرة الذاتية

#### 📁 [`src/lib/pdf/`](src/lib/pdf/)
مكتبات إنشاء PDF (مجلد فارغ حالياً)

---

## ملخص المكونات الرئيسية

```
┌─────────────────────────────────────────────────────────────┐
│                    AI CV Builder                            │
├─────────────────────────────────────────────────────────────┤
│  Frontend (Next.js + React + TypeScript)                    │
│  ├── صفحات التطبيق (App Router)                             │
│  ├── مكونات الواجهة (Components)                            │
│  │   ├── Wizard (خطوات الإنشاء)                             │
│  │   ├── Chat (الدردشة الذكية)                              │
│  │   ├── Preview (المعاينة)                                 │
│  │   └── Payment (الدفع)                                    │
│  └── أنماط CSS (Tailwind)                                   │
├─────────────────────────────────────────────────────────────┤
│  Backend (API Routes)                                       │
│  ├── AI Chat API                                            │
│  └── Upload Proof API                                       │
├─────────────────────────────────────────────────────────────┤
│  AI Integration                                             │
│  ├── ZAI Client                                             │
│  ├── System Prompts                                         │
│  ├── Questionnaire Agent                                    │
│  └── Chat Editor                                            │
├─────────────────────────────────────────────────────────────┤
│  PDF Generation                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## التقنيات المستخدمة

- **إطار العمل:** Next.js 14+ (App Router)
- **اللغة:** TypeScript
- **التصميم:** Tailwind CSS
- **الذكاء الاصطناعي:** ZAI Client
- **الخطوط:** IBM Plex Sans Arabic
- **النشر:** Cloudflare Workers (Wrangler)

---

## ملاحظات

- المشروع يدعم اللغة العربية بشكل كامل (خط IBM Plex Sans Arabic)
- يحتوي على نظام دفع متكامل (ShamCash)
- يستخدم الذكاء الاصطناعي لمساعدة المستخدمين في إنشاء سيرهم الذاتية
- يدعم تصدير السير الذاتية بصيغة PDF
