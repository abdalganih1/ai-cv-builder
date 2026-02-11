"use client";

import { CVData, Question } from '@/lib/types/cv-schema';
import { useState, useEffect } from 'react';
import questionnaireAgent from '@/lib/ai/questionnaire-agent';
import { motion } from 'framer-motion';
import NextImage from 'next/image';
import VoiceRecorder from '@/components/ui/VoiceRecorder';
import { translateAbbreviation } from '@/lib/utils/syrian-universities';

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

    // History stack for internal navigation - stores field and entry index
    interface HistoryEntry {
        field: string;
        entryIndex?: number; // For array fields like education, experience, languages
    }
    const [questionHistory, setQuestionHistory] = useState<HistoryEntry[]>([]);
    const [historyInitialized, setHistoryInitialized] = useState(false);

    // Rewinding state - for handling "back" navigation correctly
    const [rewindingField, setRewindingField] = useState<string | null>(null);

    // Helper: Check if field was skipped
    const isSkipped = (val: string | undefined | null): boolean => val === '__skipped__';

    // Initialize history from existing data - allows back navigation to work correctly
    const initializeHistoryFromData = (cvData: CVData): HistoryEntry[] => {
        const history: HistoryEntry[] = [];

        // Personal Info fields
        if (cvData.personal.birthDate && !isSkipped(cvData.personal.birthDate)) {
            history.push({ field: 'birthDate' });
        }
        if (cvData.personal.targetJobTitle) {
            history.push({ field: 'targetJobTitle' });
        }
        if (cvData.personal.email && !isSkipped(cvData.personal.email)) {
            history.push({ field: 'email' });
        }
        if (cvData.personal.photoUrl && !isSkipped(cvData.personal.photoUrl)) {
            history.push({ field: 'photoUrl' });
        }

        // Education fields
        if (cvData.education && cvData.education.length > 0) {
            history.push({ field: 'education_has' });
            cvData.education.forEach((edu, index) => {
                if (edu.institution) history.push({ field: 'education_institution', entryIndex: index });
                if (edu.degree) history.push({ field: 'education_degree', entryIndex: index });
                if (edu.major) history.push({ field: 'education_major', entryIndex: index });
                if (edu.startYear) history.push({ field: 'education_startYear', entryIndex: index });
                if (edu.endYear) history.push({ field: 'education_endYear', entryIndex: index });
            });
            // If education is not completed, add education_more to history
            if (!cvData._completedEducation && cvData.education.length > 0) {
                const lastEdu = cvData.education[cvData.education.length - 1];
                if (lastEdu.institution && lastEdu.degree && lastEdu.major && lastEdu.startYear && lastEdu.endYear) {
                    history.push({ field: 'education_more' });
                }
            }
        }

        // Experience fields
        if (cvData.experience && cvData.experience.length > 0) {
            history.push({ field: 'experience_has' });
            cvData.experience.forEach((exp, index) => {
                if (exp.company) history.push({ field: 'experience_company', entryIndex: index });
                if (exp.position) history.push({ field: 'experience_position', entryIndex: index });
                if (exp.startDate) history.push({ field: 'experience_startDate', entryIndex: index });
                if (exp.endDate) history.push({ field: 'experience_endDate', entryIndex: index });
                if (exp.description) history.push({ field: 'experience_description', entryIndex: index });
            });
            // If experience is not completed, add experience_more to history
            if (!cvData._completedExperience && cvData.experience.length > 0) {
                const lastExp = cvData.experience[cvData.experience.length - 1];
                if (lastExp.company && lastExp.position && lastExp.startDate && lastExp.endDate && lastExp.description) {
                    history.push({ field: 'experience_more' });
                }
            }
        }

        // Skills
        if (cvData.skills && cvData.skills.length > 0) {
            history.push({ field: 'skills' });
        }

        // Languages fields
        if (cvData.languages && cvData.languages.length > 0) {
            history.push({ field: 'languages_has' });
            cvData.languages.forEach((lang, index) => {
                if (lang.name) history.push({ field: 'languages_name', entryIndex: index });
                if (lang.level) history.push({ field: 'languages_level', entryIndex: index });
            });
            // If languages is not completed, add languages_more to history
            if (!cvData._completedLanguages && cvData.languages.length > 0) {
                const lastLang = cvData.languages[cvData.languages.length - 1];
                if (lastLang.name && lastLang.level) {
                    history.push({ field: 'languages_more' });
                }
            }
        }

        // Hobbies
        if (cvData.hobbies && cvData.hobbies.length > 0) {
            history.push({ field: 'hobbies_has' });
            if (cvData.hobbies[0] !== '__pending__') {
                history.push({ field: 'hobbies_text' });
            }
        }

        return history;
    };

    // Initialize history on first mount only
    useEffect(() => {
        if (!historyInitialized) {
            const initialHistory = initializeHistoryFromData(data);
            if (initialHistory.length > 0) {
                console.log('📜 Initialized question history:', initialHistory);
                setQuestionHistory(initialHistory);
            }
            setHistoryInitialized(true);
        }
    }, [historyInitialized, data]);

    // Calculate progress based on completed sections
    const calculateProgress = (): { percentage: number; currentSection: string } => {
        let completed = 0;
        const totalSections = 6; // birthDate, education, experience, skills, languages, hobbies

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

        // 5. Languages
        if (data._completedLanguages) completed += 1;

        // 6. Hobbies
        if (data._completedHobbies) completed += 1;

        const percentage = Math.round((completed / totalSections) * 100);

        // Determine current section for label
        let currentSection = 'المعلومات الشخصية';
        if (!data.personal.birthDate) currentSection = 'المعلومات الشخصية';
        else if (!data._completedEducation) currentSection = 'التعليم والشهادات';
        else if (!data._completedExperience) currentSection = 'الخبرات العملية';
        else if (!data.skills || data.skills.length === 0) currentSection = 'المهارات';
        else if (!data._completedLanguages) currentSection = 'الغات';
        else if (!data._completedHobbies) currentSection = 'الهوايات';

        return { percentage, currentSection };
    };

    const { percentage, currentSection } = calculateProgress();

    // Get question for a specific field (used when rewinding)
    const getQuestionForField = (field: string, cvData: CVData): Question | null => {
        const fieldNameMap: Record<string, Omit<Question, 'id'>> = {
            'birthDate': {
                field: 'birthDate',
                text: 'ما هو تاريخ ميلادك؟ (مثال: 1990/05/15)',
                type: 'text',
                skippable: true
            },
            'targetJobTitle': {
                field: 'targetJobTitle',
                text: 'ما هو المسمى الوظيفي الذي ترغب أن يظهر في أعلى السيرة الذاتية؟ (مثال: مبرمج واجهات أمامية، مدير مشاريع)',
                type: 'text',
                skippable: false
            },
            'email': {
                field: 'email',
                text: 'ما هو بريدك الإلكتروني؟',
                type: 'email',
                skippable: true,
                placeholder: `${cvData.personal.firstName?.toLowerCase() || 'your.name'}@gmail.com`
            },
            'photoUrl': {
                field: 'photoUrl',
                text: 'هل تود إضافة صورة شخصية للسيرة الذاتية؟ يفضل صورة احترافية خلفية بيضاء.',
                type: 'file',
                skippable: true
            }
        };

        const questionData = fieldNameMap[field];
        if (questionData) {
            return { id: field, ...questionData } as Question;
        }

        // For array fields (education, experience, languages), return null to let normal flow handle it
        // This is a simplified approach - for complex fields we'd need more logic
        return null;
    };

    // Load the next question when the component mounts or after an answer
    useEffect(() => {
        const fetchQuestion = async () => {
            // If we're rewinding to a specific field, show that question directly
            if (rewindingField) {
                const question = getQuestionForField(rewindingField, data);
                setCurrentQuestion(question);
                setLoading(false);
                setRewindingField(null); // Clear after use
                return;
            }

            setLoading(true);
            const question = await questionnaireAgent.getNextQuestion(data);
            setCurrentQuestion(question);
            setLoading(false);
        };

        fetchQuestion();
    }, [data, rewindingField]);

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

        // Save current question to history before moving forward
        // Include entry index for array fields
        const historyEntry: { field: string; entryIndex?: number } = { field: currentQuestion.field };

        if (currentQuestion.field.startsWith('education_')) {
            historyEntry.entryIndex = data.education?.length ? data.education.length - 1 : 0;
        } else if (currentQuestion.field.startsWith('experience_')) {
            historyEntry.entryIndex = data.experience?.length ? data.experience.length - 1 : 0;
        } else if (currentQuestion.field.startsWith('languages_')) {
            historyEntry.entryIndex = data.languages?.length ? data.languages.length - 1 : 0;
        }

        setQuestionHistory(prev => [...prev, historyEntry]);

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
            if (list.length > 0) list[list.length - 1].institution = translateAbbreviation(response, 'university');
            updatedData.education = list;
        }
        else if (field === 'education_degree') {
            const list = [...(data.education || [])];
            if (list.length > 0) list[list.length - 1].degree = response;
            updatedData.education = list;
        }
        else if (field === 'education_major') {
            const list = [...(data.education || [])];
            if (list.length > 0) list[list.length - 1].major = translateAbbreviation(response, 'major');
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

        // ═══════════════════════════════════════════════════════════════
        // LANGUAGES
        // ═══════════════════════════════════════════════════════════════
        else if (field === 'languages_has') {
            if (response === 'yes') {
                const list = [...(data.languages || [])];
                list.push({ name: '', level: '' });
                updatedData.languages = list;
            } else {
                updatedData._completedLanguages = true;
                // Add default native language if empty? Maybe Arabic?
                // For now, leave as is.
            }
        }
        else if (field === 'languages_name') {
            const list = [...(data.languages || [])];
            if (list.length > 0) list[list.length - 1].name = response;
            updatedData.languages = list;
        }
        else if (field === 'languages_level') {
            const list = [...(data.languages || [])];
            if (list.length > 0) list[list.length - 1].level = response;
            updatedData.languages = list;
        }
        else if (field === 'languages_more') {
            if (response === 'yes') {
                const list = [...(data.languages || [])];
                list.push({ name: '', level: '' });
                updatedData.languages = list;
            } else {
                updatedData._completedLanguages = true;
            }
        }

        // Update global state, trigger useEffect to fetch next question
        onUpdate(updatedData);
        setResponse('');
    };

    const handleInternalBack = () => {
        // If history is empty, go back to previous step (Contact)
        if (questionHistory.length === 0) {
            onBack();
            return;
        }

        // Pop the last question field to get the PREVIOUS question
        const newHistory = [...questionHistory];
        const lastEntry = newHistory.pop();
        setQuestionHistory(newHistory);

        if (!lastEntry) return;

        const lastField = lastEntry.field;

        console.log('🔙 Backing up to field:', lastField);

        // Set rewinding field to show that question for editing
        setRewindingField(lastField);

        // Pre-populate response with current value for single fields
        if (lastField === 'birthDate') {
            const currentValue = data.personal.birthDate;
            if (currentValue && currentValue !== '__skipped__') {
                setResponse(currentValue);
            } else {
                setResponse('');
            }
        } else if (lastField === 'targetJobTitle') {
            setResponse(data.personal.targetJobTitle || '');
        } else if (lastField === 'email') {
            const currentEmail = data.personal.email;
            if (currentEmail && currentEmail !== '__skipped__') {
                // Parse email for username and domain
                const parts = currentEmail.split('@');
                if (parts.length === 2) {
                    setEmailUsername(parts[0]);
                    setEmailDomain(parts[1]);
                    setResponse(currentEmail);
                } else {
                    setEmailUsername('');
                    setEmailDomain('gmail.com');
                    setResponse('');
                }
            } else {
                setEmailUsername('');
                setEmailDomain('gmail.com');
                setResponse('');
            }
        } else if (lastField === 'photoUrl') {
            const currentValue = data.personal.photoUrl;
            if (currentValue && currentValue !== '__skipped__') {
                setResponse(currentValue);
            } else {
                setResponse('');
            }
        }

        // For array fields (education, experience, languages), keep the history logic
        // but don't clear data - just allow re-entry
        const entryIndex = lastEntry.entryIndex;
        const clearData: Partial<CVData> = {};

        // Only clear data for array fields, not for personal info fields
        if (lastField.startsWith('education_') && entryIndex !== undefined) {
            const list = [...(data.education || [])];
            const idx = entryIndex;
            if (idx >= 0 && idx < list.length) {
                if (lastField === 'education_institution') list[idx].institution = '';
                else if (lastField === 'education_degree') list[idx].degree = '';
                else if (lastField === 'education_major') list[idx].major = '';
                else if (lastField === 'education_startYear') list[idx].startYear = '';
                else if (lastField === 'education_endYear') list[idx].endYear = '';
                clearData.education = list;
            }
        } else if (lastField.startsWith('experience_') && entryIndex !== undefined) {
            const list = [...(data.experience || [])];
            const idx = entryIndex;
            if (idx >= 0 && idx < list.length) {
                if (lastField === 'experience_company') list[idx].company = '';
                else if (lastField === 'experience_position') list[idx].position = '';
                else if (lastField === 'experience_startDate') list[idx].startDate = '';
                else if (lastField === 'experience_endDate') list[idx].endDate = '';
                else if (lastField === 'experience_description') list[idx].description = '';
                clearData.experience = list;
            }
        } else if (lastField.startsWith('languages_') && entryIndex !== undefined) {
            const list = [...(data.languages || [])];
            const idx = entryIndex;
            if (idx >= 0 && idx < list.length) {
                if (lastField === 'languages_name') list[idx].name = '';
                else if (lastField === 'languages_level') list[idx].level = '';
                clearData.languages = list;
            }
        } else if (lastField === 'education_has') {
            clearData._completedEducation = undefined;
            if (data.education && data.education.length > 0) {
                const lastEdu = data.education[data.education.length - 1];
                if (!lastEdu.institution && !lastEdu.degree) {
                    clearData.education = data.education.slice(0, -1);
                }
            }
        } else if (lastField === 'education_more') {
            clearData._completedEducation = undefined;
            if (data.education && data.education.length > 0) {
                const lastEdu = data.education[data.education.length - 1];
                if (!lastEdu.institution && !lastEdu.degree && !lastEdu.major && !lastEdu.startYear && !lastEdu.endYear) {
                    clearData.education = data.education.slice(0, -1);
                }
            }
        } else if (lastField === 'experience_has') {
            clearData._completedExperience = undefined;
            if (data.experience && data.experience.length > 0) {
                const lastExp = data.experience[data.experience.length - 1];
                if (!lastExp.company && !lastExp.position) {
                    clearData.experience = data.experience.slice(0, -1);
                }
            }
        } else if (lastField === 'experience_more') {
            clearData._completedExperience = undefined;
            if (data.experience && data.experience.length > 0) {
                const lastExp = data.experience[data.experience.length - 1];
                if (!lastExp.company && !lastExp.position && !lastExp.startDate && !lastExp.endDate && !lastExp.description) {
                    clearData.experience = data.experience.slice(0, -1);
                }
            }
        } else if (lastField === 'skills') {
            clearData.skills = [];
        } else if (lastField === 'hobbies_has') {
            clearData._completedHobbies = undefined;
            clearData.hobbies = [];
        } else if (lastField === 'hobbies_text') {
            clearData._completedHobbies = undefined;
            clearData.hobbies = ['__pending__'];
        } else if (lastField === 'languages_has') {
            clearData._completedLanguages = undefined;
            if (data.languages && data.languages.length > 0) {
                const lastLang = data.languages[data.languages.length - 1];
                if (!lastLang.name) {
                    clearData.languages = data.languages.slice(0, -1);
                }
            }
        } else if (lastField === 'languages_more') {
            clearData._completedLanguages = undefined;
            if (data.languages && data.languages.length > 0) {
                const lastLang = data.languages[data.languages.length - 1];
                if (!lastLang.name && !lastLang.level) {
                    clearData.languages = data.languages.slice(0, -1);
                }
            }
        }

        // Update data only if we have clearData (for array fields or special cases)
        if (Object.keys(clearData).length > 0) {
            onUpdate(clearData);
        }
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
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <button
                    onClick={handleInternalBack}
                    className="px-8 py-4 rounded-2xl font-bold border-2 border-gray-200 text-gray-500 hover:border-gray-400 hover:text-gray-700 transition-all"
                >
                    ← العودة لتعديل البيانات
                </button>
                <button onClick={() => onNext({})} className="bg-primary text-white px-10 py-4 rounded-2xl font-bold shadow-xl shadow-primary/20 hover:scale-105 transition-all">
                    الانتقال للدفع والمعاينة
                </button>
            </div>
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
                        <div className="relative">
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
                                className="w-full p-5 pl-14 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                                placeholder="اكتب إجابتك هنا..."
                                autoFocus
                                enterKeyHint="next"
                            />
                            <div className="absolute left-3 top-1/2 -translate-y-1/2">
                                <VoiceRecorder
                                    onTranscript={(text) => setResponse(prev => prev + ' ' + text)}
                                    placeholder="🎤"
                                />
                            </div>
                        </div>
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
                                className="w-full p-5 pb-14 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none min-h-[160px] transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                                placeholder="اكتب تفاصيل إجابتك هنا..."
                                autoFocus
                                enterKeyHint="enter"
                            />
                            <div className="absolute bottom-4 left-4 flex items-center gap-3">
                                <VoiceRecorder
                                    onTranscript={(text) => setResponse(prev => prev + ' ' + text)}
                                    placeholder="🎤"
                                />
                                <span className="text-xs text-gray-400">{response.length} حرف</span>
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
                        <div className="space-y-4" dir="ltr">
                            {/* Username input - separate box */}
                            <input
                                type="email"
                                value={emailUsername}
                                onChange={(e) => {
                                    const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                                    setEmailUsername(val);
                                    setResponse(`${val}@${emailDomain}`);
                                }}
                                className="w-full p-4 text-lg border-2 border-gray-200 rounded-xl outline-none focus:border-primary bg-white text-gray-800 placeholder:text-gray-400"
                                placeholder="your.name"
                                dir="ltr"
                                autoFocus
                                inputMode="email"
                                autoCapitalize="none"
                                autoCorrect="off"
                                autoComplete="username"
                                enterKeyHint="next"
                                style={{ fontSize: '16px' }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                        e.preventDefault();
                                        handleAnswer();
                                    }
                                }}
                            />

                            {/* @ + Domain - separate box */}
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-primary">@</span>
                                <select
                                    value={emailDomain}
                                    onChange={(e) => {
                                        setEmailDomain(e.target.value);
                                        setResponse(`${emailUsername}@${e.target.value}`);
                                    }}
                                    className="flex-1 p-4 text-lg border-2 border-gray-200 rounded-xl outline-none focus:border-primary bg-white text-gray-700 font-medium"
                                    dir="ltr"
                                    style={{ fontSize: '16px', WebkitAppearance: 'menulist', appearance: 'menulist' }}
                                >
                                    <option value="gmail.com">gmail.com</option>
                                    <option value="icloud.com">icloud.com</option>
                                    <option value="outlook.com">outlook.com</option>
                                    <option value="hotmail.com">hotmail.com</option>
                                </select>
                            </div>

                            {/* Preview - always visible */}
                            {emailUsername && (
                                <div className="text-center py-3 bg-primary/5 rounded-xl">
                                    <span className="text-sm text-gray-500" dir="rtl">البريد الإلكتروني: </span>
                                    <span className="font-bold text-primary" dir="ltr">{emailUsername}@{emailDomain}</span>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                    <button
                        onClick={handleInternalBack}
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
