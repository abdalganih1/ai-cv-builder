'use client';

import { useMemo, useState, useEffect } from 'react';

interface AISuggestButtonProps {
    fieldType: string;
    context?: string;
    currentValue: string;
    onSelect: (value: string) => void;
    fullContext?: {
        education?: Array<{ major?: string; degree?: string }>;
        targetJobTitle?: string;
        company?: string;
    };
}

const MAJOR_TO_JOBS: Record<string, string[]> = {
    'هندسة برمجيات': ['مهندس برمجيات', 'مطور برمجي', 'مطور ويب', 'مطور تطبيقات', 'مهندس تطوير', 'مبرمج'],
    'علوم الحاسوب': ['مطور برمجي', 'محلل بيانات', 'مبرمج', 'مهندس برمجيات', 'محلل نظم'],
    'تقانة المعلومات': ['مهندس شبكات', 'مسؤول تقني', 'مهندس أنظمة', 'فني دعم تقني'],
    'هندسة الحاسوب': ['مهندس حاسوب', 'مهندس عتاد', 'مهندس شبكات', 'مطور برمجي'],
    'الذكاء الاصطناعي': ['مهندس ذكاء اصطناعي', 'باحث بيانات', 'محلل بيانات', 'مهندس تعلم آلي'],
    'هندسة الشبكات': ['مهندس شبكات', 'مسؤول شبكات', 'مهندس أمن سيبراني', 'فني شبكات'],
    'هندسة مدنية': ['مهندس مدني', 'مهندس موقع', 'مهندس مشاريع', 'مقاول', 'مهندس تصميم'],
    'هندسة معمارية': ['مهندس معماري', 'مصمم معماري', 'مهندس تصميم', 'مخطط حضري'],
    'هندسة كهربائية': ['مهندس كهربائي', 'مهندس طاقة', 'مهندس تحكم آلي', 'فني كهرباء'],
    'هندسة ميكانيكية': ['مهندس ميكانيكي', 'مهندس إنتاج', 'مهندس صيانة', 'مهندس تصميم ميكانيكي'],
    'هندسة اتصالات': ['مهندس اتصالات', 'مهندس إلكترونيات', 'مهندس راديو', 'فني اتصالات'],
    'هندسة إلكترونية': ['مهندس إلكتروني', 'مهندس تحكم', 'مهندس أتمتة', 'فني إلكترونيات'],
    'هندسة كيميائية': ['مهندس كيميائي', 'مهندس عمليات', 'مهندس بترول', 'مهندس سلامة'],
    'هندسة بترولية': ['مهندس بترول', 'مهندس حفر', 'مهندس إنتاج نفطي', 'جيولوجي بترولي'],
    'ميكاترونيكس': ['مهندس ميكاترونكس', 'مهندس أتمتة', 'مهندس روبوتات', 'مهندس تحكم'],
    'طب بشري': ['طبيب', 'طبيب بشري', 'طبيب عام', 'طبيب مقيم', 'طبيب أخصائي'],
    'طب أسنان': ['طبيب أسنان', 'طبيب تجميل أسنان', 'فني أسنان'],
    'صيدلة': ['صيدلي', 'صيدلي سريري', 'باحث صيدلاني', 'مدير صيدلية'],
    'تمريض': ['ممرض', 'ممرضة', 'ممرض أول', 'مشرف تمريض'],
    'حقوق': ['محامي', 'مستشار قانوني', 'قاضي', 'محرر عقود', 'محقق قانوني'],
    'إدارة أعمال': ['مدير', 'مدير مشاريع', 'مدير عمليات', 'محلل أعمال', 'مدير موارد بشرية'],
    'محاسبة': ['محاسب', 'محاسب قانوني', 'مدقق حسابات', 'مدير مالي', 'محاسب ضرائب'],
    'اقتصاد': ['محلل اقتصادي', 'مستشار مالي', 'باحث اقتصادي', 'مدير استثمار'],
    'تمويل ومصارف': ['محلل مالي', 'مدير بنك', 'مستشار مالي', 'محاسب بنكي', 'ضابط ائتمان'],
    'تسويق': ['مسؤول تسويق', 'مدير تسويق', 'مندوب مبيعات', 'مدير مبيعات', 'محلل سوق'],
    'ترجمة': ['مترجم', 'مترجم محلف', 'مترجم فوري', 'مدقق لغوي'],
    'إعلام': ['إعلامي', 'صحفي', 'مذيع', 'معد برامج', 'مصور صحفي'],
    'صحافة': ['صحفي', 'محرر', 'مراسل', 'كاتب مقالات'],
    'علم نفس': ['معالج نفسي', 'أخصائي نفسي', 'مرشد نفسي', 'باحث نفسي'],
    'تربية': ['معلم', 'مدرس', 'أستاذ', 'مشرف تربوي', 'مدير مدرسة'],
    'آداب إنجليزي': ['مترجم', 'معلم لغة إنجليزية', 'محرر', 'كاتب محتوى'],
    'آداب عربي': ['معلم لغة عربية', 'محرر', 'كاتب', 'صحفي'],
    'تصميم غرافيكي': ['مصمم جرافيك', 'مصمم هوية بصرية', 'مصمم واجهات', 'مخرج فني'],
    'فنون جميلة': ['فنان', 'مصمم', 'مصور', 'مخرج فني'],
    'شريعة': ['إمام', 'خطيب', 'مدرس شريعة', 'مستشار شرعي', 'قاضي شرعي'],
    'زراعة': ['مهندس زراعي', 'فني زراعة', 'مدير مزرعة', 'باحث زراعي'],
};

