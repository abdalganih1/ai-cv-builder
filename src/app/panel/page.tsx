'use client';

/**
 * Admin Dashboard - الصفحة الرئيسية
 * تعرض إحصائيات عامة وآخر الجلسات
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { DashboardStats, Session } from '@/lib/analytics/types';

interface StatsCardProps {
    icon: string;
    label: string;
    value: number | string;
    color: string;
    subtext?: string;
}

function StatsCard({ icon, label, value, color, subtext }: StatsCardProps) {
    return (
        <div className={`bg-gray-800 rounded-xl p-6 border border-gray-700 hover:border-${color}-500/50 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-4">
                <span className="text-3xl">{icon}</span>
                <span className={`text-xs px-2 py-1 rounded-full bg-${color}-500/20 text-${color}-400`}>
                    {subtext || 'إجمالي'}
                </span>
            </div>
            <p className="text-3xl font-bold text-white mb-1">{value}</p>
            <p className="text-gray-400 text-sm">{label}</p>
        </div>
    );
}

function SessionRow({ session }: { session: Session }) {
    const getStatusColor = () => {
        if (session.isActive) return 'bg-green-500';
        if (session.paymentStatus === 'uploaded') return 'bg-yellow-500';
        if (session.maxStepReached >= 4) return 'bg-blue-500';
        return 'bg-gray-500';
    };

    const getStepLabel = (step: number) => {
        const labels = ['Welcome', 'Contact', 'Questionnaire', 'Payment', 'Preview'];
        return labels[step] || `Step ${step}`;
    };

    const formatTime = (date: string) => {
        return new Date(date).toLocaleTimeString('ar-SY', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <Link
            href={`/panel/sessions/${session.id}`}
            className="flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-700/50 rounded-lg border border-gray-700 hover:border-gray-600 transition group"
        >
            <div className="flex items-center gap-4">
                <div className={`w-3 h-3 rounded-full ${getStatusColor()}`} />
                <div>
                    <p className="text-white font-medium font-mono text-sm">
                        {session.ip.substring(0, 15)}...
                    </p>
                    <p className="text-gray-500 text-xs">{session.country || 'Unknown'}</p>
                </div>
            </div>

            <div className="flex items-center gap-6">
                <div className="text-center">
                    <p className="text-white text-sm">{getStepLabel(session.maxStepReached)}</p>
                    <p className="text-gray-500 text-xs">Step {session.maxStepReached + 1}/5</p>
                </div>

                <div className="text-center">
                    <p className="text-white text-sm">{formatTime(session.lastActivity)}</p>
                    <p className="text-gray-500 text-xs">آخر نشاط</p>
                </div>

                {session.paymentProofUrl && (
                    <span className="text-green-400 text-xl" title="أرسل إثبات الدفع">💳</span>
                )}

                <span className="text-gray-400 group-hover:text-white transition">←</span>
            </div>
        </Link>
    );
}

export default function AdminDashboard() {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [recentSessions, setRecentSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const [statsRes, sessionsRes] = await Promise.all([
                    fetch('/api/analytics/stats'),
                    fetch('/api/analytics/sessions?limit=10'),
                ]);

                if (!statsRes.ok || !sessionsRes.ok) {
                    throw new Error('Failed to fetch data');
                }

                const statsData = await statsRes.json();
                const sessionsData = await sessionsRes.json();

                setStats(statsData.data);
                setRecentSessions(sessionsData.data || []);
            } catch (err) {
                setError(err instanceof Error ? err.message : 'Unknown error');
            } finally {
                setLoading(false);
            }
        }

        fetchData();

        // تحديث كل 30 ثانية
        const interval = setInterval(fetchData, 30000);
        return () => clearInterval(interval);
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="bg-red-500/10 border border-red-500/50 rounded-xl p-6 text-center">
                <p className="text-red-400 text-lg">خطأ: {error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition"
                >
                    إعادة المحاولة
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">📊 لوحة التحكم</h1>
                    <p className="text-gray-400 mt-1">تحليلات وإحصائيات الموقع</p>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span>تحديث مباشر</span>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatsCard
                    icon="📈"
                    label="إجمالي الجلسات"
                    value={stats?.totalSessions || 0}
                    color="blue"
                />
                <StatsCard
                    icon="🟢"
                    label="جلسات نشطة"
                    value={stats?.activeSessions || 0}
                    color="green"
                    subtext="الآن"
                />
                <StatsCard
                    icon="💳"
                    label="إثباتات الدفع"
                    value={stats?.paymentUploads || 0}
                    color="yellow"
                />
                <StatsCard
                    icon="✅"
                    label="أكملوا النموذج"
                    value={stats?.completedForms || 0}
                    color="emerald"
                />
            </div>

            {/* Conversion Rate */}
            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-bold text-white">معدل التحويل</h2>
                    <span className="text-2xl font-bold text-blue-400">
                        {stats?.conversionRate?.toFixed(1) || 0}%
                    </span>
                </div>
                <div className="w-full bg-gray-700 rounded-full h-3">
                    <div
                        className="bg-gradient-to-r from-blue-500 to-blue-400 h-3 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(stats?.conversionRate || 0, 100)}%` }}
                    />
                </div>
                <p className="text-gray-400 text-sm mt-2">
                    نسبة الزوار الذين أكملوا جميع الخطوات
                </p>
            </div>

            {/* Step Dropoffs */}
            {stats?.stepDropoffs && Object.keys(stats.stepDropoffs).length > 0 && (
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4">توزيع الخطوات</h2>
                    <div className="flex items-end justify-between gap-2 h-32">
                        {[0, 1, 2, 3, 4].map((step) => {
                            const count = stats.stepDropoffs[step] || 0;
                            const maxCount = Math.max(...Object.values(stats.stepDropoffs), 1);
                            const height = (count / maxCount) * 100;
                            const labels = ['Welcome', 'Contact', 'Questionnaire', 'Payment', 'Preview'];

                            return (
                                <div key={step} className="flex-1 flex flex-col items-center gap-2">
                                    <span className="text-white text-sm font-medium">{count}</span>
                                    <div
                                        className="w-full bg-blue-500 rounded-t transition-all duration-500"
                                        style={{ height: `${Math.max(height, 5)}%` }}
                                    />
                                    <span className="text-gray-400 text-xs text-center">{labels[step]}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Recent Sessions */}
            <div className="bg-gray-800/50 rounded-xl border border-gray-700">
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">آخر الجلسات</h2>
                    <Link
                        href="/panel/sessions"
                        className="text-blue-400 hover:text-blue-300 text-sm transition"
                    >
                        عرض الكل ←
                    </Link>
                </div>
                <div className="p-4 space-y-3">
                    {recentSessions.length === 0 ? (
                        <p className="text-gray-400 text-center py-8">لا توجد جلسات بعد</p>
                    ) : (
                        recentSessions.map((session) => (
                            <SessionRow key={session.id} session={session} />
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
