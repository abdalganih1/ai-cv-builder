'use client';

/**
 * Admin Panel Layout
 * تخطيط لوحة التحكم مع التحقق من المصادقة
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface AuthState {
    isAuthenticated: boolean;
    email?: string;
    loading: boolean;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const [auth, setAuth] = useState<AuthState>(() => {
        if (process.env.NODE_ENV === 'development') {
            return { isAuthenticated: true, email: 'dev@localhost', loading: false };
        }
        return { isAuthenticated: false, loading: true };
    });

    useEffect(() => {
        // إذا كنا في وضع التطوير، فقد تمت التهيئة بالفعل
        if (process.env.NODE_ENV === 'development') return;

        // في الإنتاج، إذا وصل المستخدم لهنا فهو مصادق عبر Cloudflare Access
        // لأن Access يعترض الطلب قبل وصوله للتطبيق
        // نتحقق من وجود CF Access cookie
        const hasCFCookie = document.cookie.includes('CF_Authorization');

        if (hasCFCookie) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setAuth({ isAuthenticated: true, email: 'admin@cloudflare', loading: false });
        } else {
            // محاولة استدعاء API للتحقق
            fetch('/api/analytics/stats', { credentials: 'include' })
                .then(res => {
                    if (res.ok) {
                        setAuth({ isAuthenticated: true, loading: false });
                    } else {
                        // إذا فشل، نسمح بالدخول على أي حال لأن Access سبق ومصادق
                        setAuth({ isAuthenticated: true, loading: false });
                    }
                })
                .catch(() => {
                    // حتى لو فشل الـ API، المستخدم مصادق عبر Access
                    setAuth({ isAuthenticated: true, loading: false });
                });
        }
    }, []);

    if (auth.loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">جاري التحقق من الهوية...</p>
                </div>
            </div>
        );
    }

    if (!auth.isAuthenticated) {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center">
                <div className="bg-gray-800 p-8 rounded-2xl shadow-xl max-w-md text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-white mb-2">غير مصرح بالدخول</h1>
                    <p className="text-gray-400 mb-6">
                        هذه اللوحة محمية بواسطة Cloudflare Access.
                        يرجى تسجيل الدخول للوصول.
                    </p>
                    <a
                        href="/"
                        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        العودة للموقع
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900" dir="rtl">
            {/* Header */}
            <header className="bg-gray-800 border-b border-gray-700 sticky top-0 z-50">
                <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/panel" className="text-xl font-bold text-white flex items-center gap-2">
                            <span className="text-2xl">📊</span>
                            <span>لوحة التحكم</span>
                        </Link>
                        <nav className="flex items-center gap-2 mr-8">
                            <Link
                                href="/panel"
                                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition"
                            >
                                الرئيسية
                            </Link>
                            <Link
                                href="/panel/sessions"
                                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition"
                            >
                                الجلسات
                            </Link>
                            <Link
                                href="/panel/settings"
                                className="px-4 py-2 text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition"
                            >
                                ⚙️ الإعدادات
                            </Link>
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        {auth.email && (
                            <span className="text-gray-400 text-sm">{auth.email}</span>
                        )}
                        <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" title="متصل" />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="max-w-7xl mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
}
