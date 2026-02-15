"use client";

import { useState, useEffect, useMemo, useRef } from 'react';
import { CVData } from '@/lib/types/cv-schema';
import EditChat from '@/components/chat/EditChat';
import { translateCVToEnglish, generateProfessionalCV } from '@/lib/ai/chat-editor';
import { base64ToBlobUrl, isBase64DataUrl, revokeBlobUrl } from '@/lib/utils/image-utils';

import { pdf } from '@react-pdf/renderer';
import PDFDocument, { CombinedPDFDocument } from './PDFDocument';
import ImageCropper from './ImageCropper';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import AnalysisProgress from '../wizard/AnalysisProgress';
import { useAnalytics } from '@/lib/analytics/provider';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
    onBack: () => void;
}

// Section labels in both languages
const LABELS = {
    ar: {
        summary: 'نبذة تعريفية',
        experience: 'الخبرة العملية',
        education: 'التعليم',
        skills: 'المهارات',
        languages: 'اللغات',
        hobbies: 'الهوايات',
        birthDate: 'تاريخ الميلاد',
        jobTitle: 'المسمى الوظيفي',
    },
    en: {
        summary: 'Professional Summary',
        experience: 'Work Experience',
        education: 'Education',
        skills: 'Skills',
        languages: 'Languages',
        hobbies: 'Interests',
        birthDate: 'Date of Birth',
        jobTitle: 'Job Title',
    }
};

const ENGLISH_CV_CACHE_KEY = 'cv_english_translation';

// Payment settings interface
interface PaymentSettings {
    qrImageUrl: string;
    recipientName: string;
    recipientCode: string;
    amount: number;
    currency: string;
    paymentType: 'mandatory' | 'donation' | 'disabled';
}

const DEFAULT_SETTINGS: PaymentSettings = {
    qrImageUrl: '/sham-cash-qr.png',
    recipientName: 'عبد الغني أحمد الحمدي',
    recipientCode: '0d4f56f704ded4f3148727e0edc03778',
    amount: 500,
    currency: 'ل.س',
    paymentType: 'mandatory',
};

