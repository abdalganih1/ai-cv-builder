/**
 * Smart Year Suggestions for Education
 * Comprehensive algorithm that handles all education entry scenarios
 */

export interface YearSuggestion {
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

const SHORT_PROGRAMS = ['دبلوم', 'شهادة مهنية', 'دورة'];

const DEGREE_ORDER: Record<string, number> = {
    'دكتوراه': 4,
    'ماجستير': 3,
    'بكالوريوس هندسي': 2,
    'بكالوريوس': 1,
    'دبلوم': 0,
    'شهادة مهنية': 0,
};

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
    return yearMatch ? parseInt(yearMatch[0], 10) : null;
}

function getDegreeLevel(degree: string): number {
    if (!degree) return 0;
    for (const [key, level] of Object.entries(DEGREE_ORDER)) {
        if (degree.includes(key)) return level;
    }
    return 0;
}

function normalizeDegree(degree: string): string {
    if (!degree) return '';
    if (degree.includes('دكتوراه')) return 'دكتوراه';
    if (degree.includes('ماجستير')) return 'ماجستير';
    if (degree.includes('بكالوريوس هندسي')) return 'بكالوريوس هندسي';
    if (degree.includes('بكالوريوس')) return 'بكالوريوس';
    if (degree.includes('دبلوم')) return 'دبلوم';
    if (degree.includes('شهادة مهنية')) return 'شهادة مهنية';
    return degree;
}

function parseYear(year: string | undefined): number | null {
    if (!year || year === '__skipped__') return null;
    const parsed = parseInt(year, 10);
    return isNaN(parsed) ? null : parsed;
}

interface EducationAnalysis {
    hasHigherEducation: boolean;
    hasLowerEducation: boolean;
    lastHigherEndYear: number | null;
    lastHigherStartYear: number | null;
    lastLowerEndYear: number | null;
    lastLowerStartYear: number | null;
    lowerEducationDuration: number;
    allEducationYears: number[];
    currentDegreeLevel: number;
}

function analyzeEducation(
    currentDegree: string | undefined,
    education: EducationEntry[] | undefined,
    currentEntryIndex: number | null
): EducationAnalysis {
    const currentLevel = getDegreeLevel(currentDegree || '');
    const allEducationYears: number[] = [];
    let hasHigherEducation = false;
    let hasLowerEducation = false;
    let lastHigherEndYear: number | null = null;
    let lastHigherStartYear: number | null = null;
    let lastLowerEndYear: number | null = null;
    let lastLowerStartYear: number | null = null;
    let lowerEducationDuration = 4;

    if (!education || education.length === 0) {
        return {
            hasHigherEducation: false,
            hasLowerEducation: false,
            lastHigherEndYear: null,
            lastHigherStartYear: null,
            lastLowerEndYear: null,
            lastLowerStartYear: null,
            lowerEducationDuration,
            allEducationYears,
            currentDegreeLevel: currentLevel,
        };
    }

    for (let i = 0; i < education.length; i++) {
        if (currentEntryIndex !== null && i === currentEntryIndex) continue;

        const edu = education[i];
        const eduLevel = getDegreeLevel(edu.degree);
        const startYear = parseYear(edu.startYear);
        const endYear = parseYear(edu.endYear);

        if (startYear) allEducationYears.push(startYear);
        if (endYear) allEducationYears.push(endYear);

        if (eduLevel > currentLevel) {
            hasHigherEducation = true;
            if (endYear && (!lastHigherEndYear || endYear > lastHigherEndYear)) {
                lastHigherEndYear = endYear;
            }
            if (startYear && (!lastHigherStartYear || startYear > lastHigherStartYear)) {
                lastHigherStartYear = startYear;
            }
        } else if (eduLevel < currentLevel) {
            hasLowerEducation = true;
            if (endYear && (!lastLowerEndYear || endYear > lastLowerEndYear)) {
                lastLowerEndYear = endYear;
            }
            if (startYear && (!lastLowerStartYear || startYear > lastLowerStartYear)) {
                lastLowerStartYear = startYear;
            }
            const normalDegree = normalizeDegree(edu.degree);
            lowerEducationDuration = DEGREE_DURATIONS[normalDegree] || 4;
        }
    }

    return {
        hasHigherEducation,
        hasLowerEducation,
        lastHigherEndYear,
        lastHigherStartYear,
        lastLowerEndYear,
        lastLowerStartYear,
        lowerEducationDuration,
        allEducationYears,
        currentDegreeLevel: currentLevel,
    };
}

