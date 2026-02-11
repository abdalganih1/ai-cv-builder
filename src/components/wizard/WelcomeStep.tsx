"use client";

import { CVData, MissingFieldInfo } from '@/lib/types/cv-schema';
import { useState } from 'react';
import MissingFieldsForm from './MissingFieldsForm';
import AnalysisProgress from './AnalysisProgress';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
}

type QuickStartMode = 'select' | 'manual' | 'pdf' | 'text' | 'url' | 'advanced';

import AdvancedInput from './AdvancedInput';

// Card component for quick start options
function OptionCard({
    icon,
    title,
    description,
    onClick,
    gradient
}: {
    icon: string;
    title: string;
    description: string;
    onClick: () => void;
    gradient: string;
}) {
    return (
        <button
            onClick={onClick}
            className={`group relative p-6 rounded-2xl border-2 border-gray-100 hover:border-transparent transition-all duration-300 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] bg-white overflow-hidden text-right w-full`}
        >
            <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${gradient}`} />
            <div className="relative z-10">
                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-300">{icon}</div>
                <h3 className="text-lg font-bold text-gray-800 group-hover:text-white transition-colors mb-1">{title}</h3>
                <p className="text-sm text-gray-500 group-hover:text-white/80 transition-colors">{description}</p>
            </div>
        </button>
    );
}

// Manual entry component (original WelcomeStep)
function ManualEntry({ data, onNext, onBack }: { data: CVData; onNext: (data: Partial<CVData>) => void; onBack: () => void }) {
    const [firstName, setFirstName] = useState(data.personal.firstName);
    const [lastName, setLastName] = useState(data.personal.lastName);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        console.log('🔍 Form Submit - firstName:', firstName, 'lastName:', lastName);
        console.log('🔍 data.personal:', data.personal);
        console.log('🔍 data.metadata:', data.metadata);

        if (firstName && lastName) {
            console.log('✅ Calling onNext...');
            onNext({
                personal: { ...data.personal, firstName, lastName },
                metadata: { ...data.metadata, importSource: 'manual' }
            });
        } else {
            console.log('❌ firstName or lastName is empty!');
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-8">
            <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
            >
                <span>→</span>
                <span>العودة للخيارات</span>
            </button>

            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">✏️ البدء من الصفر</h2>
                <p className="text-gray-500">أدخل اسمك لنبدأ ببناء سيرتك الذاتية</p>
            </div>

            <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <input
                        id="firstName"
                        name="firstName"
                        type="text"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        className="w-full p-4 text-lg border-2 border-gray-100 rounded-xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                        placeholder="الاسم الأول (مثلاً: محمد)"
                        autoComplete="given-name"
                        enterKeyHint="next"
                        required
                    />
                    <input
                        id="lastName"
                        name="lastName"
                        type="text"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        className="w-full p-4 text-lg border-2 border-gray-100 rounded-xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                        placeholder="الكنية (مثلاً: علي)"
                        autoComplete="family-name"
                        enterKeyHint="go"
                        required
                    />
                </div>
            </div>

            <button
                type="submit"
                className="w-full bg-primary text-white py-4 rounded-xl font-bold text-lg hover:bg-primary-dark transition-all shadow-lg shadow-primary/20 active:scale-[0.98]"
            >
                متابعة ⚡
            </button>
        </form>
    );
}

// Text paste component
function TextPaste({ data, onNext, onBack }: { data: CVData; onNext: (data: Partial<CVData>) => void; onBack: () => void }) {
    const [text, setText] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [showMissingFields, setShowMissingFields] = useState(false);
    const [partialData, setPartialData] = useState<Partial<CVData> | null>(null);
    const [missingFieldsInfo, setMissingFieldsInfo] = useState<MissingFieldInfo[]>([]);

    const handleAnalyze = async () => {
        if (!text.trim()) return;

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/analyze/text', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text })
            });

            if (!response.ok) throw new Error('فشل في تحليل النص');

            const result = await response.json();

            // Check if there are missing required fields
            if (!result.isComplete && result.missingFields && result.missingFields.length > 0) {
                // Show missing fields form
                setPartialData(result.cvData);
                setMissingFieldsInfo(result.missingFields);
                setShowMissingFields(true);
            } else {
                // Data is complete - proceed to next step
                onNext({
                    ...result.cvData,
                    metadata: { ...data.metadata, importSource: 'text', currentStep: 3 }
                });
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
        } finally {
            setIsLoading(false);
        }
    };

    // Show missing fields form if needed
    if (showMissingFields && partialData) {
        return (
            <MissingFieldsForm
                missingFields={missingFieldsInfo}
                existingData={partialData}
                onComplete={(completeData) => {
                    onNext({
                        ...completeData,
                        metadata: { ...data.metadata, importSource: 'text', currentStep: 3 }
                    });
                }}
                onBack={() => {
                    setShowMissingFields(false);
                    setPartialData(null);
                    setMissingFieldsInfo([]);
                }}
            />
        );
    };

    // Show progress indicator while loading
    if (isLoading) {
        return <AnalysisProgress estimatedDuration={100} />;
    }

    return (
        <div className="space-y-6">
            <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
            >
                <span>→</span>
                <span>العودة للخيارات</span>
            </button>

            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">📝 لصق النص</h2>
                <p className="text-gray-500">الصق معلوماتك وسنستخرج البيانات تلقائياً</p>
            </div>

            <textarea
                id="cvText"
                name="cvText"
                value={text}
                onChange={(e) => setText(e.target.value)}
                className="w-full h-64 p-4 text-base border-2 border-gray-100 rounded-xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-400 resize-none"
                placeholder={`مثال:
اسمي محمد أحمد، مهندس برمجيات بخبرة 5 سنوات.
عملت في شركة XYZ كمطور Full Stack من 2019 إلى 2024.
حاصل على بكالوريوس هندسة حاسوب من جامعة دمشق.
أتقن JavaScript, Python, React, Node.js
أتحدث العربية والإنجليزية بطلاقة.`}
                dir="rtl"
            />

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                </div>
            )}

            <button
                onClick={handleAnalyze}
                disabled={!text.trim() || isLoading}
                className="w-full bg-gradient-to-l from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
                {isLoading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري التحليل...</span>
                    </>
                ) : (
                    <>
                        <span>تحليل النص</span>
                        <span>🔍</span>
                    </>
                )}
            </button>
        </div>
    );
}

interface QuickStartProps {
    onNext: (data: Partial<CVData>) => void;
    setMode: (mode: QuickStartMode) => void;
}

// URL input component
function URLInput({ onNext, setMode }: QuickStartProps) {
    const [url, setUrl] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const detectPlatform = (url: string): string => {
        if (url.includes('linkedin.com')) return 'LinkedIn';
        if (url.includes('facebook.com') || url.includes('fb.com')) return 'Facebook';
        if (url.includes('instagram.com')) return 'Instagram';
        if (url.includes('twitter.com') || url.includes('x.com')) return 'X/Twitter';
        return 'رابط';
    };

    const handleAnalyze = async () => {
        if (!url.trim()) return;

        // Normalize URL - add https:// if no protocol
        let normalizedUrl = url.trim();
        if (!normalizedUrl.match(/^https?:\/\//i)) {
            normalizedUrl = 'https://' + normalizedUrl;
        }

        // Basic URL validation
        try {
            new URL(normalizedUrl);
        } catch {
            setError('يرجى إدخال رابط صحيح');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const response = await fetch('/api/analyze/url', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: normalizedUrl })
            });

            if (!response.ok) throw new Error('فشل في تحليل الرابط');

            const result = await response.json();

            onNext({
                ...result.cvData,
                metadata: { importSource: 'url', sourceUrl: normalizedUrl, currentStep: 3 }
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <button
                type="button"
                onClick={() => setMode('select')}
                className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
            >
                <span>→</span>
                <span>العودة للخيارات</span>
            </button>

            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">🔗 تحليل رابط</h2>
                <p className="text-gray-500">أدخل رابط حسابك على السوشال ميديا</p>
            </div>

            <div className="flex gap-4 justify-center text-3xl opacity-60">
                <span title="LinkedIn">💼</span>
                <span title="Facebook">📘</span>
                <span title="Instagram">📸</span>
                <span title="X/Twitter">🐦</span>
            </div>

            <div className="relative">
                <input
                    id="profileUrl"
                    name="profileUrl"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    className="w-full p-4 pr-24 text-base border-2 border-gray-100 rounded-xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-400 font-mono"
                    placeholder="https://linkedin.com/in/username"
                    autoComplete="url"
                    dir="ltr"
                />
                {url && (
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-lg border border-primary/20">
                        {detectPlatform(url)}
                    </span>
                )}
            </div>

            {error && (
                <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
                    <div className="flex items-center gap-2 font-bold mb-1">
                        <span>⚠️</span>
                        <span>فشل في تحليل الرابط</span>
                    </div>
                    <p className="mb-3">{error}</p>
                    <button
                        onClick={() => setMode('text')}
                        className="text-primary hover:text-primary-dark underline font-bold text-xs"
                    >
                        🔄 تجربة طريقة &apos;لصق النص&apos; بدلاً من ذلك
                    </button>
                </div>
            )}

            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-700 text-sm">
                <strong>ملاحظة:</strong> بعض الشبكات الاجتماعية قد لا تسمح بالوصول للبيانات. الصفحات العامة فقط مدعومة.
            </div>

            <button
                onClick={handleAnalyze}
                disabled={!url.trim() || isLoading}
                className="w-full bg-gradient-to-l from-blue-500 to-indigo-500 text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-blue-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
                {isLoading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري التحليل...</span>
                    </>
                ) : (
                    <>
                        <span>تحليل الرابط</span>
                        <span>🌐</span>
                    </>
                )}
            </button>
        </div>
    );
}

// PDF upload component
function PDFUpload({ data, onNext, onBack }: { data: CVData; onNext: (data: Partial<CVData>) => void; onBack: () => void }) {
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile?.type === 'application/pdf') {
            setFile(droppedFile);
            setError('');
        } else {
            setError('يرجى رفع ملف PDF فقط');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile?.type === 'application/pdf') {
            setFile(selectedFile);
            setError('');
        } else if (selectedFile) {
            setError('يرجى رفع ملف PDF فقط');
        }
    };

    const handleAnalyze = async () => {
        if (!file) return;

        // Check file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
            setError('حجم الملف يجب أن يكون أقل من 5 ميغابايت');
            return;
        }

        setIsLoading(true);
        setError('');

        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/analyze/pdf', {
                method: 'POST',
                body: formData
            });

            if (!response.ok) throw new Error('فشل في تحليل الملف');

            const result = await response.json();

            onNext({
                ...result.cvData,
                metadata: { ...data.metadata, importSource: 'pdf', originalPdfName: file.name, currentStep: 3 }
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'حدث خطأ غير متوقع');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
            >
                <span>→</span>
                <span>العودة للخيارات</span>
            </button>

            <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold text-gray-800">📄 رفع سيرة ذاتية</h2>
                <p className="text-gray-500">ارفع ملف PDF وسنحلل بياناتك تلقائياً</p>
            </div>

            <div
                onDrop={handleDrop}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${isDragging
                    ? 'border-primary bg-primary/5'
                    : file
                        ? 'border-green-400 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300 bg-gray-50/50'
                    }`}
                onClick={() => document.getElementById('pdf-input')?.click()}
            >
                <input
                    id="pdf-input"
                    type="file"
                    accept=".pdf"
                    onChange={handleFileSelect}
                    className="hidden"
                />

                {file ? (
                    <div className="space-y-2">
                        <div className="text-4xl">✅</div>
                        <p className="font-bold text-green-600">{file.name}</p>
                        <p className="text-sm text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                        <button
                            onClick={(e) => { e.stopPropagation(); setFile(null); }}
                            className="text-red-500 text-sm hover:underline"
                        >
                            إزالة الملف
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <div className="text-5xl opacity-50">📁</div>
                        <p className="font-medium text-gray-600">اسحب الملف هنا أو انقر للاختيار</p>
                        <p className="text-sm text-gray-400">PDF فقط، الحد الأقصى 5 ميغابايت</p>
                    </div>
                )}
            </div>

            {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                    {error}
                </div>
            )}

            <button
                onClick={handleAnalyze}
                disabled={!file || isLoading}
                className="w-full bg-gradient-to-l from-purple-500 to-violet-500 text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-purple-500/20 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
            >
                {isLoading ? (
                    <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        <span>جاري التحليل...</span>
                    </>
                ) : (
                    <>
                        <span>تحليل الملف</span>
                        <span>🔍</span>
                    </>
                )}
            </button>
        </div>
    );
}

