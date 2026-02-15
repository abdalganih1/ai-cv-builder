'use client';

export const runtime = 'edge';

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
    paymentStatus?: string;
}

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/sessions?limit=50')
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
            <div className="flex items-center gap-4">
                <Link href="/panel" className="text-gray-400 hover:text-white">← العودة</Link>
                <h1 className="text-2xl font-bold text-white">الجلسات</h1>
            </div>

            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                <table className="w-full">
                    <thead className="bg-gray-700">
                        <tr>
                            <th className="p-3 text-right text-gray-300">IP</th>
                            <th className="p-3 text-right text-gray-300">الدولة</th>
                            <th className="p-3 text-right text-gray-300">الخطوة</th>
                            <th className="p-3 text-right text-gray-300">الحالة</th>
                            <th className="p-3 text-right text-gray-300">الدفع</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sessions.map(s => (
                            <tr key={s.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                                <td className="p-3">
                                    <Link href={`/panel/sessions/${s.id}`} className="text-blue-400 hover:underline font-mono">
                                        {s.ip?.substring(0, 15)}
                                    </Link>
                                </td>
                                <td className="p-3 text-gray-300">{s.country || '-'}</td>
                                <td className="p-3 text-white">{s.maxStepReached + 1}/5</td>
                                <td className="p-3">
                                    <span className={`px-2 py-1 rounded text-xs ${s.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                        {s.isActive ? 'نشط' : 'منتهي'}
                                    </span>
                                </td>
                                <td className="p-3">
                                    {s.paymentProofUrl && (
                                        <span className={`px-2 py-1 rounded text-xs ${
                                            s.paymentStatus === 'verified' ? 'bg-green-500/20 text-green-400' :
                                            s.paymentStatus === 'rejected' ? 'bg-red-500/20 text-red-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                            {s.paymentStatus === 'verified' ? 'مُتحقق' : s.paymentStatus === 'rejected' ? 'مرفوض' : 'قيد المراجعة'}
                                        </span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                
                {sessions.length === 0 && (
                    <p className="text-gray-400 text-center py-8">لا توجد جلسات</p>
                )}
            </div>
        </div>
    );
}
