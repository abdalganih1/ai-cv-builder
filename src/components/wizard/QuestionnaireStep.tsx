"use client";

import { CVData, Question } from '@/lib/types/cv-schema';
import { useState, useEffect, useCallback } from 'react';
import questionnaireAgent from '@/lib/ai/questionnaire-agent';
import NextImage from 'next/image';
import VoiceRecorder from '@/components/ui/VoiceRecorder';
import { translateAbbreviation } from '@/lib/utils/syrian-universities';

interface StepProps {
    data: CVData;
    onNext: (data: Partial<CVData>) => void;
    onUpdate: (data: Partial<CVData>) => void;
    onBack: () => void;
}

// ═══════════════════════════════════════════════════════════════
// SECTION DEFINITIONS for Checkpoints
// ═══════════════════════════════════════════════════════════════
interface SectionDef {
    id: string;
    label: string;
    icon: string;
    fields: string[]; // ordered fields in this section
}

const SECTIONS: SectionDef[] = [
    {
        id: 'personal', label: 'المعلومات الشخصية', icon: '👤',
        fields: ['birthDate', 'targetJobTitle', 'email', 'photoUrl']
    },
    {
        id: 'education', label: 'التعليم والشهادات', icon: '🎓',
        fields: ['education_has', 'education_institution', 'education_degree', 'education_major', 'education_startYear', 'education_endYear', 'education_more']
    },
    {
        id: 'experience', label: 'الخبرات العملية', icon: '💼',
        fields: ['experience_has', 'experience_company', 'experience_position', 'experience_startDate', 'experience_endDate', 'experience_description', 'experience_more']
    },
    {
        id: 'skills', label: 'المهارات', icon: '⚡',
        fields: ['skills']
    },
    {
        id: 'languages', label: 'اللغات', icon: '🌍',
        fields: ['languages_has', 'languages_name', 'languages_level', 'languages_more']
    },
    {
        id: 'hobbies', label: 'الهوايات', icon: '🎯',
        fields: ['hobbies_has', 'hobbies_text']
    }
];

// History entry for navigation
interface HistoryEntry {
    field: string;
    entryIndex?: number; // For array fields like education, experience, languages
}

