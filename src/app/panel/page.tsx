'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface Session {
    id: string;
    ip: string;
    country?: string;
    maxStepReached: number;
    lastActivity: string;
    paymentProofUrl?: string;
    isActive: boolean;
}

export default function AdminDashboard() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/sessions?limit=10')
            .then(res => res.json())
            .then(data => {
                setSessions(data.data || []);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="flex justify-center p-8"><div className="w-8 h-8 border-2 border-blue-500 rounded-full animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 p-4">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-white">لوحة التحكم</h1>
                <Link href="/" className="text-blue-400 hover:underline">الموقع</Link>
            </div>

            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">آخر الجلسات</h2>
                    <Link href="/panel/sessions" className="text-blue-400 text-sm">عرض الكل</Link>
                </div>
                
                <div className="space-y-2">
                    {sessions.length === 0 ? (
                        <p className="text-gray-400 text-center py-4">لا توجد جلسات</p>
                    ) : (
                        sessions.map(s => (
                            <Link key={s.id} href={`/panel/sessions/${s.id}`}
                                className="flex items-center justify-between p-3 bg-gray-700/50 hover:bg-gray-700 rounded-lg">
                                <div>
                                    <p className="text-white font-mono text-sm">{s.ip?.substring(0, 15)}</p>
                                    <p className="text-gray-400 text-xs">{s.country || 'غير معروف'}</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-white text-sm">الخطوة {s.maxStepReached + 1}/5</p>
                                    <div className={`w-2 h-2 rounded-full ${s.isActive ? 'bg-green-500' : 'bg-gray-500'}`} />
                                </div>
                            </Link>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
