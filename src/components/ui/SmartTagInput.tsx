'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';

// ═══════════════════════════════════════════════════════════
// قاعدة بيانات المهارات حسب التخصص والوظيفة
// ═══════════════════════════════════════════════════════════

const SKILLS_BY_CATEGORY: Record<string, string[]> = {
    // مهارات تقنية عامة
    'تقنية': [
        'JavaScript', 'TypeScript', 'Python', 'Java', 'C++', 'C#', 'PHP', 'Ruby', 'Go', 'Rust', 'Swift', 'Kotlin',
        'React', 'Angular', 'Vue.js', 'Next.js', 'Node.js', 'Express.js', 'Django', 'Flask', 'Laravel', 'Spring Boot',
        'HTML', 'CSS', 'Sass', 'Tailwind CSS', 'Bootstrap',
        'SQL', 'MySQL', 'PostgreSQL', 'MongoDB', 'Redis', 'Firebase',
        'Git', 'GitHub', 'Docker', 'Kubernetes', 'AWS', 'Azure', 'Google Cloud',
        'Linux', 'Windows Server', 'Nginx', 'Apache',
        'REST API', 'GraphQL', 'WebSocket',
        'React Native', 'Flutter', 'Dart',
        'TensorFlow', 'PyTorch', 'scikit-learn', 'Pandas', 'NumPy',
        'Figma', 'Adobe Photoshop', 'Adobe Illustrator', 'Adobe XD',
        'CI/CD', 'Jenkins', 'GitHub Actions',
        'Agile', 'Scrum', 'Jira',
    ],
    // مهارات هندسة
    'هندسة': [
        'AutoCAD', 'SolidWorks', 'CATIA', 'Revit', 'MATLAB', 'Simulink',
        'ETABS', 'SAP2000', 'STAAD Pro', 'Primavera P6',
        'تصميم إنشائي', 'إدارة مشاريع', 'حساب كميات', 'إشراف هندسي',
        'تصميم معماري', 'تخطيط حضري', '3D Max', 'SketchUp', 'Lumion',
        'PLC Programming', 'SCADA', 'تحكم آلي', 'أتمتة صناعية',
        'تصميم دوائر كهربائية', 'قراءة مخططات', 'صيانة معدات',
    ],
    // مهارات طبية
    'طبية': [
        'تشخيص سريري', 'رعاية مرضى', 'إسعافات أولية', 'تحاليل مخبرية',
        'تصوير طبي', 'عمليات جراحية', 'تخدير', 'أشعة',
        'صيدلة سريرية', 'تحضير أدوية', 'إدارة مستشفيات',
        'تمريض متقدم', 'عناية مركزة', 'طوارئ',
    ],
    // مهارات إدارية ومالية
    'إدارية': [
        'إدارة فريق', 'إدارة مشاريع', 'تخطيط استراتيجي', 'إدارة عمليات',
        'إدارة موارد بشرية', 'تطوير أعمال', 'تسويق رقمي',
        'محاسبة', 'تدقيق حسابات', 'تحليل مالي', 'إعداد ميزانيات',
        'ERP Systems', 'SAP', 'Oracle', 'QuickBooks',
        'إدارة مبيعات', 'خدمة عملاء', 'علاقات عامة',
        'تحليل بيانات', 'إعداد تقارير', 'عروض تقديمية',
    ],
    // مهارات قانونية
    'قانونية': [
        'صياغة عقود', 'استشارات قانونية', 'ترافع أمام المحاكم',
        'قانون تجاري', 'قانون مدني', 'قانون جنائي', 'قانون دولي',
        'تحكيم', 'وساطة', 'بحث قانوني',
    ],
    // مهارات شخصية (Soft Skills)
    'شخصية': [
        'تواصل فعّال', 'عمل جماعي', 'حل مشكلات', 'تفكير ناقد', 'تفكير إبداعي',
        'إدارة وقت', 'قيادة', 'تفاوض', 'عرض وتقديم', 'اتخاذ قرارات',
        'مرونة وتكيّف', 'ذكاء عاطفي', 'إدارة ضغوط', 'تنظيم وترتيب',
        'خدمة عملاء', 'بناء علاقات', 'التعلم الذاتي', 'الانتباه للتفاصيل',
    ],
    // مهارات لغوية وإعلامية
    'لغوية': [
        'ترجمة', 'تحرير', 'كتابة محتوى', 'كتابة إبداعية',
        'تدقيق لغوي', 'ترجمة فورية', 'كتابة تقنية',
        'تحرير فيديو', 'مونتاج', 'تصوير فوتوغرافي', 'تصوير فيديو',
        'إدارة محتوى', 'SEO', 'وسائل تواصل اجتماعي',
    ],
    // أدوات عامة
    'أدوات': [
        'Microsoft Office', 'Microsoft Word', 'Microsoft Excel', 'Microsoft PowerPoint',
        'Google Workspace', 'Google Sheets', 'Google Docs',
        'Zoom', 'Microsoft Teams', 'Slack',
        'Canva', 'WordPress', 'Shopify',
    ],
};

