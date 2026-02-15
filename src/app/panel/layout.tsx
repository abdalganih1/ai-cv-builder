'use client';

export const runtime = 'edge';

import { useEffect, useState } from 'react';
import Link from 'next/link';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [authorized, setAuthorized] = useState(true);

    useEffect(() => {
        if (process.env.NODE_ENV === 'development') return;
        
        const hasCF = document.cookie.includes('CF_Authorization');
        fetch('/api/analytics/stats')
            .then(res => setAuthorized(res.ok || hasCF))
            .catch(() => setAuthorized(hasCF));
    }, []);

    if (!authorized) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 p-8 rounded-xl text-center">
                    <p className="text-4xl mb-4">🔒</p>
                    <p className="text-white text-xl">غير مصرح</p>
                    <a href="/" className="mt-4 inline-block text-blue-400">العودة للموقع</a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900" dir="rtl">
            <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-6">
                        <Link href="/panel" className="text-xl font-bold text-white">📊 لوحة التحكم</Link>
                        <nav className="flex gap-2">
                            <Link href="/panel" className="px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded">الرئيسية</Link>
                            <Link href="/panel/sessions" className="px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded">الجلسات</Link>
                            <Link href="/panel/settings" className="px-3 py-1 text-gray-300 hover:text-white hover:bg-gray-700 rounded">⚙️</Link>
                        </nav>
                    </div>
                    <Link href="/" className="text-gray-400 hover:text-white text-sm">الموقع ←</Link>
                </div>
            </header>
            <main className="max-w-7xl mx-auto">{children}</main>
        </div>
    );
}
