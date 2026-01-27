"use client";

import { CVData } from '@/lib/types/cv-schema';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { generateProfessionalCV } from '@/lib/ai/chat-editor';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
    onBack: () => void;
}

export default function ShamCashPayment({ data, onNext, onBack }: StepProps) {
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string>('');
    const cost = 500; // Fixed cost as per requirements

    const handlePayment = async () => {
        setIsProcessing(true);
        setStatus('جاري معالجة الدفع...');

        // Simulate API call to Sham Cash gateway
        await new Promise(resolve => setTimeout(resolve, 1500));
        setStatus('تم الدفع بنجاح! ✅');

        // Now trigger AI to generate professional CV
        setStatus('🧠 الذكاء الاصطناعي يعمل على تحسين سيرتك الذاتية...');

        try {
            const enhancedData = await generateProfessionalCV(data);
            setStatus('✨ تم إنشاء السيرة الذاتية الاحترافية بنجاح!');

            await new Promise(resolve => setTimeout(resolve, 1000));

            // On success - pass enhanced data
            onNext({
                ...enhancedData,
                metadata: {
                    ...data.metadata,
                    paymentStatus: 'completed'
                }
            });
        } catch (error) {
            console.error("AI Enhancement failed:", error);
            setStatus('⚠️ تعذّر تحسين السيرة الذاتية، سننتقل للنسخة الأساسية...');
            await new Promise(resolve => setTimeout(resolve, 1500));

            // Fallback to original data
            onNext({
                metadata: {
                    ...data.metadata,
                    paymentStatus: 'completed'
                }
            });
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="w-full max-w-xl mx-auto space-y-10 py-6">
            <div className="text-center space-y-3">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">بوابة الدفع الآمنة</h2>
                <p className="text-lg text-gray-500 font-medium">خطوة أخيرة لتجهيز سيرتك الذاتية للاحتراف</p>
                <div className="flex justify-center">
                    <div className="h-1.5 w-16 bg-accent rounded-full"></div>
                </div>
            </div>

            <div className="bg-gradient-to-br from-primary to-primary-dark p-8 rounded-[2rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute -right-10 -top-10 w-40 h-40 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-700"></div>

                <div className="relative z-10 flex justify-between items-end">
                    <div className="space-y-1">
                        <span className="text-blue-200 font-medium block">المبلغ المستحق</span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-5xl font-black">{cost}</span>
                            <span className="text-xl font-bold opacity-80">ل.س</span>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-bold border border-white/20 inline-block">
                            شام كاش | Sham Cash
                        </div>
                    </div>
                </div>

                <div className="mt-8 pt-8 border-t border-white/10 flex justify-between items-center text-sm font-medium text-blue-100">
                    <span>خدمة إنشاء السيرة الذاتية بالذكاء الاصطناعي</span>
                    <span className="bg-green-400 w-2 h-2 rounded-full animate-ping"></span>
                </div>
            </div>

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
                        className="flex-[2] bg-primary text-white py-5 rounded-2xl font-bold text-xl hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-3"
                    >
                        {isProcessing ? (
                            <>
                                <span className="w-6 h-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                <span>جاري المعالجة...</span>
                            </>
                        ) : (
                            <>
                                <span>تأكيد الدفع والتحميل</span>
                                <span className="text-2xl">💳</span>
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