export default function QuestionnaireStep({ data, onNext, onUpdate, onBack }: StepProps) {
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [response, setResponse] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Email-specific state
    const [emailUsername, setEmailUsername] = useState<string>('');
    const [emailDomain, setEmailDomain] = useState<string>('gmail.com');

    // History stack for internal navigation
    const [questionHistory, setQuestionHistory] = useState<HistoryEntry[]>([]);
    const [historyInitialized, setHistoryInitialized] = useState(false);

    // Rewinding state
    const [isRewinding, setIsRewinding] = useState(false);

    // Active entry index for array fields
    const [activeEntryIndex, setActiveEntryIndex] = useState<number | null>(null);

    // Helper: Check if field was skipped
    const isSkipped = (val: string | undefined | null): boolean => val === '__skipped__';

    // ═══════════════════════════════════════════════════════════════
    // HISTORY INITIALIZATION - build from existing data
    // ═══════════════════════════════════════════════════════════════
    const initializeHistoryFromData = useCallback((cvData: CVData): HistoryEntry[] => {
        const history: HistoryEntry[] = [];

        // Personal Info fields
        if (cvData.personal.birthDate) history.push({ field: 'birthDate' });
        if (cvData.personal.targetJobTitle) history.push({ field: 'targetJobTitle' });
        if (cvData.personal.email) history.push({ field: 'email' });
        if (cvData.personal.photoUrl) history.push({ field: 'photoUrl' });

        // Education fields
        if ((cvData.education && cvData.education.length > 0) || cvData._completedEducation) {
            history.push({ field: 'education_has' });
            cvData.education.forEach((edu, index) => {
                if (edu.institution) history.push({ field: 'education_institution', entryIndex: index });
                if (edu.degree) history.push({ field: 'education_degree', entryIndex: index });
                if (edu.major) history.push({ field: 'education_major', entryIndex: index });
                if (edu.startYear) history.push({ field: 'education_startYear', entryIndex: index });
                if (edu.endYear) history.push({ field: 'education_endYear', entryIndex: index });
            });
            if (!cvData._completedEducation && cvData.education.length > 0) {
                const lastEdu = cvData.education[cvData.education.length - 1];
                if (lastEdu.institution && lastEdu.degree && lastEdu.major && lastEdu.startYear && lastEdu.endYear) {
                    history.push({ field: 'education_more' });
                }
            }
        }

        // Experience fields
        if ((cvData.experience && cvData.experience.length > 0) || cvData._completedExperience) {
            history.push({ field: 'experience_has' });
            cvData.experience.forEach((exp, index) => {
                if (exp.company) history.push({ field: 'experience_company', entryIndex: index });
                if (exp.position) history.push({ field: 'experience_position', entryIndex: index });
                if (exp.startDate) history.push({ field: 'experience_startDate', entryIndex: index });
                if (exp.endDate) history.push({ field: 'experience_endDate', entryIndex: index });
                if (exp.description) history.push({ field: 'experience_description', entryIndex: index });
            });
            if (!cvData._completedExperience && cvData.experience.length > 0) {
                const lastExp = cvData.experience[cvData.experience.length - 1];
                if (lastExp.company && lastExp.position && lastExp.startDate && lastExp.endDate && lastExp.description) {
                    history.push({ field: 'experience_more' });
                }
            }
        }

        // Skills
        if (cvData.skills && cvData.skills.length > 0) history.push({ field: 'skills' });

        // Languages fields
        if ((cvData.languages && cvData.languages.length > 0) || cvData._completedLanguages) {
            history.push({ field: 'languages_has' });
            cvData.languages.forEach((lang, index) => {
                if (lang.name) history.push({ field: 'languages_name', entryIndex: index });
                if (lang.level) history.push({ field: 'languages_level', entryIndex: index });
            });
            if (!cvData._completedLanguages && cvData.languages.length > 0) {
                const lastLang = cvData.languages[cvData.languages.length - 1];
                if (lastLang.name && lastLang.level) {
                    history.push({ field: 'languages_more' });
                }
            }
        }

        // Hobbies
        if ((cvData.hobbies && cvData.hobbies.length > 0) || cvData._completedHobbies) {
            history.push({ field: 'hobbies_has' });
            if (cvData.hobbies[0] !== '__pending__') {
                history.push({ field: 'hobbies_text' });
            }
        }

        return history;
    }, []);

    // Initialize history on first mount
    useEffect(() => {
        if (!historyInitialized) {
            const initialHistory = initializeHistoryFromData(data);
            if (initialHistory.length > 0) {
                console.log('📜 Initialized question history:', initialHistory);
                setQuestionHistory(initialHistory);
            }
            setHistoryInitialized(true);
        }
    }, [historyInitialized, data, initializeHistoryFromData]);

    // ═══════════════════════════════════════════════════════════════
    // SECTION STATUS - determine which sections are complete/active
    // ═══════════════════════════════════════════════════════════════
    const getSectionStatus = useCallback((sectionId: string): 'completed' | 'active' | 'locked' => {
        const isSkippedField = (val: string | undefined | null): boolean => val === '__skipped__';

        switch (sectionId) {
            case 'personal': {
                const allDone = (data.personal.birthDate || isSkippedField(data.personal.birthDate)) &&
                    data.personal.targetJobTitle &&
                    (data.personal.email || isSkippedField(data.personal.email)) &&
                    (data.personal.photoUrl || isSkippedField(data.personal.photoUrl));
                if (allDone) return 'completed';
                return 'active';
            }
            case 'education': {
                if (data._completedEducation) return 'completed';
                const personalDone = getSectionStatus('personal') === 'completed';
                return personalDone ? 'active' : 'locked';
            }
            case 'experience': {
                if (data._completedExperience) return 'completed';
                return getSectionStatus('education') === 'completed' ? 'active' : 'locked';
            }
            case 'skills': {
                if (data.skills && data.skills.length > 0) return 'completed';
                return getSectionStatus('experience') === 'completed' ? 'active' : 'locked';
            }
            case 'languages': {
                if (data._completedLanguages) return 'completed';
                return getSectionStatus('skills') === 'completed' ? 'active' : 'locked';
            }
            case 'hobbies': {
                if (data._completedHobbies) return 'completed';
                return getSectionStatus('languages') === 'completed' ? 'active' : 'locked';
            }
            default: return 'locked';
        }
    }, [data]);

    // ═══════════════════════════════════════════════════════════════
    // PROGRESS CALCULATION
    // ═══════════════════════════════════════════════════════════════
    const calculateProgress = (): { percentage: number; currentSection: string } => {
        let completed = 0;
        const totalSections = 6;

        const isSkippedField = (val: string | undefined | null): boolean => val === '__skipped__';

        // 1. Personal Info
        const personalFields = [
            data.personal.birthDate && !isSkippedField(data.personal.birthDate),
            data.personal.targetJobTitle,
            data.personal.email && !isSkippedField(data.personal.email),
            data.personal.photoUrl && !isSkippedField(data.personal.photoUrl)
        ];
        const personalFilled = personalFields.filter(Boolean).length;
        const personalSkipped = [
            isSkippedField(data.personal.birthDate),
            isSkippedField(data.personal.email),
            isSkippedField(data.personal.photoUrl)
        ].filter(Boolean).length;
        completed += (personalFilled + personalSkipped) / 4;

        // 2. Education
        if (data._completedEducation) {
            completed += 1;
        } else if (data.education && data.education.length > 0) {
            const lastEdu = data.education[data.education.length - 1];
            const fields = [lastEdu.institution, lastEdu.degree, lastEdu.major, lastEdu.startYear, lastEdu.endYear];
            completed += 0.2 + (fields.filter(f => f).length / fields.length) * 0.6;
        }

        // 3. Experience
        if (data._completedExperience) {
            completed += 1;
        } else if (data.experience && data.experience.length > 0) {
            const lastExp = data.experience[data.experience.length - 1];
            const fields = [lastExp.company, lastExp.position, lastExp.startDate, lastExp.endDate, lastExp.description];
            completed += 0.2 + (fields.filter(f => f).length / fields.length) * 0.6;
        }

        // 4. Skills
        if (data.skills && data.skills.length > 0) completed += 1;

        // 5. Languages
        if (data._completedLanguages) completed += 1;

        // 6. Hobbies
        if (data._completedHobbies) completed += 1;

        const percentage = Math.round((completed / totalSections) * 100);

        // Current section name
        let currentSection = 'المعلومات الشخصية';
        for (const section of SECTIONS) {
            const status = getSectionStatus(section.id);
            if (status !== 'completed') {
                currentSection = section.label;
                break;
            }
        }

        return { percentage, currentSection };
    };

    const { percentage, currentSection } = calculateProgress();

    // ═══════════════════════════════════════════════════════════════
    // NAVIGATE TO QUESTION - Core navigation helper
    // ═══════════════════════════════════════════════════════════════
    const navigateToField = useCallback((field: string, entryIndex?: number) => {
        const question = questionnaireAgent.getQuestionForFieldDirect(field, data, entryIndex);
        if (!question) return;

        setIsRewinding(true);
        setActiveEntryIndex(entryIndex ?? null);
        setCurrentQuestion(question);
        setLoading(false);

        // Pre-populate response with current value
        populateResponseForField(field, entryIndex);
    }, [data]);

    // Helper: populate response field with current stored value
    const populateResponseForField = (field: string, entryIndex?: number) => {
        // Personal fields
        if (field === 'birthDate') {
            const v = data.personal.birthDate;
            setResponse(v && v !== '__skipped__' ? v : '');
        } else if (field === 'targetJobTitle') {
            setResponse(data.personal.targetJobTitle || '');
        } else if (field === 'email') {
            const currentEmail = data.personal.email;
            if (currentEmail && currentEmail !== '__skipped__') {
                const parts = currentEmail.split('@');
                if (parts.length === 2) {
                    setEmailUsername(parts[0]);
                    setEmailDomain(parts[1]);
                    setResponse(currentEmail);
                } else {
                    setEmailUsername(''); setEmailDomain('gmail.com'); setResponse('');
                }
            } else {
                setEmailUsername(''); setEmailDomain('gmail.com'); setResponse('');
            }
        } else if (field === 'photoUrl') {
            setResponse('');
        }
        // Education array fields
        else if (field.startsWith('education_') && entryIndex !== undefined) {
            const edu = data.education?.[entryIndex];
            if (edu) {
                if (field === 'education_institution') setResponse(edu.institution || '');
                else if (field === 'education_degree') setResponse(edu.degree || '');
                else if (field === 'education_major') setResponse(edu.major || '');
                else if (field === 'education_startYear') setResponse(edu.startYear || '');
                else if (field === 'education_endYear') setResponse(edu.endYear || '');
                else setResponse('');
            } else {
                setResponse('');
            }
        }
        // Experience array fields
        else if (field.startsWith('experience_') && entryIndex !== undefined) {
            const exp = data.experience?.[entryIndex];
            if (exp) {
                if (field === 'experience_company') setResponse(exp.company || '');
                else if (field === 'experience_position') setResponse(exp.position || '');
                else if (field === 'experience_startDate') setResponse(exp.startDate || '');
                else if (field === 'experience_endDate') setResponse(exp.endDate || '');
                else if (field === 'experience_description') setResponse(exp.description || '');
                else setResponse('');
            } else {
                setResponse('');
            }
        }
        // Languages array fields
        else if (field.startsWith('languages_') && entryIndex !== undefined) {
            const lang = data.languages?.[entryIndex];
            if (lang) {
                if (field === 'languages_name') setResponse(lang.name || '');
                else if (field === 'languages_level') setResponse(lang.level || '');
                else setResponse('');
            } else {
                setResponse('');
            }
        }
        // Skills
        else if (field === 'skills') {
            setResponse(data.skills?.join('، ') || '');
        }
        // Hobbies
        else if (field === 'hobbies_text') {
            const h = data.hobbies?.filter(h => h !== '__pending__');
            setResponse(h?.join('، ') || '');
        }
        // yes/no fields - don't pre-populate
        else {
            setResponse('');
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // SECTION NAVIGATION (Checkpoint click)
    // ═══════════════════════════════════════════════════════════════
    const navigateToSection = useCallback((sectionId: string) => {
        const status = getSectionStatus(sectionId);
        if (status === 'locked') return; // Can't navigate to locked sections

        // Find the first field in this section
        const section = SECTIONS.find(s => s.id === sectionId);
        if (!section) return;

        // Build history up to this section's start
        const newHistory: HistoryEntry[] = [];
        const sectionIndex = SECTIONS.findIndex(s => s.id === sectionId);

        // Add all history entries from previous sections
        for (let i = 0; i < sectionIndex; i++) {
            const prevSection = SECTIONS[i];
            const prevStatus = getSectionStatus(prevSection.id);
            if (prevStatus === 'completed') {
                const historyFromPrevSection = initializeHistoryFromData(data).filter(h => {
                    return prevSection.fields.some(f => h.field === f || h.field.startsWith(f.replace('_more', '_')));
                });
                newHistory.push(...historyFromPrevSection);
            }
        }

        setQuestionHistory(newHistory);

        // For completed sections, navigate to the first field so user can review
        // For active sections, let the normal flow determine the current question
        if (status === 'completed') {
            // Navigate to first field of this completed section
            const firstField = section.fields[0];

            // Handle special cases for _has fields with existing data
            if (firstField === 'education_has' && data.education.length > 0) {
                // Go to first education entry's first field
                navigateToField('education_institution', 0);
            } else if (firstField === 'experience_has' && data.experience.length > 0) {
                navigateToField('experience_company', 0);
            } else if (firstField === 'languages_has' && data.languages.length > 0) {
                navigateToField('languages_name', 0);
            } else {
                navigateToField(firstField);
            }
        } else {
            // Active section - clear rewinding and let normal flow take over
            setIsRewinding(false);
            setActiveEntryIndex(null);
            setResponse('');
        }
    }, [data, getSectionStatus, initializeHistoryFromData, navigateToField]);

    // ═══════════════════════════════════════════════════════════════
    // FETCH NEXT QUESTION (normal flow)
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        const fetchQuestion = async () => {
            if (isRewinding) return;
            setLoading(true);
            const question = await questionnaireAgent.getNextQuestion(data);
            setCurrentQuestion(question);
            setLoading(false);
        };
        fetchQuestion();
    }, [data, isRewinding]);

    // ═══════════════════════════════════════════════════════════════
    // FILE UPLOAD HANDLER
    // ═══════════════════════════════════════════════════════════════
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

    // ═══════════════════════════════════════════════════════════════
    // HANDLE ANSWER (forward navigation)
    // ═══════════════════════════════════════════════════════════════
    const handleAnswer = async () => {
        if (!currentQuestion) return;

        // Reset rewinding state
        if (isRewinding) {
            setIsRewinding(false);
        }

        // Save current question to history
        const historyEntry: HistoryEntry = { field: currentQuestion.field };
        if (currentQuestion.field.startsWith('education_')) {
            historyEntry.entryIndex = activeEntryIndex !== null ? activeEntryIndex : (data.education?.length ? data.education.length - 1 : 0);
        } else if (currentQuestion.field.startsWith('experience_')) {
            historyEntry.entryIndex = activeEntryIndex !== null ? activeEntryIndex : (data.experience?.length ? data.experience.length - 1 : 0);
        } else if (currentQuestion.field.startsWith('languages_')) {
            historyEntry.entryIndex = activeEntryIndex !== null ? activeEntryIndex : (data.languages?.length ? data.languages.length - 1 : 0);
        }
        setQuestionHistory(prev => [...prev, historyEntry]);

        const field = currentQuestion.field;
        const updatedData: Partial<CVData> = {};

        // ═══ PERSONAL INFO ═══
        if (field === 'birthDate') {
            updatedData.personal = { ...data.personal, birthDate: response || '__skipped__' };
        }
        else if (field === 'targetJobTitle') {
            updatedData.personal = { ...data.personal, targetJobTitle: response };
        }
        else if (field === 'email') {
            updatedData.personal = { ...data.personal, email: response || '__skipped__' };
        }
        else if (field === 'photoUrl') {
            updatedData.personal = { ...data.personal, photoUrl: response || '__skipped__' };
        }

        // ═══ EDUCATION ═══
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
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].institution = translateAbbreviation(response, 'university');
            updatedData.education = list;
        }
        else if (field === 'education_degree') {
            const list = [...(data.education || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].degree = response;
            updatedData.education = list;
        }
        else if (field === 'education_major') {
            const list = [...(data.education || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].major = translateAbbreviation(response, 'major');
            updatedData.education = list;
        }
        else if (field === 'education_startYear') {
            const list = [...(data.education || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].startYear = response;
            updatedData.education = list;
        }
        else if (field === 'education_endYear') {
            const list = [...(data.education || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].endYear = response;
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

        // ═══ EXPERIENCE ═══
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
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].company = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_position') {
            const list = [...(data.experience || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].position = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_startDate') {
            const list = [...(data.experience || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].startDate = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_endDate') {
            const list = [...(data.experience || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].endDate = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_description') {
            const list = [...(data.experience || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].description = response;
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

        // ═══ SKILLS & HOBBIES ═══
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

        // ═══ LANGUAGES ═══
        else if (field === 'languages_has') {
            if (response === 'yes') {
                const list = [...(data.languages || [])];
                list.push({ name: '', level: '' });
                updatedData.languages = list;
            } else {
                updatedData._completedLanguages = true;
            }
        }
        else if (field === 'languages_name') {
            const list = [...(data.languages || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].name = response;
            updatedData.languages = list;
        }
        else if (field === 'languages_level') {
            const list = [...(data.languages || [])];
            const idx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > idx) list[idx].level = response;
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

        // Reset activeEntryIndex after processing
        setActiveEntryIndex(null);

        // Update global state
        onUpdate(updatedData);
        setResponse('');
    };

    // ═══════════════════════════════════════════════════════════════
    // HANDLE BACK (backward navigation) - REBUILT
    // ═══════════════════════════════════════════════════════════════
    const handleInternalBack = () => {
        // If history is empty, go back to previous step (Contact)
        if (questionHistory.length === 0) {
            onBack();
            return;
        }

        // Pop the last entry
        const newHistory = [...questionHistory];
        const lastEntry = newHistory.pop()!;
        setQuestionHistory(newHistory);

        if (!lastEntry) return;

        const lastField = lastEntry.field;
        const entryIndex = lastEntry.entryIndex;

        console.log('🔙 Backing up to field:', lastField, 'EntryIndex:', entryIndex);

        // Use the centralized navigation function
        setIsRewinding(true);

        // Restore activeEntryIndex
        if (entryIndex !== undefined) {
            setActiveEntryIndex(entryIndex);
        } else {
            setActiveEntryIndex(null);
        }

        // Get question using the agent's new method (supports ALL field types)
        const question = questionnaireAgent.getQuestionForFieldDirect(lastField, data, entryIndex);
        if (question) {
            setCurrentQuestion(question);
            setLoading(false);
        }

        // Pre-populate response with current value
        populateResponseForField(lastField, entryIndex);

        // Handle data cleanup for special cases (undo operations)
        const clearData: Partial<CVData> = {};

        if (lastField === 'education_has') {
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

        // Update data only if we have cleanup to do
        if (Object.keys(clearData).length > 0) {
            onUpdate(clearData);
        }
    };

    // ═══════════════════════════════════════════════════════════════
    // RENDER: Loading state
    // ═══════════════════════════════════════════════════════════════
    if (loading) return (
        <div className="text-center p-10">
            <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
            <p className="font-bold text-primary">جاري تحليل الإجابات وتوليد السؤال التالي...</p>
        </div>
    );

    // ═══════════════════════════════════════════════════════════════
    // RENDER: All questions done
    // ═══════════════════════════════════════════════════════════════
    if (!currentQuestion) return (
        <div className="text-center p-10 space-y-6">
            <div className="text-6xl mb-4">🎉</div>
            <h2 className="text-2xl font-black text-gray-900">تم الانتهاء من جميع الأسئلة بنجاح!</h2>
            <p className="text-gray-500">لقد جمعنا معلومات كافية لبناء سيرة ذاتية احترافية.</p>

            {/* Checkpoints - still visible for back navigation */}
            <div className="flex flex-wrap justify-center gap-2 my-6">
                {SECTIONS.map((section) => {
                    const status = getSectionStatus(section.id);
                    return (
                        <button
                            key={section.id}
                            onClick={() => navigateToSection(section.id)}
                            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all
                                ${status === 'completed' ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100 cursor-pointer' : ''}
                                ${status === 'active' ? 'bg-primary/10 text-primary border border-primary/30 cursor-pointer' : ''}
                                ${status === 'locked' ? 'bg-gray-50 text-gray-300 border border-gray-100 cursor-not-allowed' : ''}
                            `}
                            disabled={status === 'locked'}
                        >
                            <span>{section.icon}</span>
                            <span>{section.label}</span>
                            {status === 'completed' && <span className="text-green-500">✓</span>}
                        </button>
                    );
                })}
            </div>

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

    // ═══════════════════════════════════════════════════════════════
    // RENDER: Main questionnaire view
    // ═══════════════════════════════════════════════════════════════
    return (
        <div className="w-full max-w-xl mx-auto py-4">
            {/* ═══ Checkpoints Bar ═══ */}
            <div className="flex flex-wrap justify-center gap-1.5 mb-6">
                {SECTIONS.map((section) => {
                    const status = getSectionStatus(section.id);
                    const isCurrentSection = section.label === currentSection;
                    return (
                        <button
                            key={section.id}
                            onClick={() => navigateToSection(section.id)}
                            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all duration-300 border
                                ${status === 'completed' ? 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:shadow-sm cursor-pointer' : ''}
                                ${status === 'active' && isCurrentSection ? 'bg-primary/10 text-primary border-primary/40 ring-2 ring-primary/20 cursor-pointer' : ''}
                                ${status === 'active' && !isCurrentSection ? 'bg-primary/5 text-primary/70 border-primary/20 cursor-pointer' : ''}
                                ${status === 'locked' ? 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed opacity-60' : ''}
                            `}
                            disabled={status === 'locked'}
                            title={section.label}
                        >
                            <span className="text-sm">{section.icon}</span>
                            <span className="hidden sm:inline">{section.label}</span>
                            {status === 'completed' && <span className="text-green-500 text-[10px]">✓</span>}
                        </button>
                    );
                })}
            </div>

            {/* ═══ Progress Bar ═══ */}
            <div className="mb-8">
                <div className="flex justify-between text-sm font-bold text-gray-500 mb-2">
                    <span>{currentSection}</span>
                    <span>{percentage}%</span>
                </div>
                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-primary rounded-full transition-all duration-500 ease-out"
                        style={{ width: `${percentage}%` }}
                    />
                </div>
            </div>

            <div
                key={currentQuestion.id + '-' + (activeEntryIndex ?? 'null')}
                className="space-y-8 animate-in fade-in duration-300"
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
                            {emailUsername && (
                                <div className="text-center py-3 bg-primary/5 rounded-xl">
                                    <span className="text-sm text-gray-500" dir="rtl">البريد الإلكتروني: </span>
                                    <span className="font-bold text-primary" dir="ltr">{emailUsername}@{emailDomain}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {currentQuestion.type === 'select' && currentQuestion.options && (
                        <div className="grid grid-cols-2 gap-3">
                            {currentQuestion.options.map((option) => (
                                <button
                                    key={option}
                                    onClick={() => setResponse(option)}
                                    className={`p-4 rounded-2xl border-2 font-bold text-sm transition-all duration-300 ${response === option ? 'border-primary bg-primary/5 text-primary shadow-md' : 'border-gray-100 hover:border-primary/50 bg-white text-gray-600'}`}
                                >
                                    {option}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* ═══ Navigation Buttons ═══ */}
                <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                    <button
                        onClick={handleInternalBack}
                        className="flex items-center gap-2 text-gray-400 hover:text-gray-600 font-medium transition-colors"
                    >
                        <span>←</span>
                        <span>رجوع</span>
                    </button>

                    <div className="flex gap-3">
                        {currentQuestion.skippable && !response && (
                            <button
                                onClick={handleAnswer}
                                className="flex items-center gap-2 px-6 py-4 rounded-2xl font-bold text-gray-400 border-2 border-gray-100 hover:border-gray-300 hover:text-gray-600 transition-all"
                            >
                                <span>تخطي</span>
                            </button>
                        )}

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
            </div>
        </div>
    );
}
