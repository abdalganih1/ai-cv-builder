'use client';

import { useRef, useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════
// كاروسيل اختيار الجامعة — شعارات كبيرة قابلة للسحب أفقياً
// المصادر: WPU-Book (شعارات نظيفة) + Wikipedia (صور رسمية)
// ═══════════════════════════════════════════════════════════════

export interface UniversityItem {
    name: string;
    logo?: string;        // مسار الشعار /logos/xxx
    shortName?: string;   // اختصار للعرض (WPU, IUST...)
    color: string;        // لون الهوية للفالباك
}

export const SYRIAN_UNIVERSITIES: UniversityItem[] = [
    { name: 'جامعة دمشق', logo: '/logos/damascus_sq.png', color: '#1e6091' },
    { name: 'جامعة حلب', logo: '/logos/aleppo.png', color: '#b91c1c' },
    { name: 'جامعة حمص', logo: '/logos/homs.webp', color: '#15803d' },
    { name: 'جامعة تشرين', color: '#0f766e' },
    { name: 'جامعة حماة', logo: '/logos/hama.png', color: '#a16207' },
    { name: 'جامعة الفرات', color: '#7e22ce' },
    { name: 'جامعة طرطوس', color: '#0369a1' },
    { name: 'الجامعة الافتراضية السورية', logo: '/logos/svu_sq.png', shortName: 'SVU', color: '#1d4ed8' },
    { name: 'الجامعة الوطنية الخاصة (WPU)', logo: '/logos/watuaniya.png', shortName: 'WPU', color: '#be185d' },
    { name: 'الجامعة العربية الدولية (IUST)', logo: '/logos/arabia.png', shortName: 'IUST', color: '#4d7c0f' },
    { name: 'جامعة القلمون الخاصة', logo: '/logos/qalamoun_sq.png', color: '#9a3412' },
    { name: 'جامعة الحواش الخاصة', logo: '/logos/hawash.png', color: '#334155' },
];

interface Props {
    value: string;
    onSelect: (name: string) => void;
}

export default function UniversityCarousel({ value, onSelect }: Props) {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [startX, setStartX] = useState(0);
    const [scrollStart, setScrollStart] = useState(0);
    const [moved, setMoved] = useState(0);

    // drag-to-scroll (ماوس + لمس عبر scroll native)
    const onMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setStartX(e.pageX);
        setScrollStart(scrollerRef.current?.scrollLeft ?? 0);
        setMoved(0);
    };
    const onMouseMove = (e: React.MouseEvent) => {
        if (!isDragging || !scrollerRef.current) return;
        e.preventDefault();
        const dx = e.pageX - startX;
        setMoved(Math.abs(dx));
        scrollerRef.current.scrollLeft = scrollStart - dx;
    };
    const endDrag = () => setIsDragging(false);

    return (
        <div className="w-full" dir="rtl">
            <div
                ref={scrollerRef}
                className="flex gap-4 overflow-x-auto pb-3 pt-1 cursor-grab active:cursor-grabbing select-none"
                style={{
                    scrollbarWidth: 'thin',
                    scrollSnapType: 'x mandatory',
                    WebkitOverflowScrolling: 'touch',
                }}
                onMouseDown={onMouseDown}
                onMouseMove={onMouseMove}
                onMouseUp={endDrag}
                onMouseLeave={endDrag}
            >
                {SYRIAN_UNIVERSITIES.map((u) => {
                    const selected = value === u.name;
                    return (
                        <button
                            key={u.name}
                            type="button"
                            onClick={() => {
                                if (moved < 6) onSelect(u.name); // تجاهل النقر بعد سحب
                            }}
                            className="flex flex-col items-center gap-2 shrink-0 group"
                            style={{ scrollSnapAlign: 'start', width: 108 }}
                            aria-pressed={selected}
                        >
                            <span
                                className={`flex items-center justify-center rounded-2xl transition-all duration-200 ${
                                    selected
                                        ? 'ring-4 ring-offset-2 scale-105 shadow-lg'
                                        : 'ring-1 ring-gray-200 group-hover:ring-primary/50 group-hover:scale-105'
                                }`}
                                style={{
                                    width: 88,
                                    height: 88,
                                    background: '#ffffff',
                                    // @ts-ignore CSS custom prop
                                    '--tw-ring-color': selected ? u.color : undefined,
                                }}
                            >
                                {u.logo ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={u.logo}
                                        alt={u.name}
                                        draggable={false}
                                        className="w-[72px] h-[72px] object-contain"
                                        loading="lazy"
                                    />
                                ) : (
                                    <span
                                        className="text-2xl font-black"
                                        style={{ color: u.color }}
                                    >
                                        {u.shortName || u.name.replace('جامعة ', '').slice(0, 2)}
                                    </span>
                                )}
                            </span>
                            <span
                                className={`text-[11px] leading-tight text-center font-bold transition-colors ${
                                    selected ? 'text-gray-900' : 'text-gray-500 group-hover:text-gray-700'
                                }`}
                            >
                                {u.shortName ? `${u.name.split(' (')[0]}` : u.name}
                            </span>
                            {selected && (
                                <span
                                    className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                                    style={{ background: u.color }}
                                >
                                    ✓ محدد
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
            <div className="text-center text-xs text-gray-400 mt-1">
                ← اسحب لرؤية المزيد →
            </div>
        </div>
    );
}