export function getStartYearSuggestions(
    birthDate: string | undefined,
    university: string | undefined,
    degree: string | undefined = undefined,
    education: EducationEntry[] | undefined = undefined,
    currentEntryIndex: number | null = null
): YearSuggestion[] {
    const birthYear = extractBirthYear(birthDate);
    const currentYear = new Date().getFullYear();
    const suggestions: YearSuggestion[] = [];
    const usedYears = new Set<number>();

    const analysis = analyzeEducation(degree, education, currentEntryIndex);
    const normalDegree = normalizeDegree(degree || '');
    const degreeDuration = DEGREE_DURATIONS[normalDegree] || 4;

    // ═══ Scenario 1: Has lower education (e.g., adding Master's after Bachelor's) ═══
    if (analysis.hasLowerEducation && analysis.lastLowerEndYear) {
        const expectedStart = analysis.lastLowerEndYear + 1;
        for (let offset = 0; offset <= 3; offset++) {
            const year = expectedStart + offset;
            if (year >= 2000 && year <= currentYear + 2 && !usedYears.has(year)) {
                usedYears.add(year);
                suggestions.push({
                    year,
                    label: offset === 0 ? `${year} (بعد التخرج - متوقع)` : year.toString(),
                });
            }
        }
    }

    // ═══ Scenario 2: Has higher education (e.g., adding Bachelor's after Master's was entered) ═══
    if (analysis.hasHigherEducation && analysis.lastHigherStartYear) {
        const degreeLevel = analysis.currentDegreeLevel;
        
        if (degreeLevel === 1 || degreeLevel === 2) { // Bachelor's
            const expectedEnd = analysis.lastHigherStartYear - 1;
            const expectedStart = expectedEnd - degreeDuration;
            
            for (let offset = -2; offset <= 2; offset++) {
                const year = expectedStart + offset;
                if (year >= 2000 && year <= currentYear && !usedYears.has(year)) {
                    usedYears.add(year);
                    suggestions.push({
                        year,
                        label: offset === 0 ? `${year} (قبل الماجستير - متوقع)` : year.toString(),
                    });
                }
            }
        } else if (degreeLevel === 3) { // Master's (adding before Doctorate)
            const expectedEnd = analysis.lastHigherStartYear - 1;
            const expectedStart = expectedEnd - degreeDuration;
            
            for (let offset = -2; offset <= 2; offset++) {
                const year = expectedStart + offset;
                if (year >= 2000 && year <= currentYear && !usedYears.has(year)) {
                    usedYears.add(year);
                    suggestions.push({
                        year,
                        label: offset === 0 ? `${year} (قبل الدكتوراه - متوقع)` : year.toString(),
                    });
                }
            }
        }
    }

    // ═══ Scenario 3: Use birth year for first education entry ═══
    if (birthYear && suggestions.length === 0) {
        const expectedStartYear = birthYear + 18;
        
        for (let offset = -2; offset <= 2; offset++) {
            const year = expectedStartYear + offset;
            if (year >= 2000 && year <= currentYear && !usedYears.has(year)) {
                usedYears.add(year);
                suggestions.push({
                    year,
                    label: offset === 0 ? `${year} (متوقع)` : year.toString(),
                });
            }
        }
    }

    // ═══ Fallback: Recent years ═══
    if (suggestions.length < 3) {
        for (let offset = 0; offset <= 8; offset++) {
            const year = currentYear - offset;
            if (!usedYears.has(year)) {
                usedYears.add(year);
                suggestions.push({ year, label: year.toString() });
                if (suggestions.length >= 6) break;
            }
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
    const usedYears = new Set<number>();

    suggestions.push({
        year: currentYear,
        label: 'حالياً (لا أزال طالباً)',
    });
    usedYears.add(currentYear);

    const start = parseYear(startYear);

    if (start) {
        let estimatedDuration = DEGREE_DURATIONS[normalizeDegree(degree || '')] || 4;

        if (!degree || !DEGREE_DURATIONS[normalizeDegree(degree)]) {
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

        for (let extraYears = 0; extraYears <= 3; extraYears++) {
            const duration = estimatedDuration + extraYears;
            const endYear = start + duration;

            if (endYear <= currentYear + 5 && !usedYears.has(endYear)) {
                usedYears.add(endYear);
                const durationLabel = duration === 1 ? 'سنة' : duration === 2 ? 'سنتين' : `${duration} سنوات`;
                suggestions.push({
                    year: endYear,
                    label: extraYears === 0 ? `${endYear} (${durationLabel} - متوقع)` : endYear.toString(),
                });
            }
        }
    }

    if (suggestions.length < 4) {
        for (let offset = 1; offset <= 5; offset++) {
            const year = currentYear - offset;
            if (!usedYears.has(year)) {
                usedYears.add(year);
                suggestions.push({ year, label: year.toString() });
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
    education?: EducationEntry[],
    currentEntryIndex?: number
): YearSuggestion[] {
    if (type === 'start') {
        return getStartYearSuggestions(birthDate, university, degree, education, currentEntryIndex ?? null);
    } else {
        return getEndYearSuggestions(startYear, university, major, degree);
    }
}

// ═══ AI-Powered Suggestions (Background) ═══
export async function getAIYearSuggestions(
    context: {
        birthDate?: string;
        degree?: string;
        education: EducationEntry[];
        fieldType: 'start' | 'end';
        currentEntryIndex?: number;
    }
): Promise<YearSuggestion[] | null> {
    try {
        const response = await fetch('/api/ai/year-suggestions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(context),
        });

        if (!response.ok) return null;

        const data = await response.json();
        return data.suggestions || null;
    } catch {
        return null;
    }
}
