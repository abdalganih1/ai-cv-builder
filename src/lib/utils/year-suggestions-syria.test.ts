import { describe, it, expect } from 'vitest';
import { getYearSuggestions } from './year-suggestions';

describe('سنة التخرج — الهندسة بسوريا 5 سنوات', () => {
    it('بكالوريوس هندسة اتصالات → أول اقتراح متوقع 5 سنوات', () => {
        const s = getYearSuggestions('end', undefined, 'جامعة دمشق', 'هندسة الاتصالات', '2019', 'بكالوريوس');
        // أول اقتراح متوقع = 2019+5 = 2024 مع ليبل يحتوي "5 سنوات"
        const expected = s.find(x => x.year === 2024);
        expect(expected).toBeDefined();
        expect(expected!.label).toContain('5 سنوات');
    });

    it('بكالوريوس هندسة معلوماتية → 5 سنوات', () => {
        const s = getYearSuggestions('end', undefined, 'جامعة حلب', 'هندسة المعلوماتية', '2020', 'بكالوريوس');
        const expected = s.find(x => x.year === 2025);
        expect(expected).toBeDefined();
        expect(expected!.label).toContain('5 سنوات');
    });

    it('بكالوريوس حقوق (مو هندسة) → يبقى 4 (بكالوريوس DEGREE_DURATIONS)', () => {
        const s = getYearSuggestions('end', undefined, 'جامعة دمشق', 'حقوق', '2019', 'بكالوريوس');
        const expected = s.find(x => x.year === 2023);
        expect(expected).toBeDefined();
        expect(expected!.label).toContain('4 سنوات');
    });

    it('بكالوريوس هندسة الحواسيب → 5 سنوات', () => {
        const s = getYearSuggestions('end', undefined, 'جامعة تشرين', 'هندسة الحواسيب', '2018', 'بكالوريوس');
        const expected = s.find(x => x.year === 2023);
        expect(expected).toBeDefined();
        expect(expected!.label).toContain('5 سنوات');
    });

    it('بكالوريوس هندسة التحكم الآلي → 5 سنوات', () => {
        const s = getYearSuggestions('end', undefined, 'جامعة حلب', 'هندسة التحكم الآلي', '2021', 'بكالوريوس');
        const labeled = s.find(x => x.label.includes('5 سنوات') || (x.year === 2026));
        expect(labeled).toBeDefined();
        expect(labeled!.year).toBe(2026);
    });
});