const GENERAL_JOBS = [
    'مدير', 'موظف', 'إداري', 'سكرتير', 'مندوب', 'مشرف',
    'منسق', 'مساعد', 'مستشار', 'خبير', 'محلل',
];

function getSmartSuggestions(
    fieldType: string,
    currentValue: string,
    fullContext?: AISuggestButtonProps['fullContext']
): string[] {
    if (fieldType === 'position' || fieldType === 'jobTitle') {
        const suggestions: string[] = [];
        const addedJobs = new Set<string>();

        const majors = fullContext?.education?.map(e => e.major).filter(Boolean) || [];
        const targetJobTitle = fullContext?.targetJobTitle;

        if (targetJobTitle && !currentValue) {
            suggestions.push(targetJobTitle);
            addedJobs.add(targetJobTitle);
        }

        for (const major of majors) {
            if (major && MAJOR_TO_JOBS[major]) {
                for (const job of MAJOR_TO_JOBS[major]) {
                    if (!addedJobs.has(job)) {
                        suggestions.push(job);
                        addedJobs.add(job);
                    }
                }
            }
        }

        for (const major of majors) {
            if (major) {
                const baseMajor = major.replace('هندسة ', '').replace('هندس', '');
                const capitalizedMajor = baseMajor.charAt(0).toUpperCase() + baseMajor.slice(1);
                
                if (!addedJobs.has(`مهندس ${baseMajor}`)) {
                    suggestions.push(`مهندس ${baseMajor}`);
                    addedJobs.add(`مهندس ${baseMajor}`);
                }
            }
        }

        if (suggestions.length < 5) {
            for (const job of GENERAL_JOBS) {
                if (!addedJobs.has(job) && suggestions.length < 8) {
                    suggestions.push(job);
                    addedJobs.add(job);
                }
            }
        }

        if (currentValue && currentValue.trim() !== '') {
            const search = currentValue.toLowerCase().trim();
            return suggestions.filter(s => 
                s.toLowerCase().includes(search) || 
                s.includes(currentValue)
            ).slice(0, 8);
        }

        return suggestions.slice(0, 10);
    }

    return [];
}