export default function CVPreview({ data, onUpdate, onBack }: StepProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [englishCV, setEnglishCV] = useState<CVData | null>(null);
    const [activeLanguage, setActiveLanguage] = useState<'ar' | 'en'>('ar');
    const [showExportModal, setShowExportModal] = useState(false);
    const [pendingCropImage, setPendingCropImage] = useState<string | null>(null);
    const [translationProgress, setTranslationProgress] = useState(0);
    const [translationTimer, setTranslationTimer] = useState(100);

    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentSettings, setPaymentSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
    const [paymentProof, setPaymentProof] = useState<File | null>(null);
    const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
    const [showProofRequired, setShowProofRequired] = useState(false);
    const [isProcessingPayment, setIsProcessingPayment] = useState(false);
    const [paymentStatus, setPaymentStatus] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [showScanner, setShowScanner] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [showProgress, setShowProgress] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { trackFileUpload, sessionId } = useAnalytics();

    const [selectedExportOption, setSelectedExportOption] = useState<'ar' | 'en' | 'both' | null>(null);

    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analysisDone, setAnalysisDone] = useState(false);
    const [editingSection, setEditingSection] = useState<string | null>(null);

    // Handle file upload - open cropper instead of directly setting photo
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const imageUrl = event.target?.result as string;
                setPendingCropImage(imageUrl);
            };
            reader.readAsDataURL(file);
        }
        // Reset input so same file can be selected again
        e.target.value = '';
    };

    // Handle cropped image save
    const handleCropComplete = (croppedImageUrl: string) => {
        onUpdate({ ...data, personal: { ...data.personal, photoUrl: croppedImageUrl } });
        setPendingCropImage(null);
    };

    // Load cached English CV on mount
    useEffect(() => {
        try {
            const cached = localStorage.getItem(ENGLISH_CV_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                setEnglishCV(parsed);
                console.log('✅ Loaded cached English CV from localStorage');
            }
        } catch (error) {
            console.warn('Failed to load cached English CV:', error);
        }
    }, []);

    useEffect(() => {
        if (analysisDone) return;
        const analyzeCV = async () => {
            setIsAnalyzing(true);
            try {
                const enhancedData = await generateProfessionalCV(data);
                onUpdate(enhancedData);
                setAnalysisDone(true);
            } catch (error) {
                console.error('Auto-analysis failed:', error);
                setAnalysisDone(true);
            } finally {
                setIsAnalyzing(false);
            }
        };
        analyzeCV();
    }, [analysisDone, data, onUpdate]);

    // Fetch payment settings from API
    useEffect(() => {
        async function fetchSettings() {
            try {
                // أولاً: جلب من localStorage للتطوير المحلي
                const localSettings = localStorage.getItem('cv_payment_settings');
                if (localSettings) {
                    try {
                        const parsed = JSON.parse(localSettings);
                        setPaymentSettings(prev => ({ ...prev, ...parsed }));
                        console.log('[Payment] Loaded from localStorage:', parsed.paymentType);
                    } catch (e) {
                        console.error('Failed to parse local settings:', e);
                    }
                }

                // ثانياً: محاولة جلب من API (للإنتاج)
                const res = await fetch('/api/settings');
                const responseData = await res.json();
                if (responseData.success && responseData.data) {
                    setPaymentSettings(responseData.data);
                }
            } catch (error) {
                console.error('Failed to fetch payment settings:', error);
            }
        }
        fetchSettings();
    }, []);

    // Save English CV to localStorage when it changes
    useEffect(() => {
        if (englishCV) {
            try {
                localStorage.setItem(ENGLISH_CV_CACHE_KEY, JSON.stringify(englishCV));
                console.log('💾 Saved English CV to localStorage');
            } catch (error) {
                console.warn('Failed to save English CV to cache:', error);
            }
        }
    }, [englishCV]);

    // Get current preview data and labels based on active language
    const previewData = activeLanguage === 'en' && englishCV ? englishCV : data;
    const labels = LABELS[activeLanguage];
    const isRTL = activeLanguage === 'ar';

    // Convert base64 photoUrl to Blob URL for better performance
    const displayPhotoUrl = useMemo(() => {
        const photoUrl = previewData.personal.photoUrl;
        if (!photoUrl || photoUrl === '__skipped__') {
            return null;
        }
        // Convert base64 to Blob URL for better browser performance
        if (isBase64DataUrl(photoUrl)) {
            return base64ToBlobUrl(photoUrl);
        }
        return photoUrl;
    }, [previewData.personal.photoUrl]);

    // Clean up Blob URL on unmount or when photoUrl changes
    useEffect(() => {
        return () => {
            if (displayPhotoUrl && displayPhotoUrl.startsWith('blob:')) {
                revokeBlobUrl(displayPhotoUrl);
            }
        };
    }, [displayPhotoUrl]);

    // Handle updates - reset English when Arabic changes significantly
    const handleUpdate = (newData: CVData) => {
        onUpdate(newData);
        // Only reset English if content changed (not just photo)
        const contentChanged = JSON.stringify({ ...newData, personal: { ...newData.personal, photoUrl: '' } }) !==
            JSON.stringify({ ...data, personal: { ...data.personal, photoUrl: '' } });
        if (englishCV && contentChanged) {
            setEnglishCV(null);
            localStorage.removeItem(ENGLISH_CV_CACHE_KEY);
            if (activeLanguage === 'en') setActiveLanguage('ar');
            console.log('🔄 English CV cache cleared due to content change');
        }
    };

    // Handle updates from Chat - routes to correct language state
    const handleChatUpdate = (newData: CVData) => {
        if (activeLanguage === 'en') {
            // Independent English Update
            setEnglishCV(newData);
            console.log('🇬🇧 English CV updated independently');
        } else {
            // Arabic/Main Update
            handleUpdate(newData);
        }
    };

    // Countdown timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTranslating) {
            setTranslationTimer(100);
            setTranslationProgress(0);
            interval = setInterval(() => {
                setTranslationTimer(prev => {
                    if (prev <= 1) return 1;
                    return prev - 1;
                });
                setTranslationProgress(prev => {
                    if (prev >= 95) return 95;
                    return prev + 1;
                });
            }, 1000);
        } else {
            setTranslationTimer(100);
            setTranslationProgress(0);
        }
        return () => clearInterval(interval);
    }, [isTranslating]);

    const handleTranslateToEnglish = async () => {

        setIsTranslating(true);
        setActiveLanguage('en'); // Switch to English tab immediately to show loading state
        try {
            const translated = await translateCVToEnglish(data);
            setEnglishCV(translated);
            setActiveLanguage('en');
            // Cache is saved automatically via useEffect
        } catch (error) {
            console.error('Translation failed:', error);
            alert('عذراً، فشلت الترجمة. يرجى المحاولة مرة أخرى.');
        } finally {
            setIsTranslating(false);
        }
    };

    // Export functions
    const downloadPDF = async (cvData: CVData, suffix: string, lang: 'ar' | 'en') => {
        const blob = await pdf(<PDFDocument data={cvData} language={lang} />).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = `CV_${cvData.personal.firstName}_${cvData.personal.lastName}_${suffix}`.replace(/[^a-z0-9_\u0600-\u06FF]/gi, '_');
        link.download = `${fileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    // Download combined PDF with both languages
    const downloadCombinedPDF = async () => {
        if (!englishCV) return;

        const blob = await pdf(<CombinedPDFDocument arabicData={data} englishData={englishCV} />).toBlob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const fileName = `CV_${data.personal.firstName}_${data.personal.lastName}_AR_EN`.replace(/[^a-z0-9_\u0600-\u06FF]/gi, '_');
        link.download = `${fileName}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 100);
    };

    const handleExport = async (option: 'ar' | 'en' | 'both') => {
        await performExport(option);
    };

    const performExport = async (option: 'ar' | 'en' | 'both') => {
        setIsGenerating(true);
        setShowExportModal(false);
        setShowPaymentModal(false);

        try {
            if (option === 'ar') {
                await downloadPDF(data, 'AR', 'ar');
            } else if (option === 'en' && englishCV) {
                await downloadPDF(englishCV, 'EN', 'en');
            } else if (option === 'both' && englishCV) {
                // Combined single PDF with both languages
                await downloadCombinedPDF();
            }
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('عذراً، حدث خطأ أثناء إنشاء ملف PDF.');
        } finally {
            setIsGenerating(false);
        }
    };

    // Payment functions
    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(paymentSettings.recipientCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handlePaymentFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPaymentProof(file);
            const reader = new FileReader();
            reader.onload = () => {
                setPaymentProofPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            setShowProofRequired(false);
            trackFileUpload('payment_proof', file.name);
            console.log('📊 [Analytics] Tracked payment proof upload:', file.name);
        }
    };

    const removeProof = () => {
        setPaymentProof(null);
        setPaymentProofPreview(null);
    };

    const uploadProofImage = async (): Promise<string | null> => {
        if (!paymentProof) return null;

        setUploadStatus('uploading');

        try {
            const formData = new FormData();
            formData.append('file', paymentProof);
            formData.append('customerName', `${data.personal.firstName} ${data.personal.lastName}`);
            formData.append('phone', data.personal.phone || 'N/A');
            if (sessionId) {
                formData.append('sessionId', sessionId);
            }

            const response = await fetch('/api/upload-proof', {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error('Upload failed');
            }

            const result = await response.json();
            setUploadStatus('success');
            return result.url;
        } catch (error) {
            console.error('Upload error:', error);
            setUploadStatus('error');
            return null;
        }
    };

    const handlePaymentConfirm = async () => {
        // Check if proof is required (only for mandatory payment type)
        if (paymentSettings.paymentType === 'mandatory' && !paymentProof) {
            setShowProofRequired(true);
            return;
        }

        setIsProcessingPayment(true);
        setPaymentStatus('📤 جاري رفع إثبات الدفع...');

        // Upload the proof image
        const proofUrl = await uploadProofImage();

        if (!proofUrl && uploadStatus === 'error') {
            setPaymentStatus('❌ فشل رفع إثبات الدفع. يرجى المحاولة مرة أخرى.');
            setIsProcessingPayment(false);
            return;
        }

        setPaymentStatus('✅ تم رفع إثبات الدفع بنجاح!');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Trigger AI to generate professional CV - Show progress indicator
        setShowProgress(true);

        try {
            const enhancedData = await generateProfessionalCV(data);
            setShowProgress(false);
            setPaymentStatus('✨ تم إنشاء السيرة الذاتية الاحترافية بنجاح!');

            await new Promise(resolve => setTimeout(resolve, 1000));

            // Update data with payment completed
            onUpdate({
                ...enhancedData,
                metadata: {
                    ...data.metadata,
                    paymentStatus: 'completed',
                    paymentProofUrl: proofUrl || undefined
                }
            });

            // Now perform the export
            if (selectedExportOption) {
                await performExport(selectedExportOption);
            }
        } catch (error) {
            console.error("AI Enhancement failed:", error);
            setShowProgress(false);
            setPaymentStatus('⚠️ تعذّر تحسين السيرة الذاتية، سننتقل للنسخة الأساسية...');
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Update payment status and proceed
            onUpdate({
                metadata: {
                    ...data.metadata,
                    paymentStatus: 'completed',
                    paymentProofUrl: proofUrl || undefined
                }
            });

            if (selectedExportOption) {
                await performExport(selectedExportOption);
            }
        } finally {
            setIsProcessingPayment(false);
        }
    };

    const handleSkipPayment = async () => {
        // Only allow skip for donation type
        if (paymentSettings.paymentType !== 'donation') return;

        setShowProgress(true);
        try {
            const enhancedData = await generateProfessionalCV(data);
            setShowProgress(false);

            onUpdate({
                ...enhancedData,
                metadata: {
                    ...data.metadata,
                    paymentStatus: 'completed',
                }
            });

            if (selectedExportOption) {
                await performExport(selectedExportOption);
            }
        } catch (error) {
            console.error("AI Enhancement failed:", error);
            setShowProgress(false);
            onUpdate({
                metadata: {
                    ...data.metadata,
                    paymentStatus: 'completed',
                }
            });

            if (selectedExportOption) {
                await performExport(selectedExportOption);
            }
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 min-h-[100dvh] md:h-[850px] w-full">
            {isAnalyzing && (
                <div className="fixed inset-0 bg-white/90 z-50 flex items-center justify-center">
                    <div className="w-full max-w-2xl mx-auto p-8">
                        <AnalysisProgress estimatedDuration={200} />
                    </div>
                </div>
            )}
            {/* Sidebar / Chat Interface */}
            <div className="w-full md:w-1/3 order-2 md:order-1 flex flex-col gap-3 md:gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col">
                    <h3 className="font-bold text-primary mb-2">مساعد التعديل الذكي</h3>
                    <p className="text-xs text-gray-500 mb-4">اطلب أي تعديل على سيرتك الذاتية وسأقوم بتنفيذه فوراً.</p>
                    <EditChat
                        data={previewData}
                        onUpdate={handleChatUpdate}
                        language={activeLanguage}
                    />
                </div>

                {/* Language Toggle & Translation */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-xl border border-blue-100">
                    <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-bold text-gray-700">🌐 معاينة</span>
                        <div className="flex bg-white rounded-lg p-1 shadow-sm">
                            <button
                                onClick={() => setActiveLanguage('ar')}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeLanguage === 'ar' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'}`}
                            >
                                العربية
                            </button>
                            <button
                                onClick={() => {
                                    if (englishCV) {
                                        setActiveLanguage('en');
                                    } else {
                                        handleTranslateToEnglish();
                                    }
                                }}
                                disabled={isTranslating}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeLanguage === 'en' ? 'bg-primary text-white' : 'text-gray-500 hover:bg-gray-100'} ${isTranslating ? 'opacity-50 cursor-wait' : ''}`}
                            >
                                English
                            </button>
                        </div>
                    </div>

                    {/* Progress Bar / Timer when translating */}
                    {isTranslating && (
                        <div className="space-y-2 animate-in fade-in zoom-in duration-300">
                            <div className="flex justify-between text-xs font-medium text-indigo-600">
                                <span>جاري ترجمة السيرة الذاتية...</span>
                                <span>{translationTimer} ثانية</span>
                            </div>
                            <div className="h-2 bg-indigo-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full transition-all duration-1000 ease-linear"
                                    style={{ width: `${translationProgress}%` }}
                                />
                            </div>
                            <p className="text-[10px] text-gray-400 text-center">يقوم الذكاء الاصطناعي بصياغة احترافية (يستغرق 1-2 دقيقة)</p>
                        </div>
                    )}

                    {!englishCV && !isTranslating && activeLanguage === 'ar' && (
                        <div className="bg-white/50 rounded-lg p-3 text-center border border-indigo-100">
                            <p className="text-xs text-indigo-600 mb-2">اضغط على English لإنشاء نسخة مترجمة تلقائياً</p>
                        </div>
                    )}

                    {englishCV && !isTranslating && (
                        <div className="flex items-center justify-between bg-green-50 px-3 py-2 rounded-lg border border-green-100">
                            <p className="text-xs text-green-700 font-medium flex items-center gap-1">
                                <span>✅</span>
                                <span>النسخة الإنجليزية جاهزة</span>
                            </p>
                            <button
                                onClick={handleTranslateToEnglish}
                                className="text-[10px] bg-white text-indigo-600 px-2 py-1 rounded border border-indigo-200 hover:bg-indigo-50"
                            >
                                🔄 تحديث
                            </button>
                        </div>
                    )}
                </div>

                <div className="flex gap-2">
                    <button onClick={onBack} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                        رجوع
                    </button>
                    <button
                        onClick={() => setShowExportModal(true)}
                        disabled={isGenerating}
                        className={`flex-1 bg-primary text-white py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2 ${isGenerating ? 'opacity-70 cursor-not-allowed' : 'hover:bg-primary-dark'}`}
                    >
                        {isGenerating ? (
                            <>
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>جاري التجهيز...</span>
                            </>
                        ) : (
                            <>
                                <span>📄</span>
                                <span>تصدير PDF</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="w-full md:w-2/3 order-1 md:order-2 bg-gray-50 rounded-xl border border-gray-200 p-2 sm:p-4 overflow-hidden flex flex-col min-h-[60vh] md:min-h-0">
                {/* Language indicator */}
                <div className="flex items-center justify-between mb-2 px-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${activeLanguage === 'en' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {activeLanguage === 'en' ? '🇬🇧 English Preview' : '🇸🇦 معاينة عربية'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white shadow-sm rounded-lg relative">
                    <div
                        className="min-h-full p-4 sm:p-8 md:p-12 bg-white"
                        style={{ fontFamily: 'Arial, sans-serif', direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' }}
                    >
                        {/* Header */}
                        <div className="border-b-2 border-primary pb-4 sm:pb-6 mb-4 sm:mb-6 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
                            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 items-center sm:items-end w-full sm:w-auto">
                                {/* Photo or Upload Button */}
                                {displayPhotoUrl ? (
                                    <div className="relative group">
                                        <div className="w-20 h-20 sm:w-32 sm:h-32 rounded-full border-4 border-primary overflow-hidden shadow-lg mb-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={displayPhotoUrl} alt="Profile" className="w-full h-full object-cover" />
                                        </div>
                                        {/* Change photo overlay */}
                                        <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                            <span className="text-white text-xs font-bold">📷 تغيير</span>
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={handleFileSelect}
                                            />
                                        </label>
                                    </div>
                                ) : (
                                    <label className="w-20 h-20 sm:w-32 sm:h-32 rounded-full border-4 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all mb-2 group">
                                        <span className="text-2xl sm:text-3xl group-hover:scale-110 transition-transform">📷</span>
                                        <span className="text-[10px] sm:text-xs text-gray-500 mt-1 group-hover:text-primary">رفع صورة</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                )}
                                <div className="text-center sm:text-right">
                                    <h1 className="text-2xl sm:text-4xl font-bold text-primary mb-1 sm:mb-2">{previewData.personal.firstName} {previewData.personal.lastName}</h1>
                                    <p className="text-base sm:text-xl text-accent font-medium">{previewData.personal.targetJobTitle || previewData.personal.jobTitle || labels.jobTitle}</p>
                                </div>
                            </div>
                            <div className="text-xs sm:text-sm text-gray-600 leading-relaxed w-full sm:w-auto text-center sm:text-right">
                                {previewData.personal.email && previewData.personal.email !== '__skipped__' && <p dir="ltr">{previewData.personal.email}</p>}
                                {previewData.personal.phone && previewData.personal.phone !== '__skipped__' && <p dir="ltr">{previewData.personal.phone}</p>}
                                {previewData.personal.country && previewData.personal.country !== '__skipped__' && <p>{previewData.personal.country}</p>}
                                {previewData.personal.birthDate && previewData.personal.birthDate !== '__skipped__' && <p>{labels.birthDate}: {previewData.personal.birthDate}</p>}
                            </div>
                        </div>

                        {/* Summary */}
                        {previewData.personal.summary && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                    <h2 className="text-xl font-bold text-primary">{labels.summary}</h2>
                                    <button
                                        onClick={() => setEditingSection('summary')}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                        title="تعديل"
                                    >
                                        ✏️
                                    </button>
                                </div>
                                <p className="text-gray-700 leading-relaxed text-base">{previewData.personal.summary}</p>
                            </div>
                        )}

                        {/* Experience */}
                        {previewData.experience && previewData.experience.length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                                    <h2 className="text-xl font-bold text-primary">{labels.experience}</h2>
                                    <button
                                        onClick={() => setEditingSection('experience')}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                        title="تعديل"
                                    >
                                        ✏️
                                    </button>
                                </div>
                                <div className="flex flex-col gap-6">
                                    {previewData.experience.map((exp) => (
                                        <div key={exp.id}>
                                            <h3 className="font-bold text-lg text-gray-900">{exp.position}</h3>
                                            <div className="flex justify-between text-sm text-accent mb-2">
                                                <span>{exp.company}</span>
                                                <span dir="ltr">{exp.startDate} - {exp.endDate}</span>
                                            </div>
                                            <p className="text-gray-700 text-sm leading-relaxed">{exp.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Education */}
                        {previewData.education && previewData.education.length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                                    <h2 className="text-xl font-bold text-primary">{labels.education}</h2>
                                    <button
                                        onClick={() => setEditingSection('education')}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                        title="تعديل"
                                    >
                                        ✏️
                                    </button>
                                </div>
                                <div className="flex flex-col gap-4">
                                    {previewData.education.map((edu) => (
                                        <div key={edu.id}>
                                            <h3 className="font-bold text-lg text-gray-900">{edu.degree}{edu.major ? ` - ${edu.major}` : ''}</h3>
                                            <p className="text-accent">{edu.institution}</p>
                                            <p className="text-xs text-gray-500" dir="ltr">{edu.startYear} - {edu.endYear}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Skills */}
                        {previewData.skills && previewData.skills.length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                                    <h2 className="text-xl font-bold text-primary">{labels.skills}</h2>
                                    <button
                                        onClick={() => setEditingSection('skills')}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                        title="تعديل"
                                    >
                                        ✏️
                                    </button>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {previewData.skills.map((skill, idx) => (
                                        <span key={idx} className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-700 font-medium">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Languages */}
                        {previewData.languages && previewData.languages.length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                                    <h2 className="text-xl font-bold text-primary">{labels.languages}</h2>
                                    <button
                                        onClick={() => setEditingSection('languages')}
                                        className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                        title="تعديل"
                                    >
                                        ✏️
                                    </button>
                                </div>
                                <div className="flex flex-col gap-2">
                                    {previewData.languages.map((lang, idx) => (
                                        <div key={idx} className="flex justify-between items-center bg-gray-50 border border-gray-200 px-4 py-2 rounded-lg">
                                            <span className="text-sm text-gray-800 font-bold">{lang.name}</span>
                                            <span className="text-xs text-primary font-medium bg-primary/10 px-2 py-1 rounded">
                                                {lang.level}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Export Modal */}
            {showExportModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowExportModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-sm w-full mx-4 shadow-2xl" onClick={e => e.stopPropagation()}>
                        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">📄 خيارات التصدير</h3>

                        <div className="space-y-3">
                            <button
                                onClick={() => handleExport('ar')}
                                className="w-full p-4 rounded-xl border-2 border-gray-200 hover:border-primary hover:bg-primary/5 transition-all flex items-center gap-3"
                            >
                                <span className="text-2xl">🇸🇦</span>
                                <div className="text-right flex-1">
                                    <p className="font-bold text-gray-900">النسخة العربية فقط</p>
                                    <p className="text-xs text-gray-500">ملف PDF واحد بالعربية</p>
                                </div>
                            </button>

                            <button
                                onClick={() => handleExport('en')}
                                disabled={!englishCV}
                                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${englishCV ? 'border-gray-200 hover:border-primary hover:bg-primary/5' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}`}
                            >
                                <span className="text-2xl">🇬🇧</span>
                                <div className="text-right flex-1">
                                    <p className="font-bold text-gray-900" dir="ltr">English Only</p>
                                    <p className="text-xs text-gray-500">
                                        {englishCV ? 'Single PDF in English' : 'يجب إنشاء النسخة الإنجليزية أولاً'}
                                    </p>
                                </div>
                            </button>

                            <button
                                onClick={() => handleExport('both')}
                                disabled={!englishCV}
                                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${englishCV ? 'border-green-200 bg-green-50 hover:border-green-400' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}`}
                            >
                                <span className="text-2xl">📦</span>
                                <div className="text-right flex-1">
                                    <p className="font-bold text-gray-900">كلا النسختين (Arabic & English)</p>
                                    <p className="text-xs text-gray-500">{englishCV ? 'ملف PDF واحد يحتوي اللغتين' : 'يجب إنشاء النسخة الإنجليزية أولاً'}</p>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => setShowExportModal(false)}
                            className="w-full mt-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                        >
                            إلغاء
                        </button>
                    </div>
                </div>
            )}

            {/* Payment Modal */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !isProcessingPayment && setShowPaymentModal(false)}>
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        {/* Show progress indicator during AI processing */}
                        {showProgress ? (
                            <AnalysisProgress estimatedDuration={50} />
                        ) : (
                            <>
                                {/* Header */}
                                <div className="text-center space-y-3 mb-6">
                                    <h2 className="text-2xl font-black text-gray-900 tracking-tight">💳 بوابة الدفع</h2>
                                    <p className="text-sm text-gray-500 font-medium">
                                        {paymentSettings.paymentType === 'mandatory'
                                            ? 'الدفع مطلوب لتصدير السيرة الذاتية'
                                            : 'تبرع اختياري لدعم المشروع'}
                                    </p>
                                    <div className="flex justify-center">
                                        <div className="h-1.5 w-16 bg-accent rounded-full"></div>
                                    </div>
                                </div>

                                {/* Toggle QR Code Button */}
                                {!showScanner && (
                                    <button
                                        onClick={() => setShowScanner(true)}
                                        className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-base shadow-lg hover:bg-gray-800 transition-all flex items-center justify-center gap-2 mb-4"
                                    >
                                        <span>📱</span>
                                        <span>عرض رمز الدفع</span>
                                    </button>
                                )}

                                {/* QR Code Section */}
                                <AnimatePresence>
                                    {showScanner && (
                                        <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: 'auto' }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden mb-4"
                                        >
                                            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-4 rounded-2xl shadow-xl">
                                                <div className="flex flex-col items-center gap-3">
                                                    {/* QR Image */}
                                                    <div className="bg-white p-2 rounded-xl shadow-lg">
                                                        <Image
                                                            src={paymentSettings.qrImageUrl}
                                                            alt="Payment QR Code"
                                                            width={160}
                                                            height={160}
                                                            className="rounded-lg"
                                                        />
                                                    </div>

                                                    {/* Account Info */}
                                                    <div className="text-center text-white space-y-2">
                                                        <p className="text-sm font-bold">{paymentSettings.recipientName}</p>
                                                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-3 py-2 rounded-lg border border-white/20">
                                                            <code className="text-xs font-mono text-cyan-300 select-all flex-1" dir="ltr">
                                                                {paymentSettings.recipientCode}
                                                            </code>
                                                            <button
                                                                onClick={copyCode}
                                                                className="px-2 py-1 bg-cyan-500 hover:bg-cyan-400 text-white text-xs font-bold rounded transition-all"
                                                            >
                                                                {copied ? '✓' : 'نسخ'}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {/* Cost Badge */}
                                                    <div className="flex items-baseline gap-1 text-white">
                                                        <span className="text-2xl font-black">{paymentSettings.amount}</span>
                                                        <span className="text-sm font-bold opacity-80">{paymentSettings.currency}</span>
                                                    </div>

                                                    {/* Payment Type Badge */}
                                                    {paymentSettings.paymentType === 'donation' && (
                                                        <div className="px-3 py-1 bg-yellow-500/20 rounded-full">
                                                            <span className="text-yellow-300 text-xs font-bold">🎁 تبرع اختياري</span>
                                                        </div>
                                                    )}

                                                    <button
                                                        onClick={() => setShowScanner(false)}
                                                        className="text-gray-400 hover:text-white text-xs transition-colors"
                                                    >
                                                        إخفاء الباركود
                                                    </button>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                {/* Upload Proof Section */}
                                <div className="bg-white border-2 border-dashed border-gray-200 rounded-xl p-4 space-y-3 mb-4">
                                    <div className="text-center">
                                        <h3 className="text-sm font-bold text-gray-800">📸 رفع إثبات الدفع</h3>
                                        <p className="text-xs text-gray-500">التقط صورة للإيصال أو لقطة شاشة</p>
                                    </div>

                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handlePaymentFileChange}
                                        className="hidden"
                                        id="payment-proof-upload"
                                    />

                                    <AnimatePresence mode="wait">
                                        {paymentProofPreview ? (
                                            <motion.div
                                                initial={{ opacity: 0, scale: 0.9 }}
                                                animate={{ opacity: 1, scale: 1 }}
                                                exit={{ opacity: 0, scale: 0.9 }}
                                                className="relative"
                                            >
                                                <Image
                                                    src={paymentProofPreview}
                                                    alt="Payment Proof"
                                                    width={300}
                                                    height={200}
                                                    className="w-full max-h-40 object-contain rounded-lg border border-gray-200"
                                                />
                                                <button
                                                    onClick={removeProof}
                                                    className="absolute top-1 left-1 bg-red-500 text-white w-6 h-6 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all text-xs"
                                                >
                                                    ✕
                                                </button>
                                                <div className="mt-1 text-center text-xs text-green-600 font-medium">
                                                    ✓ تم اختيار الصورة
                                                </div>
                                            </motion.div>
                                        ) : (
                                            <motion.label
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                htmlFor="payment-proof-upload"
                                                className={`flex flex-col items-center justify-center py-6 cursor-pointer rounded-lg transition-all ${showProofRequired
                                                    ? 'bg-red-50 border-2 border-red-300'
                                                    : 'bg-gray-50 hover:bg-gray-100'
                                                    }`}
                                            >
                                                <div className="text-3xl mb-1">📤</div>
                                                <span className="font-bold text-gray-700 text-sm">اضغط لاختيار صورة</span>
                                                {showProofRequired && (
                                                    <motion.p
                                                        initial={{ opacity: 0, y: -10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className="text-red-500 font-bold mt-2 text-xs"
                                                    >
                                                        ⚠️ يجب رفع إثبات الدفع
                                                    </motion.p>
                                                )}
                                            </motion.label>
                                        )}
                                    </AnimatePresence>
                                </div>

                                {/* Status Message */}
                                {paymentStatus && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-center py-3 px-4 bg-primary/5 rounded-xl border-2 border-primary/10 mb-4"
                                    >
                                        <p className="text-sm font-bold text-primary">{paymentStatus}</p>
                                    </motion.div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-3">
                                    <button
                                        onClick={handlePaymentConfirm}
                                        disabled={isProcessingPayment}
                                        className={`w-full py-3 rounded-xl font-bold text-base transition-all shadow-lg active:scale-[0.98] flex items-center justify-center gap-2 ${paymentProof
                                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
                                            : 'bg-primary hover:bg-primary-dark text-white shadow-primary/20'
                                            } ${isProcessingPayment ? 'opacity-70 cursor-not-allowed' : ''}`}
                                    >
                                        {isProcessingPayment ? (
                                            <>
                                                <span className="w-5 h-5 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>جاري المعالجة...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>{paymentProof ? 'تأكيد الدفع والتصدير' : 'متابعة'}</span>
                                                <span>{paymentProof ? '✅' : '💳'}</span>
                                            </>
                                        )}
                                    </button>

                                    {/* Skip button for donation type */}
                                    {paymentSettings.paymentType === 'donation' && (
                                        <button
                                            onClick={handleSkipPayment}
                                            disabled={isProcessingPayment}
                                            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 font-medium"
                                        >
                                            تخطي الدفع والتصدير مباشرة
                                        </button>
                                    )}

                                    <button
                                        onClick={() => setShowPaymentModal(false)}
                                        disabled={isProcessingPayment}
                                        className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
                                    >
                                        إلغاء
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Image Cropper Modal */}
            {pendingCropImage && (
                <ImageCropper
                    imageUrl={pendingCropImage}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setPendingCropImage(null)}
                />
            )}

            {/* Section Edit Modal */}
            {editingSection && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingSection(null)}>
                    <div className="bg-white rounded-2xl p-6 max-w-md w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">✏️ تعديل {LABELS.ar[editingSection as keyof typeof LABELS.ar] || editingSection}</h3>
                            <button onClick={() => setEditingSection(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>
                        <p className="text-sm text-gray-500 mb-4">اكتب التعديل المطلوب في الشريط الجانبي (مساعد التعديل الذكي)</p>
                        <button onClick={() => setEditingSection(null)} className="w-full py-3 bg-primary text-white rounded-xl font-bold">
                            حسناً، سأستخدم المساعد
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
