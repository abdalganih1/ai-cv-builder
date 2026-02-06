"use client";

import { useState, useEffect } from 'react';
import { CVData } from '@/lib/types/cv-schema';
import EditChat from '@/components/chat/EditChat';
import { translateCVToEnglish } from '@/lib/ai/chat-editor';

import { pdf } from '@react-pdf/renderer';
import PDFDocument, { CombinedPDFDocument } from './PDFDocument';
import ImageCropper from './ImageCropper';

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

export default function CVPreview({ data, onUpdate, onBack }: StepProps) {
    const [isGenerating, setIsGenerating] = useState(false);
    const [isTranslating, setIsTranslating] = useState(false);
    const [englishCV, setEnglishCV] = useState<CVData | null>(null);
    const [activeLanguage, setActiveLanguage] = useState<'ar' | 'en'>('ar');
    const [showExportModal, setShowExportModal] = useState(false);
    // Image cropper state
    const [pendingCropImage, setPendingCropImage] = useState<string | null>(null);

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

    const handleTranslateToEnglish = async () => {
        if (isTranslating) return;

        setIsTranslating(true);
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
        setIsGenerating(true);
        setShowExportModal(false);

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

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[850px] w-full">
            {/* Sidebar / Chat Interface */}
            <div className="w-full md:w-1/3 order-2 md:order-1 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col">
                    <h3 className="font-bold text-primary mb-2">مساعد التعديل الذكي</h3>
                    <p className="text-xs text-gray-500 mb-4">اطلب أي تعديل على سيرتك الذاتية وسأقوم بتنفيذه فوراً.</p>
                    <EditChat data={data} onUpdate={handleUpdate} />
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
                                onClick={() => englishCV && setActiveLanguage('en')}
                                disabled={!englishCV}
                                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${activeLanguage === 'en' ? 'bg-primary text-white' : englishCV ? 'text-gray-500 hover:bg-gray-100' : 'text-gray-300 cursor-not-allowed'}`}
                            >
                                English
                            </button>
                        </div>
                    </div>

                    {!englishCV ? (
                        <button
                            onClick={handleTranslateToEnglish}
                            disabled={isTranslating}
                            className="w-full bg-white text-indigo-600 py-2.5 rounded-lg font-bold text-sm border-2 border-indigo-200 hover:bg-indigo-50 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isTranslating ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-indigo-300 border-t-indigo-600 rounded-full animate-spin" />
                                    <span>جاري الترجمة...</span>
                                </>
                            ) : (
                                <>
                                    <span>🇬🇧</span>
                                    <span>إنشاء نسخة إنجليزية</span>
                                </>
                            )}
                        </button>
                    ) : (
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-green-600 font-medium">✅ النسخة الإنجليزية جاهزة!</p>
                            <button
                                onClick={handleTranslateToEnglish}
                                disabled={isTranslating}
                                className="text-xs text-indigo-500 hover:underline"
                            >
                                {isTranslating ? '...' : '🔄 تحديث'}
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
            <div className="w-full md:w-2/3 order-1 md:order-2 bg-gray-50 rounded-xl border border-gray-200 p-4 overflow-hidden flex flex-col">
                {/* Language indicator */}
                <div className="flex items-center justify-between mb-2 px-2">
                    <span className={`text-xs font-bold px-2 py-1 rounded ${activeLanguage === 'en' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                        {activeLanguage === 'en' ? '🇬🇧 English Preview' : '🇸🇦 معاينة عربية'}
                    </span>
                </div>

                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white shadow-sm rounded-lg relative">
                    <div
                        className="min-h-full p-8 md:p-12 bg-white"
                        style={{ fontFamily: 'Arial, sans-serif', direction: isRTL ? 'rtl' : 'ltr', textAlign: isRTL ? 'right' : 'left' }}
                    >
                        {/* Header */}
                        <div className="border-b-2 border-primary pb-6 mb-6 flex justify-between items-end">
                            <div className="flex gap-6 items-end">
                                {/* Photo or Upload Button */}
                                {previewData.personal.photoUrl && previewData.personal.photoUrl !== '__skipped__' ? (
                                    <div className="relative group">
                                        <div className="w-32 h-32 rounded-full border-4 border-primary overflow-hidden shadow-lg mb-2">
                                            {/* eslint-disable-next-line @next/next/no-img-element */}
                                            <img src={previewData.personal.photoUrl} alt="Profile" className="w-full h-full object-cover" />
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
                                    <label className="w-32 h-32 rounded-full border-4 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-primary/5 transition-all mb-2 group">
                                        <span className="text-3xl group-hover:scale-110 transition-transform">📷</span>
                                        <span className="text-xs text-gray-500 mt-1 group-hover:text-primary">رفع صورة</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            className="hidden"
                                            onChange={handleFileSelect}
                                        />
                                    </label>
                                )}
                                <div>
                                    <h1 className="text-4xl font-bold text-primary mb-2">{previewData.personal.firstName} {previewData.personal.lastName}</h1>
                                    <p className="text-xl text-accent font-medium">{previewData.personal.targetJobTitle || previewData.personal.jobTitle || labels.jobTitle}</p>
                                </div>
                            </div>
                            <div className="text-sm text-gray-600 leading-relaxed">
                                {previewData.personal.email && previewData.personal.email !== '__skipped__' && <p dir="ltr">{previewData.personal.email}</p>}
                                {previewData.personal.phone && previewData.personal.phone !== '__skipped__' && <p dir="ltr">{previewData.personal.phone}</p>}
                                {previewData.personal.country && previewData.personal.country !== '__skipped__' && <p>{previewData.personal.country}</p>}
                                {previewData.personal.birthDate && previewData.personal.birthDate !== '__skipped__' && <p>{labels.birthDate}: {previewData.personal.birthDate}</p>}
                            </div>
                        </div>

                        {/* Summary */}
                        {previewData.personal.summary && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-primary mb-3 border-b border-gray-100 pb-2">{labels.summary}</h2>
                                <p className="text-gray-700 leading-relaxed text-base">{previewData.personal.summary}</p>
                            </div>
                        )}

                        {/* Experience */}
                        {previewData.experience && previewData.experience.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-primary mb-4 border-b border-gray-100 pb-2">{labels.experience}</h2>
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
                                <h2 className="text-xl font-bold text-primary mb-4 border-b border-gray-100 pb-2">{labels.education}</h2>
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
                                <h2 className="text-xl font-bold text-primary mb-4 border-b border-gray-100 pb-2">{labels.skills}</h2>
                                <div className="flex flex-wrap gap-2">
                                    {previewData.skills.map((skill, idx) => (
                                        <span key={idx} className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-700 font-medium">
                                            {skill}
                                        </span>
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
                                    <p className="font-bold text-gray-900">النسخة الإنجليزية فقط</p>
                                    <p className="text-xs text-gray-500">{englishCV ? 'ملف PDF واحد بالإنجليزية' : 'يجب إنشاء النسخة الإنجليزية أولاً'}</p>
                                </div>
                            </button>

                            <button
                                onClick={() => handleExport('both')}
                                disabled={!englishCV}
                                className={`w-full p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${englishCV ? 'border-green-200 bg-green-50 hover:border-green-400' : 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed'}`}
                            >
                                <span className="text-2xl">📦</span>
                                <div className="text-right flex-1">
                                    <p className="font-bold text-gray-900">كلا النسختين</p>
                                    <p className="text-xs text-gray-500">{englishCV ? 'ملفان PDF منفصلان' : 'يجب إنشاء النسخة الإنجليزية أولاً'}</p>
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

            {/* Image Cropper Modal */}
            {pendingCropImage && (
                <ImageCropper
                    imageUrl={pendingCropImage}
                    onCropComplete={handleCropComplete}
                    onCancel={() => setPendingCropImage(null)}
                />
            )}
        </div>
    );
}
