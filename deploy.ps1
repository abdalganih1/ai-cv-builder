# ============================================================================
# سكريبت نشر المشروع - AI CV Builder Deploy Script
# ============================================================================
# هذا السكريبت يقوم بـ:
# 1. عرض التغييرات الحالية
# 2. طلب رسالة commit من المستخدم
# 3. إضافة الملفات وعمل commit
# 4. عمل push إلى GitHub
# 5. تشغيل عملية deploy إلى Cloudflare
# ============================================================================

param(
    [string]$Message = "",
    [switch]$SkipDeploy,
    [switch]$SkipPush,
    [switch]$Help
)

# ألوان للطباعة
function Write-Info { param($text) Write-Host "ℹ️  $text" -ForegroundColor Cyan }
function Write-Success { param($text) Write-Host "✅ $text" -ForegroundColor Green }
function Write-Warning { param($text) Write-Host "⚠️  $text" -ForegroundColor Yellow }
function Write-Error { param($text) Write-Host "❌ $text" -ForegroundColor Red }
function Write-Header { param($text) Write-Host "`n========================================" -ForegroundColor Magenta; Write-Host "  $text" -ForegroundColor Magenta; Write-Host "========================================" -ForegroundColor Magenta }

# عرض المساعدة
if ($Help) {
    Write-Host @"
    
🚀 سكريبت نشر المشروع - AI CV Builder

الاستخدام:
    .\deploy.ps1                    # تشغيل تفاعلي (يسأل عن رسالة commit)
    .\deploy.ps1 -Message "نص"      # تحديد رسالة commit مباشرة
    .\deploy.ps1 -SkipDeploy        # تخطي عملية deploy (فقط commit و push)
    .\deploy.ps1 -SkipPush          # تخطي عملية push (فقط commit)
    .\deploy.ps1 -Help              # عرض هذه المساعدة

أمثلة:
    .\deploy.ps1 -Message "إصلاح مشكلة التنقل"
    .\deploy.ps1 -SkipDeploy -Message "تحديث التوثيق"

"@
    exit 0
}

Write-Header "مرحباً بك في سكريبت النشر 🚀"

# التحقق من وجود git
if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
    Write-Error "Git غير مثبت على النظام!"
    exit 1
}

# التحقق من وجود npm
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Error "NPM غير مثبت على النظام!"
    exit 1
}

# عرض حالة Git الحالية
Write-Header "حالة Git الحالية"
git status

# التحقق من وجود تغييرات
$status = git status --porcelain
if (-not $status) {
    Write-Warning "لا توجد تغييرات للنشر!"
    exit 0
}

# عرض التغييرات المعدلة
Write-Header "الملفات المعدلة"
git diff --stat

# عرض الملفات الجديدة
$newFiles = git ls-files --others --exclude-standard
if ($newFiles) {
    Write-Info "الملفات الجديدة:"
    $newFiles | ForEach-Object { Write-Host "  + $_" -ForegroundColor Green }
}