// ربط التخصصات بفئات المهارات ذات الصلة
const MAJOR_TO_SKILL_CATEGORIES: Record<string, string[]> = {
    'هندسة برمجيات': ['تقنية', 'شخصية', 'أدوات'],
    'علوم الحاسوب': ['تقنية', 'شخصية', 'أدوات'],
    'تقانة المعلومات': ['تقنية', 'شخصية', 'أدوات'],
    'هندسة الحاسوب': ['تقنية', 'هندسة', 'شخصية'],
    'الذكاء الاصطناعي': ['تقنية', 'شخصية'],
    'هندسة مدنية': ['هندسة', 'شخصية', 'أدوات'],
    'هندسة معمارية': ['هندسة', 'شخصية', 'أدوات'],
    'هندسة كهربائية': ['هندسة', 'تقنية', 'شخصية'],
    'هندسة ميكانيكية': ['هندسة', 'شخصية', 'أدوات'],
    'هندسة اتصالات': ['هندسة', 'تقنية', 'شخصية'],
    'هندسة إلكترونية': ['هندسة', 'تقنية', 'شخصية'],
    'ميكاترونيكس': ['هندسة', 'تقنية', 'شخصية'],
    'طب بشري': ['طبية', 'شخصية'],
    'طب أسنان': ['طبية', 'شخصية'],
    'صيدلة': ['طبية', 'شخصية', 'إدارية'],
    'تمريض': ['طبية', 'شخصية'],
    'حقوق': ['قانونية', 'شخصية', 'أدوات'],
    'إدارة أعمال': ['إدارية', 'شخصية', 'أدوات'],
    'محاسبة': ['إدارية', 'شخصية', 'أدوات'],
    'اقتصاد': ['إدارية', 'شخصية', 'أدوات'],
    'تسويق': ['إدارية', 'لغوية', 'شخصية', 'أدوات'],
    'ترجمة': ['لغوية', 'شخصية', 'أدوات'],
    'إعلام': ['لغوية', 'شخصية', 'أدوات'],
    'صحافة': ['لغوية', 'شخصية', 'أدوات'],
    'تربية': ['شخصية', 'أدوات', 'لغوية'],
    'تصميم غرافيكي': ['تقنية', 'شخصية', 'لغوية'],
};

const HOBBIES_DATABASE = [
    'القراءة', 'الكتابة', 'الكتابة الإبداعية', 'التأليف',
    'السباحة', 'الجري', 'المشي', 'ركوب الدراجة', 'كرة القدم', 'كرة السلة', 'التنس', 'الرياضة',
    'اللياقة البدنية', 'كمال الأجسام', 'اليوغا', 'التأمل',
    'السفر', 'التخييم', 'المغامرات', 'تسلق الجبال', 'الغوص',
    'الطبخ', 'الخبز', 'فنون الطهي',
    'التصوير الفوتوغرافي', 'تصوير الفيديو', 'المونتاج',
    'الرسم', 'الفن التشكيلي', 'الخط العربي', 'النحت', 'الأشغال اليدوية',
    'الموسيقى', 'العزف', 'الغناء', 'الاستماع للموسيقى',
    'الشطرنج', 'ألعاب الطاولة', 'ألعاب الفيديو',
    'البرمجة', 'تطوير التطبيقات', 'الأمن السيبراني', 'الذكاء الاصطناعي',
    'تعلم اللغات', 'اللغة الإنجليزية', 'اللغة الفرنسية', 'اللغة التركية',
    'مشاهدة الأفلام', 'مشاهدة المسلسلات', 'المسرح', 'السينما',
    'البستنة', 'الزراعة المنزلية', 'العناية بالنباتات',
    'التطوع', 'العمل الخيري', 'خدمة المجتمع',
    'التاريخ', 'الفلك', 'العلوم', 'الفلسفة',
    'التصميم الداخلي', 'تصميم الأزياء', 'الموضة',
    'الطيران', 'صناعة الطائرات المسيّرة (درونز)',
    'الصيد', 'ركوب الخيل', 'رياضات المغامرة',
];

