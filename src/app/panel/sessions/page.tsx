'use client';

export const runtime = 'edge';


/**
 * Sessions List Page
 * صفحة عرض جميع الجلسات مع فلترة
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Session } from '@/lib/analytics/types';

export default function SessionsPage() {
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState({
        search: '',
        paymentStatus: '',
        minStep: '',
        isActive: '',
    });

    useEffect(() => {
        fetchSessions();
    }, []);

    async function fetchSessions() {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (filter.search) params.set('search', filter.search);
            if (filter.paymentStatus) params.set('paymentStatus', filter.paymentStatus);
            if (filter.minStep) params.set('minStep', filter.minStep);
            if (filter.isActive) params.set('isActive', filter.isActive);

            const res = await fetch(`/api/analytics/sessions?${params.toString()}`);
            const data = await res.json();
            setSessions(data.data || []);
        } catch (error) {
            console.error('Failed to fetch sessions:', error);
        } finally {
            setLoading(false);
        }
    }

    const getStatusBadge = (session: Session) => {
        if (session.isActive) {
            return <span className="px-2 py-1 text-xs rounded-full bg-green-500/20 text-green-400">نشط</span>;
        }
        if (session.paymentStatus === 'uploaded') {
            return <span className="px-2 py-1 text-xs rounded-full bg-yellow-500/20 text-yellow-400">دفع مرفق</span>;
        }
        if (session.maxStepReached >= 4) {
            return <span className="px-2 py-1 text-xs rounded-full bg-blue-500/20 text-blue-400">مكتمل</span>;
        }
        return <span className="px-2 py-1 text-xs rounded-full bg-gray-500/20 text-gray-400">منتهي</span>;
    };

    const formatDate = (date: string) => {
        return new Date(date).toLocaleDateString('ar-SY', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">👥 جميع الجلسات</h1>
                    <p className="text-gray-400 mt-1">{sessions.length} جلسة</p>
                </div>
                <button
                    onClick={fetchSessions}
                    className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition flex items-center gap-2"
                >
                    <span>🔄</span>
                    <span>تحديث</span>
                </button>
            </div>

            {/* Filters */}
            <div className="bg-gray-800 rounded-xl p-4 border border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-gray-400 text-sm mb-1 block">بحث بالـ IP</label>
                        <input
                            type="text"
                            value={filter.search}
                            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
                            placeholder="192.168..."
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div>
                        <label className="text-gray-400 text-sm mb-1 block">حالة الدفع</label>
                        <select
                            value={filter.paymentStatus}
                            onChange={(e) => setFilter({ ...filter, paymentStatus: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">الكل</option>
                            <option value="pending">قيد الانتظار</option>
                            <option value="uploaded">مرفق</option>
                            <option value="verified">مُتحقق</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-gray-400 text-sm mb-1 block">الحد الأدنى للخطوة</label>
                        <select
                            value={filter.minStep}
                            onChange={(e) => setFilter({ ...filter, minStep: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">الكل</option>
                            <option value="1">Contact+</option>
                            <option value="2">Questionnaire+</option>
                            <option value="3">Payment+</option>
                            <option value="4">Preview</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-gray-400 text-sm mb-1 block">الحالة</label>
                        <select
                            value={filter.isActive}
                            onChange={(e) => setFilter({ ...filter, isActive: e.target.value })}
                            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none"
                        >
                            <option value="">الكل</option>
                            <option value="true">نشط</option>
                            <option value="false">منتهي</option>
                        </select>
                    </div>
                </div>

                <button
                    onClick={fetchSessions}
                    className="mt-4 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                    تطبيق الفلتر
                </button>
            </div>

            {/* Sessions Table */}
            <div className="bg-gray-800 rounded-xl border border-gray-700 overflow-hidden">
                {loading ? (
                    <div className="p-8 text-center">
                        <div className="w-8 h-8 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto" />
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="p-8 text-center text-gray-400">
                        لا توجد جلسات تطابق المعايير
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-900">
                                <tr>
                                    <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">الحالة</th>
                                    <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">IP</th>
                                    <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">البلد</th>
                                    <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">الخطوة</th>
                                    <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">بدء الجلسة</th>
                                    <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">آخر نشاط</th>
                                    <th className="px-4 py-3 text-right text-gray-400 text-sm font-medium">الدفع</th>
                                    <th className="px-4 py-3"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-700">
                                {sessions.map((session) => (
                                    <tr key={session.id} className="hover:bg-gray-700/50 transition">
                                        <td className="px-4 py-3">{getStatusBadge(session)}</td>
                                        <td className="px-4 py-3 font-mono text-white text-sm">{session.ip}</td>
                                        <td className="px-4 py-3 text-gray-300">{session.country || '-'}</td>
                                        <td className="px-4 py-3">
                                            <span className="text-white">{session.maxStepReached + 1}</span>
                                            <span className="text-gray-500">/5</span>
                                        </td>
                                        <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(session.startedAt)}</td>
                                        <td className="px-4 py-3 text-gray-300 text-sm">{formatDate(session.lastActivity)}</td>
                                        <td className="px-4 py-3">
                                            {session.paymentProofUrl ? (
                                                <span className="text-green-400">💳</span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <Link
                                                href={`/panel/sessions/${session.id}`}
                                                className="text-blue-400 hover:text-blue-300 transition"
                                            >
                                                تفاصيل ←
                                            </Link>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
