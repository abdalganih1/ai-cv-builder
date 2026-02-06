"use client";

import { CVData } from '@/lib/types/cv-schema';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { generateProfessionalCV } from '@/lib/ai/chat-editor';
import Image from 'next/image';
import AnalysisProgress from '../wizard/AnalysisProgress';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
    onBack: () => void;
}

const SHAM_CASH_CODE = "0d4f56f704ded4f3148727e0edc03778";
const SHAM_CASH_NAME = "عبد الغني أحمد الحمدي";

export default function ShamCashPayment({ data, onNext, onBack }: StepProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [showProgress, setShowProgress] = useState(false);
    const [status, setStatus] = useState<string>('');
    const [copied, setCopied] = useState(false);
    const [paymentProof, setPaymentProof] = useState<File | null>(null);
    const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
    const [showProofRequired, setShowProofRequired] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const cost = 500;

    const copyCode = async () => {
        try {
            await navigator.clipboard.writeText(SHAM_CASH_CODE);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setPaymentProof(file);
            const reader = new FileReader();
            reader.onload = () => {
                setPaymentProofPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            setShowProofRequired(false);
        }
    };

    const removeProof = () => {
        setPaymentProof(null);
        setPaymentProofPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const uploadProofImage = async (): Promise<string | null> => {
        if (!paymentProof) return null;

        setUploadStatus('uploading');

        try {
            const formData = new FormData();
            formData.append('file', paymentProof);
            formData.append('customerName', `${data.personal.firstName} ${data.personal.lastName}`);
            formData.append('phone', data.personal.phone || 'N/A');

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

    const handlePayment = async () => {
        // Check if proof is required
        if (!paymentProof) {
            setShowProofRequired(true);
            return;
        }

        setIsProcessing(true);
        setStatus('📤 جاري رفع إثبات الدفع...');

        // Upload the proof image
        const proofUrl = await uploadProofImage();

        if (!proofUrl && uploadStatus === 'error') {
            setStatus('❌ فشل رفع إثبات الدفع. يرجى المحاولة مرة أخرى.');
            setIsProcessing(false);
            return;
        }

        setStatus('✅ تم رفع إثبات الدفع بنجاح!');
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Now trigger AI to generate professional CV - Show progress indicator
        setShowProgress(true);

        try {
            const enhancedData = await generateProfessionalCV(data);
            setShowProgress(false);
            setStatus('✨ تم إنشاء السيرة الذاتية الاحترافية بنجاح!');

            await new Promise(resolve => setTimeout(resolve, 1000));

            // On success - pass enhanced data with proof URL
            onNext({
                ...enhancedData,
                metadata: {
                    ...data.metadata,
                    paymentStatus: 'completed',
                    paymentProofUrl: proofUrl || undefined
                }
            });
        } catch (error) {
            console.error("AI Enhancement failed:", error);
            setShowProgress(false);
            setStatus('⚠️ تعذّر تحسين السيرة الذاتية، سننتقل للنسخة الأساسية...');
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Fallback to original data
            onNext({
                metadata: {
                    ...data.metadata,
                    paymentStatus: 'completed',
                    paymentProofUrl: proofUrl || undefined
                }
            });
        } finally {
            setIsProcessing(false);
        }
    };


    // Show progress indicator during AI processing
    if (showProgress) {
        return <AnalysisProgress estimatedDuration={50} />;
    }

    return (
        <div className="w-full max-w-xl mx-auto space-y-8 py-6">
            {/* Header */}
            <div className="text-center space-y-3">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">بوابة الدفع الآمنة</h2>
                <p className="text-lg text-gray-500 font-medium">خطوة أخيرة لتجهيز سيرتك الذاتية للاحتراف</p>
                <div className="flex justify-center">
                    <div className="h-1.5 w-16 bg-accent rounded-full"></div>
                </div>
            </div>

            {/* QR Code Section */}
            <div className="bg-gradient-to-br from-gray-900 to-gray-800 p-6 rounded-3xl shadow-2xl">
                <div className="flex flex-col items-center gap-4">
                    {/* QR Image */}
                    <div className="bg-white p-3 rounded-2xl shadow-lg">
                        <Image
                            src="/sham-cash-qr.png"
                            alt="Sham Cash QR Code"
                            width={200}
                            height={200}
                            className="rounded-xl"
                        />
                    </div>

                    {/* Account Info */}
                    <div className="text-center text-white space-y-2">
                        <p className="text-lg font-bold">{SHAM_CASH_NAME}</p>
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md px-4 py-3 rounded-xl border border-white/20">
                            <code className="text-sm font-mono text-cyan-300 select-all flex-1" dir="ltr">
                                {SHAM_CASH_CODE}
                            </code>
                            <button
                                onClick={copyCode}
                                className="px-3 py-1 bg-cyan-500 hover:bg-cyan-400 text-white text-sm font-bold rounded-lg transition-all active:scale-95"
                            >
                                {copied ? '✓ تم النسخ' : 'نسخ'}
                            </button>
                        </div>
                    </div>

                    {/* Cost Badge */}
                    <div className="flex items-baseline gap-2 text-white mt-2">
                        <span className="text-4xl font-black">{cost}</span>
                        <span className="text-xl font-bold opacity-80">ل.س</span>
                    </div>
                </div>
            </div>

            {/* Upload Proof Section */}
            <div className="bg-white border-2 border-dashed border-gray-200 rounded-2xl p-6 space-y-4">
                <div className="text-center">
                    <h3 className="text-lg font-bold text-gray-800">📸 رفع إثبات الدفع</h3>
                    <p className="text-sm text-gray-500">التقط صورة للإيصال أو لقطة شاشة من التطبيق</p>
                </div>

                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                    id="proof-upload"
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
                                width={400}
                                height={300}
                                className="w-full max-h-60 object-contain rounded-xl border border-gray-200"
                            />
                            <button
                                onClick={removeProof}
                                className="absolute top-2 left-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all"
                            >
                                ✕
                            </button>
                            <div className="mt-2 text-center text-sm text-green-600 font-medium">
                                ✓ تم اختيار الصورة
                            </div>
                        </motion.div>
                    ) : (
                        <motion.label
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            htmlFor="proof-upload"
                            className={`flex flex-col items-center justify-center py-8 cursor-pointer rounded-xl transition-all ${showProofRequired
                                ? 'bg-red-50 border-2 border-red-300'
                                : 'bg-gray-50 hover:bg-gray-100'
                                }`}
                        >
                            <div className="text-4xl mb-2">📤</div>
                            <span className="font-bold text-gray-700">اضغط لاختيار صورة</span>
                            <span className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG</span>
                            {showProofRequired && (
                                <motion.p
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="text-red-500 font-bold mt-3 text-sm"
                                >
                                    ⚠️ يجب رفع إثبات الدفع للمتابعة
                                </motion.p>
                            )}
                        </motion.label>
                    )}
                </AnimatePresence>
            </div>

            {/* Action Buttons */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <button
                        onClick={onBack}
                        className="flex-1 py-5 rounded-2xl border-2 border-gray-100 text-gray-400 font-bold text-lg hover:border-gray-300 hover:text-gray-600 transition-all active:scale-[0.98]"
                    >
                        رجوع
                    </button>
                    <button
                        onClick={handlePayment}
                        disabled={isProcessing}
                        className={`flex-[2] py-5 rounded-2xl font-bold text-xl transition-all shadow-xl active:scale-[0.98] flex items-center justify-center gap-3 ${paymentProof
                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20'
                            : 'bg-primary hover:bg-primary-dark text-white shadow-primary/20'
                            }`}
                    >
                        {isProcessing ? (
                            <>
                                <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>جاري المعالجة...</span>
                            </>
                        ) : (
                            <>
                                <span>{paymentProof ? 'تأكيد الدفع والتحميل' : 'متابعة'}</span>
                                <span className="text-2xl">{paymentProof ? '✅' : '💳'}</span>
                            </>
                        )}
                    </button>
                </div>

                {status && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-center py-4 px-6 bg-primary/5 rounded-2xl border-2 border-primary/10"
                    >
                        <p className="text-lg font-bold text-primary">{status}</p>
                    </motion.div>
                )}

                <p className="text-center text-sm text-gray-400 font-medium">
                    سيتم تحويلك إلى صفحة المعاينة والتحميل فور نجاح العملية
                </p>
            </div>
        </div>
    );
}