// Main component
export default function WelcomeStep({ data, onNext }: StepProps) {
    const [mode, setMode] = useState<QuickStartMode>('select');

    const handleBack = () => setMode('select');

    // Selection screen - Two main modes
    if (mode === 'select') {
        return (
            <div className="w-full max-w-2xl mx-auto space-y-8 py-4">
                <div className="text-center space-y-3">
                    <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                        أهلاً بك في <span className="text-primary italic">ذكاء السيرة</span>
                    </h1>
                    <p className="text-lg text-gray-500 font-medium">اختر الطريقة الأنسب لك للبدء</p>
                    <div className="flex justify-center">
                        <div className="h-1.5 w-16 bg-accent rounded-full"></div>
                    </div>
                </div>

                {/* Main Two Options */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Simple Mode */}
                    <button
                        onClick={() => setMode('manual')}
                        className="group relative p-8 rounded-3xl border-2 border-gray-100 hover:border-transparent transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] bg-white overflow-hidden text-center"
                    >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-primary to-primary-dark" />
                        <div className="relative z-10 space-y-4">
                            <div className="text-6xl group-hover:scale-110 transition-transform duration-300">🚀</div>
                            <h3 className="text-2xl font-black text-gray-800 group-hover:text-white transition-colors">البدء البسيط</h3>
                            <p className="text-gray-500 group-hover:text-white/80 transition-colors">أنشئ سيرتك من الصفر خطوة بخطوة</p>
                        </div>
                    </button>

                    {/* Advanced Mode */}
                    <button
                        onClick={() => setMode('advanced')}
                        className="group relative p-8 rounded-3xl border-2 border-gray-100 hover:border-transparent transition-all duration-300 hover:shadow-2xl hover:scale-[1.02] active:scale-[0.98] bg-white overflow-hidden text-center"
                    >
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-gradient-to-br from-blue-500 to-indigo-600" />
                        <div className="relative z-10 space-y-4">
                            <div className="text-6xl group-hover:scale-110 transition-transform duration-300">⚡</div>
                            <h3 className="text-2xl font-black text-gray-800 group-hover:text-white transition-colors">البدء المتقدم</h3>
                            <p className="text-gray-500 group-hover:text-white/80 transition-colors">لديّ معلومات جاهزة (روابط، ملفات، نص)</p>
                        </div>
                    </button>
                </div>

                {/* Quick Actions */}
                <div className="pt-4">
                    <p className="text-center text-gray-400 text-sm mb-3">أو اختر طريقة محددة:</p>
                    <div className="flex justify-center gap-3 flex-wrap">
                        <button
                            onClick={() => setMode('pdf')}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition flex items-center gap-2"
                        >
                            <span>📄</span> رفع PDF
                        </button>
                        <button
                            onClick={() => setMode('text')}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition flex items-center gap-2"
                        >
                            <span>📝</span> لصق نص
                        </button>
                        <button
                            onClick={() => setMode('url')}
                            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full transition flex items-center gap-2"
                        >
                            <span>🔗</span> إدخال رابط
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Render selected mode
    switch (mode) {
        case 'manual':
            return <ManualEntry data={data} onNext={onNext} onBack={handleBack} />;
        case 'advanced':
            return <AdvancedInput data={data} onNext={onNext} onBack={handleBack} />;
        case 'pdf':
            return <PDFUpload data={data} onNext={onNext} onBack={handleBack} />;
        case 'text':
            return <TextPaste data={data} onNext={onNext} onBack={handleBack} />;
        case 'url':
            return <URLInput onNext={onNext} setMode={setMode} />;
        default:
            return null;
    }
}
