# AI CV Builder - تقرير شامل للمشروع

> **للـ AI Agents:** هذا التقرير يحتوي على كل تفاصيل المشروع، المشاكل، الحلول، والتوجيهات. يجب تحديثه مع كل تطوير جديد.

---

## 📋 جدول المحتويات

1. [نظرة عامة](#نظرة-عامة)
2. [الهيكلية التقنية](#الهيكلية-التقنية)
3. [المشاكل والحلول](#المشاكل-والحلول)
4. [التوجيهات والقواعد](#التوجيهات-والقواعد)
5. [النشر والتشغيل](#النشر-والتشغيل)
6. [التجارب المختبرة](#التجارب-المختبرة)

---

## 🎯 نظرة عامة

### الهدف

تطبيق ويب لإنشاء سير ذاتية احترافية باللغة العربية باستخدام الذكاء الاصطناعي.

### المزايا الرئيسية

- ✅ استيراد من PDF/نص/URL
- ✅ معالجة نصوص عربية (RTL)
- ✅ تصدير PDF احترافي
- ✅ دفع عبر ShamCash
- ✅ واجهة عصرية وجذابة

### التقنيات المستخدمة

```
Frontend: Next.js 15.1.5, React 19, TypeScript
Styling: Tailwind CSS
PDF Generation: @react-pdf/renderer
PDF Parsing: pdfjs-dist
AI: Z.AI API (GLM-5-Turbo)
Deployment: Cloudflare Pages
```

---

## 🏗️ الهيكلية التقنية

### البنية الأساسية

```
ai-cv-builder/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── analyze/
│   │   │   │   ├── pdf/route.ts      # تحليل PDF
│   │   │   │   └── text/route.ts     # تحليل النص
│   │   │   ├── ai/
│   │   │   │   └── chat/route.ts     # محادثة AI
│   │   │   └── upload-proof/route.ts # رفع إثبات الدفع
│   │   ├── page.tsx                   # الصفحة الرئيسية
│   │   └── layout.tsx                 # التخطيط العام
│   ├── components/
│   │   ├── wizard/                    # خطوات الإنشاء
│   │   │   ├── WelcomeStep.tsx
│   │   │   ├── AnalysisProgress.tsx
│   │   │   ├── MissingFieldsForm.tsx
│   │   │   ├── PersonalInfoStep.tsx
│   │   │   ├── ExperienceStep.tsx
│   │   │   ├── EducationStep.tsx
│   │   │   └── PaymentStep.tsx
│   │   ├── payment/
│   │   │   └── ShamCashPayment.tsx
│   │   └── pdf/
│   │       └── CVDocument.tsx         # قالب PDF
│   ├── lib/
│   │   ├── types/
│   │   │   └── cv-schema.ts           # أنواع البيانات
│   │   └── fonts/
│   │       └── register-fonts.ts      # تسجيل الخطوط
│   └── public/
│       ├── fonts/                     # IBM Plex Sans Arabic
│       └── sham-cash-qr.png          # QR للدفع
├── .env.local                         # متغيرات البيئة
└── next.config.ts                     # إعدادات Next.js
```

### مسار تدفق البيانات

```mermaid
graph LR
    A[المستخدم] --> B{اختيار طريقة الإدخال}
    B -->|PDF| C[رفع PDF]
    B -->|نص| D[لصق النص]
    B -->|يدوي| E[إدخال يدوي]
    
    C --> F[/api/analyze/pdf]
    D --> G[/api/analyze/text]
    
    F --> H[استخراج النص بـ pdfjs-dist]
    H --> I[إرسال للذكاء الاصطناعي]
    G --> I
    
    I --> J[تحليل وهيكلة البيانات]
    J --> K[ملء النموذج]
    
    E --> K
    K --> L[مراجعة وتعديل]
    L --> M[الدفع]
    M --> N[تصدير PDF]
```

---

## 🐛 المشاكل والحلول

### 1️⃣ مشكلة استخراج النص من PDF العربي

#### المشكلة الأولى: النص المشوه

**التاريخ:** 2026-02-05  
**الأعراض:**

```
--- DEBUG: Extracted Text Start ---
ar º∟!Ê♥½B¹×L´»>R♠¿ÝæRÚ¹rhí▼qø¾S÷
--- Total Length: 38568 chars ---
```

#### المحاولات المختبرة

##### ❌ المحاولة 1: استخدام `pdf-parse`

```typescript
const pdf = await import('pdf-parse');
const data = await pdf(Buffer.from(buffer));
return data.text;
```

**النتيجة:** فشل - المكتبة لا تعمل في Edge Runtime (Cloudflare)

##### ❌ المحاولة 2: Regex البسيط

```typescript
const text = pdfBuffer.toString('utf8');
return text.replace(/[^\x20-\x7E\u0600-\u06FF]/g, '');
```

**النتيجة:** فشل - فقدان كبير للمعلومات

##### ❌ المحاولة 3: خادم Python بـ PyMuPDF

```python
import fitz
doc = fitz.open(stream=pdf_bytes)
text = "\n\n".join([page.get_text() for page in doc])
```

**النتيجة:** نجح محلياً لكن **غير متوافق مع Cloudflare Pages**

##### ❌ المحاولة 4: pdfjs-dist بدون CMaps

```typescript
const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true
}).promise;
```

**النتيجة:** فشل - نص مشوه (`º∟!Ê♥½B¹×`)

##### ⚠️ المحاولة 5: pdfjs-dist مع CMaps (جاري الاختبار)

```typescript
pdfjs.GlobalWorkerOptions.workerSrc = false; // تعطيل Worker
const doc = await pdfjs.getDocument({
    cMapUrl: 'https://unpkg.com/pdfjs-dist@.../cmaps/',
    cMapPacked: true,
    useSystemFonts: false
}).promise;
```

**الحالة:** قيد الاختبار - مشكلة Worker ما زالت موجودة

---

### 2️⃣ مشكلة Web Worker في بيئة Node.js

#### الخطأ

```
PDF.js parsing error: Setting up fake worker failed
No "GlobalWorkerOptions.workerSrc" specified
```

#### السبب الجذري

`pdfjs-dist` مصمم للمتصفح ويحتاج Web Worker. في بيئة Node.js (Next.js API Routes)، Worker غير متاح.

#### الحلول المجربة

1. ✅ `workerSrc = ''` → فشل (يطلب قيمة فعلية)
2. ⏳ `workerSrc = false` → قيد الاختبار
3. ⏳ `useWorkerFetch: false` → قيد الاختبار

---

### 3️⃣ مشكلة الذكاء الاصطناعي يرجع بيانات فارغة

#### المشكلة

```json
{
  "personal": {"firstName": "", "lastName": "", ...},
  "experience": [],
  "education": []
}
```

#### الأسباب المحتملة

1. **نص مشوه:** الـ AI يستقبل رموز بدلاً من نصوص
2. **قواعد صارمة:** Prompt كان يطلب عدم "تأليف" بيانات، فترك كل شيء فارغاً
3. **حد الطول:** كان 8000 حرف فقط (قد لا يكفي لـ 5 صفحات)

#### الحلول المطبقة

- ✅ تخفيف قواعد الـ Prompt
- ✅ زيادة حد الطول من 8000 → 15000 حرف
- ✅ **حل نهائي:** استخدام Python PyMuPDF عبر `child_process`

---

### 6️⃣ الحل النهائي: PyMuPDF + child_process (2026-02-06)

#### المشكلة

جميع مكتبات JavaScript لاستخراج النص من PDF (pdf-parse, pdfjs-dist) أنتجت نصاً مشوهاً.

#### الحل

إنشاء script Python يستخدم PyMuPDF (fitz) واستدعاؤه من Node.js:

```bash
# الموقع: scripts/pdf_text_extractor.py
python scripts/pdf_text_extractor.py "cv.pdf"
# يرجع JSON مع النص والصورة الشخصية
```

#### النتائج

```
✅ PyMuPDF extracted 7832 chars, 5 images
✅ Profile image detected!
```

#### الملفات المُنشأة

- `scripts/pdf_text_extractor.py` - استخراج النص والصور
- `scripts/pdf_extractor.py` - أداة اختبار بسيطة

---

### 7️⃣ مشكلة النشر على Cloudflare (2026-02-06)

#### التحدي

Cloudflare Pages لا يدعم:

- ❌ Python أو أي runtime غير JavaScript
- ❌ `child_process` (لا shell access)
- ❌ ملفات كبيرة على الذاكرة

#### الحل: نظام استخراج مزدوج (Dual-Mode)

```typescript
// تحديد تلقائي حسب متغيرات البيئة:
// Mode 1: PDF_API_URL → Self-hosted API (VPS)
// Mode 2: OCR_SPACE_API_KEY → OCR.space API (Cloudflare)
// Mode 3: None → Python PyMuPDF (Local dev only)
```

#### المحاولات والأخطاء

| # | المحاولة | المشكلة | الحل |
|---|----------|---------|------|
| 1 | `pdf-parse` | ESM import errors | ❌ Abandoned |
| 2 | `pdfjs-dist` | Web Worker not available in Node.js | ❌ Abandoned |
| 3 | `pdfjs-dist/legacy` | Type errors + garbled Arabic | ❌ Abandoned |
| 4 | Python child_process | Works locally, **NOT on Cloudflare** | ✅ Local only |
| 5 | OCR.space with spread | `String.fromCharCode(...arr)` → Stack overflow | ❌ Fixed |
| 6 | OCR.space with Buffer | `Buffer.from().toString('base64')` | ✅ Works! |

#### خطأ Stack Overflow (2026-02-06 01:38)

**السبب:**

```typescript
// ❌ هذا يسبب stack overflow مع ملفات كبيرة (>1MB)
const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
```

**الإصلاح:**

```typescript
// ✅ استخدام Buffer للتحويل الآمن
if (typeof Buffer !== 'undefined') {
    base64 = Buffer.from(uint8Array).toString('base64');
} else {
    // Edge runtime: chunk-based conversion
    const CHUNK_SIZE = 32768;
    const chunks: string[] = [];
    for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
        const chunk = uint8Array.slice(i, i + CHUNK_SIZE);
        chunks.push(String.fromCharCode.apply(null, Array.from(chunk)));
    }
    base64 = btoa(chunks.join(''));
}
```

#### البنية النهائية للنشر

```
┌─────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                      │
│  ┌─────────────────────────────────────────────────┐    │
│  │ .env: OCR_SPACE_API_KEY=K8xxx                   │    │
│  │ → extractViaOCRSpace() → api.ocr.space          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    VPS (Optional)                        │
│  ┌─────────────────────────────────────────────────┐    │
│  │ .env: PDF_API_URL=https://pdf.domain.com        │    │
│  │ → extractViaSelfHostedAPI() → Docker FastAPI    │    │
│  │                                                  │    │
│  │ Docker: services/pdf-api/                       │    │
│  │ - FastAPI + PyMuPDF                             │    │
│  │ - docker-compose up -d                          │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

#### الملفات المُضافة للنشر

| ملف | الغرض |
|-----|-------|
| `services/pdf-api/app/main.py` | FastAPI server |
| `services/pdf-api/Dockerfile` | Docker config |
| `services/pdf-api/docker-compose.yml` | Orchestration |
| `services/pdf-api/README.md` | دليل النشر |
| `.env.example` | متغيرات البيئة الموثقة |

---

### 4️⃣ مشكلة توقيت مؤشر التقدم

#### المشكلة

المؤشر كان يكتمل بعد 60 ثانية، لكن الـ API يأخذ حتى 95 ثانية.

#### الحل

```typescript
// WelcomeStep.tsx
<AnalysisProgress estimatedDuration={100} /> // كان 60
```

---

### 5️⃣ مشكلة بناء الكود (Syntax Error)

#### الخطأ

```
Parsing ecmascript source code failed
> 62 | 4. في حقل `summary`، لخص الخبرة والمهارات في فقرة احترافية.
     |                 ^^^^^^^
Expected a semicolon
```

#### السبب

استخدام backticks (`) داخل template literal.

#### الحل

```typescript
// ❌ قبل
4. في حقل `summary`، لخص الخبرة...

// ✅ بعد
4. في حقل summary، لخص الخبرة...
```

---

## 📜 التوجيهات والقواعد

### قواعد التطوير (من `.gemini/GEMINI.md`)

#### 1. التفكير العميق (Deep Reasoning)

```
عندما يكتب المستخدم "فكر"، ادخل في حلقة تفكير متكررة:
- تحليل الأثر النفسي على المستخدم
- تكلفة الذاكرة للتنفيذ
- قابلية صيانة الكود لمدة 5 سنوات
```

#### 2. معايير التصميم

```
✅ تصميم "Avant-Garde" (طليعي)
✅ تناسق الألوان (HSL منسق)
✅ خطوط Google Fonts (Inter, Outfit, Bricolage Grotesque)
✅ Micro-animations لكل hover/interaction
✅ SEO proactive (Meta tags, Semantic HTML5)
```

#### 3. الأمان

```
❌ لا تعرض API Keys
❌ لا تستخدم eval()
✅ sanitize كل inputs
✅ استخدام environment variables
```

#### 4. الأدوات المحلية

```bash
# Python Tools في ~/.gemini/antigravity/tools/
pdf_vision.py analyze <pdf> <output>
pdf_vision.py md2pdf <md> <pdf>
office_suite.py read_docx <file>
wp_crawler.py <url> full
seo_auditor.py <file>
```

---

## 🚀 النشر والتشغيل

### التشغيل المحلي

#### 1️⃣ المتطلبات

```bash
Node.js: 24.8.0
npm: 10.x
```

#### 2️⃣ الإعداد

```bash
# استنساخ المشروع
git clone <repo-url>
cd ai-cv-builder

# تثبيت الحزم
npm install

# إعداد البيئة
cp .env.example .env.local
# ثم افتح .env.local وأضف:
# ZAI_API_KEY=your_api_key_here
```

#### 3️⃣ التشغيل

```bash
# Development
npm run dev
# يعمل على: http://localhost:3000

# Production Build
npm run build
npm start
```

---

### النشر على Cloudflare Pages

#### الإعدادات

```yaml
Build command: npm run build
Build output: .next
Node version: 24.8.0
Environment Variables:
  - ZAI_API_KEY: <secret>
```

#### خطوات النشر

##### 1️⃣ عبر Git (تلقائي)

```bash
git push origin main
# Cloudflare يبني ويشغّل تلقائياً
```

##### 2️⃣ عبر Dashboard

1. اذهب إلى Cloudflare Pages
2. اختر المشروع
3. Settings → Environment Variables
4. أضف `ZAI_API_KEY`
5. Deployments → Retry deployment

#### الدومين

```
Production: https://technoenjaz-pdf.pages.dev
Custom: https://pdf.technoenjaz.com
```

---

## 🧪 التجارب المختبرة

### تجربة 1: Python Server

**الهدف:** استخراج نص PDF بدقة  
**الحزم:** FastAPI + PyMuPDF  
**النتيجة:** ✅ نجح محلياً / ❌ فشل على Cloudflare  
**السبب:** Cloudflare Pages لا تدعم Python runtime

---

### تجربة 2: pdf-parse

**الهدف:** مكتبة Node.js بسيطة  
**النتيجة:** ❌ فشل  
**السبب:** لا تعمل في Edge Runtime

---

### تجربة 3: pdfjs-dist (بدون CMaps)

**الهدف:** استخراج نص في بيئة JavaScript خالصة  
**النتيجة:** ⚠️ جزئي - استخراج مشوه  
**السبب:** غياب Character Maps

---

### تجربة 4: pdfjs-dist + CMaps (الحالية)

**الهدف:** حل مشكلة النص العربي المشوه  
**الحالة:** ⏳ قيد الاختبار  
**التحديات:**

- ❌ Worker error في Node.js
- ⏳ محاولة تعطيل Worker
- ⏳ اختبار `GlobalWorkerOptions.workerSrc = false`

---

## 📊 حالة المشروع الحالية

### ✅ ما يعمل

- [x] واجهة المستخدم كاملة
- [x] استيراد يدوي
- [x] استيراد من نص
- [x] AI chat للتعديلات
- [x] تصدير PDF بتنسيق احترافي
- [x] دفع ShamCash
- [x] نشر على Cloudflare

### ⚠️ ما يحتاج إصلاح

- [ ] **استخراج PDF العربي** (المشكلة الرئيسية الحالية)
  - النص ما زال مشوهاً (`º∟!Ê♥½B¹×`)
  - Worker error في pdfjs-dist
  - CMaps لا تتحمل بشكل صحيح

### 🎯 الخطوات القادمة

1. حل مشكلة Worker في pdfjs-dist
2. التأكد من تحميل CMaps
3. اختبار استخراج النص العربي
4. إذا فشل → النظر في حلول بديلة:
   - استخدام خدمة خارجية (PDF.co API)
   - طلب من المستخدم لصق النص يدوياً
   - استخدام OCR (Tesseract.js) كحل أخير

### 🆕 تطويرات مستقبلية

1. **استخراج الصورة الشخصية تلقائياً:**
   - تم تطبيق استخراج الصور من PDF
   - اكتشاف صورة الوجه باستخدام heuristics (Portrait orientation, page 1)
   - يمكن تحسينها باستخدام OpenCV للتعرف على الوجوه

2. **تكامل الصورة مع CV:**
   - إضافة حقل `profileImage` في API response
   - يمكن عرضها في واجهة المعاينة
   - تضمينها في ملف PDF المُصدَّر

---

## 🔄 سجل التحديثات

### 2026-02-06

- ✅ حل مشكلة استخراج النص من PDF العربي
- ✅ إنشاء `scripts/pdf_text_extractor.py` باستخدام PyMuPDF
- ✅ تكامل Python مع Node.js عبر `child_process`
- ✅ استخراج الصورة الشخصية من PDF
- ✅ تحديث API لإرجاع `profileImage`

### 2026-02-05

- ✅ إضافة CMaps لـ pdfjs-dist
- ⏳ محاولة حل Worker error
- ✅ إنشاء هذا التقرير الشامل

### 2026-02-04

- ✅ تحسين UI/UX
- ✅ إضافة مؤشر التقدم
- ✅ رفع مدة المؤشر لـ 100 ثانية

### 2026-01-31

- ✅ إطلاق النسخة الأولى
- ✅ النشر على Cloudflare Pages

---

## 📝 ملاحظات للـ AI Agents

### كيفية تحديث هذا التقرير

#### عند إضافة ميزة جديدة

1. حدّث قسم [الهيكلية التقنية](#الهيكلية-التقنية)
2. أضف المسار في البنية الأساسية
3. حدّث الـ Mermaid diagram إذا تغير التدفق

#### عند حل مشكلة

1. أضف قسم جديد في [المشاكل والحلول](#المشاكل-والحلول)
2. وثّق الأعراض، المحاولات، والحل النهائي
3. حدّث [حالة المشروع](#حالة-المشروع-الحالية)

#### عند تجربة حل جديد

1. أضف في [التجارب المختبرة](#التجارب-المختبرة)
2. وثّق النتيجة (نجح/فشل/جزئي)
3. اشرح السبب

#### تنسيق الإضافات

```markdown
### X️⃣ مشكلة [اسم المشكلة]

#### المشكلة
[شرح المشكلة]

#### المحاولات المختبرة
##### ❌/✅/⏳ المحاولة N: [اسم الحل]
**النتيجة:** ...
**السبب:** ...
```

---

## 🔗 روابط مفيدة

- [Cloudflare Dashboard](https://dash.cloudflare.com)
- [Z.AI API Docs](https://api.z.ai/docs)
- [pdfjs-dist GitHub](https://github.com/mozilla/pdf.js)
- [Next.js Docs](https://nextjs.org/docs)

---

**آخر تحديث:** 2026-02-07 04:22 UTC+3  
**الحالة:** 🟢 تم إصلاح مشكلة النقاط التعدادية في PDF العربي

---

## 🆕 مشكلة RTL للنقاط التعدادية (2026-02-07)

### المشكلة الحالية

**الوصف:**

- عند تصدير PDF باللغة العربية، النقاط (`•`) تظهر لكن **النص بجانبها مفقود**
- النسخة الإنجليزية تعمل بشكل صحيح ✅
- الخط والتباعد يظهران بشكل جيد

**الملف المتأثر:**

```
src/components/preview/PDFDocument.tsx
```

**الدالة المشكلة:**

```typescript
function BulletText({ text, isRTL, styles }: BulletTextProps) {
    // هذه الدالة تحاول تحويل النص التعدادي إلى bullets منفصلة
    // المشكلة: النص يختفي بعد المعالجة
}
```

---

### 🔴 المحاولات الفاشلة (تجنب تكرارها!)

#### ❌ محاولة 1: تغيير الخط من IBMPlexSansArabic إلى TraditionalArabic

- **النتيجة:** فاشلة - المستخدم يفضل الخط القديم
- **السبب:** التغيير كان كبيراً جداً ولم يحل المشكلة الأساسية

#### ❌ محاولة 2: استخدام processRTLText مع RTL markers

```typescript
function processRTLText(text: string, isRTL: boolean): string {
    // إضافة RLM markers للنص
    return '\u200F' + text + '\u200F';
}
```

- **النتيجة:** فاشلة - لم تحل مشكلة ترتيب النقاط

#### ❌ محاولة 3: Split بـ regex على كل `-`

```typescript
const lines = text.split(/\n|(?=[-•●])/);
```

- **النتيجة:** كارثية! - يفصل على كل `-` في النص حتى داخل الكلمات
- **المشكلة:** كلمة مثل `T-shirt` تتحول لـ 3 أجزاء

#### ❌ محاولة 4: BulletText component مع split على newlines فقط

```typescript
const lines = text.split('\n');
if (line.startsWith('-')) {
    const content = line.replace(/^[-•●]\s*/, '').trim();
    // ...
}
```

- **النتيجة:** النقاط تظهر لكن النص بجانبها فارغ!
- **السبب المحتمل:** البيانات لا تحتوي `\n` - كل description يأتي كسطر واحد

---

### 🟡 الفرضيات المتبقية للتحقيق

#### فرضية 1: البيانات لا تحتوي newlines

- **الاختبار:** تم إضافة console.log لتتبع البيانات

```typescript
console.log('🔍 BulletText received:', { text, hasNewlines: text?.includes('\n') });
```

- **المطلوب:** فحص Console في المتصفح عند التصدير

#### فرضية 2: الـ description فارغ أصلاً

- **الاختبار:** نفس الـ console.log سيكشف هذا

#### فرضية 3: مشكلة في تمرير البيانات من CVData إلى PDFDocument

- **الاختبار:** مقارنة البيانات في localStorage مع ما يظهر في PDF

---

### 🔧 الحالة الحالية للكود

#### PDFDocument.tsx - BulletText Component (السطور 238-295)

```typescript
function BulletText({ text, isRTL, styles }: BulletTextProps) {
    // Debug logging - مضاف للتشخيص
    console.log('🔍 BulletText received:', { 
        text: text?.substring(0, 100), 
        isRTL, 
        hasNewlines: text?.includes('\n'), 
        length: text?.length 
    });
    
    if (!text) return null;

    const lines = text.split('\n');
    const validLines = lines.filter(line => line.trim());
    
    // ... rest of the code
}
```

#### الاستخدام في JSX

```tsx
{/* Summary */}
<BulletText text={data.personal.summary} isRTL={isRTL} styles={styles} />

{/* Experience */}
<BulletText text={exp.description} isRTL={isRTL} styles={styles} />
```

---

### 🎨 Styles المتعلقة بـ RTL

```typescript
bulletLine: {
    flexDirection: isRTL ? 'row-reverse' : 'row',  // ✅ RTL support
    alignItems: 'flex-start',
    marginBottom: 2,
    paddingRight: isRTL ? 0 : 8,
    paddingLeft: isRTL ? 8 : 0
},
bulletPoint: {
    fontSize: 10,
    color: '#1e3a5f',
    marginRight: isRTL ? 0 : 4,
    marginLeft: isRTL ? 4 : 0
},
bulletText: {
    fontSize: 10,
    color: '#333333',
    flex: 1,
    textAlign: isRTL ? 'right' : 'left'
}
```

---

### 📝 الخطوة التالية المقترحة

1. **أولاً:** فحص Console في المتصفح لرؤية ما يطبعه `console.log`
2. **ثانياً:** بناءً على النتيجة:
   - إذا `hasNewlines: false` ➜ النص يأتي كسطر واحد، نحتاج طريقة أخرى لتجزئته
   - إذا `text: undefined/null` ➜ البيانات لا تُمرر بشكل صحيح
   - إذا `text` موجود وصحيح ➜ المشكلة في المعالجة

---

### 🛠️ الخطوط المتوفرة

| الخط | الملف | الحجم |
|------|-------|-------|
| IBM Plex Sans Arabic (الحالي) | `IBMPlexSansArabic-Regular.ttf` | 195KB |
| Dubai | `Dubai-Regular.ttf` | 181KB |
| Traditional Arabic | `TraditionalArabic-Regular.ttf` | 282KB |
| Amiri | `Amiri-Regular.ttf` | 431KB |
| Noto Naskh Arabic | `NotoNaskhArabic.ttf` | 298KB |

---

### 📊 Schema للبيانات

```typescript
interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;  // ⚠️ هذا الحقل - string واحد
}

interface PersonalInfo {
  // ...
  summary?: string;  // ⚠️ هذا الحقل أيضاً
}
```

**ملاحظة:** الـ `description` هو `string` واحد وليس `array`، لذا يجب أن يحتوي على `\n` للتعدادات.

---

### 🔴 مشاكل أخرى متبقية

#### 1. خطأ atob في image-utils.ts

```
InvalidCharacterError: Failed to execute 'atob' on 'Window'
```

**الملف:** `src/lib/utils/image-utils.ts` السطر 44
**السبب:** base64 غير صالح للصورة

#### 2. تحذير "Unknown version 65280"

```
Unknown version 65280
```

**السبب:** تحذير من react-pdf عند قراءة بعض الخطوط

---

### ✅ ما يعمل بشكل صحيح

1. ✅ النسخة الإنجليزية تعمل بشكل كامل
2. ✅ الخط العربي يظهر بشكل جميل (الاسم، العناوين)
3. ✅ الصورة الشخصية تظهر
4. ✅ المهارات تظهر كـ badges
5. ✅ اللغات تظهر بشكل صحيح
6. ✅ RTL في العناوين والأسماء يعمل

---

### 🔗 الملفات الرئيسية للمراجعة

1. `src/components/preview/PDFDocument.tsx` - ملف PDF الرئيسي
2. `src/components/preview/CVPreview.tsx` - معاينة CV
3. `src/lib/types/cv-schema.ts` - تعريفات TypeScript
4. `src/lib/utils/image-utils.ts` - معالجة الصور
