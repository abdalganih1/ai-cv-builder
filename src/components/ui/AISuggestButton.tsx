'use client';

import { useMemo } from 'react';

interface AISuggestButtonProps {
    fieldType: string;
    context?: string;
    currentValue: string;
    onSelect: (value: string) => void;
}

const STATIC_SUGGESTIONS: Record<string, string[]> = {
    university: [
        'جامعة البعث',
        'جامعة دمشق',
        'جامعة حلب',
        'جامعة تشرين',
        'جامعة حماة',
        'جامعة الفرات',
        'جامعة طرطوس',
        'الجامعة الافتراضية السورية',
        'الجامعة الوطنية الخاصة',
        'الجامعة العربية الدولية',
        'جامعة القلمون',
        'الجامعة السورية الخاصة',
        'جامعة الوادي الدولية',
        'الجامعة الدولية للعلوم والتكنولوجيا',
        'جامعة اليرموك الخاصة',
        'جامعة الرشيد الدولية',
        'جامعة قرطبة الخاصة',
    ],
    language: [
        'الإنجليزية',
        'الفرنسية',
        'الألمانية',
        'التركية',
        'الروسية',
        'الإسبانية',
        'الإيطالية',
        'الفارسية',
        'العبرية',
        'اليابانية',
        'الصينية',
    ],
    degree: [
        'بكالوريوس',
        'ماجستير',
        'دبلوم',
        'دكتوراه',
        'شهادة مهنية',
        'بكالوريوس هندسي',
    ],
    major: [
        'هندسة برمجيات',
        'علوم الحاسوب',
        'تقانة المعلومات',
        'هندسة الحاسوب',
        'الذكاء الاصطناعي',
        'هندسة الشبكات',
        'هندسة مدنية',
        'هندسة معمارية',
        'هندسة كهربائية',
        'هندسة ميكانيكية',
        'هندسة اتصالات',
        'هندسة إلكترونية',
        'هندسة كيميائية',
        'هندسة بترولية',
        'هندسة زراعية',
        'هندسة طبية حيوية',
        'ميكاترونيكس',
        'طب بشري',
        'طب أسنان',
        'صيدلة',
        'تمريض',
        'علاج طبيعي',
        'مخابر طبية',
        'حقوق',
        'إدارة أعمال',
        'محاسبة',
        'اقتصاد',
        'تمويل ومصارف',
        'تسويق',
        'نظم معلومات إدارية',
        'رياضيات',
        'فيزياء',
        'كيمياء',
        'أحياء',
        'جيولوجيا',
        'إحصاء',
        'تربية',
        'آداب إنجليزي',
        'آداب عربي',
        'ترجمة',
        'إعلام',
        'صحافة',
        'علم نفس',
        'علم اجتماع',
        'فلسفة',
        'تاريخ',
        'جغرافيا',
        'فنون جميلة',
        'تصميم غرافيكي',
        'تصميم داخلي',
        'شريعة',
        'دراسات إسلامية',
        'زراعة',
        'علوم أغذية',
        'طب بيطري',
    ],
    company: [
        'شركة سيريتل',
        'MTN سوريا',
        'بنك سورية والخليج',
        'بنك البركة',
        'شركة سيرياتل',
    ],
    position: [
        'مطور برمجي',
        'مهندس شبكات',
        'مدير مبيعات',
        'محاسب',
        'مصمم جرافيك',
        'مهندس ميكانيكي',
        'طبيب',
        'ممرض',
    ],
    description: [
        'إدارة وتطوير التطبيقات',
        'متابعة المشاريع',
        'كتابة التقارير',
    ],
    jobTitle: [
        'مطور Full-Stack',
        'مهندس DevOps',
        'مدير منتج',
        'محلل بيانات',
        'مصمم UX',
    ],
    skills: [
        'JavaScript',
        'Python',
        'تواصل فعّال',
        'إدارة وقت',
        'تفكير ناقد',
        'React',
        'Node.js',
    ],
};

export default function AISuggestButton({ fieldType, currentValue, onSelect }: AISuggestButtonProps) {
    const suggestions = useMemo(() => {
        const staticList = STATIC_SUGGESTIONS[fieldType] || [];
        if (!currentValue || currentValue.trim() === '') {
            return staticList.slice(0, 6);
        }
        const search = currentValue.toLowerCase();
        const filtered = staticList.filter(s => 
            s.toLowerCase().includes(search) || 
            s.includes(currentValue)
        );
        return filtered.length > 0 ? filtered.slice(0, 6) : staticList.slice(0, 6);
    }, [fieldType, currentValue]);

    const handleSelect = (value: string) => {
        onSelect(value);
    };

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className="ai-suggest-container">
            <div className="ai-suggest-label">💡 اقتراحات ذكية:</div>
            <div className="ai-suggest-chips">
                {suggestions.map((suggestion, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelect(suggestion)}
                        className="ai-suggest-chip"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>

            {/* Scoped Styles */}
            <style jsx>{`
                .ai-suggest-container {
                    margin-top: 12px;
                    direction: rtl;
                }
                .ai-suggest-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #6366f1;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .ai-suggest-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .ai-suggest-chip {
                    display: inline-flex;
                    align-items: center;
                    padding: 8px 14px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #4f46e5;
                    background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
                    border: 1.5px solid #c7d2fe;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .ai-suggest-chip:hover {
                    background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%);
                    border-color: #818cf8;
                    color: #3730a3;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(99, 102, 241, 0.15);
                }
                .ai-suggest-chip:active {
                    transform: translateY(0);
                    box-shadow: 0 1px 2px rgba(99, 102, 241, 0.1);
                }
            `}</style>
        </div>
    );
}
