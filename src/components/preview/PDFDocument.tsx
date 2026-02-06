"use client";

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { CVData } from '@/lib/types/cv-schema';

// Flag to track if fonts are registered
let fontsRegistered = false;

// Register Arabic Font with error handling
function registerFonts() {
    if (fontsRegistered) return;

    try {
        Font.register({
            family: 'IBMPlexSansArabic',
            fonts: [
                {
                    src: '/IBMPlexSansArabic-Regular.ttf',
                    fontWeight: 'normal'
                },
                {
                    src: '/IBMPlexSansArabic-Bold.ttf',
                    fontWeight: 'bold'
                }
            ]
        });
        fontsRegistered = true;
        console.log('✅ Arabic fonts registered successfully');
    } catch (error) {
        console.error('❌ Failed to register Arabic fonts:', error);
    }
}

// Attempt to register fonts immediately
registerFonts();

// Section labels in both languages
const LABELS = {
    ar: {
        summary: 'نبذة تعريفية',
        experience: 'الخبرة العملية',
        education: 'التعليم',
        skills: 'المهارات',
        languages: 'اللغات',
        hobbies: 'الهوايات',
        jobTitle: 'المسمى الوظيفي',
    },
    en: {
        summary: 'Professional Summary',
        experience: 'Work Experience',
        education: 'Education',
        skills: 'Skills',
        languages: 'Languages',
        hobbies: 'Interests',
        jobTitle: 'Job Title',
    }
};

// Create styles based on language
const createStyles = (isRTL: boolean) => StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: fontsRegistered ? 'IBMPlexSansArabic' : 'Helvetica',
        backgroundColor: '#ffffff'
    },
    header: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#1e3a5f',
        paddingBottom: 20
    },
    headerInfo: {
        flexGrow: 1,
        alignItems: isRTL ? 'flex-end' : 'flex-start'
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e3a5f',
        marginBottom: 5
    },
    jobTitle: {
        fontSize: 14,
        color: '#0891b2',
        marginBottom: 10
    },
    contactInfo: {
        fontSize: 10,
        color: '#4b5563',
        marginBottom: 2
    },
    section: {
        marginBottom: 20,
        alignItems: isRTL ? 'flex-end' : 'flex-start'
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#1e3a5f',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
        paddingBottom: 5,
        width: '100%',
        textAlign: isRTL ? 'right' : 'left'
    },
    text: {
        fontSize: 10,
        lineHeight: 1.5,
        textAlign: isRTL ? 'right' : 'left',
        color: '#374151'
    },
    experienceItem: {
        marginBottom: 10,
        alignItems: isRTL ? 'flex-end' : 'flex-start',
        width: '100%'
    },
    itemHeader: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 2
    },
    itemTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#111827'
    },
    itemSubtitle: {
        fontSize: 10,
        color: '#0891b2'
    },
    itemDate: {
        fontSize: 9,
        color: '#6b7280'
    },
    skillsContainer: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        flexWrap: 'wrap',
        gap: 5
    },
    skillBadge: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        fontSize: 9,
        color: '#374151'
    },
    photo: {
        width: 80,
        height: 80,
        borderRadius: 40,
        marginLeft: isRTL ? 20 : 0,
        marginRight: isRTL ? 0 : 20
    },
    languageBadge: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: '#1e3a5f',
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 4,
        fontSize: 8,
        color: '#ffffff'
    }
});

// ============ CV Page Component (reusable) ============
interface CVPageProps {
    data: CVData;
    language: 'ar' | 'en';
    showLanguageBadge?: boolean;
}

