# دليل نشر AI CV Builder على Cloudflare Pages

تم تجهيز المشروع ليكون متوافقاً مع Cloudflare Pages. اتبع الخطوات التالية للنشر بنجاح.

## 1. رفع الكود إلى GitHub
تأكد من رفع التعديلات الأخيرة (بما فيها ملف `package.json` وملف `package-lock.json`) إلى GitHub.
```bash
git add .
git commit -m "Prepare for Cloudflare deployment"
git push
```

## 2. إنشاء مشروع جديد في Cloudflare
1. سجل الدخول إلى [Cloudflare Dashboard](https://dash.cloudflare.com).
2. انتقل إلى **Workers & Pages** > **Create application**.
3. اختر تبويب **Pages** ثم **Connect to Git**.
4. اختر مستودع المشروع (Repository) الخاص بك.

## 3. إعدادات البناء (Build Settings)
عند صفحة الإعدادات، املأ الحقول كالتالي بدقة:

- **Framework preset:** `Next.js` (إذا لم يظهر، اختر `None`)
- **Build command:** `npx @cloudflare/next-on-pages`
- **Build output directory:** `.vercel/output/static`
- **Root directory:** (اتركه فارغاً إلا إذا كان المشروع في مجلد فرعي)

> [!IMPORTANT]
> تأكد من استخدام الأمر `npx @cloudflare/next-on-pages` وليس `npm run build`. هذا الأمر يحول المشروع ليعمل على شبكة Edge الخاصة بـ Cloudflare.

## 4. متغيرات البيئة (Environment Variables)
هذه الخطوة **حرجة جداً** لكي يعمل الذكاء الاصطناعي.

في قسم **Environment variables** (أو بعد الإنشاء في Settings > Environment variables)، أضف المتغير التالي:

| Variable Name | Value |
|cB |cB |
| `ZAI_API_KEY` | (الصق مفتاح API الخاص بك هنا) |
| `NODE_VERSION` | `20` (اختياري، لكن يفضل تثبيته لضمان التوافق) |

## 5. حفظ ونشر (Save and Deploy)
اضغط على **Save and Deploy**. ستبدأ عملية البناء، وقد تستغرق دقيقة أو دقيقتين.

---

## ⚠️ استكشاف الأخطاء وإصلاحها

### مشكلة: Edge Runtime / Node.js Compatibility
إذا ظهر خطأ يتعلق بـ `compatibility flags`، قد تحتاج لتفعيل `nodejs_compat`.
1. اذهب إلى **Settings** > **Functions**.
2. ابحث عن **Compatibility Flags**.
3. أضف `nodejs_compat` إلى القائمة.

### مشكلة: الذاكرة المؤقتة (Cache)
إذا قمت بتحديث الموقع ولم تظهر التعديلات، قد تحتاج لمسح التخزين المؤقت (Purge Cache) من لوحة تحكم Cloudflare.
