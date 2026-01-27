"use client";

import { useState } from 'react';
import { CVData } from '@/lib/types/cv-schema';
import { processEditRequest } from '@/lib/ai/chat-editor';
import { motion } from 'framer-motion';

interface EditChatProps {
    data: CVData;
    onUpdate: (newData: CVData) => void;
}

export default function EditChat({ data, onUpdate }: EditChatProps) {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [status, setStatus] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        const userMsg = input;
        setInput('');
        setIsProcessing(true);
        setStatus('جاري معالجة طلبك وتحديث السيرة الذاتية...');

        try {
            const updatedCV = await processEditRequest(data, userMsg);
            onUpdate(updatedCV);
            setStatus('تم تطبيق التعديلات بنجاح ✨');
            setTimeout(() => setStatus(null), 3000);
        } catch (error) {
            console.error(error);
            setStatus('عذراً، حدث خطأ. حاول صياغة الطلب بشكل أوضح.');
        } finally {
            setIsProcessing(false);
        }
    };

    return (
        <div className="flex flex-col gap-6 py-4">
            <div className="space-y-4">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full p-4 text-sm border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none min-h-[120px] transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-400"
                        placeholder='مثال: "اجعل الخبرات العملية تظهر أولاً" أو "أضف مهارة الذكاء الاصطناعي"'
                        disabled={isProcessing}
                    />
                    <div className="absolute bottom-3 left-3">
                        {isProcessing ? (
                            <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin block" />
                        ) : (
                            <span className="text-gray-300 text-xs">AI Editor</span>
                        )}
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isProcessing || !input}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                    <span>تطبيق التعديلات</span>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
            </div>

            {status && (
                <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-3 rounded-lg text-xs font-bold text-center ${status.includes('خطأ') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}
                >
                    {status}
                </motion.div>
            )}
        </div>
    );
}
