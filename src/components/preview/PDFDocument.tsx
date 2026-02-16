"use client";

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { CVData } from '@/lib/types/cv-schema';

// Flag to track if fonts are registered
let fontsRegistered = false;
let fontLoadError = false;

// Register Arabic Font with error handling
function registerFonts() {
    if (fontsRegistered || fontLoadError) return;

    try {
        // Use Cairo as primary - more reliable
        Font.register({
            family: 'Cairo',
            fonts: [
                {
                    src: '/Cairo-Regular.ttf',
                    fontWeight: 'normal'
                },
                {
                    src: '/Cairo-Bold.ttf',
                    fontWeight: 'bold'
                }
            ]
        });

        fontsRegistered = true;
        console.log('✅ Arabic fonts registered successfully (Cairo)');
    } catch (error) {
        console.error('❌ Failed to register Arabic fonts:', error);
        fontLoadError = true;
    }
}

// Attempt to register fonts immediately
try {
    registerFonts();
} catch (e) {
    console.error('Font registration error:', e);
    fontLoadError = true;
}

/**
 * Note: We do NOT use Unicode RTL control characters (RLM, RLE, PDF, RLO)
 * because @react-pdf/renderer does not support them and renders them as
 * visible glyphs (e.g. "+" after bullet points). Instead, RTL layout is
 * handled entirely via flexDirection: 'row-reverse' and textAlign: 'right'.
 */

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
        direction: isRTL ? 'rtl' : 'ltr',
        color: '#374151'
    },
    // RTL bullet list styles
    bulletLine: {
        flexDirection: isRTL ? 'row-reverse' : 'row',
        marginBottom: 2,
        width: '100%'
    },
    bulletPoint: {
        fontSize: 10,
        color: '#374151',
        marginLeft: isRTL ? 6 : 0,
        marginRight: isRTL ? 0 : 6
    },
    bulletText: {
        fontSize: 10,
        color: '#374151',
        flex: 1,
        textAlign: isRTL ? 'right' : 'left',
        direction: isRTL ? 'rtl' : 'ltr'
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
        borderRadius: 4
    },
    skillBadgeText: {
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
        borderRadius: 4
    },
    languageBadgeText: {
        fontSize: 8,
        color: '#ffffff'
    }
});

// ============ Bullet Text Component for RTL support ============
interface BulletTextProps {
    text: string;
    isRTL: boolean;
    styles: ReturnType<typeof createStyles>;
}

/**
 * Smart bullet text parser that handles multiple formats:
 * 1. Lines separated by \n with bullets (- or •)
 * 2. Single string with inline bullets "- item1 - item2"
 * 3. Mixed content with regular text and bullet points
 */
function BulletText({ text, isRTL, styles }: BulletTextProps) {
    if (!text || typeof text !== 'string') return null;

    // Normalize the text - trim and handle various line endings
    const normalizedText = text.trim().replace(/\r\n/g, '\n');

    // Check if text has newlines
    const hasNewlines = normalizedText.includes('\n');

    let items: { type: 'bullet' | 'text'; content: string }[] = [];

    if (hasNewlines) {
        // Split by newlines and process each line
        const lines = normalizedText.split('\n').map(l => l.trim()).filter(l => l);

        for (const line of lines) {
            // Check if line starts with bullet character
            const bulletMatch = line.match(/^[\-•●○◦]\s*(.+)/);
            if (bulletMatch && bulletMatch[1]) {
                items.push({ type: 'bullet', content: bulletMatch[1].trim() });
            } else if (line) {
                // Check if line contains inline bullets (like "- item1 - item2")
                const inlineBullets = extractInlineBullets(line);
                if (inlineBullets.length > 0) {
                    items.push(...inlineBullets);
                } else {
                    items.push({ type: 'text', content: line });
                }
            }
        }
    } else {
        // Single line - check for inline bullets
        const inlineBullets = extractInlineBullets(normalizedText);
        if (inlineBullets.length > 0) {
            items = inlineBullets;
        } else {
            // Just regular text
            items.push({ type: 'text', content: normalizedText });
        }
    }

    // Render the items
    if (items.length === 0) {
        return <Text style={styles.text}>{text}</Text>;
    }

    // If only one text item, render simply
    if (items.length === 1 && items[0].type === 'text') {
        return <Text style={styles.text}>{items[0].content}</Text>;
    }

    return (
        <View style={{ width: '100%' }}>
            {items.map((item, idx) => {
                if (item.type === 'bullet') {
                    return (
                        <View key={idx} style={styles.bulletLine}>
                            <Text style={styles.bulletPoint}>•</Text>
                            <Text style={styles.bulletText}>{item.content}</Text>
                        </View>
                    );
                }
                return <Text key={idx} style={styles.text}>{item.content}</Text>;
            })}
        </View>
    );
}

/**
 * Extract inline bullets from text like "- item1 - item2 - item3"
 * Only splits on " - " (with spaces) to avoid splitting words like "e-mail"
 */
function extractInlineBullets(text: string): { type: 'bullet' | 'text'; content: string }[] {
    const items: { type: 'bullet' | 'text'; content: string }[] = [];

    // Check if text starts with a bullet
    const startsWithBullet = /^[\-•●]/.test(text.trim());

    // Split by " - " (dash with spaces on both sides) to avoid breaking words
    // Also handle Arabic dash patterns
    const parts = text.split(/\s+[\-•●]\s+/);

    if (parts.length > 1 || startsWithBullet) {
        for (let i = 0; i < parts.length; i++) {
            let content = parts[i].trim();

            // Remove leading bullet from first part if exists
            if (i === 0) {
                content = content.replace(/^[\-•●]\s*/, '').trim();
            }

            if (content) {
                // Remove any remaining bullet characters or + signs from content
                content = content.replace(/^[\-•●○◦+\s]+/, '').trim();
                if (content) {
                    items.push({ type: 'bullet', content });
                }
            }
        }
    }

    return items;
}

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
                    <Text style={styles.languageBadgeText}>{language === 'ar' ? '🇸🇦 العربية' : '🇬🇧 English'}</Text>
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
                    <BulletText text={data.personal.summary} isRTL={isRTL} styles={styles} />
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
                            <BulletText text={exp.description} isRTL={isRTL} styles={styles} />
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
                                <Text style={styles.skillBadgeText}>{skill}</Text>
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
                                <Text style={styles.skillBadgeText}>{lang.name} ({lang.level})</Text>
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
                                <Text style={styles.skillBadgeText}>{hobby}</Text>
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
