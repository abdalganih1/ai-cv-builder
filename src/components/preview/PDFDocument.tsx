"use client";

import { Document, Page, Text, View, StyleSheet, Font, Image } from '@react-pdf/renderer';
import { CVData } from '@/lib/types/cv-schema';

// Register Arabic Font - use absolute URL on client side
// This ensures the font loads correctly in browser environment
const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
        return window.location.origin;
    }
    return '';
};

// Only register fonts on client side
if (typeof window !== 'undefined') {
    Font.register({
        family: 'IBMPlexSansArabic',
        fonts: [
            {
                src: `${getBaseUrl()}/IBMPlexSansArabic-Regular.ttf`,
                fontWeight: 'normal'
            },
            {
                src: `${getBaseUrl()}/IBMPlexSansArabic-Bold.ttf`,
                fontWeight: 'bold'
            }
        ]
    });
}


const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'IBMPlexSansArabic',
        backgroundColor: '#ffffff'
    },
    header: {
        flexDirection: 'row-reverse',
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#1e3a5f',
        paddingBottom: 20
    },
    headerInfo: {
        flexGrow: 1,
        alignItems: 'flex-end'
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
        alignItems: 'flex-end'
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
        textAlign: 'right'
    },
    text: {
        fontSize: 10,
        lineHeight: 1.5,
        textAlign: 'right',
        color: '#374151'
    },
    bold: {
        fontWeight: 'bold'
    },
    experienceItem: {
        marginBottom: 10,
        alignItems: 'flex-end',
        width: '100%'
    },
    itemHeader: {
        flexDirection: 'row-reverse',
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
        flexDirection: 'row-reverse',
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
        marginLeft: 20
    }
});

interface PDFDocumentProps {
    data: CVData;
}

export default function PDFDocument({ data }: PDFDocumentProps) {
    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.headerInfo}>
                        <Text style={styles.name}>{data.personal.firstName} {data.personal.lastName}</Text>
                        <Text style={styles.jobTitle}>{data.personal.targetJobTitle || data.personal.jobTitle || 'المسمى الوظيفي'}</Text>

                        {data.personal.email && data.personal.email !== '__skipped__' && <Text style={styles.contactInfo}>{data.personal.email}</Text>}
                        {data.personal.phone && data.personal.phone !== '__skipped__' && <Text style={styles.contactInfo}>{data.personal.phone}</Text>}
                        {data.personal.country && data.personal.country !== '__skipped__' && <Text style={styles.contactInfo}>{data.personal.country}</Text>}
                    </View>
                    {data.personal.photoUrl && data.personal.photoUrl !== '__skipped__' && (
                        /* Note: Image support in react-pdf can be tricky with data URLs or mixed content. 
                           For robustness, we might try to render it simply if it's a valid URL.
                           If it's a base64 string, it usually works fine. 
                        */
                        <Image src={data.personal.photoUrl} style={styles.photo} />
                    )}
                </View>

                {/* Summary */}
                {data.personal.summary && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>نبذة تعريفية</Text>
                        <Text style={styles.text}>{data.personal.summary}</Text>
                    </View>
                )}

                {/* Experience */}
                {data.experience && data.experience.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>الخبرة العملية</Text>
                        {data.experience.map((exp) => (
                            <View key={exp.id} style={styles.experienceItem}>
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
                        <Text style={styles.sectionTitle}>التعليم</Text>
                        {data.education.map((edu) => (
                            <View key={edu.id} style={styles.experienceItem}>
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
                        <Text style={styles.sectionTitle}>المهارات</Text>
                        <View style={styles.skillsContainer}>
                            {data.skills.map((skill, idx) => (
                                <View key={idx} style={styles.skillBadge}>
                                    <Text>{skill}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                )}
            </Page>
        </Document>
    );
}