# طلب رسالة commit إذا لم يتم تحديدها
if (-not $Message) {
    Write-Header "اقتراحات لرسالة Commit"
    
    # تحليل التغييرات واقتراح رسائل مناسبة
    $modifiedFiles = git diff --name-only
    $newFilesList = git ls-files --others --exclude-standard
    
    $suggestions = @()
    
    # اقتراحات بناءً على الملفات المعدلة
    if ($modifiedFiles -match "page\.tsx" -or $modifiedFiles -match "QuestionnaireStep") {
        $suggestions += "تحسينات على واجهة المستخدم ومعالج الأسئلة"
    }
    if ($modifiedFiles -match "CVPreview" -or $modifiedFiles -match "preview") {
        $suggestions += "تحديث معاينة السيرة الذاتية"
    }
    if ($modifiedFiles -match "UserReport") {
        $suggestions += "تحديث تقرير المستخدم والتوثيق"
    }
    if ($modifiedFiles -match "api") {
        $suggestions += "تحديثات على واجهات API"
    }
    if ($newFilesList -match "plans") {
        $suggestions += "إضافة خطط جديدة للتطوير"
    }
    
    # إضافة اقتراحات افتراضية
    $suggestions += "تحديثات عامة على المشروع"
    $suggestions += "إصلاح أخطاء وتحسين الأداء"
    
    # عرض الاقتراحات
    $i = 1
    foreach ($suggestion in $suggestions | Select-Object -Unique) {
        Write-Host "  [$i] $suggestion" -ForegroundColor Yellow
        $i++
    }
    Write-Host "  [c] كتابة رسالة مخصصة" -ForegroundColor Cyan
    Write-Host "  [q] إلغاء العملية" -ForegroundColor Red
    
    $choice = Read-Host "`nاختر رقم الاقتراح أو اكتب 'c' لرسالة مخصصة"
    
    if ($choice -eq "q") {
        Write-Warning "تم إلغاء العملية"
        exit 0
    }
    elseif ($choice -eq "c") {
        $Message = Read-Host "أدخل رسالة Commit"
    }
    else {
        $index = [int]$choice - 1
        $uniqueSuggestions = $suggestions | Select-Object -Unique
        if ($index -ge 0 -and $index -lt $uniqueSuggestions.Count) {
            $Message = $uniqueSuggestions[$index]
        }
        else {
            $Message = Read-Host "أدخل رسالة Commit"
        }
    }
}

# التحقق من وجود رسالة
if (-not $Message) {
    Write-Error "يجب إدخال رسالة Commit!"
    exit 1
}

Write-Info "رسالة Commit: $Message"

# تأكيد المتابعة
$confirm = Read-Host "`nهل تريد المتابعة؟ (y/n)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Warning "تم إلغاء العملية"
    exit 0
}

# إضافة جميع الملفات
Write-Header "إضافة الملفات"
git add .
Write-Success "تم إضافة جميع الملفات"

# عمل commit
Write-Header "إنشاء Commit"
git commit -m $Message
if ($LASTEXITCODE -ne 0) {
    Write-Error "فشل في إنشاء Commit!"
    exit 1
}
Write-Success "تم إنشاء Commit بنجاح"

# عمل push
if (-not $SkipPush) {
    Write-Header "رفع التغييرات إلى GitHub"
    git push origin main
    if ($LASTEXITCODE -ne 0) {
        Write-Error "فشل في رفع التغييرات!"
        exit 1
    }
    Write-Success "تم رفع التغييرات إلى GitHub بنجاح"
}
else {
    Write-Warning "تم تخطي عملية Push"
}

# تشغيل deploy
if (-not $SkipDeploy) {
    Write-Header "نشر المشروع على Cloudflare"
    
    # بناء المشروع أولاً
    Write-Info "بناء المشروع..."
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error "فشل في بناء المشروع!"
        exit 1
    }
    Write-Success "تم بناء المشروع بنجاح"
    
    # نشر على Cloudflare
    Write-Info "نشر على Cloudflare Pages..."
    npm run deploy
    if ($LASTEXITCODE -ne 0) {
        Write-Error "فشل في نشر المشروع!"
        exit 1
    }
    Write-Success "تم نشر المشروع على Cloudflare بنجاح"
}
else {
    Write-Warning "تم تخطي عملية Deploy"
}

Write-Header "اكتملت العملية بنجاح! 🎉"
Write-Host ""
Write-Info "ملخص العملية:"
Write-Host "  ✅ تم إضافة الملفات" -ForegroundColor Green
Write-Host "  ✅ تم إنشاء Commit: $Message" -ForegroundColor Green
if (-not $SkipPush) {
    Write-Host "  ✅ تم الرفع إلى GitHub" -ForegroundColor Green
}
if (-not $SkipDeploy) {
    Write-Host "  ✅ تم النشر على Cloudflare" -ForegroundColor Green
}
Write-Host ""
