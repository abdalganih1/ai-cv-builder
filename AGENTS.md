# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Build/Test Commands
- `npm run dev` - Start development server
- `npm run build` - Production build (Next.js)
- `npm run test` - Run all tests with Vitest
- `npm run test -- --run path/to/file.test.tsx` - Run single test file
- `npm run lint` - Run ESLint

## Architecture
- **Wizard Flow**: 5 steps (Welcome → Contact → Questionnaire → Payment → Preview) in [`src/app/page.tsx`](src/app/page.tsx)
- **State**: CV data persisted to localStorage + server sync via [`/api/sessions/save`](src/app/api/sessions/save/route.ts)
- **AI Integration**: Uses z.ai API (`ZAI_API_KEY` env var) - see [`src/lib/ai/zai-client.ts`](src/lib/ai/zai-client.ts)
- **Analytics**: D1 database in production, localStorage fallback - see [`src/lib/analytics/storage.ts`](src/lib/analytics/storage.ts)

## Critical Patterns
- **API Routes**: Must use `export const runtime = 'edge'` for Cloudflare compatibility
- **Arabic RTL**: App is Arabic-first with `dir="rtl"` in layout - all UI text should be Arabic
- **Path Alias**: `@/*` maps to `./src/*` (configured in tsconfig.json)
- **Tests**: Place `*.test.tsx` files in same directory as source (not separate `__tests__` folder)
- **CV Schema**: Central type definitions in [`src/lib/types/cv-schema.ts`](src/lib/types/cv-schema.ts)

## Deployment
- **النشر التلقائي**: Cloudflare Pages يأخذ المشروع تلقائياً من GitHub
- لا حاجة لعمل `npm run build` أو `npm run deploy` محلياً
- فقط اعمل `git push` وسيقوم Cloudflare بالبناء والنشر تلقائياً

- سكريبت [`deploy.ps1`](deploy.ps1) يقوم بـ: git add → commit → push فقط
- استخدم `.\deploy.ps1 -Yes` للموافقة التلقائية وتخطي التأكيد

### ⚠️ قاعدة مهمة جداً - متابعة النشر
**بعد كل عملية push:**
1. يجب التحقق من حالة النشر على Cloudflare Pages
2. إذا فشل النشر → **أولوية قصوى لإصلاحه قبل أي شيء آخر**
3. لا تكمل مهام جديدة حتى يتم إصلاح فشل النشر
4. استخدم MCP Cloudflare أو dashboard للتحقق من حالة النشر

**رابط النشر:** cv.abdalgani.com

## 📋 تقارير المستخدم - User Reports
**مهم جداً:** بعد كل محادثة أو تعديل بناءً على طلب المستخدم، يجب إضافة تقرير إلى ملف [`UserReport.md`](UserReport.md).
- التقرير يجب أن يُضاف للبيانات القديمة (append) وليس حذف المحتوى السابق
- يجب توثيق: المشكلة، السبب الجذري، الحل المطبق، الملفات المعدلة، النتيجة
- دائما التقارير تكتب باللغة العربية
- دائما اقرا اخر التقارير حتى تعرف تقدم المشروع في كل امر جديد
- دائما بس تنتهي بتشغل الملف اسمه deploy.ps1 باستعمال powershell 
