interface DateSuggestion {
    date: string;
    label: string;
}

interface WorkEntry {
    company?: string;
    position?: string;
    startDate?: string;
    endDate?: string;
}

interface EducationEntry {
    degree?: string;
    major?: string;
    endYear?: string;
}

function parseYear(dateStr: string | undefined): number | null {
    if (!dateStr) return null;
    const match = dateStr.match(/\d{4}/);
    return match ? parseInt(match[0], 10) : null;
}

export function getWorkDateSuggestions(
    type: 'start' | 'end',
    birthDate: string | undefined,
    education: EducationEntry[] | undefined,
    experience: WorkEntry[] | undefined,
    currentCompany: string | undefined,
    currentStartDate: string | undefined
): DateSuggestion[] {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const suggestions: DateSuggestion[] = [];

    const birthYear = parseYear(birthDate);

    const lastEducation = education?.filter(e => e.endYear).sort((a, b) => 
        (parseYear(b.endYear) || 0) - (parseYear(a.endYear) || 0)
    )[0];

    const lastExperience = experience?.filter(e => e.endDate && e.endDate !== 'حالياً' && e.endDate !== 'حتى الآن').sort((a, b) => 
        (parseYear(b.endDate) || 0) - (parseYear(a.endDate) || 0)
    )[0];

    if (type === 'start') {
        if (lastExperience?.endDate) {
            const lastEndYear = parseYear(lastExperience.endDate);
            if (lastEndYear) {
                for (let offset = 0; offset <= 12; offset++) {
                    const months = offset;
                    const year = lastEndYear + Math.floor((parseInt(lastExperience.endDate.split('/')[1] || '1') - 1 + months) / 12);
                    const month = ((parseInt(lastExperience.endDate.split('/')[1] || '1') - 1 + months) % 12) + 1;
                    const dateStr = `${year}/${month.toString().padStart(2, '0')}`;
                    if (year <= currentYear) {
                        suggestions.push({
                            date: dateStr,
                            label: offset === 0 ? `${dateStr} (بعد الوظيفة السابقة)` : dateStr,
                        });
                    }
                }
            }
        }

        if (lastEducation?.endYear) {
            const gradYear = parseYear(lastEducation.endYear);
            if (gradYear) {
                for (let months = 0; months <= 24; months += 3) {
                    const year = gradYear + Math.floor((6 + months) / 12);
                    const month = ((6 + months) % 12) + 1;
                    const dateStr = `${year}/${month.toString().padStart(2, '0')}`;
                    if (year <= currentYear && !suggestions.some(s => s.date === dateStr)) {
                        suggestions.push({
                            date: dateStr,
                            label: months === 0 ? `${dateStr} (بعد التخرج)` : dateStr,
                        });
                    }
                }
            }
        }

        if (birthYear && suggestions.length === 0) {
            const expectedStart = birthYear + 22;
            for (let year = expectedStart; year <= currentYear; year++) {
                suggestions.push({
                    date: `${year}/01`,
                    label: `${year}/01`,
                });
            }
        }
    } else {
        suggestions.push({
            date: 'حالياً',
            label: 'حالياً (لا أزال أعمل)',
        });

        if (currentStartDate) {
            const startYear = parseYear(currentStartDate);
            const startMonth = parseInt(currentStartDate.split('/')[1] || '1');
            if (startYear) {
                for (let years = 1; years <= 5; years++) {
                    const endYear = startYear + years;
                    const endMonth = startMonth;
                    const dateStr = `${endYear}/${endMonth.toString().padStart(2, '0')}`;
                    if (endYear <= currentYear + 1) {
                        suggestions.push({
                            date: dateStr,
                            label: `${dateStr} (${years === 1 ? 'سنة' : years === 2 ? 'سنتين' : `${years} سنوات`})`,
                        });
                    }
                }
            }
        }
    }

    if (suggestions.length === 0) {
        for (let i = 0; i < 6; i++) {
            const year = currentYear - i;
            suggestions.push({
                date: `${year}/01`,
                label: `${year}/01`,
            });
        }
    }

    return suggestions.slice(0, 8);
}

export async function getAIWorkDateSuggestions(context: {
    birthDate?: string;
    education?: EducationEntry[];
    experience?: WorkEntry[];
    fieldType: 'start' | 'end';
    currentCompany?: string;
    currentStartDate?: string;
}): Promise<DateSuggestion[] | null> {
    try {
        const response = await fetch('/api/ai/work-date-suggestions', {
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

export type { DateSuggestion };
