'use client';

export const runtime = 'edge';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

interface SessionData {
    session: {
        id: string;
        ip: string;
        country?: string;
        city?: string;
        maxStepReached: number;
        startedAt: string;
        lastActivity: string;
        paymentProofUrl?: string;
        paymentStatus?: string;
        isActive: boolean;
        formData?: Record<string, unknown>;
    };
    events: Array<{
        id: string;
        eventType: string;
        timestamp: string;
        stepIndex?: number;
        eventData?: Record<string, unknown>;
    }>;
}

const eventIcons: Record<string, string> = {
    page_view: '👁️', step_view: '📍', step_complete: '✅', form_field_fill: '✏️',
    button_click: '👆', file_upload: '📎', payment_proof_upload: '💳',
    session_start: '🚀', session_end: '🏁', error: '❌',
};

export default function SessionDetailPage() {
    const params = useParams();
    const sessionId = params.id as string;
    const [data, setData] = useState<SessionData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch(`/api/analytics/sessions/${sessionId}`)
            .then(res => res.json())
            .then(json => setData(json.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [sessionId]);

    if (loading) return <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-blue-500 rounded-full animate-spin" /></div>;
    if (!data) return <div className="p-4 text-red-400">الجلسة غير موجودة</div>;

    const { session, events } = data;

    return (
        <div className="space-y-6 p-4">
            <div className="flex items-center gap-4">
                <Link href="/panel/sessions" className="text-gray-400 hover:text-white">← العودة</Link>
                <h1 className="text-xl font-bold text-white">جلسة: {session.id.substring(0, 8)}...</h1>
                <span className={`px-2 py-1 rounded text-xs ${session.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                    {session.isActive ? 'نشط' : 'منتهي'}
                </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">معلومات</h3>
                    <p className="text-white font-mono">{session.ip}</p>
                    <p className="text-gray-300">{session.country || '-'} {session.city && `- ${session.city}`}</p>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">التقدم</h3>
                    <p className="text-white text-xl font-bold">{session.maxStepReached + 1}/5</p>
                    <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                        <div className="bg-blue-500 h-2 rounded-full" style={{ width: `${((session.maxStepReached + 1) / 5) * 100}%` }} />
                    </div>
                </div>
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-gray-400 text-sm mb-2">آخر نشاط</h3>
                    <p className="text-white">{new Date(session.lastActivity).toLocaleString('ar-SY')}</p>
                </div>
            </div>

            {session.paymentProofUrl && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-white font-bold mb-2">💳 إثبات الدفع</h3>
                    <img src={session.paymentProofUrl} alt="Payment" className="max-w-md rounded-lg" />
                </div>
            )}

            {session.formData && Object.keys(session.formData).length > 0 && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-white font-bold mb-2">📝 بيانات النموذج</h3>
                    <pre className="text-gray-300 text-sm overflow-auto">{JSON.stringify(session.formData, null, 2)}</pre>
                </div>
            )}

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h3 className="text-white font-bold mb-4">📊 الأحداث ({events.length})</h3>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                    {events.map((e, i) => (
                        <div key={e.id || i} className="flex items-center gap-3 p-2 bg-gray-700/50 rounded">
                            <span>{eventIcons[e.eventType] || '📌'}</span>
                            <span className="text-white">{e.eventType}</span>
                            <span className="text-gray-400 text-xs mr-auto">{new Date(e.timestamp).toLocaleTimeString('ar-SY')}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
