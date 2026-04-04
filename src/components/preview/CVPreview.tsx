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
        header: 'المعلومات الشخصية',
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
        header: 'Personal Info',
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

// Generate a lightweight fingerprint of Arabic CV data (without photoUrl)
function generateDataFingerprint(data: CVData): string {
    const obj = {
        firstName: data.personal.firstName,
        lastName: data.personal.lastName,
        summary: data.personal.summary,
        experience: data.experience?.map(e => e.description),
        education: data.education?.map(e => e.degree + e.institution),
        skills: data.skills,
        languages: data.languages?.map(l => l.name + l.level),
    };
    return JSON.stringify(obj).split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) & 0xFFFFFF, 0).toString(36);
}

// Payment settings interface
interface PaymentSettings {
    qrImageUrl: string;
    recipientName: string;
    recipientCode: string;
    amount: number;
    currency: string;
    paymentType: 'mandatory' | 'donation' | 'disabled';
    priceUsd?: number;
    priceSyp?: number;
    paymentLanguage?: 'both' | 'ar' | 'en';
    defaultPaymentImage?: boolean;
}

const DEFAULT_SETTINGS: PaymentSettings = {
    qrImageUrl: '/sham-cash-qr.png',
    recipientName: 'عبد الغني أحمد الحمدي',
    recipientCode: '0d4f56f704ded4f3148727e0edc03778',
    amount: 5,
    currency: 'USD',
    paymentType: 'mandatory',
    priceUsd: 5,
    priceSyp: 50000,
    paymentLanguage: 'both',
    defaultPaymentImage: true,
};

