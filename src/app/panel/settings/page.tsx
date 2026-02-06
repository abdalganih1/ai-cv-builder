'use client';

/**
 * Payment Settings Admin Page - صفحة إعدادات الدفع
 * للتحكم بـ QR, المبلغ, ونوع الدفع
 */

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface PaymentSettings {
    qrImageUrl: string;
    recipientName: string;
    recipientCode: string;
    amount: number;
    currency: string;
    paymentType: 'mandatory' | 'donation' | 'disabled';
    updatedAt?: string;
}

const DEFAULT_SETTINGS: PaymentSettings = {
    qrImageUrl: '/sham-cash-qr.png',
    recipientName: 'عبد الغني أحمد الحمدي',
    recipientCode: '0d4f56f704ded4f3148727e0edc03778',
    amount: 500,
    currency: 'ل.س',
    paymentType: 'mandatory',
};

export default function SettingsPage() {
    const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            // أولاً: جلب من localStorage للتطوير المحلي
            const localSettings = localStorage.getItem('cv_payment_settings');
            if (localSettings) {
                try {
                    const parsed = JSON.parse(localSettings);
                    setSettings(prev => ({ ...prev, ...parsed }));
                } catch (e) {
                    console.error('Failed to parse local settings:', e);
                }
            }

            // ثانياً: محاولة جلب من API (للإنتاج)
            const res = await fetch('/api/admin/settings');
            const data = await res.json();
            if (data.success && data.data) {
                setSettings(data.data);
                // تحديث localStorage
                localStorage.setItem('cv_payment_settings', JSON.stringify(data.data));
            }
        } catch (error) {
            console.error('Failed to fetch settings:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (field: keyof PaymentSettings, value: string | number) => {
        setSettings(prev => ({ ...prev, [field]: value }));
        setHasChanges(true);
        setMessage(null);
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            // حفظ في localStorage أولاً (للتطوير المحلي)
            localStorage.setItem('cv_payment_settings', JSON.stringify(settings));

            // محاولة حفظ في API (للإنتاج)
            const res = await fetch('/api/admin/settings', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings),
            });

            const data = await res.json();

            if (data.success) {
                setMessage({ type: 'success', text: '✅ تم الحفظ محلياً! ' + (data.message || '') });
                setHasChanges(false);
                if (data.data) {
                    setSettings(data.data);
                    localStorage.setItem('cv_payment_settings', JSON.stringify(data.data));
                }
            } else {
                // حتى لو فشل الـ API، الإعدادات محفوظة محلياً
                setMessage({ type: 'success', text: '✅ تم الحفظ محلياً! (قاعدة البيانات غير متوفرة)' });
                setHasChanges(false);
            }
        } catch (error) {
            console.error('Save error:', error);
            // الإعدادات محفوظة محلياً على أي حال
            setMessage({ type: 'success', text: '✅ تم الحفظ محلياً!' });
            setHasChanges(false);
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="w-12 h-12 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-white">⚙️ إعدادات الدفع</h1>
                    <p className="text-gray-400 mt-1">تحكم بخيارات الدفع وصورة QR</p>
                </div>
                {hasChanges && (
                    <span className="text-yellow-400 text-sm animate-pulse">
                        • تغييرات غير محفوظة
                    </span>
                )}
            </div>

            {/* Message */}
            {message && (
                <div className={`p-4 rounded-xl ${message.type === 'success'
                    ? 'bg-green-500/10 border border-green-500/50 text-green-400'
                    : 'bg-red-500/10 border border-red-500/50 text-red-400'
                    }`}>
                    {message.text}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* QR Code Section */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span>📱</span>
                        <span>صورة QR Code</span>
                    </h2>

                    <div className="flex flex-col items-center gap-4">
                        <div className="bg-white p-4 rounded-xl shadow-lg">
                            <Image
                                src={settings.qrImageUrl}
                                alt="Payment QR Code"
                                width={200}
                                height={200}
                                className="rounded-lg"
                            />
                        </div>

                        <div className="w-full">
                            <label className="block text-gray-400 text-sm mb-2">
                                رابط الصورة
                            </label>
                            <input
                                type="text"
                                value={settings.qrImageUrl}
                                onChange={(e) => handleChange('qrImageUrl', e.target.value)}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition"
                                dir="ltr"
                                placeholder="/sham-cash-qr.png"
                            />
                            <p className="text-gray-500 text-xs mt-1">
                                ضع الصورة في مجلد public ثم اكتب المسار هنا
                            </p>
                        </div>
                    </div>
                </div>

                {/* Recipient Info Section */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span>👤</span>
                        <span>معلومات المستلم</span>
                    </h2>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-sm mb-2">
                                اسم المستلم
                            </label>
                            <input
                                type="text"
                                value={settings.recipientName}
                                onChange={(e) => handleChange('recipientName', e.target.value)}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition"
                                placeholder="الاسم الكامل"
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm mb-2">
                                كود ShamCash
                            </label>
                            <input
                                type="text"
                                value={settings.recipientCode}
                                onChange={(e) => handleChange('recipientCode', e.target.value)}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white font-mono focus:border-blue-500 focus:outline-none transition"
                                dir="ltr"
                                placeholder="0d4f56f704ded4f3148727e0edc03778"
                            />
                        </div>
                    </div>
                </div>

                {/* Amount Section */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span>💰</span>
                        <span>المبلغ</span>
                    </h2>

                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-gray-400 text-sm mb-2">
                                القيمة
                            </label>
                            <input
                                type="number"
                                value={settings.amount}
                                onChange={(e) => handleChange('amount', parseInt(e.target.value) || 0)}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-2xl font-bold focus:border-blue-500 focus:outline-none transition"
                                min="0"
                            />
                        </div>

                        <div className="w-24">
                            <label className="block text-gray-400 text-sm mb-2">
                                العملة
                            </label>
                            <select
                                value={settings.currency}
                                onChange={(e) => handleChange('currency', e.target.value)}
                                className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:border-blue-500 focus:outline-none transition"
                            >
                                <option value="ل.س">ل.س</option>
                                <option value="$">$</option>
                                <option value="€">€</option>
                            </select>
                        </div>
                    </div>

                    <div className="mt-4 p-3 bg-gray-700/50 rounded-lg text-center">
                        <span className="text-gray-400">المبلغ المعروض للمستخدم:</span>
                        <span className="text-white text-xl font-bold mr-2">
                            {settings.amount} {settings.currency}
                        </span>
                    </div>
                </div>

                {/* Payment Type Section */}
                <div className="bg-gray-800 rounded-xl p-6 border border-gray-700">
                    <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <span>🎛️</span>
                        <span>نوع الدفع</span>
                    </h2>

                    <div className="space-y-3">
                        <label
                            className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition border-2 ${settings.paymentType === 'mandatory'
                                ? 'bg-blue-500/10 border-blue-500'
                                : 'bg-gray-700/50 border-transparent hover:border-gray-600'
                                }`}
                        >
                            <input
                                type="radio"
                                name="paymentType"
                                value="mandatory"
                                checked={settings.paymentType === 'mandatory'}
                                onChange={(e) => handleChange('paymentType', e.target.value)}
                                className="sr-only"
                            />
                            <span className="text-3xl">💳</span>
                            <div className="flex-1">
                                <p className="text-white font-bold">إجباري</p>
                                <p className="text-gray-400 text-sm">يجب على المستخدم رفع إثبات الدفع للمتابعة</p>
                            </div>
                            {settings.paymentType === 'mandatory' && (
                                <span className="text-blue-400">✓</span>
                            )}
                        </label>

                        <label
                            className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition border-2 ${settings.paymentType === 'donation'
                                ? 'bg-yellow-500/10 border-yellow-500'
                                : 'bg-gray-700/50 border-transparent hover:border-gray-600'
                                }`}
                        >
                            <input
                                type="radio"
                                name="paymentType"
                                value="donation"
                                checked={settings.paymentType === 'donation'}
                                onChange={(e) => handleChange('paymentType', e.target.value)}
                                className="sr-only"
                            />
                            <span className="text-3xl">🎁</span>
                            <div className="flex-1">
                                <p className="text-white font-bold">تبرع (اختياري)</p>
                                <p className="text-gray-400 text-sm">المستخدم يمكنه المتابعة بدون رفع إثبات</p>
                            </div>
                            {settings.paymentType === 'donation' && (
                                <span className="text-yellow-400">✓</span>
                            )}
                        </label>

                        <label
                            className={`flex items-center gap-4 p-4 rounded-xl cursor-pointer transition border-2 ${settings.paymentType === 'disabled'
                                ? 'bg-gray-500/10 border-gray-500'
                                : 'bg-gray-700/50 border-transparent hover:border-gray-600'
                                }`}
                        >
                            <input
                                type="radio"
                                name="paymentType"
                                value="disabled"
                                checked={settings.paymentType === 'disabled'}
                                onChange={(e) => handleChange('paymentType', e.target.value)}
                                className="sr-only"
                            />
                            <span className="text-3xl">⏭️</span>
                            <div className="flex-1">
                                <p className="text-white font-bold">معطل</p>
                                <p className="text-gray-400 text-sm">تخطي خطوة الدفع بالكامل</p>
                            </div>
                            {settings.paymentType === 'disabled' && (
                                <span className="text-gray-400">✓</span>
                            )}
                        </label>
                    </div>
                </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end gap-4">
                <button
                    onClick={() => {
                        setSettings(DEFAULT_SETTINGS);
                        setHasChanges(true);
                    }}
                    className="px-6 py-3 bg-gray-700 text-gray-300 rounded-xl hover:bg-gray-600 transition"
                >
                    استعادة الافتراضي
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving || !hasChanges}
                    className={`px-8 py-3 rounded-xl font-bold text-lg transition flex items-center gap-2 ${hasChanges
                        ? 'bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-500/20'
                        : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                        }`}
                >
                    {saving ? (
                        <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            <span>جاري الحفظ...</span>
                        </>
                    ) : (
                        <>
                            <span>💾</span>
                            <span>حفظ التغييرات</span>
                        </>
                    )}
                </button>
            </div>

            {/* Last Updated */}
            {settings.updatedAt && (
                <p className="text-center text-gray-500 text-sm">
                    آخر تحديث: {new Date(settings.updatedAt).toLocaleString('ar-SY')}
                </p>
            )}
        </div>
    );
}
