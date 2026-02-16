"use client";

import { CVData } from '@/lib/types/cv-schema';
import { useState } from 'react';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
    onBack: () => void;
}

const COUNTRIES_REQUIRING_RESIDENCY = ['الإمارات', 'السعودية', 'قطر', 'الكويت', 'البحرين', 'عمان'];

export default function ContactStep({ data, onNext, onBack }: StepProps) {
    const [phone, setPhone] = useState(data.personal.phone);
    const [country, setCountry] = useState(data.personal.country || 'سوريا');
    const [residencyStatus, setResidencyStatus] = useState<string>(data.personal.residencyStatus || '');
    const [residencyExpiry, setResidencyExpiry] = useState(data.personal.residencyExpiry || '');
    const [showResidencyFields, setShowResidencyFields] = useState(
        COUNTRIES_REQUIRING_RESIDENCY.includes(data.personal.country || '')
    );

    const handleCountryChange = (newCountry: string) => {
        setCountry(newCountry);
        const needsResidency = COUNTRIES_REQUIRING_RESIDENCY.includes(newCountry);
        setShowResidencyFields(needsResidency);
        if (!needsResidency) {
            setResidencyStatus('');
            setResidencyExpiry('');
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (phone && country) {
            const personalUpdate: any = { ...data.personal, phone, country };
            if (showResidencyFields) {
                personalUpdate.residencyCountry = country;
                personalUpdate.residencyStatus = residencyStatus === 'مواطن' ? 'citizen' : 
                    residencyStatus === 'مقيم (مع إقامة)' ? 'resident' : 
                    residencyStatus === 'زائر (بدون إقامة)' ? 'visitor' : undefined;
                personalUpdate.residencyExpiry = residencyExpiry;
            }
            onNext({ personal: personalUpdate });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto space-y-10 py-6">
            <div className="text-center space-y-3">
                <h2 className="text-3xl font-black text-gray-900 tracking-tight">معلومات التواصل</h2>
                <p className="text-lg text-gray-500 font-medium">كيف يمكن لأصحاب العمل الوصول إليك؟</p>
                <div className="flex justify-center">
                    <div className="h-1.5 w-16 bg-accent rounded-full"></div>
                </div>
            </div>

            <div className="space-y-8">
                <div className="space-y-3">
                    <label className="text-lg font-bold text-gray-700 mr-2">دولة الإقامة</label>
                    <select
                        value={country}
                        onChange={(e) => handleCountryChange(e.target.value)}
                        className="w-full p-5 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 appearance-none cursor-pointer"
                    >
                        <option value="سوريا">سوريا 🇸🇾</option>
                        <option value="الإمارات">الإمارات 🇦🇪</option>
                        <option value="السعودية">السعودية 🇸🇦</option>
                        <option value="قطر">قطر 🇶🇦</option>
                        <option value="الكويت">الكويت 🇰🇼</option>
                        <option value="البحرين">البحرين 🇧🇭</option>
                        <option value="عمان">عمان 🇴🇲</option>
                        <option value="مصر">مصر 🇪🇬</option>
                        <option value="الأردن">الأردن 🇯🇴</option>
                        <option value="تركيا">تركيا 🇹🇷</option>
                        <option value="أخرى">دولة أخرى</option>
                    </select>
                </div>

                {showResidencyFields && (
                    <div className="space-y-6 p-4 bg-blue-50 rounded-xl border border-blue-200">
                        <p className="text-sm text-blue-700 font-medium">
                            📋 معلومات الإقامة في {country} (مهم لأصحاب العمل)
                        </p>
                        
                        <div className="space-y-3">
                            <label className="text-base font-bold text-gray-700 mr-2">حالة الإقامة</label>
                            <select
                                value={residencyStatus}
                                onChange={(e) => setResidencyStatus(e.target.value)}
                                className="w-full p-4 text-lg border-2 border-blue-100 rounded-xl focus:border-blue-400 focus:ring-0 outline-none transition-all bg-white text-gray-800"
                            >
                                <option value="">اختر حالة الإقامة...</option>
                                <option value="مواطن">مواطن ({country === 'السعودية' ? 'سعودي' : country === 'الإمارات' ? 'إماراتي' : 'مواطن'})</option>
                                <option value="مقيم (مع إقامة)">مقيم (مع إقامة)</option>
                                <option value="زائر (بدون إقامة)">زائر (بدون إقامة)</option>
                            </select>
                        </div>

                        {residencyStatus === 'مقيم (مع إقامة)' && (
                            <div className="space-y-3">
                                <label className="text-base font-bold text-gray-700 mr-2">تاريخ انتهاء الإقامة</label>
                                <input
                                    type="text"
                                    value={residencyExpiry}
                                    onChange={(e) => setResidencyExpiry(e.target.value)}
                                    className="w-full p-4 text-lg border-2 border-blue-100 rounded-xl focus:border-blue-400 focus:ring-0 outline-none transition-all bg-white text-gray-800"
                                    placeholder="مثال: 2025/12"
                                    dir="ltr"
                                />
                            </div>
                        )}
                    </div>
                )}

                <div className="space-y-3">
                    <label className="text-lg font-bold text-gray-700 mr-2">رقم الهاتف الجوال</label>
                    <div className="relative">
                        <input
                            type="tel"
                            value={phone}
                            onChange={(e) => setPhone(e.target.value)}
                            className="w-full p-5 pl-14 text-xl border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300 tracking-widest font-mono"
                            placeholder={country === 'سوريا' ? '09xx xxx xxx' : '+xxx xxx xxx xxx'}
                            required
                            dir="ltr"
                            enterKeyHint="go"
                            autoComplete="tel"
                        />
                        <div className="absolute left-5 top-1/2 -translate-y-1/2 text-primary text-xl pointer-events-none">
                            📞
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                    type="button"
                    onClick={onBack}
                    className="flex-1 py-5 rounded-2xl border-2 border-gray-100 text-gray-400 font-bold text-lg hover:border-gray-300 hover:text-gray-600 transition-all active:scale-[0.98]"
                >
                    العودة للسابق
                </button>
                <button
                    type="submit"
                    className="flex-[2] bg-primary text-white py-5 rounded-2xl font-bold text-xl hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-3"
                >
                    <span>متابعة الخطوات</span>
                    <span className="text-2xl">→</span>
                </button>
            </div>
        </form>
    );
}
