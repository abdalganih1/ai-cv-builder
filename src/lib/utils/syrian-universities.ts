/**
 * Syrian University & Major Abbreviation Lookup
 * Used to auto-translate English abbreviations to Arabic names
 */

// ═══════════════════════════════════════════════════════════════
// SYRIAN UNIVERSITIES (Public + Private)
// ═══════════════════════════════════════════════════════════════
export const SYRIAN_UNIVERSITIES: Record<string, string> = {
    // ─── Public Universities ───
    'DU': 'جامعة دمشق',
    'Damascus University': 'جامعة دمشق',
    'SVU': 'الجامعة الافتراضية السورية',
    'AU': 'جامعة حلب',
    'University of Aleppo': 'جامعة حلب',
    'LU': 'جامعة اللاذقية (تشرين)',
    'Tishreen University': 'جامعة تشرين',
    'Tishreen': 'جامعة تشرين',
    'HU': 'جامعة حمص (البعث)',
    'Al-Baath University': 'جامعة البعث',
    'Baath University': 'جامعة البعث',
    'FU': 'جامعة الفرات',
    'Al-Furat University': 'جامعة الفرات',
    'Hama University': 'جامعة حماة',
    'UoT': 'جامعة طرطوس',
    'University of Tartus': 'جامعة طرطوس',
    'HIAST': 'المعهد العالي للعلوم التطبيقية والتكنولوجيا',
    'HIBA': 'المعهد العالي لإدارة الأعمال',
    'INA': 'المعهد الوطني للإدارة العامة',

    // ─── Private Universities ───
    'WPU': 'الجامعة الوطنية الخاصة',
    'WNPU': 'الجامعة الوطنية الخاصة',
    'Al-Wataniya': 'الجامعة الوطنية الخاصة',
    'SPU': 'الجامعة السورية الخاصة',
    'Syrian Private University': 'الجامعة السورية الخاصة',
    'AIU': 'الجامعة العربية الدولية',
    'Arab International University': 'الجامعة العربية الدولية',
    'IUST': 'الجامعة الدولية للعلوم والتكنولوجيا',
    'WIU': 'جامعة الوادي الدولية',
    'Wadi International University': 'جامعة الوادي الدولية',
    'RU': 'جامعة الرشيد الدولية للعلوم والتكنولوجيا',
    'YPU': 'جامعة اليرموك الخاصة',
    'Yarmouk': 'جامعة اليرموك الخاصة',
    'CPU': 'جامعة قرطبة الخاصة',
    'Cordoba': 'جامعة قرطبة الخاصة',
    'IPU': 'جامعة الاتحاد الخاصة',
    'Ittihad': 'جامعة الاتحاد الخاصة',
    'SU': 'جامعة الشهباء',
    'JPU': 'جامعة الجزيرة الخاصة',
    'AUST': 'الجامعة العربية للعلوم والتكنولوجيا',
    'HPU': 'جامعة الحواش الخاصة',
    'EPU': 'جامعة إيبلا الخاصة',
    'ASPU': 'جامعة الشام الخاصة',
    'QPU': 'جامعة قاسيون الخاصة',
    'MPU': 'جامعة ماري الخاصة',
    'MU': 'جامعة المنارة',
    'ASU': 'جامعة أنطاكية السورية',
    'AZU': 'جامعة الزهراء',
    'UOK': 'جامعة القلمون',
    'University of Kalamoon': 'جامعة القلمون',
    'BAUK': 'جامعة بلاد الشام للعلوم الشرعية',

    // ─── Common English Names ───
    'Damascus': 'جامعة دمشق',
    'Aleppo': 'جامعة حلب',
    'Homs': 'جامعة البعث',
    'Latakia': 'جامعة تشرين',
};

