"use client";

import { CVData } from '@/lib/types/cv-schema';
import { motion } from 'framer-motion';
import EditChat from '@/components/chat/EditChat';

import { pdf } from '@react-pdf/renderer';
import PDFDocument from './PDFDocument';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
    onBack: () => void;
}

export default function CVPreview({ data, onNext, onUpdate, onBack }: StepProps) {

    const handleUpdate = (newData: CVData) => {
        onUpdate(newData); // Use onUpdate to modify data without changing step
    };

    const handleDownloadPDF = async () => {
        try {
            const blob = await pdf(<PDFDocument data={data} />).toBlob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `CV_${data.personal.firstName}_${data.personal.lastName}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        } catch (error) {
            console.error('Failed to generate PDF:', error);
            alert('عذراً، حدث خطأ أثناء إنشاء ملف PDF');
        }
    };

    return (
        <div className="flex flex-col md:flex-row gap-6 h-[800px] w-full">
            {/* Sidebar / Chat Interface */}
            <div className="w-full md:w-1/3 order-2 md:order-1 flex flex-col gap-4">
                <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex-1 flex flex-col">
                    <h3 className="font-bold text-primary mb-2">مساعد التعديل الذكي</h3>
                    <p className="text-xs text-gray-500 mb-4">اطلب أي تعديل على سيرتك الذاتية وسأقوم بتنفيذه فوراً.</p>
                    <EditChat data={data} onUpdate={handleUpdate} />
                </div>

                <div className="flex gap-2">
                    <button onClick={onBack} className="flex-1 bg-gray-100 text-gray-600 py-3 rounded-xl font-bold hover:bg-gray-200 transition-colors">
                        رجوع
                    </button>
                    <button
                        onClick={handleDownloadPDF}
                        className="flex-1 bg-primary text-white py-3 rounded-xl font-bold hover:bg-primary-dark transition-colors shadow-lg active:scale-95"
                    >
                        تصدير PDF
                    </button>
                </div>
            </div>

            {/* Preview Area */}
            <div className="w-full md:w-2/3 order-1 md:order-2 bg-gray-50 rounded-xl border border-gray-200 p-4 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto custom-scrollbar bg-white shadow-sm rounded-lg relative">
                    <div className="min-h-full p-8 md:p-12 bg-white text-right" style={{ fontFamily: 'Arial, sans-serif' }}>

                        {/* Header */}
                        <div className="border-b-2 border-primary pb-6 mb-6 flex justify-between items-end">
                            <div className="flex gap-6 items-end">
                                {data.personal.photoUrl && data.personal.photoUrl !== '__skipped__' && (
                                    <div className="w-32 h-32 rounded-full border-4 border-primary overflow-hidden shadow-lg mb-2">
                                        <img src={data.personal.photoUrl} alt="Profile" className="w-full h-full object-cover" />
                                    </div>
                                )}
                                <div>
                                    <h1 className="text-4xl font-bold text-primary mb-2">{data.personal.firstName} {data.personal.lastName}</h1>
                                    <p className="text-xl text-accent font-medium">{data.personal.targetJobTitle || data.personal.jobTitle || 'المسمى الوظيفي'}</p>
                                </div>
                            </div>
                            <div className="text-right text-sm text-gray-600 leading-relaxed">
                                {data.personal.email && data.personal.email !== '__skipped__' && <p dir="ltr">{data.personal.email}</p>}
                                {data.personal.phone && data.personal.phone !== '__skipped__' && <p dir="ltr">{data.personal.phone}</p>}
                                {data.personal.country && data.personal.country !== '__skipped__' && <p>{data.personal.country}</p>}
                                {data.personal.birthDate && data.personal.birthDate !== '__skipped__' && <p>تاريخ الميلاد: {data.personal.birthDate}</p>}
                            </div>
                        </div>

                        {/* Summary */}
                        {data.personal.summary && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-primary mb-3 border-b border-gray-100 pb-2">نبذة تعريفية</h2>
                                <p className="text-gray-700 leading-relaxed text-base">{data.personal.summary}</p>
                            </div>
                        )}

                        {/* Experience */}
                        {data.experience && data.experience.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-primary mb-4 border-b border-gray-100 pb-2">الخبرة العملية</h2>
                                <div className="flex flex-col gap-6">
                                    {data.experience.map((exp) => (
                                        <div key={exp.id}>
                                            <h3 className="font-bold text-lg text-gray-900">{exp.position}</h3>
                                            <div className="flex justify-between text-sm text-accent mb-2">
                                                <span>{exp.company}</span>
                                                <span dir="ltr">{exp.startDate} - {exp.endDate}</span>
                                            </div>
                                            <p className="text-gray-700 text-sm leading-relaxed">{exp.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Education */}
                        {data.education && data.education.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-primary mb-4 border-b border-gray-100 pb-2">التعليم</h2>
                                <div className="flex flex-col gap-4">
                                    {data.education.map((edu) => (
                                        <div key={edu.id}>
                                            <h3 className="font-bold text-lg text-gray-900">{edu.degree}{edu.major ? ` - ${edu.major}` : ''}</h3>
                                            <p className="text-accent">{edu.institution}</p>
                                            <p className="text-xs text-gray-500 dir-ltr">{edu.startYear} - {edu.endYear}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Skills */}
                        {data.skills && data.skills.length > 0 && (
                            <div className="mb-8">
                                <h2 className="text-xl font-bold text-primary mb-4 border-b border-gray-100 pb-2">المهارات</h2>
                                <div className="flex flex-wrap gap-2">
                                    {data.skills.map((skill, idx) => (
                                        <span key={idx} className="bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-sm text-gray-700 font-medium">
                                            {skill}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        )}

                    </div>
                </div>
            </div>
        </div>
    );
}