function CVPage({ data, language, showLanguageBadge = false }: CVPageProps) {
    const isRTL = language === 'ar';
    const labels = LABELS[language];
    const styles = createStyles(isRTL);

    return (
        <Page size="A4" style={styles.page}>
            {/* Language Badge for combined PDF */}
            {showLanguageBadge && (
                <View style={styles.languageBadge}>
                    <Text>{language === 'ar' ? '🇸🇦 العربية' : '🇬🇧 English'}</Text>
                </View>
            )}

            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerInfo}>
                    <Text style={styles.name}>{data.personal.firstName} {data.personal.lastName}</Text>
                    <Text style={styles.jobTitle}>{data.personal.targetJobTitle || data.personal.jobTitle || labels.jobTitle}</Text>

                    {data.personal.email && data.personal.email !== '__skipped__' && <Text style={styles.contactInfo}>{data.personal.email}</Text>}
                    {data.personal.phone && data.personal.phone !== '__skipped__' && <Text style={styles.contactInfo}>{data.personal.phone}</Text>}
                    {data.personal.country && data.personal.country !== '__skipped__' && <Text style={styles.contactInfo}>{data.personal.country}</Text>}
                </View>
                {data.personal.photoUrl && data.personal.photoUrl !== '__skipped__' && (
                    // eslint-disable-next-line jsx-a11y/alt-text
                    <Image src={data.personal.photoUrl} style={styles.photo} />
                )}
            </View>

            {/* Summary */}
            {data.personal.summary && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.summary}</Text>
                    <Text style={styles.text}>{data.personal.summary}</Text>
                </View>
            )}

            {/* Experience */}
            {data.experience && data.experience.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.experience}</Text>
                    {data.experience.map((exp, idx) => (
                        <View key={exp.id || `exp-${idx}`} style={styles.experienceItem}>
                            <View style={styles.itemHeader}>
                                <Text style={styles.itemTitle}>{exp.position}</Text>
                            </View>
                            <View style={styles.itemHeader}>
                                <Text style={styles.itemSubtitle}>{exp.company}</Text>
                                <Text style={styles.itemDate}>{exp.startDate} - {exp.endDate}</Text>
                            </View>
                            <Text style={styles.text}>{exp.description}</Text>
                        </View>
                    ))}
                </View>
            )}

            {/* Education */}
            {data.education && data.education.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.education}</Text>
                    {data.education.map((edu, idx) => (
                        <View key={edu.id || `edu-${idx}`} style={styles.experienceItem}>
                            <Text style={styles.itemTitle}>{edu.degree} {edu.major ? `- ${edu.major}` : ''}</Text>
                            <View style={styles.itemHeader}>
                                <Text style={styles.itemSubtitle}>{edu.institution}</Text>
                                <Text style={styles.itemDate}>{edu.startYear} - {edu.endYear}</Text>
                            </View>
                        </View>
                    ))}
                </View>
            )}

            {/* Skills */}
            {data.skills && data.skills.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.skills}</Text>
                    <View style={styles.skillsContainer}>
                        {data.skills.map((skill, idx) => (
                            <View key={idx} style={styles.skillBadge}>
                                <Text>{skill}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Languages */}
            {data.languages && data.languages.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.languages}</Text>
                    <View style={styles.skillsContainer}>
                        {data.languages.map((lang, idx) => (
                            <View key={idx} style={styles.skillBadge}>
                                <Text>{lang}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}

            {/* Hobbies */}
            {data.hobbies && data.hobbies.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>{labels.hobbies}</Text>
                    <View style={styles.skillsContainer}>
                        {data.hobbies.map((hobby, idx) => (
                            <View key={idx} style={styles.skillBadge}>
                                <Text>{hobby}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
        </Page>
    );
}

// ============ Single Language PDF Document ============
interface PDFDocumentProps {
    data: CVData;
    language?: 'ar' | 'en';
}

export default function PDFDocument({ data, language = 'ar' }: PDFDocumentProps) {
    return (
        <Document>
            <CVPage data={data} language={language} />
        </Document>
    );
}

// ============ Combined Bilingual PDF Document ============
interface CombinedPDFDocumentProps {
    arabicData: CVData;
    englishData: CVData;
}

export function CombinedPDFDocument({ arabicData, englishData }: CombinedPDFDocumentProps) {
    return (
        <Document>
            {/* Arabic page first */}
            <CVPage data={arabicData} language="ar" showLanguageBadge={true} />
            {/* English page second */}
            <CVPage data={englishData} language="en" showLanguageBadge={true} />
        </Document>
    );
}