export default function AISuggestButton({ fieldType, context, currentValue, onSelect, fullContext }: AISuggestButtonProps) {
    const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
    const [aiLoading, setAiLoading] = useState(false);

    const localSuggestions = useMemo(() => {
        if (fieldType === 'position' || fieldType === 'jobTitle') {
            return getSmartSuggestions(fieldType, currentValue, fullContext);
        }
        
        const STATIC_SUGGESTIONS: Record<string, string[]> = {
            university: [
                'جامعة حمص', 'جامعة دمشق', 'جامعة حلب', 'جامعة تشرين',
                'جامعة حماة', 'جامعة الفرات', 'جامعة طرطوس',
                'الجامعة الافتراضية السورية', 'الجامعة الوطنية الخاصة',
                'الجامعة العربية الدولية', 'جامعة القلمون',
            ],
            language: [
                'الإنجليزية', 'الفرنسية', 'الألمانية', 'التركية',
                'الروسية', 'الإسبانية', 'الإيطالية', 'الصينية',
            ],
            degree: [
                'بكالوريوس', 'ماجستير', 'دبلوم', 'دكتوراه',
                'شهادة مهنية', 'بكالوريوس هندسي',
            ],
            major: [
                'هندسة برمجيات', 'علوم الحاسوب', 'هندسة كهربائية',
                'هندسة مدنية', 'هندسة ميكانيكية', 'هندسة معمارية',
                'طب بشري', 'صيدلة', 'حقوق', 'إدارة أعمال', 'محاسبة',
            ],
            company: [
                'شركة سيريتل', 'MTN سوريا', 'بنك سورية والخليج',
            ],
            skills: [
                'JavaScript', 'Python', 'React', 'Node.js',
                'تواصل فعّال', 'إدارة وقت', 'تفكير ناقد',
            ],
            hobbies: [
                'القراءة', 'السباحة', 'الرياضة', 'السفر', 'الطبخ',
                'التصوير', 'الرسم', 'الموسيقى', 'الشطرنج', 'البرمجة',
                'المشي', 'ركوب الدراجة', 'البستنة', 'الخط العربي',
                'تعلم لغات', 'الأفلام', 'القراءة والكتابة',
            ],
        };

        const staticList = STATIC_SUGGESTIONS[fieldType] || [];
        
        if (!currentValue || currentValue.trim() === '') {
            return staticList.slice(0, 6);
        }

        const search = currentValue.toLowerCase().trim();
        const exactStart = staticList.filter(s => s.toLowerCase().startsWith(search));
        const contains = staticList.filter(s => s.toLowerCase().includes(search) && !s.toLowerCase().startsWith(search));
        const filtered = [...exactStart, ...contains];
        
        return filtered.length > 0 ? filtered.slice(0, 8) : staticList.slice(0, 6);
    }, [fieldType, currentValue, fullContext]);

    useEffect(() => {
        if (fieldType !== 'position' && fieldType !== 'jobTitle' && fieldType !== 'hobbies') return;
        if (!fullContext?.education?.length && !fullContext?.targetJobTitle && fieldType !== 'hobbies') return;

        const fetchAI = async () => {
            setAiLoading(true);
            try {
                const response = await fetch('/api/ai/smart-suggestions', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        fieldType,
                        currentValue,
                        context: fullContext,
                    }),
                });

                if (response.ok) {
                    const data = await response.json();
                    if (data.suggestions && data.suggestions.length > 0) {
                        setAiSuggestions(data.suggestions);
                    }
                }
            } catch {
                // Silent fail
            }
            setAiLoading(false);
        };

        const timer = setTimeout(fetchAI, 300);
        return () => clearTimeout(timer);
    }, [fieldType, currentValue, fullContext?.education, fullContext?.targetJobTitle]);

    const suggestions = aiSuggestions.length > 0 ? aiSuggestions : localSuggestions;

    const handleSelect = (value: string) => {
        onSelect(value);
    };

    if (suggestions.length === 0) {
        return null;
    }

    return (
        <div className="ai-suggest-container">
            <div className="ai-suggest-label">
                💡 اقتراحات ذكية {aiLoading && <span className="animate-pulse">(جاري التحليل...)</span>}
            </div>
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
            `}</style>
        </div>
    );
}
