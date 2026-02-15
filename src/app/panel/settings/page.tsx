'use client';

export const runtime = 'edge';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PaymentSettings {
    paymentType: 'required' | 'optional' | 'donation' | 'disabled';
    price: number;
    currency: string;
    qrData: string;
}

const DEFAULT_SETTINGS: PaymentSettings = {
    paymentType: 'donation',
    price: 5,
    currency: 'USD',
    qrData: '',
};

export default function SettingsPage() {
    const [settings, setSettings] = useState<PaymentSettings>(DEFAULT_SETTINGS);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const saved = localStorage.getItem('cv_payment_settings');
        if (saved) {
            try {
                setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
            } catch (e) {
                console.error(e);
            }
        }
    }, []);

    const handleSave = async () => {
        setSaving(true);
        localStorage.setItem('cv_payment_settings', JSON.stringify(settings));
        setTimeout(() => {
            setSaving(false);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        }, 500);
    };

    return (
        <div className="space-y-6 p-4 max-w-lg mx-auto">
            <div className="flex items-center gap-4">
                <Link href="/panel" className="text-gray-400 hover:text-white">← العودة</Link>
                <h1 className="text-2xl font-bold text-white">الإعدادات</h1>
            </div>

            <div className="bg-gray-800 rounded-xl p-6 border border-gray-700 space-y-4">
                <div>
                    <label className="block text-gray-300 mb-2">نوع الدفع</label>
                    <select
                        value={settings.paymentType}
                        onChange={e => setSettings({ ...settings, paymentType: e.target.value as PaymentSettings['paymentType'] })}
                        className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                    >
                        <option value="disabled">معطل</option>
                        <option value="donation">تبرع اختياري</option>
                        <option value="optional">اختياري</option>
                        <option value="required">إلزامي</option>
                    </select>
                </div>

                <div>
                    <label className="block text-gray-300 mb-2">السعر ({settings.currency})</label>
                    <input
                        type="number"
                        value={settings.price}
                        onChange={e => setSettings({ ...settings, price: parseFloat(e.target.value) || 0 })}
                        className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600"
                    />
                </div>

                <div>
                    <label className="block text-gray-300 mb-2">بيانات QR</label>
                    <textarea
                        value={settings.qrData}
                        onChange={e => setSettings({ ...settings, qrData: e.target.value })}
                        className="w-full p-3 bg-gray-700 text-white rounded-lg border border-gray-600 min-h-[100px]"
                        placeholder="رابط أو بيانات QR..."
                    />
                </div>

                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold transition disabled:opacity-50"
                >
                    {saving ? 'جاري الحفظ...' : saved ? '✅ تم الحفظ' : 'حفظ الإعدادات'}
                </button>
            </div>
        </div>
    );
}
