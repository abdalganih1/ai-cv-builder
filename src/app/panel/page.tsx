'use client';

export const runtime = 'edge';

import { useEffect, useState } from 'react';

type Tab = 'dashboard' | 'sessions' | 'settings';

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

export default function AdminPanel() {
    const [tab, setTab] = useState<Tab>('dashboard');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/analytics/sessions?limit=50')
            .then(res => res.json())
            .then(data => setSessions(data.data || []))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [tab]);

    if (loading) {
        return <div className="min-h-screen bg-gray-900 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-blue-500 rounded-full animate-spin" />
        </div>;
    }

    return (
        <div className="min-h-screen bg-gray-900" dir="rtl">
            <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xl font-bold text-white">📊 لوحة التحكم</span>
                        <nav className="flex gap-1 mr-4">
                            {(['dashboard', 'sessions', 'settings'] as Tab[]).map(t => (
                                <button key={t} onClick={() => setTab(t)}
                                    className={`px-3 py-1 rounded ${tab === t ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                                    {t === 'dashboard' ? 'الرئيسية' : t === 'sessions' ? 'الجلسات' : '⚙️'}
                                </button>
                            ))}
                        </nav>
                    </div>
                    <a href="/" className="text-gray-400 hover:text-white text-sm">الموقع ←</a>
                </div>
            </header>

            <main className="max-w-7xl mx-auto p-4">
                {tab === 'dashboard' && <DashboardTab sessions={sessions} />}
                {tab === 'sessions' && <SessionsTab sessions={sessions} />}
                {tab === 'settings' && <SettingsTab />}
            </main>
        </div>
    );
}

function DashboardTab({ sessions }: { sessions: Session[] }) {
    const activeCount = sessions.filter(s => s.isActive).length;
    const paymentCount = sessions.filter(s => s.paymentProofUrl).length;
    const completedCount = sessions.filter(s => s.maxStepReached >= 4).length;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon="📈" label="الجلسات" value={sessions.length} />
                <StatCard icon="🟢" label="نشطة" value={activeCount} />
                <StatCard icon="💳" label="مدفوعات" value={paymentCount} />
                <StatCard icon="✅" label="مكتمل" value={completedCount} />
            </div>

            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                <h2 className="text-lg font-bold text-white mb-4">آخر الجلسات</h2>
                <div className="space-y-2">
                    {sessions.slice(0, 5).map(s => (
                        <div key={s.id} className="flex items-center justify-between p-2 bg-gray-700/50 rounded">
                            <span className="text-white font-mono text-sm">{s.ip?.substring(0, 15)}</span>
                            <span className="text-gray-400 text-sm">خطوة {s.maxStepReached + 1}/5</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function StatCard({ icon, label, value }: { icon: string; label: string; value: number }) {
    return (
        <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <span className="text-2xl">{icon}</span>
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-gray-400 text-sm">{label}</p>
        </div>
    );
}

function SessionsTab({ sessions }: { sessions: Session[] }) {
    return (
        <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
            <h2 className="text-lg font-bold text-white p-4 border-b border-gray-700">الجلسات ({sessions.length})</h2>
            <table className="w-full">
                <thead className="bg-gray-700">
                    <tr>
                        <th className="p-2 text-right text-gray-300">IP</th>
                        <th className="p-2 text-right text-gray-300">الدولة</th>
                        <th className="p-2 text-right text-gray-300">الخطوة</th>
                        <th className="p-2 text-right text-gray-300">الحالة</th>
                    </tr>
                </thead>
                <tbody>
                    {sessions.map(s => (
                        <tr key={s.id} className="border-t border-gray-700">
                            <td className="p-2 text-white font-mono text-sm">{s.ip?.substring(0, 15)}</td>
                            <td className="p-2 text-gray-300">{s.country || '-'}</td>
                            <td className="p-2 text-white">{s.maxStepReached + 1}/5</td>
                            <td className="p-2">
                                <span className={`px-2 py-1 rounded text-xs ${s.isActive ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'}`}>
                                    {s.isActive ? 'نشط' : 'منتهي'}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function SettingsTab() {
    const [type, setType] = useState('donation');
    const [price, setPrice] = useState(5);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('cv_payment_settings');
        if (saved) {
            const p = JSON.parse(saved);
            setType(p.paymentType || 'donation');
            setPrice(p.price || 5);
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('cv_payment_settings', JSON.stringify({ paymentType: type, price }));
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="max-w-md mx-auto space-y-4">
            <h2 className="text-lg font-bold text-white">الإعدادات</h2>
            
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
                <div>
                    <label className="block text-gray-300 mb-2">نوع الدفع</label>
                    <select value={type} onChange={e => setType(e.target.value)}
                        className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600">
                        <option value="disabled">معطل (بدون دفع)</option>
                        <option value="donation">تبرع (اختياري)</option>
                        <option value="mandatory">إلزامي (مطلوب للتصدير)</option>
                    </select>
                </div>
                
                <div>
                    <label className="block text-gray-300 mb-2">السعر (USD)</label>
                    <input type="number" value={price} onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                        className="w-full p-2 bg-gray-700 text-white rounded border border-gray-600" />
                </div>

                <button onClick={handleSave}
                    className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded font-bold">
                    {saved ? '✅ تم الحفظ' : 'حفظ'}
                </button>
            </div>
        </div>
    );
}
