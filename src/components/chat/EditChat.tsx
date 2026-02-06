"use client";

/**
 * EditChat with Message History
 * محرر الذكاء الاصطناعي مع حفظ تاريخ المحادثة
 */

import { useState, useEffect, useRef } from 'react';
import { CVData } from '@/lib/types/cv-schema';
import { processEditRequest } from '@/lib/ai/chat-editor';
import { motion, AnimatePresence } from 'framer-motion';

interface EditChatProps {
    data: CVData;
    onUpdate: (newData: CVData) => void;
}

interface ChatMessage {
    id: string;
    type: 'user' | 'assistant' | 'error';
    content: string;
    timestamp: Date;
}

// توليد معرف فريد
const generateId = () => Math.random().toString(36).substring(2, 9);

export default function EditChat({ data, onUpdate }: EditChatProps) {
    const [input, setInput] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // تحميل الرسائل من localStorage عند البداية
    useEffect(() => {
        const saved = localStorage.getItem('cv_editor_messages');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setMessages(parsed.map((m: ChatMessage) => ({
                    ...m,
                    timestamp: new Date(m.timestamp)
                })));
            } catch (e) {
                console.error('Failed to parse saved messages:', e);
            }
        }
    }, []);

    // حفظ الرسائل في localStorage عند كل تغيير
    useEffect(() => {
        if (messages.length > 0) {
            localStorage.setItem('cv_editor_messages', JSON.stringify(messages));
        }
    }, [messages]);

    // التمرير لآخر رسالة
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const addMessage = (type: ChatMessage['type'], content: string) => {
        const newMessage: ChatMessage = {
            id: generateId(),
            type,
            content,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, newMessage]);
        return newMessage;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim() || isProcessing) return;

        const userMsg = input;
        // لا نمسح الـ input فوراً - نحتفظ به
        setIsProcessing(true);

        // أضف رسالة المستخدم للتاريخ
        addMessage('user', userMsg);

        // الآن نمسح الـ input بعد حفظ الرسالة
        setInput('');

        try {
            const updatedCV = await processEditRequest(data, userMsg);
            onUpdate(updatedCV);
            addMessage('assistant', 'تم تطبيق التعديلات بنجاح ✨');
        } catch (error) {
            console.error(error);
            // حتى في حالة الخطأ، الرسالة محفوظة!
            addMessage('error', 'عذراً، حدث خطأ. النص الأصلي محفوظ في التاريخ أعلاه.');
        } finally {
            setIsProcessing(false);
        }
    };

    const deleteMessage = (id: string) => {
        setMessages(prev => prev.filter(m => m.id !== id));
    };

    const copyToInput = (content: string) => {
        setInput(content);
    };

    const clearHistory = () => {
        if (confirm('هل تريد حذف كل تاريخ المحادثة؟')) {
            setMessages([]);
            localStorage.removeItem('cv_editor_messages');
        }
    };

    return (
        <div className="flex flex-col gap-4 py-4">
            {/* تاريخ المحادثة */}
            {messages.length > 0 && (
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-bold text-gray-500">📜 تاريخ الطلبات</span>
                        <button
                            onClick={clearHistory}
                            className="text-xs text-red-400 hover:text-red-600 transition"
                        >
                            مسح الكل
                        </button>
                    </div>

                    <div className="max-h-48 overflow-y-auto space-y-2 p-2 bg-gray-50 rounded-xl border border-gray-100">
                        <AnimatePresence>
                            {messages.map((msg) => (
                                <motion.div
                                    key={msg.id}
                                    initial={{ opacity: 0, y: 5 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, x: -20 }}
                                    className={`group p-3 rounded-lg text-sm ${msg.type === 'user'
                                            ? 'bg-white border border-gray-200'
                                            : msg.type === 'error'
                                                ? 'bg-red-50 border border-red-200 text-red-600'
                                                : 'bg-green-50 border border-green-200 text-green-700'
                                        }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-xs">
                                                    {msg.type === 'user' ? '👤' : msg.type === 'error' ? '⚠️' : '✨'}
                                                </span>
                                                <span className="text-xs text-gray-400">
                                                    {msg.timestamp.toLocaleTimeString('ar-SY')}
                                                </span>
                                            </div>
                                            <p className="text-gray-700 whitespace-pre-wrap">{msg.content}</p>
                                        </div>

                                        {msg.type === 'user' && (
                                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                                <button
                                                    onClick={() => copyToInput(msg.content)}
                                                    className="p-1 text-gray-400 hover:text-primary text-xs"
                                                    title="نسخ للتحرير"
                                                >
                                                    📋
                                                </button>
                                                <button
                                                    onClick={() => deleteMessage(msg.id)}
                                                    className="p-1 text-gray-400 hover:text-red-500 text-xs"
                                                    title="حذف"
                                                >
                                                    ✕
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </motion.div>
                            ))}
                        </AnimatePresence>
                        <div ref={messagesEndRef} />
                    </div>
                </div>
            )}

            {/* مربع الإدخال */}
            <div className="space-y-3">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        className="w-full p-4 text-sm border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none min-h-[120px] transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-400"
                        placeholder='مثال: "اجعل الخبرات العملية تظهر أولاً" أو "أضف مهارة الذكاء الاصطناعي"'
                        disabled={isProcessing}
                    />
                    <div className="absolute bottom-3 left-3 flex items-center gap-2">
                        {isProcessing ? (
                            <span className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin block" />
                        ) : (
                            <span className="text-gray-300 text-xs">AI Editor</span>
                        )}
                    </div>

                    {/* مؤشر الحفظ */}
                    <div className="absolute bottom-3 right-3">
                        <span className="text-xs text-gray-300">
                            {input.length > 0 && '💾 سيتم حفظ الطلب'}
                        </span>
                    </div>
                </div>

                <button
                    onClick={handleSubmit}
                    disabled={isProcessing || !input}
                    className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
                >
                    {isProcessing ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>جاري المعالجة...</span>
                        </>
                    ) : (
                        <>
                            <span>تطبيق التعديلات</span>
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                        </>
                    )}
                </button>

                {/* تلميحات */}
                <p className="text-xs text-gray-400 text-center">
                    💡 جميع طلباتك محفوظة حتى في حالة الخطأ - يمكنك نسخها وتعديلها
                </p>
            </div>
        </div>
    );
}