export default function CVPreview({ data, onUpdate, onBack }: StepProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [englishCV, setEnglishCV] = useState<CVData | null>(null);
    const [activeLanguage, setActiveLanguage] = useState<'ar' | 'en'>('ar');
    const [showExportModal, setShowExportModal] = useState(false);
    const [pendingCropImage, setPendingCropImage] = useState<string | null>(null);
    const [translationProgress, setTranslationProgress] = useState(0);
    const [translationTimer, setTranslationTimer] = useState(35);

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
    const [manualEditValue, setManualEditValue] = useState<string>('');
    const [isAiEditing, setIsAiEditing] = useState(false);
    const [aiEditSection, setAiEditSection] = useState<string | null>(null);
    const [aiEditPrompt, setAiEditPrompt] = useState('');

    // Header edit fields (separate inputs per field)
    const [headerEditFields, setHeaderEditFields] = useState<{
        firstName: string;
        lastName: string;
        targetJobTitle: string;
        email: string;
        phone: string;
        country: string;
        birthDate: string;
        headerNotes: string;
    } | null>(null);

    // Experience edit (per-item)
    const [experienceEditItems, setExperienceEditItems] = useState<typeof data.experience | null>(null);

    // Education edit (per-item)
    const [educationEditItems, setEducationEditItems] = useState<typeof data.education | null>(null);

    // Languages edit (per-item)
    const [languageEditItems, setLanguageEditItems] = useState<typeof data.languages | null>(null);

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
        e.target.value = '';
    };

    const handleCropComplete = (croppedImageUrl: string) => {
        onUpdate({ ...data, personal: { ...data.personal, photoUrl: croppedImageUrl } });
        setPendingCropImage(null);
    };

    useEffect(() => {
        const analyzed = sessionStorage.getItem('cv_analysis_done');
        if (analyzed === 'true' || analysisDone) return;
        setAnalysisDone(true);
        sessionStorage.setItem('cv_analysis_done', 'true');
        
        const analyzeCV = async () => {
            setIsAnalyzing(true);
            try {
                const enhancedData = await generateProfessionalCV(data);
                onUpdate(enhancedData);
            } catch (error) {
                console.error('Auto-analysis failed:', error);
            } finally {
                setIsAnalyzing(false);
            }
        };
        analyzeCV();
    }, []);

    // ✅ NEW: Restore English CV from cache on mount (with fingerprint validation)
    useEffect(() => {
        try {
            const cached = localStorage.getItem(ENGLISH_CV_CACHE_KEY);
            if (cached) {
                const parsed = JSON.parse(cached);
                // Check fingerprint to ensure cache matches current Arabic data
                const currentFingerprint = generateDataFingerprint(data);
                if (parsed._fingerprint === currentFingerprint && parsed.data) {
                    setEnglishCV(parsed.data);
                    console.log('✅ Restored English CV from cache (fingerprint matched)');
                } else {
                    console.log('🔄 Cache fingerprint mismatch - clearing stale cache');
                    localStorage.removeItem(ENGLISH_CV_CACHE_KEY);
                }
            }
        } catch (error) {
            console.warn('Failed to restore English CV from cache:', error);
            localStorage.removeItem(ENGLISH_CV_CACHE_KEY);
        }
    }, []); // Run only once on mount

    // Fetch payment settings from API (D1 first, localStorage fallback)
    useEffect(() => {
        async function fetchSettings() {
            try {
                const res = await fetch('/api/settings');
                const responseData = await res.json();
                
                if (responseData.success && responseData.data) {
                    setPaymentSettings(prev => ({ 
                        ...prev, 
                        ...responseData.data,
                    }));
                }
            } catch {
                // Fallback: localStorage
                const localSettings = localStorage.getItem('cv_payment_settings');
                if (localSettings) {
                    try {
                        const parsed = JSON.parse(localSettings);
                        setPaymentSettings(prev => ({
                            ...prev,
                            paymentType: parsed.paymentType || prev.paymentType,
                            priceUsd: parsed.priceUsd ?? prev.priceUsd,
                            priceSyp: parsed.priceSyp ?? prev.priceSyp,
                            paymentLanguage: parsed.paymentLanguage || prev.paymentLanguage,
                            defaultPaymentImage: parsed.defaultPaymentImage ?? prev.defaultPaymentImage,
                        }));
                    } catch (e) {
                        console.error('Failed to parse local settings:', e);
                    }
                }
            }
        }
        fetchSettings();
    }, []);

    // Save English CV to localStorage with fingerprint for validation
    useEffect(() => {
        if (englishCV) {
            try {
                const fingerprint = generateDataFingerprint(data);
                localStorage.setItem(ENGLISH_CV_CACHE_KEY, JSON.stringify({
                    _fingerprint: fingerprint,
                    data: englishCV,
                    savedAt: Date.now()
                }));
                console.log('💾 Saved English CV to cache with fingerprint:', fingerprint);
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
            setEnglishCV(newData);
            console.log('🇬🇧 English CV updated independently');
        } else {
            handleUpdate(newData);
        }
    };

    // Handle AI editing for specific section
    const handleAiSectionEdit = async (section: string) => {
        if (!aiEditPrompt.trim()) return;
        
        setIsAiEditing(true);
        try {
            const { processEditRequest } = await import('@/lib/ai/chat-editor');
            const prompt = `عدّل قسم "${LABELS.ar[section as keyof typeof LABELS.ar] || section}": ${aiEditPrompt}`;
            const updatedCV = await processEditRequest(previewData, prompt, activeLanguage);
            handleChatUpdate(updatedCV);
            setAiEditSection(null);
            setAiEditPrompt('');
        } catch (error) {
            console.error('AI section edit failed:', error);
            alert('فشل التعديل بالذكاء الاصطناعي');
        } finally {
            setIsAiEditing(false);
        }
    };

    // Countdown timer effect
    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (isTranslating) {
            setTranslationTimer(35);
            setTranslationProgress(0);
            interval = setInterval(() => {
                setTranslationTimer(prev => {
                    if (prev <= 1) return 1;
                    return prev - 1;
                });
                setTranslationProgress(prev => {
                    if (prev >= 95) return 95;
                    // 95% in ~35 seconds
                    return Math.min(95, prev + 2.7);
                });
            }, 1000);
        } else {
            setTranslationTimer(35);
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
        if (paymentSettings.paymentType === 'disabled') {
            await performExport(option);
            return;
        }
        
        const shouldRequirePayment = 
            (paymentSettings.paymentLanguage === 'both') ||
            (paymentSettings.paymentLanguage === 'en' && (option === 'en' || option === 'both')) ||
            (paymentSettings.paymentLanguage === 'ar' && (option === 'ar' || option === 'both'));
        
        if (shouldRequirePayment && paymentSettings.paymentType === 'mandatory' && data.metadata.paymentStatus !== 'completed') {
            setSelectedExportOption(option);
            setShowPaymentModal(true);
            return;
        }
        
        if (shouldRequirePayment && paymentSettings.paymentType === 'donation' && data.metadata.paymentStatus !== 'completed') {
            setSelectedExportOption(option);
            setShowPaymentModal(true);
            return;
        }
        
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
                await downloadCombinedPDF();
            }

            // إرسال إشعار Telegram بعد التصدير الناجح (non-blocking)
            sendCVNotification(option).catch(() => {});
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('عذراً، حدث خطأ أثناء إنشاء ملف PDF.');
        } finally {
            setIsGenerating(false);
        }
    };

    // إرسال إشعار Telegram عند تصدير CV
    const sendCVNotification = async (exportOption: string) => {
        try {
            await fetch('/api/notify-cv', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: sessionId || 'unknown',
                    cvData: {
                        personal: {
                            firstName: data.personal.firstName,
                            lastName: data.personal.lastName,
                            phone: data.personal.phone,
                            email: data.personal.email,
                            country: data.personal.country,
                            targetJobTitle: data.personal.targetJobTitle,
                        },
                        education: data.education,
                        experience: data.experience,
                        skills: data.skills,
                        languages: data.languages,
                    },
                    language: exportOption === 'en' ? 'en' : 'ar',
                    action: data.metadata.paymentStatus === 'completed' ? 'payment' : 'export',
                }),
            });
        } catch {
            // إشعار اختياري - لا يوقف التصدير
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
        if (paymentSettings.paymentType === 'mandatory' && !paymentProof) {
            setShowProofRequired(true);
            return;
        }

        setIsProcessingPayment(true);
        setPaymentStatus('📤 جاري رفع إثبات الدفع...');

        const proofUrl = await uploadProofImage();

        if (!proofUrl && uploadStatus === 'error') {
            setPaymentStatus('❌ فشل رفع إثبات الدفع. يرجى المحاولة مرة أخرى.');
            setIsProcessingPayment(false);
            return;
        }

        setPaymentStatus('✅ تم رفع إثبات الدفع بنجاح!');
        await new Promise(resolve => setTimeout(resolve, 500));

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

        setIsProcessingPayment(false);
        setShowPaymentModal(false);

        generateProfessionalCV(data).then(enhancedData => {
            onUpdate(enhancedData);
        }).catch(error => {
            console.error("AI Enhancement failed:", error);
        });
    };

    const handleSkipPayment = async () => {
        if (paymentSettings.paymentType !== 'donation') return;

        onUpdate({
            metadata: {
                ...data.metadata,
                paymentStatus: 'completed',
            }
        });

        if (selectedExportOption) {
            await performExport(selectedExportOption);
        }

        setShowPaymentModal(false);

        generateProfessionalCV(data).then(enhancedData => {
            onUpdate(enhancedData);
        }).catch(error => {
            console.error("AI Enhancement failed:", error);
        });
    };

    return (
        <div className="flex flex-col md:flex-row gap-4 md:gap-6 min-h-[100dvh] md:h-[850px] w-full">
            {isAnalyzing && (
                <div className="fixed inset-0 bg-white/90 z-50 flex items-center justify-center">
                    <div className="w-full max-w-2xl mx-auto p-8">
                        <AnalysisProgress estimatedDuration={35} />
                    </div>
                </div>
            )}
            {/* Sidebar / Chat Interface */}
            <div className="w-full md:w-1/3 order-2 md:order-1 flex flex-col gap-3 md:gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col">
                    <h3 className="font-bold text-primary mb-2">مساعد التعديل الذكي</h3>
                    <p className="text-xs text-gray-500 mb-4">اطلب أي تعديل على سيرتك الذاتية وسأقوم بتنفيذه فوراً.</p>
                    {isAiEditing && (
                        <div className="mb-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                            <div className="flex items-center gap-2">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                                <span className="text-sm text-blue-700 font-medium">جاري معالجة طلبك...</span>
                            </div>
                        </div>
                    )}
                    <EditChat
                        data={previewData}
                        onUpdate={handleChatUpdate}
                        language={activeLanguage}
                        onProcessingChange={setIsAiEditing}
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
                            <p className="text-[10px] text-gray-400 text-center">جاري الترجمة الاحترافية، يستغرق حتى 35 ثانية...</p>
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
                                    <p className="text-base sm:text-xl text-accent font-medium">
                                        {previewData.personal.targetJobTitle === '__unknown__' 
                                            ? (previewData.personal.jobTitle || 'المسمى الوظيفي')
                                            : (previewData.personal.targetJobTitle || previewData.personal.jobTitle || labels.jobTitle)}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start gap-2">
                                <div className="text-xs sm:text-sm text-gray-600 leading-relaxed w-full sm:w-auto text-center sm:text-right flex-1">
                                    {previewData.personal.email && previewData.personal.email !== '__skipped__' && <p dir="ltr">{previewData.personal.email}</p>}
                                    {previewData.personal.phone && previewData.personal.phone !== '__skipped__' && <p dir="ltr">{previewData.personal.phone}</p>}
                                    <p>
                                        {previewData.personal.country && previewData.personal.country !== '__skipped__' && previewData.personal.country}
                                        {previewData.personal.residencyStatus && previewData.personal.residencyStatus !== 'citizen' && (
                                            <span className="text-primary"> • {previewData.personal.residencyStatus === 'resident' ? 'مقيم' : 'زائر'}</span>
                                        )}
                                    </p>
                                    {previewData.personal.residencyExpiry && (
                                        <p className="text-orange-600 text-xs">انتهاء الإقامة: {previewData.personal.residencyExpiry}</p>
                                    )}
                                    {previewData.personal.birthDate && previewData.personal.birthDate !== '__skipped__' && <p>{labels.birthDate}: {previewData.personal.birthDate}</p>}
                                    {previewData.personal.headerNotes && (
                                        <p className="text-sky-700 text-xs font-medium mt-1 italic">
                                            {previewData.personal.headerNotes}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={() => {
                                        setHeaderEditFields({
                                            firstName: previewData.personal.firstName || '',
                                            lastName: previewData.personal.lastName || '',
                                            targetJobTitle: previewData.personal.targetJobTitle || previewData.personal.jobTitle || '',
                                            email: previewData.personal.email && previewData.personal.email !== '__skipped__' ? previewData.personal.email : '',
                                            phone: previewData.personal.phone && previewData.personal.phone !== '__skipped__' ? previewData.personal.phone : '',
                                            country: previewData.personal.country && previewData.personal.country !== '__skipped__' ? previewData.personal.country : '',
                                            birthDate: previewData.personal.birthDate && previewData.personal.birthDate !== '__skipped__' ? previewData.personal.birthDate : '',
                                            headerNotes: previewData.personal.headerNotes || '',
                                        });
                                        setEditingSection('header');
                                        setAiEditSection(null);
                                    }}
                                    className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all shrink-0"
                                    title="تعديل الهيدر"
                                >
                                    ✏️
                                </button>
                            </div>
                        </div>

                        {/* Summary */}
                        {previewData.personal.summary && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-3 border-b border-gray-100 pb-2">
                                    <h2 className="text-xl font-bold text-primary">{labels.summary}</h2>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => { setManualEditValue(previewData.personal.summary || ''); setEditingSection('summary'); setAiEditSection(null); }}
                                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                            title="تعديل يدوي"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => { setAiEditSection('summary'); setEditingSection(null); }}
                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                            title="تعديل بالذكاء الاصطناعي"
                                        >
                                            🤖
                                        </button>
                                    </div>
                                </div>
                                {aiEditSection === 'summary' && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                        <input
                                            type="text"
                                            placeholder="مثال: اجعل النبذة أكثر احترافية"
                                            className="w-full p-3 border border-blue-200 rounded-lg text-sm"
                                            value={aiEditPrompt}
                                            onChange={(e) => setAiEditPrompt(e.target.value)}
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleAiSectionEdit('summary')}
                                                disabled={isAiEditing || !aiEditPrompt.trim()}
                                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                                            >
                                                {isAiEditing ? 'جاري...' : 'تطبيق'}
                                            </button>
                                            <button
                                                onClick={() => { setAiEditSection(null); setAiEditPrompt(''); }}
                                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                )}
                                <p className="text-gray-700 leading-relaxed text-base">{previewData.personal.summary}</p>
                            </div>
                        )}

                        {/* Experience */}
                        {previewData.experience && previewData.experience.length > 0 && (
                            <div className="mb-8">
                                <div className="flex items-center justify-between mb-4 border-b border-gray-100 pb-2">
                                    <h2 className="text-xl font-bold text-primary">{labels.experience}</h2>
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => {
                                            setExperienceEditItems(previewData.experience.map(e => ({...e})));
                                            setEditingSection('experience');
                                            setAiEditSection(null);
                                        }}
                                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                            title="تعديل يدوي"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => { setAiEditSection('experience'); setEditingSection(null); }}
                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                            title="تعديل بالذكاء الاصطناعي"
                                        >
                                            🤖
                                        </button>
                                    </div>
                                </div>
                                {aiEditSection === 'experience' && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                        <input
                                            type="text"
                                            placeholder="مثال: أضف خبرة جديدة في شركة سيريتل"
                                            className="w-full p-3 border border-blue-200 rounded-lg text-sm"
                                            value={aiEditPrompt}
                                            onChange={(e) => setAiEditPrompt(e.target.value)}
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleAiSectionEdit('experience')}
                                                disabled={isAiEditing || !aiEditPrompt.trim()}
                                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                                            >
                                                {isAiEditing ? 'جاري...' : 'تطبيق'}
                                            </button>
                                            <button
                                                onClick={() => { setAiEditSection(null); setAiEditPrompt(''); }}
                                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => {
                                            setEducationEditItems(previewData.education.map(e => ({...e})));
                                            setEditingSection('education');
                                            setAiEditSection(null);
                                        }}
                                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                            title="تعديل يدوي"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => { setAiEditSection('education'); setEditingSection(null); }}
                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                            title="تعديل بالذكاء الاصطناعي"
                                        >
                                            🤖
                                        </button>
                                    </div>
                                </div>
                                {aiEditSection === 'education' && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                        <input
                                            type="text"
                                            placeholder="مثال: غيّر التخصص من تحكم إلى هندسة برمجيات"
                                            className="w-full p-3 border border-blue-200 rounded-lg text-sm"
                                            value={aiEditPrompt}
                                            onChange={(e) => setAiEditPrompt(e.target.value)}
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleAiSectionEdit('education')}
                                                disabled={isAiEditing || !aiEditPrompt.trim()}
                                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                                            >
                                                {isAiEditing ? 'جاري...' : 'تطبيق'}
                                            </button>
                                            <button
                                                onClick={() => { setAiEditSection(null); setAiEditPrompt(''); }}
                                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => { setManualEditValue((previewData.skills || []).join('\n')); setEditingSection('skills'); setAiEditSection(null); }}
                                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                            title="تعديل يدوي"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => { setAiEditSection('skills'); setEditingSection(null); }}
                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                            title="تعديل بالذكاء الاصطناعي"
                                        >
                                            🤖
                                        </button>
                                    </div>
                                </div>
                                {aiEditSection === 'skills' && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                        <input
                                            type="text"
                                            placeholder="مثال: أضف مهارة React و Node.js"
                                            className="w-full p-3 border border-blue-200 rounded-lg text-sm"
                                            value={aiEditPrompt}
                                            onChange={(e) => setAiEditPrompt(e.target.value)}
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleAiSectionEdit('skills')}
                                                disabled={isAiEditing || !aiEditPrompt.trim()}
                                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                                            >
                                                {isAiEditing ? 'جاري...' : 'تطبيق'}
                                            </button>
                                            <button
                                                onClick={() => { setAiEditSection(null); setAiEditPrompt(''); }}
                                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => {
                                            setLanguageEditItems(previewData.languages.map(l => ({...l})));
                                            setEditingSection('languages');
                                            setAiEditSection(null);
                                        }}
                                            className="p-2 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                                            title="تعديل يدوي"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => { setAiEditSection('languages'); setEditingSection(null); }}
                                            className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                                            title="تعديل بالذكاء الاصطناعي"
                                        >
                                            🤖
                                        </button>
                                    </div>
                                </div>
                                {aiEditSection === 'languages' && (
                                    <div className="mb-4 p-3 bg-blue-50 rounded-xl border border-blue-200">
                                        <input
                                            type="text"
                                            placeholder="مثال: أضف لغة الإنجليزية بمستوى جيد جداً"
                                            className="w-full p-3 border border-blue-200 rounded-lg text-sm"
                                            value={aiEditPrompt}
                                            onChange={(e) => setAiEditPrompt(e.target.value)}
                                        />
                                        <div className="flex gap-2 mt-2">
                                            <button
                                                onClick={() => handleAiSectionEdit('languages')}
                                                disabled={isAiEditing || !aiEditPrompt.trim()}
                                                className="flex-1 py-2 bg-blue-500 text-white rounded-lg text-sm font-bold disabled:opacity-50"
                                            >
                                                {isAiEditing ? 'جاري...' : 'تطبيق'}
                                            </button>
                                            <button
                                                onClick={() => { setAiEditSection(null); setAiEditPrompt(''); }}
                                                className="px-4 py-2 border border-gray-300 rounded-lg text-sm"
                                            >
                                                إلغاء
                                            </button>
                                        </div>
                                    </div>
                                )}
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
                                                    <div className="text-center text-white space-y-1">
                                                        <div className="flex items-baseline justify-center gap-1">
                                                            <span className="text-2xl font-black">{paymentSettings.priceUsd || paymentSettings.amount}</span>
                                                            <span className="text-sm font-bold opacity-80">USD</span>
                                                        </div>
                                                        <div className="flex items-baseline justify-center gap-1">
                                                            <span className="text-lg font-bold">{paymentSettings.priceSyp?.toLocaleString() || '---'}</span>
                                                            <span className="text-xs font-bold opacity-70">ل.س</span>
                                                        </div>
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

            {/* ✏️ HEADER EDIT MODAL - Separate fields per info */}
            {editingSection === 'header' && headerEditFields && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setEditingSection(null); setHeaderEditFields(null); }}>
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-gray-900">✏️ تعديل المعلومات الشخصية</h3>
                            <button onClick={() => { setEditingSection(null); setHeaderEditFields(null); }} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
                        </div>

                        <div className="space-y-4">
                            {/* Row: First Name */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-500 w-32 shrink-0 text-left">الاسم الأول</label>
                                <input
                                    value={headerEditFields.firstName}
                                    onChange={e => setHeaderEditFields(prev => prev ? { ...prev, firstName: e.target.value } : prev)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary outline-none text-gray-800"
                                    dir="auto"
                                />
                            </div>
                            {/* Row: Last Name */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-500 w-32 shrink-0 text-left">اسم العائلة</label>
                                <input
                                    value={headerEditFields.lastName}
                                    onChange={e => setHeaderEditFields(prev => prev ? { ...prev, lastName: e.target.value } : prev)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary outline-none text-gray-800"
                                    dir="auto"
                                />
                            </div>
                            {/* Row: Job Title */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-500 w-32 shrink-0 text-left">المسمى الوظيفي</label>
                                <input
                                    value={headerEditFields.targetJobTitle}
                                    onChange={e => setHeaderEditFields(prev => prev ? { ...prev, targetJobTitle: e.target.value } : prev)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary outline-none text-gray-800"
                                    dir="auto"
                                />
                            </div>
                            {/* Row: Email */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-500 w-32 shrink-0 text-left">البريد الإلكتروني</label>
                                <input
                                    type="email"
                                    value={headerEditFields.email}
                                    onChange={e => setHeaderEditFields(prev => prev ? { ...prev, email: e.target.value } : prev)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary outline-none text-gray-800"
                                    dir="ltr"
                                />
                            </div>
                            {/* Row: Phone */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-500 w-32 shrink-0 text-left">الهاتف</label>
                                <input
                                    type="tel"
                                    value={headerEditFields.phone}
                                    onChange={e => setHeaderEditFields(prev => prev ? { ...prev, phone: e.target.value } : prev)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary outline-none text-gray-800"
                                    dir="ltr"
                                />
                            </div>
                            {/* Row: Country */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-500 w-32 shrink-0 text-left">الدولة</label>
                                <input
                                    value={headerEditFields.country}
                                    onChange={e => setHeaderEditFields(prev => prev ? { ...prev, country: e.target.value } : prev)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary outline-none text-gray-800"
                                    dir="auto"
                                />
                            </div>
                            {/* Row: Birth Date */}
                            <div className="flex items-center gap-3">
                                <label className="text-sm font-bold text-gray-500 w-32 shrink-0 text-left">تاريخ الميلاد</label>
                                <input
                                    value={headerEditFields.birthDate}
                                    onChange={e => setHeaderEditFields(prev => prev ? { ...prev, birthDate: e.target.value } : prev)}
                                    className="flex-1 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-primary outline-none text-gray-800"
                                    dir="ltr"
                                    placeholder="مثال: 1990-01-15"
                                />
                            </div>
                            {/* Row: Header Notes */}
                            <div className="flex flex-col gap-2 pt-2 border-t border-gray-100">
                                <div className="flex items-center gap-2">
                                    <label className="text-sm font-bold text-indigo-600">📝 ملاحظة في الهيدر</label>
                                    <span className="text-xs text-gray-400">(تظهر في رأس السيرة دون كلمة &quot;ملاحظة&quot;)</span>
                                </div>
                                <input
                                    value={headerEditFields.headerNotes}
                                    onChange={e => setHeaderEditFields(prev => prev ? { ...prev, headerNotes: e.target.value } : prev)}
                                    className="w-full px-3 py-2 border-2 border-indigo-200 rounded-lg focus:border-indigo-500 outline-none text-gray-800 bg-indigo-50/30"
                                    placeholder="مثال: يوجد إقامة حتى عام 2026"
                                    dir="auto"
                                />
                            </div>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => { setEditingSection(null); setHeaderEditFields(null); }}
                                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={() => {
                                    if (!headerEditFields) return;
                                    const updatedData: CVData = {
                                        ...previewData,
                                        personal: {
                                            ...previewData.personal,
                                            firstName: headerEditFields.firstName,
                                            lastName: headerEditFields.lastName,
                                            targetJobTitle: headerEditFields.targetJobTitle,
                                            email: headerEditFields.email || previewData.personal.email,
                                            phone: headerEditFields.phone || previewData.personal.phone,
                                            country: headerEditFields.country || previewData.personal.country,
                                            birthDate: headerEditFields.birthDate || undefined,
                                            headerNotes: headerEditFields.headerNotes || undefined,
                                        }
                                    };
                                    handleChatUpdate(updatedData);
                                    setEditingSection(null);
                                    setHeaderEditFields(null);
                                }}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90"
                            >
                                💾 حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✏️ EXPERIENCE EDIT MODAL - Per-item fields */}
            {editingSection === 'experience' && experienceEditItems && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setEditingSection(null); setExperienceEditItems(null); }}>
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-gray-900">✏️ تعديل الخبرة العملية</h3>
                            <button onClick={() => { setEditingSection(null); setExperienceEditItems(null); }} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
                        </div>

                        <div className="space-y-6">
                            {experienceEditItems.map((exp, idx) => (
                                <div key={exp.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-400 uppercase">الخبرة {idx + 1}</span>
                                        <button
                                            onClick={() => setExperienceEditItems(prev => prev ? prev.filter((_, i) => i !== idx) : prev)}
                                            className="text-xs text-red-400 hover:text-red-600"
                                        >🗑 حذف</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">المنصب</label>
                                            <input
                                                value={exp.position}
                                                onChange={e => setExperienceEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, position: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="auto"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">الشركة</label>
                                            <input
                                                value={exp.company}
                                                onChange={e => setExperienceEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, company: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="auto"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ البدء</label>
                                            <input
                                                value={exp.startDate}
                                                onChange={e => setExperienceEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, startDate: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="ltr"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">تاريخ الانتهاء</label>
                                            <input
                                                value={exp.endDate}
                                                onChange={e => setExperienceEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, endDate: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="ltr"
                                            />
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">الوصف</label>
                                        <textarea
                                            value={exp.description}
                                            onChange={e => setExperienceEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, description: e.target.value } : item) : prev)}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none min-h-[80px]"
                                            dir="auto"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => { setEditingSection(null); setExperienceEditItems(null); }}
                                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={() => {
                                    if (!experienceEditItems) return;
                                    const updatedData: CVData = { ...previewData, experience: experienceEditItems };
                                    handleChatUpdate(updatedData);
                                    setEditingSection(null);
                                    setExperienceEditItems(null);
                                }}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90"
                            >
                                💾 حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✏️ EDUCATION EDIT MODAL - Per-item fields */}
            {editingSection === 'education' && educationEditItems && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setEditingSection(null); setEducationEditItems(null); }}>
                    <div className="bg-white rounded-2xl p-6 max-w-2xl w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-gray-900">✏️ تعديل التعليم</h3>
                            <button onClick={() => { setEditingSection(null); setEducationEditItems(null); }} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
                        </div>

                        <div className="space-y-5">
                            {educationEditItems.map((edu, idx) => (
                                <div key={edu.id} className="border border-gray-200 rounded-xl p-4 space-y-3 bg-gray-50/50">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-bold text-gray-400 uppercase">الشهادة {idx + 1}</span>
                                        <button
                                            onClick={() => setEducationEditItems(prev => prev ? prev.filter((_, i) => i !== idx) : prev)}
                                            className="text-xs text-red-400 hover:text-red-600"
                                        >🗑 حذف</button>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">الدرجة العلمية</label>
                                            <input
                                                value={edu.degree}
                                                onChange={e => setEducationEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, degree: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="auto"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">التخصص</label>
                                            <input
                                                value={edu.major || ''}
                                                onChange={e => setEducationEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, major: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="auto"
                                            />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-xs font-bold text-gray-500 mb-1">المؤسسة التعليمية</label>
                                            <input
                                                value={edu.institution}
                                                onChange={e => setEducationEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, institution: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="auto"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">سنة البدء</label>
                                            <input
                                                value={edu.startYear}
                                                onChange={e => setEducationEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, startYear: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="ltr"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">سنة التخرج</label>
                                            <input
                                                value={edu.endYear}
                                                onChange={e => setEducationEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, endYear: e.target.value } : item) : prev)}
                                                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                                dir="ltr"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => { setEditingSection(null); setEducationEditItems(null); }}
                                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={() => {
                                    if (!educationEditItems) return;
                                    const updatedData: CVData = { ...previewData, education: educationEditItems };
                                    handleChatUpdate(updatedData);
                                    setEditingSection(null);
                                    setEducationEditItems(null);
                                }}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90"
                            >
                                💾 حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✏️ LANGUAGES EDIT MODAL - Per-row fields */}
            {editingSection === 'languages' && languageEditItems && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => { setEditingSection(null); setLanguageEditItems(null); }}>
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-5">
                            <h3 className="text-xl font-bold text-gray-900">✏️ تعديل اللغات</h3>
                            <button onClick={() => { setEditingSection(null); setLanguageEditItems(null); }} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">✕</button>
                        </div>

                        <div className="space-y-3">
                            <div className="grid grid-cols-[1fr_1fr_auto] gap-2 text-xs font-bold text-gray-400 px-1">
                                <span>اللغة</span>
                                <span>المستوى</span>
                                <span></span>
                            </div>
                            {languageEditItems.map((lang, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_1fr_auto] gap-2 items-center">
                                    <input
                                        value={lang.name}
                                        onChange={e => setLanguageEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, name: e.target.value } : item) : prev)}
                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none text-gray-800"
                                        dir="auto"
                                        placeholder="مثال: العربية"
                                    />
                                    <select
                                        value={lang.level}
                                        onChange={e => setLanguageEditItems(prev => prev ? prev.map((item, i) => i === idx ? { ...item, level: e.target.value } : item) : prev)}
                                        className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-primary outline-none bg-white text-gray-800"
                                    >
                                        <option value="لغة أم">لغة أم</option>
                                        <option value="ممتاز">ممتاز</option>
                                        <option value="جيد جداً">جيد جداً</option>
                                        <option value="جيد">جيد</option>
                                        <option value="متوسط">متوسط</option>
                                        <option value="مبتدئ">مبتدئ</option>
                                        <option value="Native">Native</option>
                                        <option value="Fluent">Fluent</option>
                                        <option value="Advanced">Advanced</option>
                                        <option value="Intermediate">Intermediate</option>
                                        <option value="Basic">Basic</option>
                                    </select>
                                    <button
                                        onClick={() => setLanguageEditItems(prev => prev ? prev.filter((_, i) => i !== idx) : prev)}
                                        className="p-2 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                                    >✕</button>
                                </div>
                            ))}
                            <button
                                onClick={() => setLanguageEditItems(prev => prev ? [...prev, { name: '', level: 'متوسط' }] : [{ name: '', level: 'متوسط' }])}
                                className="w-full py-2 border-2 border-dashed border-gray-200 rounded-lg text-sm text-gray-500 hover:border-primary hover:text-primary transition-all"
                            >
                                + إضافة لغة
                            </button>
                        </div>

                        <div className="flex gap-2 mt-6">
                            <button
                                onClick={() => { setEditingSection(null); setLanguageEditItems(null); }}
                                className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50 font-medium"
                            >
                                إلغاء
                            </button>
                            <button
                                onClick={() => {
                                    if (!languageEditItems) return;
                                    const validLangs = languageEditItems.filter(l => l.name.trim());
                                    const updatedData: CVData = { ...previewData, languages: validLangs };
                                    handleChatUpdate(updatedData);
                                    setEditingSection(null);
                                    setLanguageEditItems(null);
                                }}
                                className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90"
                            >
                                💾 حفظ التعديلات
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ✏️ SKILLS / SUMMARY / OTHER SECTION EDIT MODAL */}
            {editingSection && !['header', 'experience', 'education', 'languages'].includes(editingSection) && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditingSection(null)}>
                    <div className="bg-white rounded-2xl p-6 max-w-lg w-full mx-4 shadow-2xl max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-900">✏️ تعديل {LABELS.ar[editingSection as keyof typeof LABELS.ar] || editingSection}</h3>
                            <button onClick={() => setEditingSection(null)} className="text-gray-400 hover:text-gray-600">✕</button>
                        </div>

                        {editingSection === 'skills' && (
                            <p className="text-xs text-gray-400 mb-3">💡 اكتب كل مهارة في سطر منفصل أو افصل بينها بفاصلة</p>
                        )}
                        
                        <div className="space-y-3">
                            <textarea
                                value={manualEditValue}
                                onChange={(e) => setManualEditValue(e.target.value)}
                                className="w-full p-4 border-2 border-gray-200 rounded-xl min-h-[200px] focus:border-primary outline-none text-gray-800"
                                placeholder="أدخل النص الجديد..."
                                dir={activeLanguage === 'en' ? 'ltr' : 'rtl'}
                            />
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setEditingSection(null)}
                                    className="flex-1 py-3 border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
                                >
                                    إلغاء
                                </button>
                                <button
                                    onClick={() => {
                                        applyManualEdit(editingSection, manualEditValue, previewData, handleChatUpdate, activeLanguage);
                                        setEditingSection(null);
                                    }}
                                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold hover:bg-primary/90"
                                >
                                    💾 حفظ التعديل
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Helper functions for manual editing
function getSectionValue(section: string, data: CVData): string {
    if (section === 'header') {
        const parts = [
            `الاسم: ${data.personal.firstName} ${data.personal.lastName}`,
            `المسمى الوظيفي: ${data.personal.targetJobTitle || data.personal.jobTitle || ''}`,
            `البريد: ${data.personal.email || ''}`,
            `الهاتف: ${data.personal.phone}`,
            `الدولة: ${data.personal.country}`,
        ];
        if (data.personal.residencyStatus && data.personal.residencyStatus !== 'citizen') {
            parts.push(`حالة الإقامة: ${data.personal.residencyStatus === 'resident' ? 'مقيم' : 'زائر'}`);
        }
        if (data.personal.residencyExpiry) {
            parts.push(`انتهاء الإقامة: ${data.personal.residencyExpiry}`);
        }
        return parts.join('\n');
    }
    if (section === 'summary') return data.personal.summary || '';
    if (section === 'skills') return data.skills?.join('، ') || '';
    if (section === 'languages') return data.languages?.map(l => `${l.name}: ${l.level}`).join('\n') || '';
    if (section === 'experience') {
        return data.experience?.map(e => `${e.position} - ${e.company}:\n${e.description}`).join('\n\n') || '';
    }
    if (section === 'education') {
        return data.education?.map(e => `${e.degree} ${e.major || ''} - ${e.institution} (${e.startYear}-${e.endYear})`).join('\n') || '';
    }
    return '';
}

function applyManualEdit(section: string, value: string, data: CVData, onUpdate: (data: CVData) => void, _language: 'ar' | 'en'): void {
    const newData: CVData = { 
        ...data,
        personal: { ...data.personal },
        education: [...(data.education || [])],
        experience: [...(data.experience || [])],
        skills: [...(data.skills || [])],
        languages: [...(data.languages || [])],
        hobbies: [...(data.hobbies || [])],
    };
    
    if (section === 'header') {
        const lines = value.split('\n').filter(l => l.trim());
        const parsed: Record<string, string> = {};
        lines.forEach(line => {
            const [key, ...rest] = line.split(':');
            if (key && rest.length) {
                parsed[key.trim()] = rest.join(':').trim();
            }
        });
        newData.personal = {
            ...data.personal,
            firstName: parsed['الاسم']?.split(' ')[0] || data.personal.firstName,
            lastName: parsed['الاسم']?.split(' ').slice(1).join(' ') || data.personal.lastName,
            targetJobTitle: parsed['المسمى الوظيفي'] || data.personal.targetJobTitle,
            email: parsed['البريد'] || data.personal.email,
            phone: parsed['الهاتف'] || data.personal.phone,
            country: parsed['الدولة'] || data.personal.country,
            residencyStatus: parsed['حالة الإقامة'] === 'مقيم' ? 'resident' : parsed['حالة الإقامة'] === 'زائر' ? 'visitor' : data.personal.residencyStatus,
            residencyExpiry: parsed['انتهاء الإقامة'] || data.personal.residencyExpiry,
        };
    } else if (section === 'summary') {
        newData.personal = { ...data.personal, summary: value };
    } else if (section === 'skills') {
        newData.skills = value.split(/[،,\n]+/).map(s => s.trim()).filter(s => s);
    } else if (section === 'languages') {
        const lines = value.split('\n').filter(l => l.trim());
        newData.languages = lines.map(line => {
            const parts = line.split(':').map(p => p.trim());
            return { name: parts[0] || '', level: parts[1] || 'متوسط' };
        });
    } else if (section === 'experience') {
        const blocks = value.split('\n\n').filter(b => b.trim());
        newData.experience = blocks.map((block, idx) => {
            const lines = block.split('\n').filter(l => l.trim());
            const firstLine = lines[0] || '';
            const match = firstLine.match(/(.+?)\s*-\s*(.+):?/);
            return {
                id: data.experience?.[idx]?.id || `exp_${Date.now()}_${idx}`,
                position: match?.[1]?.trim() || '',
                company: match?.[2]?.replace(':', '').trim() || '',
                startDate: data.experience?.[idx]?.startDate || '',
                endDate: data.experience?.[idx]?.endDate || '',
                description: lines.slice(1).join('\n').trim(),
            };
        });
    } else if (section === 'education') {
        const lines = value.split('\n').filter(l => l.trim());
        newData.education = lines.map((line, idx) => {
            const match = line.match(/(.+?)\s+(.+?)\s*-\s*(.+?)\s*\((\d+)-(\d+)\)/);
            return {
                id: data.education?.[idx]?.id || `edu_${Date.now()}_${idx}`,
                degree: match?.[1]?.trim() || '',
                major: match?.[2]?.trim() || '',
                institution: match?.[3]?.trim() || '',
                startYear: match?.[4] || '',
                endYear: match?.[5] || '',
            };
        });
    }
    
    onUpdate(newData);
}
