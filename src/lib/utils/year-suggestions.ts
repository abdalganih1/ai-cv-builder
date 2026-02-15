/**
 * Smart Year Suggestions for Education
 * Calculates expected start/end years based on birth date, university, and previous education
 */

interface YearSuggestion {
    year: number;
    label: string;
}

interface EducationEntry {
    id: string;
    institution: string;
    degree: string;
    major?: string;
    startYear: string;
    endYear: string;
}

const UNIVERSITY_DURATIONS: Record<string, number> = {
    'جامعة حمص': 5,
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

const DEGREE_ORDER = ['بكالوريوس', 'بكالوريوس هندسي', 'دبلوم', 'شهادة مهنية', 'ماجستير', 'دكتوراه'];

const DEGREE_DURATIONS: Record<string, number> = {
    'بكالوريوس': 4,
    'بكالوريوس هندسي': 5,
    'دبلوم': 2,
    'شهادة مهنية': 1,
    'ماجستير': 2,
    'دكتوراه': 3,
};

export function extractBirthYear(birthDate: string | undefined): number | null {
    if (!birthDate || birthDate === '__skipped__') return null;
    
    const yearMatch = birthDate.match(/\d{4}/);
    if (yearMatch) {
        return parseInt(yearMatch[0], 10);
    }
    return null;
}

function getLastCompletedEducation(education: EducationEntry[] | undefined): EducationEntry | null {
    if (!education || education.length === 0) return null;
    
    const completed = education.filter(e => e.endYear && e.endYear !== '' && e.endYear !== '__skipped__');
    if (completed.length === 0) return null;
    
    completed.sort((a, b) => {
        const yearA = parseInt(a.endYear, 10) || 0;
        const yearB = parseInt(b.endYear, 10) || 0;
        return yearB - yearA;
    });
    
    return completed[0];
}

export function getStartYearSuggestions(
    birthDate: string | undefined,
    _university: string | undefined,
    degree: string | undefined = undefined,
    education: EducationEntry[] | undefined = undefined
): YearSuggestion[] {
    const birthYear = extractBirthYear(birthDate);
    const currentYear = new Date().getFullYear();
    const suggestions: YearSuggestion[] = [];
    
    const lastEducation = getLastCompletedEducation(education);
    const isAdvancedDegree = degree && (degree.includes('ماجستير') || degree.includes('دكتوراه'));
    
    if (isAdvancedDegree && lastEducation?.endYear) {
        const lastEndYear = parseInt(lastEducation.endYear, 10);
        if (!isNaN(lastEndYear)) {
            const expectedStart = lastEndYear + 1;
            
            for (let offset = 0; offset <= 3; offset++) {
                const year = expectedStart + offset;
                if (year >= 2000 && year <= currentYear + 2) {
                    suggestions.push({
                        year,
                        label: offset === 0 ? `${year} (متوقع بعد ${lastEducation.degree || 'التخرج'})` : year.toString(),
                    });
                }
            }
            
            if (suggestions.length > 0) {
                return suggestions;
            }
        }
    }
    
    if (birthYear && !isAdvancedDegree) {
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
    major: string | undefined,
    degree: string | undefined = undefined
): YearSuggestion[] {
    const currentYear = new Date().getFullYear();
    const suggestions: YearSuggestion[] = [];
    
    suggestions.push({
        year: currentYear,
        label: 'حالياً (لا أزال طالباً)',
    });
    
    const start = startYear ? parseInt(startYear, 10) : null;
    
    if (start && !isNaN(start)) {
        let estimatedDuration = DEGREE_DURATIONS[degree || ''] || 4;
        
        if (degree && DEGREE_DURATIONS[degree]) {
            estimatedDuration = DEGREE_DURATIONS[degree];
        } else {
            const baseDuration = UNIVERSITY_DURATIONS[university || ''] || 4;
            estimatedDuration = baseDuration;
            
            if (major) {
                const majorLower = major.toLowerCase();
                if (LONG_PROGRAMS.some(p => majorLower.includes(p.toLowerCase()))) {
                    estimatedDuration = 5;
                } else if (SHORT_PROGRAMS.some(p => majorLower.includes(p.toLowerCase()))) {
                    estimatedDuration = 2;
                }
            }
        }
        
        for (let extraYears = 0; extraYears <= 2; extraYears++) {
            const duration = estimatedDuration + extraYears;
            const endYear = start + duration;
            
            if (endYear <= currentYear + 5) {
                if (extraYears === 0) {
                    suggestions.push({
                        year: endYear,
                        label: `${endYear} (${duration === 1 ? 'سنة' : duration === 2 ? 'سنتين' : `${duration} سنوات`} - متوقع)`,
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
    startYear?: string,
    degree?: string,
    education?: EducationEntry[]
): YearSuggestion[] {
    if (type === 'start') {
        return getStartYearSuggestions(birthDate, university, degree, education);
    } else {
        return getEndYearSuggestions(startYear, university, major, degree);
    }
}
