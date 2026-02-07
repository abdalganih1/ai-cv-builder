// Script to generate CV PDF directly using the project's PDF components
// Run with: npx tsx scripts/generate-cv-pdf.tsx

import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import { writeFileSync } from 'fs';
import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

// Register Arabic Font - Traditional Arabic from Windows (best Arabic ligature support)
Font.register({
    family: 'TraditionalArabic',
    fonts: [
        { src: './public/TraditionalArabic-Regular.ttf', fontWeight: 'normal' },
        { src: './public/TraditionalArabic-Bold.ttf', fontWeight: 'bold' },
    ],
});

// CV Data
const cvData = {
    personal: {
        firstName: 'عبد الغني',
        lastName: 'الحمدي',
        phone: '+963 958 794 195',
        country: 'سوريا',
        email: 'info@abdalgani.com',
        jobTitle: 'مدير مشاريع ومستشار هندسي',
        summary: `مدير مشاريع ومستشار هندسي حاصل على ماجستير في هندسة التحكم الآلي والأتمتة، أمتلك خبرة عملية تتجاوز 5 سنوات في قيادة الفرق الهندسية والتقنية وإدارة البيئات السحابية والأنظمة الحكومية. أجمع بين الخبرة العميقة في إدارة خوادم Linux والبنى التحتية الرقمية، مع سجل حافل في إدارة وتنفيذ أكثر من 500 مشروع معقد. قدت فرق عمل تصل إلى أكثر من 30 موظفاً مع تحقيق نمو ملحوظ في الإنتاجية.`,
    },
    education: [
        {
            id: '1',
            institution: 'جامعة حلب - كلية الكهرباء',
            degree: 'ماجستير',
            major: 'هندسة التحكم الآلي والأتمتة الصناعية',
            startYear: '2020',
            endYear: '2025',
            description: 'التركيز البحثي: الشبكات العصبونية والذكاء الاصطناعي',
        },
        {
            id: '2',
            institution: 'جامعة البعث - حمص',
            degree: 'إجازة',
            major: 'الهندسة الكهربائية - تحكم آلي وحواسيب',
            startYear: '2015',
            endYear: '2019',
            description: 'المرتبة الأولى في السنة الرابعة - معدل 79.24%',
        },
    ],
    experience: [
        {
            id: '1',
            company: 'شركة تكنو إنجاز',
            position: 'مؤسس ومدير تقني (CTO)',
            startDate: '2020',
            endDate: 'حتى الآن',
            description: [
                'قيادة وتطوير فريق تقني مكون من أكثر من 20 موظفاً',
                'ترأس تنفيذ أكثر من 500 مشروع هندسي وتقني',
                'إدارة البنية التحتية لسيرفرات الشركة المستضيفة لتطبيقات حيوية',
                'نجاح مثبت في التصدي للهجمات السيبرانية واستعادة الخدمة خلال أقل من ساعة',
            ],
        },
        {
            id: '2',
            company: 'مركز العموري للهندسيات',
            position: 'مستشار إداري',
            startDate: '2020',
            endDate: '2023',
            description: [
                'إدارة ووجه فريق عمل مكون من أكثر من 30 موظفاً',
                'مسؤول التخطيط والتنفيذ والمتابعة لكامل احتياجات المركز',
                'الإشراف على العمليات الفنية والإدارية',
            ],
        },
        {
            id: '3',
            company: 'المركز التقني الهندسي',
            position: 'مسؤول التخطيط والتنفيذ',
            startDate: '2021',
            endDate: '2025',
            description: [
                'بناء الخطط التسويقية والتنظيم الإداري الداخلي',
                'تعيين المسؤولين عن المتابعة وتوزيع المهام والأدوار',
            ],
        },
        {
            id: '4',
            company: 'وزارة التعليم العالي والبحث العلمي',
            position: 'محاضر بعقد مستقل',
            startDate: '2019',
            endDate: '2024',
            description: [
                'تدريس المواد النظرية والعملية في الهندسة الكهربائية والتحكم الآلي',
                'الإشراف على مشاريع التخرج للطلاب',
            ],
        },
    ],
    skills: [
        'إدارة المشاريع',
        'القيادة والتخطيط الاستراتيجي',
        'إدارة فرق العمل',
        'إدارة السيرفرات (Linux)',
        'الشبكات والأمان السيبراني',
        'Docker و Git',
        'PHP (Laravel) و Python',
        'إدارة الموارد البشرية',
    ],
    languages: ['العربية - اللغة الأم', 'الإنجليزية - جيد جداً'],
};