// ═══════════════════════════════════════════════════════════════
// COMMON MAJORS / SPECIALIZATIONS
// ═══════════════════════════════════════════════════════════════
export const SYRIAN_MAJORS: Record<string, string> = {
    // IT & Computer Science
    'IT': 'تقانة المعلومات',
    'CS': 'علوم الحاسوب',
    'Computer Science': 'علوم الحاسوب',
    'SE': 'هندسة البرمجيات',
    'Software Engineering': 'هندسة البرمجيات',
    'AI': 'الذكاء الاصطناعي',
    'Artificial Intelligence': 'الذكاء الاصطناعي',
    'CE': 'هندسة الحاسوب',
    'Computer Engineering': 'هندسة الحاسوب',
    'IS': 'نظم المعلومات',
    'Information Systems': 'نظم المعلومات',
    'MIS': 'نظم المعلومات الإدارية',
    'Web Development': 'تطوير الويب',
    'Cybersecurity': 'الأمن السيبراني',
    'Data Science': 'علوم البيانات',
    'Network Engineering': 'هندسة الشبكات',

    // Engineering
    'ME': 'الهندسة الميكانيكية',
    'Mechanical Engineering': 'الهندسة الميكانيكية',
    'EE': 'الهندسة الكهربائية',
    'Electrical Engineering': 'الهندسة الكهربائية',
    'Civil Engineering': 'الهندسة المدنية',
    'Architecture': 'الهندسة المعمارية',
    'Arch': 'الهندسة المعمارية',
    'Chemical Engineering': 'الهندسة الكيميائية',
    'Biomedical Engineering': 'الهندسة الطبية الحيوية',
    'BME': 'الهندسة الطبية الحيوية',
    'Mechatronics': 'الميكاترونيكس',
    'Telecommunications': 'هندسة الاتصالات',

    // Medical & Health
    'Medicine': 'الطب البشري',
    'MD': 'الطب البشري',
    'Dentistry': 'طب الأسنان',
    'Pharmacy': 'الصيدلة',
    'Pharm': 'الصيدلة',
    'Nursing': 'التمريض',
    'Physical Therapy': 'العلاج الطبيعي',
    'PT': 'العلاج الطبيعي',
    'Lab': 'المخابر الطبية',
    'Medical Lab': 'المخابر الطبية',

    // Business & Economics
    'BA': 'إدارة الأعمال',
    'Business Administration': 'إدارة الأعمال',
    'BBA': 'إدارة الأعمال',
    'MBA': 'ماجستير إدارة الأعمال',
    'Economics': 'الاقتصاد',
    'Econ': 'الاقتصاد',
    'Accounting': 'المحاسبة',
    'Finance': 'التمويل والمصارف',
    'Marketing': 'التسويق',
    'HR': 'الموارد البشرية',
    'Human Resources': 'الموارد البشرية',

    // Arts & Humanities
    'Law': 'الحقوق',
    'English Literature': 'الأدب الإنجليزي',
    'Arabic Literature': 'الأدب العربي',
    'Translation': 'الترجمة',
    'Journalism': 'الصحافة والإعلام',
    'Media': 'الإعلام',
    'Psychology': 'علم النفس',
    'Sociology': 'علم الاجتماع',
    'Philosophy': 'الفلسفة',
    'History': 'التاريخ',
    'Geography': 'الجغرافيا',
    'Education': 'التربية',
    'Fine Arts': 'الفنون الجميلة',
    'Interior Design': 'التصميم الداخلي',
    'Graphic Design': 'التصميم الغرافيكي',

    // Sciences
    'Math': 'الرياضيات',
    'Mathematics': 'الرياضيات',
    'Physics': 'الفيزياء',
    'Chemistry': 'الكيمياء',
    'Biology': 'الأحياء',
    'Geology': 'الجيولوجيا',
    'Statistics': 'الإحصاء',

    // Agriculture
    'Agriculture': 'الهندسة الزراعية',
    'Agri': 'الهندسة الزراعية',
    'Food Science': 'علوم الأغذية',

    // Islamic Studies
    'Sharia': 'الشريعة',
    'Islamic Studies': 'الدراسات الإسلامية',

    // ─── Common Degree abbreviations ───
    'BSc': 'بكالوريوس',
    'BA degree': 'بكالوريوس',
    'MSc': 'ماجستير',
    'MA': 'ماجستير',
    'PhD': 'دكتوراه',
    'Diploma': 'دبلوم',
};

/**
 * Translate a university or major abbreviation to Arabic
 * Returns the original text if no match found
 */
export function translateAbbreviation(text: string, type: 'university' | 'major'): string {
    if (!text || typeof text !== 'string') return text;

    const trimmed = text.trim();
    const lookup = type === 'university' ? SYRIAN_UNIVERSITIES : SYRIAN_MAJORS;

    // Exact match (case-insensitive)
    const exactMatch = Object.entries(lookup).find(
        ([key]) => key.toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) return exactMatch[1];

    // Check if text contains any known abbreviation
    for (const [abbr, arabic] of Object.entries(lookup)) {
        if (abbr.length >= 2 && trimmed.toUpperCase() === abbr.toUpperCase()) {
            return arabic;
        }
    }

    return text;
}

/**
 * Auto-translate known abbreviations in education/experience data
 * Does NOT modify names (firstName, lastName)
 */
export function autoTranslateFields(data: {
    institution?: string;
    major?: string;
    degree?: string;
}): typeof data {
    const result = { ...data };

    if (result.institution) {
        result.institution = translateAbbreviation(result.institution, 'university');
    }
    if (result.major) {
        result.major = translateAbbreviation(result.major, 'major');
    }
    if (result.degree) {
        result.degree = translateAbbreviation(result.degree, 'major');
    }

    return result;
}