// ═══════════════════════════════════════════════════════════
// المكون الرئيسي
// ═══════════════════════════════════════════════════════════

interface SmartTagInputProps {
    tags: string[];
    onChange: (tags: string[]) => void;
    onSubmit: () => void;
    fieldType: 'skills' | 'hobbies';
    placeholder?: string;
    // سياق لتخصيص الاقتراحات
    context?: {
        major?: string;
        targetJobTitle?: string;
        education?: Array<{ major?: string; degree?: string; institution?: string }>;
        experience?: Array<{ position?: string; company?: string }>;
    };
}

export default function SmartTagInput({ tags, onChange, onSubmit, fieldType, placeholder, context }: SmartTagInputProps) {
    const [inputValue, setInputValue] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(true);
    const [highlightIndex, setHighlightIndex] = useState(-1);
    const inputRef = useRef<HTMLInputElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // حساب الاقتراحات المخصصة حسب التخصص
    const allSuggestions = useMemo(() => {
        if (fieldType === 'hobbies') return HOBBIES_DATABASE;

        const suggestionsSet = new Set<string>();

        // 1. مهارات مخصصة حسب التخصص
        const majors = context?.education?.map(e => e.major).filter(Boolean) as string[] || [];
        for (const major of majors) {
            const categories = MAJOR_TO_SKILL_CATEGORIES[major];
            if (categories) {
                for (const cat of categories) {
                    const skills = SKILLS_BY_CATEGORY[cat];
                    if (skills) skills.forEach(s => suggestionsSet.add(s));
                }
            }
            // بحث جزئي في المفاتيح
            for (const [key, cats] of Object.entries(MAJOR_TO_SKILL_CATEGORIES)) {
                if (major.includes(key) || key.includes(major)) {
                    for (const cat of cats) {
                        const skills = SKILLS_BY_CATEGORY[cat];
                        if (skills) skills.forEach(s => suggestionsSet.add(s));
                    }
                }
            }
        }

        // 2. مهارات شخصية وأدوات عامة دائماً
        SKILLS_BY_CATEGORY['شخصية']?.forEach(s => suggestionsSet.add(s));
        SKILLS_BY_CATEGORY['أدوات']?.forEach(s => suggestionsSet.add(s));

        // 3. إذا لم يوجد تخصص، إضافة كل المهارات
        if (suggestionsSet.size < 20) {
            Object.values(SKILLS_BY_CATEGORY).forEach(skills =>
                skills.forEach(s => suggestionsSet.add(s))
            );
        }

        return Array.from(suggestionsSet);
    }, [fieldType, context?.education]);

    // فلترة الاقتراحات حسب ما يكتبه المستخدم
    const filteredSuggestions = useMemo(() => {
        const added = new Set(tags.map(t => t.toLowerCase()));
        let results = allSuggestions.filter(s => !added.has(s.toLowerCase()));

        if (inputValue.trim()) {
            const search = inputValue.toLowerCase().trim();
            results = results.filter(s =>
                s.toLowerCase().includes(search) ||
                s.toLowerCase().startsWith(search)
            );
            // ترتيب: الأقرب أولاً (startsWith قبل includes)
            results.sort((a, b) => {
                const aStarts = a.toLowerCase().startsWith(search) ? 0 : 1;
                const bStarts = b.toLowerCase().startsWith(search) ? 0 : 1;
                return aStarts - bStarts;
            });
        }

        return results.slice(0, 12);
    }, [allSuggestions, inputValue, tags]);

    // إضافة tag جديد
    const addTag = useCallback((value: string) => {
        const trimmed = value.trim();
        if (!trimmed) return;
        if (tags.some(t => t.toLowerCase() === trimmed.toLowerCase())) return;
        onChange([...tags, trimmed]);
        setInputValue('');
        setHighlightIndex(-1);
        inputRef.current?.focus();
    }, [tags, onChange]);

    // حذف tag
    const removeTag = useCallback((index: number) => {
        onChange(tags.filter((_, i) => i !== index));
        inputRef.current?.focus();
    }, [tags, onChange]);

    // التعامل مع الإدخال
    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            if (highlightIndex >= 0 && highlightIndex < filteredSuggestions.length) {
                addTag(filteredSuggestions[highlightIndex]);
            } else if (inputValue.trim()) {
                addTag(inputValue);
            }
        } else if (e.key === ',' || e.key === '،') {
            e.preventDefault();
            if (inputValue.trim()) {
                addTag(inputValue);
            }
        } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
            removeTag(tags.length - 1);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightIndex(prev =>
                prev < filteredSuggestions.length - 1 ? prev + 1 : 0
            );
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightIndex(prev =>
                prev > 0 ? prev - 1 : filteredSuggestions.length - 1
            );
        } else if (e.key === 'Escape') {
            setShowSuggestions(false);
        }
    };

    // إظهار الاقتراحات عند الكتابة
    useEffect(() => {
        setShowSuggestions(true);
        setHighlightIndex(-1);
    }, [inputValue]);

    // إغلاق الاقتراحات عند النقر خارج المكون
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div ref={containerRef} className="smart-tag-input-wrapper">
            {/* Tags المحددة */}
            <div
                className="smart-tag-input-container"
                onClick={() => inputRef.current?.focus()}
            >
                {tags.map((tag, idx) => (
                    <span key={idx} className="smart-tag">
                        <span className="smart-tag-text">{tag}</span>
                        <button
                            type="button"
                            className="smart-tag-remove"
                            onClick={(e) => { e.stopPropagation(); removeTag(idx); }}
                            aria-label={`حذف ${tag}`}
                        >
                            ×
                        </button>
                    </span>
                ))}
                <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    onFocus={() => setShowSuggestions(true)}
                    placeholder={tags.length === 0 ? (placeholder || 'ابدأ بالكتابة...') : 'أضف المزيد...'}
                    className="smart-tag-input"
                    dir="auto"
                />
            </div>

            {/* قائمة الاقتراحات المنسدلة */}
            {showSuggestions && filteredSuggestions.length > 0 && (
                <div className="smart-tag-suggestions">
                    <div className="smart-tag-suggestions-header">
                        💡 {inputValue ? 'نتائج البحث' : 'اقتراحات ذكية'} — اضغط للإضافة
                    </div>
                    <div className="smart-tag-suggestions-list">
                        {filteredSuggestions.map((suggestion, idx) => (
                            <button
                                key={idx}
                                type="button"
                                className={`smart-tag-suggestion-item ${idx === highlightIndex ? 'highlighted' : ''}`}
                                onClick={() => addTag(suggestion)}
                                onMouseEnter={() => setHighlightIndex(idx)}
                            >
                                <span className="smart-tag-suggestion-plus">+</span>
                                {suggestion}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* عدّاد ورسالة مساعدة */}
            <div className="smart-tag-footer">
                <span className="smart-tag-count">
                    {tags.length > 0 ? `${tags.length} ${fieldType === 'skills' ? 'مهارة' : 'هواية'}` : ''}
                </span>
                <span className="smart-tag-hint">
                    اضغط Enter أو فاصلة لإضافة • ← → للتنقل
                </span>
            </div>

            {/* زر المتابعة */}
            {tags.length > 0 && (
                <button
                    type="button"
                    className="smart-tag-submit"
                    onClick={onSubmit}
                >
                    ✓ متابعة ({tags.length} {fieldType === 'skills' ? 'مهارات' : 'هوايات'})
                </button>
            )}

            <style jsx>{`
                .smart-tag-input-wrapper {
                    width: 100%;
                    direction: rtl;
                    position: relative;
                }

                .smart-tag-input-container {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                    padding: 12px 14px;
                    min-height: 56px;
                    background: rgba(255, 255, 255, 0.06);
                    border: 2px solid rgba(99, 102, 241, 0.3);
                    border-radius: 16px;
                    cursor: text;
                    transition: all 0.3s ease;
                    align-items: center;
                }

                .smart-tag-input-container:focus-within {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                    background: rgba(255, 255, 255, 0.08);
                }

                .smart-tag {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 12px;
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    color: white;
                    border-radius: 20px;
                    font-size: 14px;
                    font-weight: 500;
                    animation: tagAppear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
                    box-shadow: 0 2px 8px rgba(79, 70, 229, 0.3);
                }

                @keyframes tagAppear {
                    from {
                        transform: scale(0.5);
                        opacity: 0;
                    }
                    to {
                        transform: scale(1);
                        opacity: 1;
                    }
                }

                .smart-tag-text {
                    max-width: 180px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                    white-space: nowrap;
                }

                .smart-tag-remove {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 20px;
                    height: 20px;
                    padding: 0;
                    background: rgba(255, 255, 255, 0.2);
                    border: none;
                    border-radius: 50%;
                    color: white;
                    font-size: 14px;
                    line-height: 1;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .smart-tag-remove:hover {
                    background: rgba(255, 255, 255, 0.4);
                    transform: scale(1.1);
                }

                .smart-tag-input {
                    flex: 1;
                    min-width: 120px;
                    border: none;
                    background: transparent;
                    outline: none;
                    font-size: 16px;
                    color: inherit;
                    padding: 4px 0;
                }

                .smart-tag-input::placeholder {
                    color: rgba(148, 163, 184, 0.6);
                }

                .smart-tag-suggestions {
                    position: absolute;
                    top: calc(100% + 4px);
                    left: 0;
                    right: 0;
                    background: #1e1b4b;
                    border: 1.5px solid rgba(99, 102, 241, 0.4);
                    border-radius: 14px;
                    box-shadow: 0 12px 40px rgba(0, 0, 0, 0.4);
                    z-index: 50;
                    overflow: hidden;
                    animation: dropdownAppear 0.2s ease;
                }

                @keyframes dropdownAppear {
                    from {
                        opacity: 0;
                        transform: translateY(-8px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                .smart-tag-suggestions-header {
                    padding: 10px 14px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #a5b4fc;
                    border-bottom: 1px solid rgba(99, 102, 241, 0.2);
                }

                .smart-tag-suggestions-list {
                    max-height: 240px;
                    overflow-y: auto;
                    padding: 6px;
                }

                .smart-tag-suggestions-list::-webkit-scrollbar {
                    width: 4px;
                }

                .smart-tag-suggestions-list::-webkit-scrollbar-thumb {
                    background: rgba(99, 102, 241, 0.3);
                    border-radius: 2px;
                }

                .smart-tag-suggestion-item {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    width: 100%;
                    padding: 10px 12px;
                    background: transparent;
                    border: none;
                    border-radius: 10px;
                    color: #e2e8f0;
                    font-size: 14px;
                    cursor: pointer;
                    transition: all 0.15s;
                    text-align: right;
                    direction: rtl;
                }

                .smart-tag-suggestion-item:hover,
                .smart-tag-suggestion-item.highlighted {
                    background: rgba(99, 102, 241, 0.2);
                    color: #c7d2fe;
                }

                .smart-tag-suggestion-plus {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    width: 22px;
                    height: 22px;
                    background: rgba(99, 102, 241, 0.3);
                    border-radius: 6px;
                    font-size: 16px;
                    font-weight: 700;
                    color: #a5b4fc;
                    flex-shrink: 0;
                }

                .smart-tag-footer {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 8px;
                    padding: 0 4px;
                }

                .smart-tag-count {
                    font-size: 13px;
                    font-weight: 600;
                    color: #a5b4fc;
                }

                .smart-tag-hint {
                    font-size: 11px;
                    color: rgba(148, 163, 184, 0.5);
                }

                .smart-tag-submit {
                    margin-top: 16px;
                    width: 100%;
                    padding: 14px 24px;
                    background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%);
                    color: white;
                    border: none;
                    border-radius: 14px;
                    font-size: 16px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    box-shadow: 0 4px 15px rgba(79, 70, 229, 0.3);
                }

                .smart-tag-submit:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 8px 25px rgba(79, 70, 229, 0.4);
                }

                .smart-tag-submit:active {
                    transform: translateY(0);
                }
            `}</style>
        </div>
    );
}
