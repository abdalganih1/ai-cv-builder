"use client";

/**
 * AdvancedInput - واجهة الإدخال الموحدة المتقدمة
 * تدعم: روابط متعددة + ملفات PDF + نص إضافي
 * مع اكتشاف ذكي لنوع كل مصدر + تتبع تحليلي كامل
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { CVData } from '@/lib/types/cv-schema';
import AnalysisProgress from './AnalysisProgress';
import { useAnalytics } from '@/lib/analytics';
import VoiceRecorder from '@/components/ui/VoiceRecorder';

interface AdvancedInputProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onBack: () => void;
}

interface SourceItem {
    id: string;
    type: 'url' | 'pdf';
    value: string;
    file?: File;
    detectedType?: 'personal' | 'job' | 'unknown';
    status: 'idle' | 'analyzing' | 'done' | 'error';
    label?: string;
}

// نوع المصدر المكتشف
const SOURCE_TYPES = {
    personal: { label: 'بياناتي الشخصية', icon: '👤', color: 'blue' },
    job: { label: 'بيانات الوظيفة', icon: '💼', color: 'purple' },
    unknown: { label: 'غير محدد', icon: '❓', color: 'gray' },
};

// اكتشاف نوع الرابط مبدئياً
function detectUrlType(url: string): 'personal' | 'job' | 'unknown' {
    const lowerUrl = url.toLowerCase();

    // روابط شخصية
    if (lowerUrl.includes('linkedin.com/in/') ||
        lowerUrl.includes('github.com/') ||
        lowerUrl.includes('portfolio') ||
        lowerUrl.includes('about')) {
        return 'personal';
    }

    // روابط وظائف
    if (lowerUrl.includes('careers') ||
        lowerUrl.includes('jobs') ||
        lowerUrl.includes('vacancy') ||
        lowerUrl.includes('hiring') ||
        lowerUrl.includes('bayt.com') ||
        lowerUrl.includes('indeed.com') ||
        lowerUrl.includes('glassdoor.com')) {
        return 'job';
    }

    // Google Drive قد يكون أي شيء
    if (lowerUrl.includes('drive.google.com') || lowerUrl.includes('docs.google.com')) {
        return 'unknown';
    }

    return 'unknown';
}

export default function AdvancedInput({ data, onNext, onBack }: AdvancedInputProps) {
    const [sources, setSources] = useState<SourceItem[]>([]);
    const [newUrl, setNewUrl] = useState('');
    const [additionalText, setAdditionalText] = useState('');
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState('');
    const [analysisStep, setAnalysisStep] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Analytics tracking
    const {
        trackAdvancedModeStart,
        trackSourceAdded,
        trackSourceRemoved,
        trackSourceTypeChanged,
        trackAnalysisStarted,
        trackAnalysisCompleted,
        trackAnalysisFailed
    } = useAnalytics();

    // تتبع بدء الوضع المتقدم مرة واحدة
    useEffect(() => {
        trackAdvancedModeStart();
    }, [trackAdvancedModeStart]);

    // إضافة رابط
    const addUrl = () => {
        if (!newUrl.trim()) return;

        let normalizedUrl = newUrl.trim();
        if (!normalizedUrl.match(/^https?:\/\//i)) {
            normalizedUrl = 'https://' + normalizedUrl;
        }

        try {
            new URL(normalizedUrl);
        } catch {
            setError('يرجى إدخال رابط صحيح');
            return;
        }

        const detectedType = detectUrlType(normalizedUrl) || 'personal';

        const sourceId = Date.now().toString();
        setSources(prev => [...prev, {
            id: sourceId,
            type: 'url',
            value: normalizedUrl,
            detectedType: detectedType === 'unknown' ? 'personal' : detectedType,
            status: 'idle',
        }]);

        // تتبع إضافة المصدر
        trackSourceAdded({ id: sourceId, type: 'url', value: normalizedUrl, detectedType });

        setNewUrl('');
        setError('');
    };

    // إضافة ملف PDF
    const addPdf = (file: File) => {
        if (file.type !== 'application/pdf') {
            setError('يرجى رفع ملف PDF فقط');
            return;
        }

        if (file.size > 10 * 1024 * 1024) {
            setError('حجم الملف يجب أن يكون أقل من 10 ميغابايت');
            return;
        }

        const sourceId = Date.now().toString();
        setSources(prev => [...prev, {
            id: sourceId,
            type: 'pdf',
            value: file.name,
            file,
            detectedType: 'personal',
            status: 'idle',
        }]);

        // تتبع إضافة الملف
        trackSourceAdded({ id: sourceId, type: 'pdf', value: file.name, detectedType: 'unknown' });

        setError('');
    };

    // حذف مصدر
    const removeSource = (id: string) => {
        setSources(prev => prev.filter(s => s.id !== id));
        trackSourceRemoved(id);
    };

    // تغيير نوع المصدر يدوياً
    const toggleSourceType = (id: string) => {
        setSources(prev => prev.map(s => {
            if (s.id === id) {
                const types: Array<'personal' | 'job' | 'unknown'> = ['personal', 'job', 'unknown'];
                const currentIndex = types.indexOf(s.detectedType || 'unknown');
                const nextType = types[(currentIndex + 1) % types.length];
                trackSourceTypeChanged(id, nextType);
                return { ...s, detectedType: nextType };
            }
            return s;
        }));
    };

    // تحليل كل المصادر
    const analyzeAllSources = async () => {
        if (sources.length === 0 && !additionalText.trim()) {
            setError('يرجى إضافة مصدر واحد على الأقل أو نص');
            return;
        }

        setIsAnalyzing(true);
        setError('');

        // تتبع بدء التحليل
        trackAnalysisStarted(sources.length, !!additionalText.trim());

        try {
            // تجهيز البيانات للإرسال
            const formData = new FormData();

            // إضافة الروابط
            const urlSources = sources
                .filter(s => s.type === 'url')
                .map(s => ({ url: s.value, type: s.detectedType }));
            formData.append('urls', JSON.stringify(urlSources));

            // إضافة الملفات
            sources.filter(s => s.type === 'pdf' && s.file).forEach((s, i) => {
                formData.append(`file_${i}`, s.file!);
                formData.append(`file_${i}_type`, s.detectedType || 'unknown');
            });

            // إضافة النص
            if (additionalText.trim()) {
                formData.append('additionalText', additionalText);
            }

            setAnalysisStep('🔍 جاري تحليل المصادر...');

            const response = await fetch('/api/analyze/smart', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'فشل في تحليل المصادر');
            }

            const result = await response.json();

            setAnalysisStep('✨ تم التحليل بنجاح!');

            // تتبع اكتمال التحليل
            trackAnalysisCompleted({ result: result.cvData });

            await new Promise(resolve => setTimeout(resolve, 1000));

            // الانتقال للخطوة التالية مع البيانات
            onNext({
                ...result.cvData,
                metadata: {
                    ...data.metadata,
                    importSource: 'smart',
                    targetJob: result.jobProfile,
                    currentStep: 3,
                }
            });

        } catch (err) {
            console.error('Analysis error:', err);
            const errorMsg = err instanceof Error ? err.message : 'حدث خطأ غير متوقع';
            trackAnalysisFailed(errorMsg);
            setError(errorMsg);
        } finally {
            setIsAnalyzing(false);
            setAnalysisStep('');
        }
    };

    // عرض مؤشر التحليل
    if (isAnalyzing) {
        return <AnalysisProgress estimatedDuration={35} />;
    }

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 py-4">
            {/* Header */}
            <div className="flex items-center gap-4">
                <button
                    onClick={onBack}
                    className="p-2 text-gray-400 hover:text-primary hover:bg-gray-100 rounded-xl transition"
                >
                    →
                </button>
                <div>
                    <h2 className="text-2xl font-bold text-gray-800">⚡ البدء المتقدم</h2>
                    <p className="text-gray-500 text-sm">أضف مصادر بياناتك وسنحللها ذكياً</p>
                </div>
            </div>

            {/* Error Message */}
            <AnimatePresence>
                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm"
                    >
                        ⚠️ {error}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* URLs Section */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 text-gray-700">
                    <span className="text-xl">🔗</span>
                    <span className="font-bold">روابط</span>
                    <span className="text-gray-400 text-sm hidden sm:inline">(اختياري)</span>
                </div>

                {/* URL List */}
                <div className="space-y-2">
                    {sources.filter(s => s.type === 'url').map(source => (
                        <div
                            key={source.id}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-gray-50 rounded-xl group"
                        >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-lg shrink-0">🌐</span>
                                <span className="flex-1 text-sm font-mono text-gray-600 truncate min-w-0" dir="ltr">
                                    {source.value}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    onClick={() => toggleSourceType(source.id)}
                                    className={`px-3 py-1.5 sm:py-1 text-xs font-bold rounded-lg transition-all ${source.detectedType === 'personal'
                                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                        : source.detectedType === 'job'
                                            ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    title="انقر لتغيير النوع"
                                >
                                    {SOURCE_TYPES[source.detectedType || 'unknown'].icon}{' '}
                                    {SOURCE_TYPES[source.detectedType || 'unknown'].label}
                                </button>
                                <button
                                    onClick={() => removeSource(source.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition sm:opacity-0 sm:group-hover:opacity-100"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Add URL Input */}
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="url"
                        value={newUrl}
                        onChange={(e) => setNewUrl(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && addUrl()}
                        placeholder="https://example.com أو abdalgani.com"
                        className="flex-1 px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none transition font-mono text-sm"
                        dir="ltr"
                    />
                    <button
                        onClick={addUrl}
                        disabled={!newUrl.trim()}
                        className="px-5 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary-dark transition disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        + أضف
                    </button>
                </div>

                <p className="text-xs text-gray-400">
                    💡 يمكنك إضافة: موقعك الشخصي، LinkedIn، رابط وظيفة شاغرة، Google Drive...
                </p>
            </div>

            {/* PDFs Section */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 text-gray-700">
                    <span className="text-xl">📄</span>
                    <span className="font-bold">ملفات PDF</span>
                    <span className="text-gray-400 text-sm hidden sm:inline">(اختياري)</span>
                </div>

                {/* PDF List */}
                <div className="space-y-2">
                    {sources.filter(s => s.type === 'pdf').map(source => (
                        <div
                            key={source.id}
                            className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 p-3 bg-gray-50 rounded-xl group"
                        >
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span className="text-lg shrink-0">📎</span>
                                <span className="flex-1 text-sm text-gray-600 truncate min-w-0">
                                    {source.value}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 justify-end">
                                <button
                                    onClick={() => toggleSourceType(source.id)}
                                    className={`px-3 py-1.5 sm:py-1 text-xs font-bold rounded-lg transition-all ${source.detectedType === 'personal'
                                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                        : source.detectedType === 'job'
                                            ? 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                    title="انقر لتغيير النوع"
                                >
                                    {SOURCE_TYPES[source.detectedType || 'unknown'].icon}{' '}
                                    {SOURCE_TYPES[source.detectedType || 'unknown'].label}
                                </button>
                                <button
                                    onClick={() => removeSource(source.id)}
                                    className="p-1.5 text-gray-400 hover:text-red-500 transition sm:opacity-0 sm:group-hover:opacity-100"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Upload Area */}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".pdf"
                    multiple
                    onChange={(e) => {
                        Array.from(e.target.files || []).forEach(addPdf);
                        e.target.value = '';
                    }}
                    className="hidden"
                />
                <button
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full p-4 border-2 border-dashed border-gray-200 rounded-xl text-gray-500 hover:border-primary hover:text-primary transition text-center"
                >
                    📁 اسحب الملفات هنا أو انقر للاختيار
                </button>

                <p className="text-xs text-gray-400">
                    💡 ارفع سيرتك الذاتية أو وصف الوظيفة المطلوبة (PDF)
                </p>
            </div>

            {/* Additional Text Section */}
            <div className="bg-white rounded-2xl border-2 border-gray-100 p-4 sm:p-5 space-y-4">
                <div className="flex items-center gap-2 text-gray-700">
                    <span className="text-xl">📝</span>
                    <span className="font-bold">معلومات إضافية</span>
                    <span className="text-gray-400 text-sm hidden sm:inline">(اختياري)</span>
                </div>

                <div className="relative">
                    <textarea
                        value={additionalText}
                        onChange={(e) => setAdditionalText(e.target.value)}
                        placeholder={`مثال:
• أركز على خبرتي في React و Node.js
• أبحث عن وظيفة Senior Developer
• متاح للعمل عن بعد
• أو الصق هنا وصف الوظيفة المطلوبة...`}
                        className="w-full h-32 p-4 pb-14 bg-gray-50 border border-gray-200 rounded-xl text-gray-800 placeholder:text-gray-400 focus:border-primary focus:outline-none transition resize-none text-sm"
                        dir="rtl"
                    />
                    <div className="absolute left-3 bottom-3">
                        <VoiceRecorder
                            onTranscript={(text) => setAdditionalText(prev => prev + ' ' + text)}
                            placeholder="تحدث..."
                        />
                    </div>
                </div>

                <p className="text-xs text-gray-400">
                    💡 أضف أي معلومات إضافية أو سياق يساعد في تحسين سيرتك - يمكنك الكتابة أو التسجيل الصوتي 🎤
                </p>
            </div>

            {/* Summary & Action */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-4 sm:p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-white">
                    <span className="font-bold">ملخص المصادر</span>
                    <div className="flex items-center gap-2 sm:gap-3 text-sm flex-wrap">
                        <span className="px-2 py-1 bg-white/10 rounded-lg">
                            🔗 {sources.filter(s => s.type === 'url').length} روابط
                        </span>
                        <span className="px-2 py-1 bg-white/10 rounded-lg">
                            📄 {sources.filter(s => s.type === 'pdf').length} ملفات
                        </span>
                        {additionalText.trim() && (
                            <span className="px-2 py-1 bg-white/10 rounded-lg">
                                📝 نص
                            </span>
                        )}
                    </div>
                </div>

                <button
                    onClick={analyzeAllSources}
                    disabled={sources.length === 0 && !additionalText.trim()}
                    className="w-full py-4 bg-gradient-to-l from-blue-500 to-indigo-500 text-white rounded-xl font-bold text-lg hover:opacity-90 transition shadow-lg shadow-blue-500/30 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-3"
                >
                    <span>🔍</span>
                    <span>حلل المصادر وابدأ</span>
                </button>
            </div>
        </div>
    );
}
