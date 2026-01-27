"use client";

import { CVData } from '@/lib/types/cv-schema';
import { useState } from 'react';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
}

export default function WelcomeStep({ data, onNext }: StepProps) {
    const [firstName, setFirstName] = useState(data.personal.firstName);
    const [lastName, setLastName] = useState(data.personal.lastName);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (firstName && lastName) {
            onNext({
                personal: { ...data.personal, firstName, lastName }
            });
        }
    };

    return (
        <form onSubmit={handleSubmit} className="w-full max-w-xl mx-auto space-y-10 py-6">
            <div className="text-center space-y-3">
                <h1 className="text-4xl font-black text-gray-900 tracking-tight">
                    أهلاً بك في <span className="text-primary italic">ذكاء السيرة</span>
                </h1>
                <p className="text-lg text-gray-500 font-medium">لنبدأ ببناء مستقبلك المهني بجودة عالمية.</p>
                <div className="flex justify-center">
                    <div className="h-1.5 w-16 bg-accent rounded-full"></div>
                </div>
            </div>

            <div className="space-y-6">
                <div className="space-y-2">
                    <label className="text-lg font-bold text-gray-700 mr-2">الاسم بالكامل</label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input
                            type="text"
                            value={firstName}
                            onChange={(e) => setFirstName(e.target.value)}
                            className="w-full p-5 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                            placeholder="الاسم الأول (مثلاً: محمد)"
                            required
                        />
                        <input
                            type="text"
                            value={lastName}
                            onChange={(e) => setLastName(e.target.value)}
                            className="w-full p-5 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                            placeholder="الكنية (مثلاً: علي)"
                            required
                        />
                    </div>
                </div>
            </div>

            <button
                type="submit"
                className="w-full bg-primary text-white py-5 rounded-2xl font-bold text-xl hover:bg-primary-dark transition-all shadow-xl shadow-primary/20 active:scale-[0.98] flex items-center justify-center gap-3"
            >
                <span>ابدأ رحلتك المهنية</span>
                <span className="text-2xl">⚡</span>
            </button>
        </form>
    );
}