// RTL-aware styles matching the project's PDFDocument.tsx
const styles = StyleSheet.create({
    page: {
        padding: 40,
        fontFamily: 'TraditionalArabic',
        backgroundColor: '#ffffff',
    },
    header: {
        flexDirection: 'row-reverse',
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomColor: '#1e3a5f',
        paddingBottom: 20,
    },
    headerInfo: {
        flexGrow: 1,
        alignItems: 'flex-end',
    },
    name: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1e3a5f',
        marginBottom: 5,
    },
    jobTitle: {
        fontSize: 14,
        color: '#0891b2',
        marginBottom: 10,
    },
    contactInfo: {
        fontSize: 10,
        color: '#4b5563',
        marginBottom: 2,
    },
    section: {
        marginBottom: 20,
        alignItems: 'flex-end',
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
        textAlign: 'right',
    },
    text: {
        fontSize: 10,
        lineHeight: 1.5,
        textAlign: 'right',
        color: '#374151',
    },
    experienceItem: {
        marginBottom: 12,
        alignItems: 'flex-end',
        width: '100%',
    },
    itemHeader: {
        flexDirection: 'row-reverse',
        justifyContent: 'space-between',
        width: '100%',
        marginBottom: 2,
    },
    itemTitle: {
        fontSize: 11,
        fontWeight: 'bold',
        color: '#111827',
    },
    itemSubtitle: {
        fontSize: 10,
        color: '#0891b2',
    },
    itemDate: {
        fontSize: 9,
        color: '#6b7280',
    },
    // Bullet point list - RTL aware
    bulletList: {
        width: '100%',
        marginTop: 5,
    },
    bulletItem: {
        flexDirection: 'row-reverse',
        marginBottom: 3,
        width: '100%',
    },
    bulletPoint: {
        fontSize: 10,
        color: '#374151',
        marginLeft: 8,
        width: 12,
        textAlign: 'center',
    },
    bulletText: {
        fontSize: 10,
        color: '#374151',
        flex: 1,
        textAlign: 'right',
        lineHeight: 1.4,
    },
    skillsContainer: {
        flexDirection: 'row-reverse',
        flexWrap: 'wrap',
        gap: 5,
        width: '100%',
    },
    skillBadge: {
        backgroundColor: '#f3f4f6',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 4,
        marginBottom: 5,
    },
    skillText: {
        fontSize: 9,
        color: '#374151',
    },
});

// Bullet point component for RTL text
const BulletItem = ({ text }: { text: string }) => (
    <View style={styles.bulletItem}>
        <Text style={styles.bulletText}>{text}</Text>
        <Text style={styles.bulletPoint}>■</Text>
    </View>
);

// PDF Document Component with proper RTL support
const CVDocument = () => (
    <Document>
        <Page size="A4" style={styles.page}>
            {/* Header */}
            <View style={styles.header}>
                <View style={styles.headerInfo}>
                    <Text style={styles.name}>{cvData.personal.firstName} {cvData.personal.lastName}</Text>
                    <Text style={styles.jobTitle}>{cvData.personal.jobTitle}</Text>
                    <Text style={styles.contactInfo}>{cvData.personal.email}</Text>
                    <Text style={styles.contactInfo}>{cvData.personal.phone}</Text>
                    <Text style={styles.contactInfo}>{cvData.personal.country}</Text>
                </View>
            </View>

            {/* Summary */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>نبذة تعريفية</Text>
                <Text style={styles.text}>{cvData.personal.summary}</Text>
            </View>

            {/* Experience */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>الخبرة العملية</Text>
                {cvData.experience.map((exp) => (
                    <View key={exp.id} style={styles.experienceItem}>
                        <View style={styles.itemHeader}>
                            <Text style={styles.itemTitle}>{exp.position}</Text>
                        </View>
                        <View style={styles.itemHeader}>
                            <Text style={styles.itemSubtitle}>{exp.company}</Text>
                            <Text style={styles.itemDate}>{exp.startDate} - {exp.endDate}</Text>
                        </View>
                        <View style={styles.bulletList}>
                            {exp.description.map((item, idx) => (
                                <BulletItem key={idx} text={item} />
                            ))}
                        </View>
                    </View>
                ))}
            </View>

            {/* Education */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>التعليم</Text>
                {cvData.education.map((edu) => (
                    <View key={edu.id} style={styles.experienceItem}>
                        <Text style={styles.itemTitle}>{edu.degree} - {edu.major}</Text>
                        <View style={styles.itemHeader}>
                            <Text style={styles.itemSubtitle}>{edu.institution}</Text>
                            <Text style={styles.itemDate}>{edu.startYear} - {edu.endYear}</Text>
                        </View>
                        {edu.description && <Text style={styles.text}>{edu.description}</Text>}
                    </View>
                ))}
            </View>

            {/* Skills */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>المهارات</Text>
                <View style={styles.skillsContainer}>
                    {cvData.skills.map((skill, index) => (
                        <View key={index} style={styles.skillBadge}>
                            <Text style={styles.skillText}>{skill}</Text>
                        </View>
                    ))}
                </View>
            </View>

            {/* Languages */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>اللغات</Text>
                <View style={styles.skillsContainer}>
                    {cvData.languages.map((lang, index) => (
                        <View key={index} style={styles.skillBadge}>
                            <Text style={styles.skillText}>{lang}</Text>
                        </View>
                    ))}
                </View>
            </View>
        </Page>
    </Document>
);

// Generate PDF
async function generatePDF() {
    console.log('🚀 بدء إنشاء ملف PDF...');

    try {
        const buffer = await renderToBuffer(<CVDocument />);
        const outputPath = './my_data/سيرة_ذاتية_عبد_الغني_الحمدي.pdf';
        writeFileSync(outputPath, buffer);
        console.log(`✅ تم إنشاء ملف PDF بنجاح: ${outputPath}`);
    } catch (error) {
        console.error('❌ خطأ أثناء إنشاء PDF:', error);
    }
}

generatePDF();
