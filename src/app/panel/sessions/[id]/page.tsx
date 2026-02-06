'use client';

/**
 * Session Detail Page
 * صفحة تفاصيل جلسة معينة مع Timeline
 */

export const runtime = 'edge';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import type { Session, AnalyticsEvent } from '@/lib/analytics/types';

interface SessionData {
    session: Session;
    events: AnalyticsEvent[];
}

const eventIcons: Record<string, string> = {
    page_view: '👁️',
    step_view: '📍',
    step_complete: '✅',
    form_field_fill: '✏️',
    button_click: '👆',
    file_upload: '📎',
    pdf_upload: '📄',
    payment_proof_upload: '💳',
    tab_visible: '🔮',
    tab_hidden: '😴',
    page_exit: '🚪',
    session_start: '🚀',
    session_end: '🏁',
    error: '❌',
};

const eventLabels: Record<string, string> = {
    page_view: 'عرض صفحة',
    step_view: 'دخول خطوة',
    step_complete: 'إكمال خطوة',
    form_field_fill: 'ملء حقل',
    button_click: 'نقر زر',
    file_upload: 'رفع ملف',
    pdf_upload: 'رفع PDF',
    payment_proof_upload: 'رفع إثبات دفع',
    tab_visible: 'عودة للمتصفح',
    tab_hidden: 'مغادرة المتصفح',
    page_exit: 'مغادرة الصفحة',
    session_start: 'بدء الجلسة',
    session_end: 'انتهاء الجلسة',
    error: 'خطأ',
};

export default function SessionDetailPage() {
    const params = useParams();
    const sessionId = params.id as string;

    const [data, setData] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchSession() {
            try {
                const res = await fetch(`/api/analytics/sessions/${sessionId}`);
                if (!res.ok) throw new Error('Session not found');
                const json = await res.json();
                setData(json.data);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        if (sessionId) {
            fetchSession();
        }
    }, [sessionId]);

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString('ar-SY', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('ar-SY', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
                <p className="text-red-400 text-lg">{error || 'Session not found'}</p>
                <Link
                    href="/panel/sessions"
                    className="mt-4 inline-block px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition"
                >
                    ← العودة للجلسات
                </Link>
            </div>
        );
    }

    const { session, events } = data;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/panel/sessions"
                        className="text-gray-400 hover:text-white transition text-sm mb-2 block"
                    >
                        ← العودة للجلسات
                    </Link>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-3">
                        <span>👤</span>
                        <span className="font-mono">{session.id.substring(0, 12)}...</span>
                    </h1>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm ${session.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {session.isActive ? '🟢 نشط الآن' : '⚫ منتهي'}
                </div>
            </div>

            {/* Session Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">معلومات الاتصال</h3>
                    <div className="space-y-2">
                        <p className="text-white font-mono">{session.ip}</p>
                        <p className="text-gray-300">{session.country || 'غير معروف'} {session.city && `- ${session.city}`}</p>
                        <p className="text-gray-500 text-xs">{session.userAgent?.substring(0, 50)}...</p>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">التوقيت</h3>
                    <div className="space-y-2">
                        <div>
                            <p className="text-gray-500 text-xs">بدء الجلسة</p>
                            <p className="text-white">{formatDate(session.startedAt)}</p>
                        </div>
                        <div>
                            <p className="text-gray-500 text-xs">آخر نشاط</p>
                            <p className="text-white">{formatDate(session.lastActivity)}</p>
                        </div>
                    </div>
                </div>

                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">التقدم</h3>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <span className="text-gray-400">أعلى خطوة</span>
                            <span className="text-white text-xl font-bold">{session.maxStepReached + 1}/5</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-blue-500 h-2 rounded-full"
                                style={{ width: `${((session.maxStepReached + 1) / 5) * 100}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-xs text-gray-500">
                            <span>Welcome</span>
                            <span>Preview</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Proof */}
            {session.paymentProofUrl && (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <span>💳</span>
                        <span>إثبات الدفع</span>
                    </h3>
                    <div className="bg-gray-900 rounded-lg p-4">
                        <img
                            src={session.paymentProofUrl}
                            alt="Payment Proof"
                            className="max-w-md rounded-lg mx-auto"
                        />
                    </div>
                    <div className="mt-4 flex items-center justify-between">
                        <span className={`px-3 py-1 rounded-full text-sm ${session.paymentStatus === 'verified' ? 'bg-green-500/20 text-green-400' :
                            session.paymentStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                'bg-yellow-500/20 text-yellow-400'
                            }`}>
                            {session.paymentStatus === 'verified' ? '✅ مُتحقق' :
                                session.paymentStatus === 'rejected' ? '❌ مرفوض' :
                                    '⏳ قيد المراجعة'}
                        </span>
                        <a
                            href={session.paymentProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm"
                        >
                            فتح في نافذة جديدة ↗
                        </a>
                    </div>
                </div>
            )}

            {/* Form Data */}
            {session.formData && Object.keys(session.formData).length > 0 && (
                <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                    <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                        <span>📝</span>
                        <span>بيانات النموذج</span>
                    </h3>
                    <div className="bg-gray-900 rounded-lg p-4 overflow-auto">
                        <pre className="text-gray-300 text-sm font-mono whitespace-pre-wrap">
                            {JSON.stringify(session.formData, null, 2)}
                        </pre>
                    </div>
                </div>
            )}

            {/* Events Timeline */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                    <span>📊</span>
                    <span>سجل الأحداث ({events.length})</span>
                </h3>

                {events.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">لا توجد أحداث مسجلة</p>
                ) : (
                    <div className="relative">
                        {/* Timeline line */}
                        <div className="absolute right-6 top-0 bottom-0 w-0.5 bg-gray-700" />

                        <div className="space-y-4">
                            {events.map((event, index) => (
                                <div key={event.id || index} className="relative flex items-start gap-4 pr-8">
                                    {/* Timeline dot */}
                                    <div className="absolute right-4 w-4 h-4 rounded-full bg-gray-800 border-2 border-blue-500 z-10" />

                                    <div className="flex-1 bg-gray-700/50 rounded-lg p-3 mr-4">
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">{eventIcons[event.eventType] || '📌'}</span>
                                                <span className="text-white font-medium">
                                                    {eventLabels[event.eventType] || event.eventType}
                                                </span>
                                            </div>
                                            <span className="text-gray-500 text-sm font-mono">
                                                {formatTime(event.timestamp)}
                                            </span>
                                        </div>

                                        {event.stepIndex !== undefined && (
                                            <p className="text-gray-400 text-sm">
                                                الخطوة: {event.stepIndex + 1}
                                            </p>
                                        )}

                                        {event.eventData && Object.keys(event.eventData).length > 0 && (
                                            <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-800 rounded p-2">
                                                {JSON.stringify(event.eventData)}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
