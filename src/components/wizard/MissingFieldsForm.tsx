"use client";

import { CVData, MissingFieldInfo } from '@/lib/types/cv-schema';
import { useState, useRef } from 'react';
import Image from 'next/image';

interface MissingFieldsFormProps {
    missingFields: MissingFieldInfo[];
    existingData: Partial<CVData>;
    onComplete: (completeData: Partial<CVData>) => void;
    onBack: () => void;
}

export default function MissingFieldsForm({
    missingFields,
    existingData,
    onComplete,
    onBack
}: MissingFieldsFormProps) {
    // Initialize state with empty values for missing fields
    const [formData, setFormData] = useState<Record<string, string>>(() => {
        const initial: Record<string, string> = {};
        missingFields.forEach(field => {
            initial[field.field] = '';
        });
        return initial;
    });

    const [errors, setErrors] = useState<Record<string, string>>({});
    const [photoFile, setPhotoFile] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Validation functions
    const validateEmail = (email: string): boolean => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    };

    const validatePhone = (phone: string): boolean => {
        // Allow various phone formats (international, local, with/without spaces)
        const phoneRegex = /^[\d\s\+\-\(\)]{7,20}$/;
        return phoneRegex.test(phone);
    };

    const validateField = (field: MissingFieldInfo, value: string): string | null => {
        if (field.required && !value.trim()) {
            return `${field.labelAr} مطلوب`;
        }

        if (value.trim()) {
            switch (field.type) {
                case 'email':
                    if (!validateEmail(value)) {
                        return 'البريد الإلكتروني غير صحيح';
                    }
                    break;
                case 'tel':
                    if (!validatePhone(value)) {
                        return 'رقم الهاتف غير صحيح';
                    }
                    break;
            }
        }

        return null;
    };

    const handleChange = (fieldName: string, value: string) => {
        setFormData(prev => ({ ...prev, [fieldName]: value }));
        // Clear error when user types
        if (errors[fieldName]) {
            setErrors(prev => {
                const newErrors = { ...prev };
                delete newErrors[fieldName];
                return newErrors;
            });
        }
    };

    const handleFileChange = (fieldName: string, file: File | null) => {
        if (file && fieldName === 'photoUrl') {
            setPhotoFile(file);
            const reader = new FileReader();
            reader.onload = () => {
                setPhotoPreview(reader.result as string);
            };
            reader.readAsDataURL(file);
            // Clear error
            if (errors[fieldName]) {
                setErrors(prev => {
                    const newErrors = { ...prev };
                    delete newErrors[fieldName];
                    return newErrors;
                });
            }
        }
    };

    const removePhoto = () => {
        setPhotoFile(null);
        setPhotoPreview(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Validate all fields
        const newErrors: Record<string, string> = {};
        missingFields.forEach(field => {
            const error = validateField(field, formData[field.field]);
            if (error) {
                newErrors[field.field] = error;
            }
        });

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }

        // Merge form data with existing data
        const completeData: Partial<CVData> = {
            ...existingData,
            personal: {
                ...existingData.personal,
                ...formData,
                // Note: photoUrl would be uploaded separately in production
                photoUrl: photoPreview || existingData.personal?.photoUrl
            } as any
        };

        onComplete(completeData);
    };

    const renderField = (field: MissingFieldInfo) => {
        const value = formData[field.field] || '';
        const error = errors[field.field];

        // Special handling for file upload (photo)
        if (field.type === 'file') {
            return (
                <div key={field.field} className="space-y-2">
                    <label className="block text-sm font-bold text-gray-700">
                        {field.labelAr}
                        {field.required && <span className="text-red-500 mr-1">*</span>}
                    </label>

                    <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileChange(field.field, e.target.files?.[0] || null)}
                        className="hidden"
                        id={field.field}
                    />

                    {photoPreview ? (
                        <div className="relative">
                            <Image
                                src={photoPreview}
                                alt="Preview"
                                width={200}
                                height={200}
                                className="w-full max-h-60 object-contain rounded-xl border-2 border-gray-200"
                            />
                            <button
                                type="button"
                                onClick={removePhoto}
                                className="absolute top-2 left-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center shadow-lg hover:bg-red-600 transition-all"
                            >
                                ✕
                            </button>
                            <div className="mt-2 text-center text-sm text-green-600 font-medium">
                                ✓ تم اختيار الصورة
                            </div>
                        </div>
                    ) : (
                        <label
                            htmlFor={field.field}
                            className={`flex flex-col items-center justify-center py-8 cursor-pointer rounded-xl transition-all ${error
                                    ? 'bg-red-50 border-2 border-red-300'
                                    : 'bg-gray-50 hover:bg-gray-100 border-2 border-dashed border-gray-200'
                                }`}
                        >
                            <div className="text-4xl mb-2">📸</div>
                            <span className="font-bold text-gray-700">اضغط لاختيار صورة</span>
                            <span className="text-xs text-gray-400 mt-1">PNG, JPG, JPEG</span>
                        </label>
                    )}

                    {error && (
                        <p className="text-sm text-red-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                            <span>⚠️</span>
                            <span>{error}</span>
                        </p>
                    )}
                </div>
            );
        }

        // Regular input fields
        return (
            <div key={field.field} className="space-y-2">
                <label
                    htmlFor={field.field}
                    className="block text-sm font-bold text-gray-700"
                >
                    {field.labelAr}
                    {field.required && <span className="text-red-500 mr-1">*</span>}
                </label>
                <input
                    id={field.field}
                    name={field.field}
                    type={field.type}
                    value={value}
                    onChange={(e) => handleChange(field.field, e.target.value)}
                    className={`w-full p-4 text-base border-2 rounded-xl focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-400 ${error
                        ? 'border-red-300 focus:border-red-500'
                        : 'border-gray-100 focus:border-primary'
                        }`}
                    placeholder={field.placeholderAr}
                    autoComplete={field.type === 'email' ? 'email' : field.type === 'tel' ? 'tel' : 'off'}
                    dir={field.type === 'email' || field.type === 'tel' ? 'ltr' : 'rtl'}
                />
                {error && (
                    <p className="text-sm text-red-600 flex items-center gap-1 animate-in fade-in slide-in-from-top-1">
                        <span>⚠️</span>
                        <span>{error}</span>
                    </p>
                )}
            </div>
        );
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6">
            <button
                type="button"
                onClick={onBack}
                className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors"
            >
                <span>→</span>
                <span>العودة</span>
            </button>

            <div className="text-center space-y-2">
                <div className="text-5xl mb-3">✍️</div>
                <h2 className="text-2xl font-bold text-gray-800">أكمل البيانات الأساسية</h2>
                <p className="text-gray-500">
                    تمكّنا من استخراج معظم بياناتك، لكن نحتاج بعض التفاصيل الأساسية
                </p>
            </div>

            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm">
                <div className="flex items-start gap-2">
                    <span className="text-lg">ℹ️</span>
                    <div>
                        <strong>نجح التحليل!</strong> استخرجنا الخبرات والمهارات من النص الذي أدخلته.
                        <br />
                        فقط املأ الحقول التالية للمتابعة:
                    </div>
                </div>
            </div>

            <div className="space-y-4">
                {missingFields.map(field => renderField(field))}
            </div>

            <button
                type="submit"
                className="w-full bg-gradient-to-l from-emerald-500 to-teal-500 text-white py-4 rounded-xl font-bold text-lg hover:opacity-90 transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-3"
            >
                <span>متابعة</span>
                <span>⚡</span>
            </button>

            <div className="text-center">
                <p className="text-xs text-gray-400">
                    الحقول المميزة بـ <span className="text-red-500">*</span> إلزامية
                </p>
            </div>
        </form>
    );
}
