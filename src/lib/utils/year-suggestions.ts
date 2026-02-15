/**
 * Smart Year Suggestions for Education
 * Calculates expected start/end years based on birth date and university
 */

interface YearSuggestion {
    year: number;
    label: string;
}

const UNIVERSITY_DURATIONS: Record<string, number> = {
    'جامعة البعث': 5,
    'جامعة دمشق': 5,
    'جامعة حلب': 5,
    'جامعة تشرين': 5,
    'جامعة حماة': 5,
    'جامعة الفرات': 5,
    'جامعة طرطوس': 5,
    'الجامعة الافتراضية السورية': 4,
    'الجامعة الوطنية الخاصة': 4,
    'الجامعة العربية الدولية': 4,
    'جامعة القلمون': 4,
    'الجامعة السورية الخاصة': 4,
    'جامعة الوادي الدولية': 4,
    'الجامعة الدولية للعلوم والتكنولوجيا': 4,
    'جامعة اليرموك الخاصة': 4,
    'جامعة الرشيد الدولية': 4,
    'جامعة قرطبة الخاصة': 4,
};

const LONG_PROGRAMS = [
    'طب بشري', 'طب عام', 'طب أسنان', 'صيدلة', 'هندسة معمارية',
    'هندسة مدنية', 'هندسة كهربائية', 'هندسة ميكانيكية', 'هندسة اتصالات',
    'هندسة إلكترونية', 'هندسة كيميائية', 'هندسة بترولية', 'هندسة طبية حيوية',
];

const SHORT_PROGRAMS = [
    'دبلوم', 'شهادة مهنية', 'دورة',
];

export function extractBirthYear(birthDate: string | undefined): number | null {
    if (!birthDate || birthDate === '__skipped__') return null;
    
    const yearMatch = birthDate.match(/\d{4}/);
    if (yearMatch) {
        return parseInt(yearMatch[0], 10);
    }
    return null;
}

export function getStartYearSuggestions(
    birthDate: string | undefined,
    _university: string | undefined
): YearSuggestion[] {
    const birthYear = extractBirthYear(birthDate);
    const currentYear = new Date().getFullYear();
    const suggestions: YearSuggestion[] = [];
    
    if (birthYear) {
        const expectedStartYear = birthYear + 18;
        
        for (let offset = -2; offset <= 2; offset++) {
            const year = expectedStartYear + offset;
            if (year >= 2000 && year <= currentYear) {
                suggestions.push({
                    year,
                    label: offset === 0 ? `${year} (متوقع)` : year.toString(),
                });
            }
        }
    }
    
    if (suggestions.length === 0) {
        for (let offset = 0; offset <= 5; offset++) {
            const year = currentYear - offset;
            suggestions.push({
                year,
                label: year.toString(),
            });
        }
    }
    
    return suggestions;
}

export function getEndYearSuggestions(
    startYear: string | undefined,
    university: string | undefined,
    major: string | undefined
): YearSuggestion[] {
    const currentYear = new Date().getFullYear();
    const suggestions: YearSuggestion[] = [];
    
    suggestions.push({
        year: currentYear,
        label: 'حالياً (لا أزال طالباً)',
    });
    
    const start = startYear ? parseInt(startYear, 10) : null;
    
    if (start && !isNaN(start)) {
        const baseDuration = UNIVERSITY_DURATIONS[university || ''] || 4;
        
        let estimatedDuration = baseDuration;
        
        if (major) {
            const majorLower = major.toLowerCase();
            if (LONG_PROGRAMS.some(p => majorLower.includes(p.toLowerCase()))) {
                estimatedDuration = 5;
            } else if (SHORT_PROGRAMS.some(p => majorLower.includes(p.toLowerCase()))) {
                estimatedDuration = 2;
            }
        }
        
        for (let extraYears = 0; extraYears <= 2; extraYears++) {
            const duration = estimatedDuration + extraYears;
            const endYear = start + duration;
            
            if (endYear <= currentYear + 5) {
                if (extraYears === 0 && duration === 4) {
                    suggestions.push({
                        year: endYear,
                        label: `${endYear} (${duration} سنوات - متوقع)`,
                    });
                } else if (extraYears === 0 && duration === 5) {
                    suggestions.push({
                        year: endYear,
                        label: `${endYear} (${duration} سنوات - متوقع)`,
                    });
                } else if (extraYears === 0 && duration === 2) {
                    suggestions.push({
                        year: endYear,
                        label: `${endYear} (${duration} سنتين - متوقع)`,
                    });
                } else if (extraYears === 0 && duration === 6) {
                    suggestions.push({
                        year: endYear,
                        label: `${endYear} (${duration} سنوات)`,
                    });
                } else {
                    suggestions.push({
                        year: endYear,
                        label: endYear.toString(),
                    });
                }
            }
        }
    }
    
    if (suggestions.length < 3) {
        for (let offset = 1; offset <= 3; offset++) {
            const year = currentYear - offset;
            if (!suggestions.some(s => s.year === year)) {
                suggestions.push({
                    year,
                    label: year.toString(),
                });
            }
        }
    }
    
    return suggestions;
}

export function getYearSuggestions(
    type: 'start' | 'end',
    birthDate: string | undefined,
    university: string | undefined,
    major?: string,
    startYear?: string
): YearSuggestion[] {
    if (type === 'start') {
        return getStartYearSuggestions(birthDate, university);
    } else {
        return getEndYearSuggestions(startYear, university, major);
    }
}
