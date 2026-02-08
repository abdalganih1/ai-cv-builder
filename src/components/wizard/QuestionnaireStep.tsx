"use client";

import { CVData, Question } from '@/lib/types/cv-schema';
import { useState, useEffect } from 'react';
import questionnaireAgent from '@/lib/ai/questionnaire-agent';
import { motion } from 'framer-motion';
import NextImage from 'next/image';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
    onBack: () => void;
}

export default function QuestionnaireStep({ data, onNext, onUpdate, onBack }: StepProps) {
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [response, setResponse] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Email-specific state
    const [emailUsername, setEmailUsername] = useState<string>('');
    const [emailDomain, setEmailDomain] = useState<string>('gmail.com');

    // Calculate progress based on completed sections
    const calculateProgress = (): { percentage: number; currentSection: string } => {
        let completed = 0;
        const totalSections = 5; // birthDate, education, experience, skills, hobbies

        // 1. Birth date
        if (data.personal.birthDate) completed += 1;

        // 2. Education
        if (data._completedEducation) {
            completed += 1;
        } else if (data.education && data.education.length > 0) {
            // Partial credit for education in progress
            const lastEdu = data.education[data.education.length - 1];
            const fields = [lastEdu.institution, lastEdu.degree, lastEdu.major, lastEdu.startYear, lastEdu.endYear];
            const filledFields = fields.filter(f => f).length;
            completed += 0.2 + (filledFields / fields.length) * 0.6; // 0.2 base + up to 0.6 for fields
        }

        // 3. Experience
        if (data._completedExperience) {
            completed += 1;
        } else if (data.experience && data.experience.length > 0) {
            const lastExp = data.experience[data.experience.length - 1];
            const fields = [lastExp.company, lastExp.position, lastExp.startDate, lastExp.endDate, lastExp.description];
            const filledFields = fields.filter(f => f).length;
            completed += 0.2 + (filledFields / fields.length) * 0.6;
        }

        // 4. Skills
        if (data.skills && data.skills.length > 0) completed += 1;

        // 5. Hobbies
        if (data._completedHobbies) completed += 1;

        const percentage = Math.round((completed / totalSections) * 100);

        // Determine current section for label
        let currentSection = 'المعلومات الشخصية';
        if (!data.personal.birthDate) currentSection = 'المعلومات الشخصية';
        else if (!data._completedEducation) currentSection = 'التعليم والشهادات';
        else if (!data._completedExperience) currentSection = 'الخبرات العملية';
        else if (!data.skills || data.skills.length === 0) currentSection = 'المهارات';
        else if (!data._completedHobbies) currentSection = 'الهوايات';

        return { percentage, currentSection };
    };

    const { percentage, currentSection } = calculateProgress();

    // Load the next question when the component mounts or after an answer
    useEffect(() => {
        const fetchQuestion = async () => {
            setLoading(true);
            const question = await questionnaireAgent.getNextQuestion(data);
            setCurrentQuestion(question);
            setLoading(false);
        };

        fetchQuestion();
    }, [data]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onloadend = () => {
                setResponse(reader.result as string);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleAnswer = async () => {
        if (!currentQuestion) return;

        const field = currentQuestion.field;
        const updatedData: Partial<CVData> = {};

        // ═══════════════════════════════════════════════════════════════
        // PERSONAL INFO
        // ═══════════════════════════════════════════════════════════════
        if (field === 'birthDate') {
            // If response is empty (skip), set skip marker
            updatedData.personal = { ...data.personal, birthDate: response || '__skipped__' };
        }
        else if (field === 'targetJobTitle') {
            updatedData.personal = { ...data.personal, targetJobTitle: response };
        }
        else if (field === 'email') {
            // If response is empty (skip), set skip marker
            updatedData.personal = { ...data.personal, email: response || '__skipped__' };
        }
        else if (field === 'photoUrl') {
            // If response is empty (user clicked Skip), set marker to skip
            updatedData.personal = { ...data.personal, photoUrl: response || '__skipped__' };
        }

        // ═══════════════════════════════════════════════════════════════
        // EDUCATION HANDLERS (Same as before)
        // ═══════════════════════════════════════════════════════════════
        else if (field === 'education_has') {
            if (response === 'yes') {
                const list = [...(data.education || [])];
                list.push({ id: Date.now().toString(), institution: '', degree: '', major: '', startYear: '', endYear: '' });
                updatedData.education = list;
            } else {
                updatedData._completedEducation = true;
            }
        }
        else if (field === 'education_institution') {
            const list = [...(data.education || [])];
            if (list.length > 0) list[list.length - 1].institution = response;
            updatedData.education = list;
        }
        else if (field === 'education_degree') {
            const list = [...(data.education || [])];
            if (list.length > 0) list[list.length - 1].degree = response;
            updatedData.education = list;
        }
        else if (field === 'education_major') {
            const list = [...(data.education || [])];
            if (list.length > 1) list[list.length - 1].major = response;
            // note: fix lookup to be safe
            if (list.length > 0) list[list.length - 1].major = response;
            updatedData.education = list;
        }
        else if (field === 'education_startYear') {
            const list = [...(data.education || [])];
            if (list.length > 0) list[list.length - 1].startYear = response;
            updatedData.education = list;
        }
        else if (field === 'education_endYear') {
            const list = [...(data.education || [])];
            if (list.length > 0) list[list.length - 1].endYear = response;
            updatedData.education = list;
        }
        else if (field === 'education_more') {
            if (response === 'yes') {
                const list = [...(data.education || [])];
                list.push({ id: Date.now().toString(), institution: '', degree: '', major: '', startYear: '', endYear: '' });
                updatedData.education = list;
            } else {
                updatedData._completedEducation = true;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // EXPERIENCE HANDLERS (Same as before)
        // ═══════════════════════════════════════════════════════════════
        else if (field === 'experience_has') {
            if (response === 'yes') {
                const list = [...(data.experience || [])];
                list.push({ id: Date.now().toString(), company: '', position: '', startDate: '', endDate: '', description: '' });
                updatedData.experience = list;
            } else {
                updatedData._completedExperience = true;
            }
        }
        else if (field === 'experience_company') {
            const list = [...(data.experience || [])];
            if (list.length > 0) list[list.length - 1].company = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_position') {
            const list = [...(data.experience || [])];
            if (list.length > 0) list[list.length - 1].position = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_startDate') {
            const list = [...(data.experience || [])];
            if (list.length > 0) list[list.length - 1].startDate = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_endDate') {
            const list = [...(data.experience || [])];
            if (list.length > 0) list[list.length - 1].endDate = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_description') {
            const list = [...(data.experience || [])];
            if (list.length > 0) list[list.length - 1].description = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_more') {
            if (response === 'yes') {
                const list = [...(data.experience || [])];
                list.push({ id: Date.now().toString(), company: '', position: '', startDate: '', endDate: '', description: '' });
                updatedData.experience = list;
            } else {
                updatedData._completedExperience = true;
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SKILLS & HOBBIES
        // ═══════════════════════════════════════════════════════════════
        else if (field === 'skills') {
            updatedData.skills = response.split(/[،,]+/).map(s => s.trim()).filter(s => s);
        }
        else if (field === 'hobbies_has') {
            if (response === 'yes') {
                updatedData.hobbies = ['__pending__'];
            } else {
                updatedData._completedHobbies = true;
                updatedData.hobbies = [];
            }
        }
        else if (field === 'hobbies_text') {
            updatedData.hobbies = response.split(/[،,]+/).map(s => s.trim()).filter(s => s);
            updatedData._completedHobbies = true;
        }

        // Update global state, trigger useEffect to fetch next question
        onUpdate(updatedData);
        setResponse('');
    };

    if (loading) return (
        <div className="text-center p-10">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="font-bold text-primary">جاري تحليل الإجابات وتوليد السؤال التالي...</p>
        </div>
    );

    if (!currentQuestion) return (
        <div className="text-center p-10 space-y-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-gray-900">تم الانتهاء من جميع الأسئلة بنجاح!</h2>
            <p className="text-gray-500">لقد جمعنا معلومات كافية لبناء سيرة ذاتية احترافية.</p>
            <button onClick={() => onNext({})} className="bg-primary text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                الانتقال للدفع والمعاينة
            </button>
        </div>
    );

    return (
        <div className="w-full max-w-xl mx-auto py-4">
            {/* Progress Bar */}
            <div className="mb-8">
                <div className="flex justify-between text-sm font-bold text-gray-500 mb-2">
                    <span>{currentSection}</span>
                    <span>{percentage}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${percentage}%` }}
                        className="h-full bg-primary rounded-full"
                        transition={{ duration: 0.5 }}
                    />
                </div>
            </div>

            <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                key={currentQuestion.id}
                className="space-y-8"
            >
                <div className="space-y-2">
                    <label className="text-2xl font-bold text-gray-900 block leading-tight">
                        {currentQuestion.text}
                    </label>
                    <div className="h-1 w-20 bg-accent rounded-full mb-4"></div>
                </div>

                <div className="min-h-[200px]">
                    {currentQuestion.type === 'yesno' && (
                        <div className="grid grid-cols-2 gap-4">
                            <button
                                onClick={() => setResponse('yes')}
                                className={`group flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${response === 'yes' ? 'border-primary bg-primary/5 text-primary shadow-md' : 'border-gray-100 hover:border-primary/50 bg-white'}`}
                            >
                                <span className={`text-xl font-bold ${response === 'yes' ? 'text-primary' : 'text-gray-600'}`}>نعم</span>
                            </button>
                            <button
                                onClick={() => setResponse('no')}
                                className={`group flex flex-col items-center justify-center p-6 rounded-2xl border-2 transition-all duration-300 ${response === 'no' ? 'border-primary bg-primary/5 text-primary shadow-md' : 'border-gray-100 hover:border-primary/50 bg-white'}`}
                            >
                                <span className={`text-xl font-bold ${response === 'no' ? 'text-primary' : 'text-gray-600'}`}>لا</span>
                            </button>
                        </div>
                    )}

                    {currentQuestion.type === 'text' && (
                        <input
                            type="text"
                            value={response}
                            onChange={(e) => setResponse(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAnswer();
                                }
                            }}
                            className="w-full p-5 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                            placeholder="اكتب إجابتك هنا..."
                            autoFocus
                            enterKeyHint="next"
                        />
                    )}

                    {currentQuestion.type === 'textarea' && (
                        <div className="relative">
                            <textarea
                                value={response}
                                onChange={(e) => setResponse(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                        e.preventDefault();
                                        handleAnswer();
                                    }
                                }}
                                className="w-full p-5 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none min-h-[160px] transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                                placeholder="اكتب تفاصيل إجابتك هنا..."
                                autoFocus
                                enterKeyHint="enter"
                            />
                            <div className="absolute bottom-4 left-4 text-xs text-gray-400">
                                {response.length} حرف
                            </div>
                        </div>
                    )}

                    {currentQuestion.type === 'file' && (
                        <div className="flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-2xl p-10 hover:bg-gray-50 transition-colors cursor-pointer relative"
                            onClick={() => document.getElementById('file-upload')?.click()}
                        >
                            <input
                                id="file-upload"
                                type="file"
                                accept="image/*"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            {response ? (
                                <div className="text-center">
                                    <div className="w-32 h-32 rounded-full overflow-hidden mx-auto mb-4 border-4 border-primary relative">
                                        <NextImage
                                            src={response}
                                            alt="Preview"
                                            fill
                                            className="object-cover"
                                        />
                                    </div>
                                    <p className="text-green-600 font-bold">تم اختيار الصورة بنجاح</p>
                                    <p className="text-xs text-gray-500 mt-2">اضغط للتغيير</p>
                                </div>
                            ) : (
                                <div className="text-center">
                                    <span className="text-4xl mb-2 block">📷</span>
                                    <p className="text-gray-600 font-medium">اضغط هنا لرفع صورة شخصية</p>
                                    <p className="text-xs text-gray-400 mt-2">JPG, PNG بحد أقصى 2 ميغابايت</p>
                                </div>
                            )}
                        </div>
                    )}

                    {currentQuestion.type === 'email' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-0 bg-gray-50/50 rounded-2xl border-2 border-gray-100 focus-within:border-primary transition-all overflow-hidden" dir="ltr">
                                {/* Username input */}
                                <input
                                    type="text"
                                    value={emailUsername}
                                    onChange={(e) => {
                                        setEmailUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, ''));
                                        setResponse(`${e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '')}@${emailDomain}`);
                                    }}
                                    className="flex-1 p-5 text-lg bg-transparent outline-none text-gray-800 placeholder:text-gray-400"
                                    placeholder="your.name"
                                    dir="ltr"
                                    autoFocus
                                    enterKeyHint="next"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            e.preventDefault();
                                            handleAnswer();
                                        }
                                    }}
                                />

                                {/* Fixed @ symbol */}
                                <span className="text-2xl font-bold text-primary px-2">@</span>

                                {/* Domain dropdown */}
                                <select
                                    value={emailDomain}
                                    onChange={(e) => {
                                        setEmailDomain(e.target.value);
                                        setResponse(`${emailUsername}@${e.target.value}`);
                                    }}
                                    className="p-5 text-lg bg-white border-r-2 border-gray-100 outline-none text-gray-700 font-medium cursor-pointer min-w-[160px]"
                                    dir="ltr"
                                >
                                    <option value="gmail.com">gmail.com</option>
                                    <option value="icloud.com">icloud.com</option>
                                    <option value="outlook.com">outlook.com</option>
                                    <option value="hotmail.com">hotmail.com</option>
                                </select>
                            </div>

                            {/* Preview */}
                            {emailUsername && (
                                <div className="text-center py-3 bg-primary/5 rounded-xl">
                                    <span className="text-sm text-gray-500">البريد الإلكتروني: </span>
                                    <span className="font-bold text-primary" dir="ltr">{emailUsername}@{emailDomain}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-600 font-medium transition-colors"
                    >
                        <span>←</span>
                        <span>رجوع</span>
                    </button>

                    <div className="flex gap-3">
                        {/* Skip button for skippable questions */}
                        {currentQuestion.skippable && !response && (
                            <button
                                onClick={handleAnswer}
                                className="flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-gray-400 border-2 border-gray-100 hover:border-gray-300 hover:text-gray-600 transition-all"
                            >
                                <span>تخطي</span>
                            </button>
                        )}

                        {/* Main continue button */}
                        <button
                            onClick={handleAnswer}
                            disabled={!response && !currentQuestion.skippable}
                            className="flex items-center gap-3 bg-primary text-white px-10 py-4 rounded-2xl font-bold hover:bg-primary-dark disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-primary/20 active:scale-95"
                        >
                            <span>المتابعة</span>
                            <span className="text-xl">→</span>
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}
