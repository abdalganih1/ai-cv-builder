"use client";

import { useState, useEffect, useMemo, useRef } from 'react';

interface SmartDateInputProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    minYear?: number;
    maxYear?: number;
    placeholder?: string;
    label?: string;
}

const MONTHS_AR = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
];

const MONTHS_EN = [
    '01', '02', '03', '04', '05', '06',
    '07', '08', '09', '10', '11', '12'
];

const currentYear = new Date().getFullYear();
const DEFAULT_MIN_YEAR = 1950;
const DEFAULT_MAX_YEAR = currentYear - 20;

export default function SmartDateInput({
    value,
    onChange,
    onSubmit,
    minYear = DEFAULT_MIN_YEAR,
    maxYear = DEFAULT_MAX_YEAR,
    placeholder = 'مثال: 1990/05/15',
    label = 'تاريخ الميلاد'
}: SmartDateInputProps) {
    const [step, setStep] = useState<'year' | 'month' | 'day'>('year');
    const [yearInput, setYearInput] = useState('');
    const [selectedYear, setSelectedYear] = useState<string>('');
    const [selectedMonth, setSelectedMonth] = useState<string>('');
    const [selectedDay, setSelectedDay] = useState<string>('');
    const yearInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (value) {
            const parts = value.split('/');
            if (parts.length >= 1) {
                setSelectedYear(parts[0]);
                setYearInput(parts[0]);
            }
            if (parts.length >= 2) {
                setSelectedMonth(parts[1]);
            }
            if (parts.length >= 3) {
                setSelectedDay(parts[2]);
            }
        }
    }, []);

    useEffect(() => {
        yearInputRef.current?.focus();
    }, [step]);

    const yearSuggestions = useMemo(() => {
        if (!yearInput) {
            const years: number[] = [];
            for (let y = maxYear; y >= minYear; y--) {
                years.push(y);
            }
            return years.slice(0, 12);
        }

        const input = yearInput.toString();
        const matching: number[] = [];

        if (input.length === 1) {
            const decade = parseInt(input);
            if (!isNaN(decade)) {
                for (let y = minYear; y <= maxYear; y++) {
                    const firstDigit = Math.floor(y / 1000);
                    if (firstDigit === decade || Math.floor((y % 1000) / 100) === decade) {
                        matching.push(y);
                    }
                }
            }
        } else if (input.length === 2) {
            const twoDigits = parseInt(input);
            if (!isNaN(twoDigits)) {
                for (let y = minYear; y <= maxYear; y++) {
                    const lastTwo = y % 100;
                    const firstTwo = Math.floor(y / 100);
                    if (lastTwo === twoDigits || firstTwo === twoDigits ||
                        lastTwo.toString().startsWith(input) || firstTwo.toString() === input) {
                        matching.push(y);
                    }
                }
            }
        } else if (input.length === 3) {
            for (let y = minYear; y <= maxYear; y++) {
                if (y.toString().startsWith(input)) {
                    matching.push(y);
                }
            }
        } else if (input.length === 4) {
            const fullYear = parseInt(input);
            if (!isNaN(fullYear) && fullYear >= minYear && fullYear <= maxYear) {
                matching.push(fullYear);
            }
        }

        return matching.slice(0, 10);
    }, [yearInput, minYear, maxYear]);

    const daysInMonth = useMemo(() => {
        if (!selectedYear || !selectedMonth) return 31;
        const year = parseInt(selectedYear);
        const month = parseInt(selectedMonth);
        return new Date(year, month, 0).getDate();
    }, [selectedYear, selectedMonth]);

    const daySuggestions = useMemo(() => {
        const days: number[] = [];
        for (let d = 1; d <= daysInMonth; d++) {
            days.push(d);
        }
        return days;
    }, [daysInMonth]);

    const handleYearSelect = (year: number) => {
        setSelectedYear(year.toString());
        setYearInput(year.toString());
        setStep('month');
    };

    const handleYearKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (yearSuggestions.length === 1) {
                handleYearSelect(yearSuggestions[0]);
            } else if (yearInput.length === 4) {
                const year = parseInt(yearInput);
                if (year >= minYear && year <= maxYear) {
                    handleYearSelect(year);
                }
            }
        }
    };

    const handleMonthSelect = (month: string) => {
        setSelectedMonth(month);
        setStep('day');
    };

    const handleDaySelect = (day: number) => {
        const dayStr = day.toString().padStart(2, '0');
        setSelectedDay(dayStr);
        const fullDate = `${selectedYear}/${selectedMonth}/${dayStr}`;
        onChange(fullDate);
        // ✅ تأخير أطول لضمان تحديث React state قبل استدعاء handleAnswer
        setTimeout(() => onSubmit(), 300);
    };

    const handleDayKeyDown = (e: React.KeyboardEvent, day: number) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleDaySelect(day);
        }
    };

    const goBack = () => {
        if (step === 'month') {
            setStep('year');
            setSelectedMonth('');
        } else if (step === 'day') {
            setStep('month');
            setSelectedDay('');
        }
    };

    const getYearLabel = (year: number) => {
        const age = currentYear - year;
        return `${year} (${age} سنة)`;
    };

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-gray-700">
                    {label}
                </span>
                {step !== 'year' && (
                    <button
                        onClick={goBack}
                        className="text-sm text-primary font-medium hover:underline"
                    >
                        ← رجوع
                    </button>
                )}
            </div>

            {step === 'year' && (
                <div className="space-y-3">
                    <input
                        ref={yearInputRef}
                        type="number"
                        value={yearInput}
                        onChange={(e) => setYearInput(e.target.value)}
                        onKeyDown={handleYearKeyDown}
                        className="w-full p-4 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800"
                        placeholder="اكتب أو اختر السنة..."
                        autoFocus
                    />
                    <div className="text-xs text-gray-500 font-medium">اقتراحات:</div>
                    <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                        {yearSuggestions.map((year) => (
                            <button
                                key={year}
                                onClick={() => handleYearSelect(year)}
                                className={`p-3 rounded-xl text-sm font-bold transition-all ${selectedYear === year.toString()
                                        ? 'bg-primary text-white shadow-md'
                                        : 'bg-gray-50 border-2 border-gray-100 text-gray-700 hover:border-primary/50 hover:bg-primary/5'
                                    }`}
                            >
                                {getYearLabel(year)}
                            </button>
                        ))}
                    </div>
                    {yearInput && yearSuggestions.length === 0 && (
                        <p className="text-sm text-red-500 text-center">
                            لم يتم العثور على نتائج
                        </p>
                    )}
                </div>
            )}

            {step === 'month' && (
                <div className="space-y-3">
                    <div className="p-3 bg-primary/10 rounded-xl text-center">
                        <span className="text-lg font-bold text-primary">{selectedYear}</span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">اختر الشهر:</div>
                    <div className="grid grid-cols-3 gap-2">
                        {MONTHS_AR.map((month, idx) => {
                            const monthNum = MONTHS_EN[idx];
                            return (
                                <button
                                    key={idx}
                                    onClick={() => handleMonthSelect(monthNum)}
                                    className={`p-3 rounded-xl text-sm font-bold transition-all ${selectedMonth === monthNum
                                            ? 'bg-primary text-white shadow-md'
                                            : 'bg-gray-50 border-2 border-gray-100 text-gray-700 hover:border-primary/50 hover:bg-primary/5'
                                        }`}
                                >
                                    {month}
                                    <span className="block text-xs text-gray-400 mt-1">{monthNum}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}

            {step === 'day' && (
                <div className="space-y-3">
                    <div className="p-3 bg-primary/10 rounded-xl text-center">
                        <span className="text-lg font-bold text-primary">
                            {selectedYear}/{selectedMonth}
                        </span>
                    </div>
                    <div className="text-xs text-gray-500 font-medium">اختر اليوم:</div>
                    <div className="grid grid-cols-7 gap-1.5 max-h-40 overflow-y-auto">
                        {daySuggestions.map((day) => (
                            <button
                                key={day}
                                onClick={() => handleDaySelect(day)}
                                onKeyDown={(e) => handleDayKeyDown(e, day)}
                                className={`p-2 rounded-lg text-sm font-bold transition-all ${selectedDay === day.toString().padStart(2, '0')
                                        ? 'bg-primary text-white shadow-md'
                                        : 'bg-gray-50 border border-gray-100 text-gray-700 hover:border-primary/50 hover:bg-primary/5'
                                    }`}
                            >
                                {day}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {selectedYear && (
                <div className="pt-3 border-t border-gray-100">
                    <div className="text-center">
                        <span className="text-sm text-gray-500">التاريخ المحدد: </span>
                        <span className="font-bold text-primary">
                            {selectedYear}
                            {selectedMonth && `/${selectedMonth}`}
                            {selectedDay && `/${selectedDay}`}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
