"use client";

import { CVData, Question } from '@/lib/types/cv-schema';
import { useState, useEffect, useCallback, useRef } from 'react';
import questionnaireAgent from '@/lib/ai/questionnaire-agent';
import NextImage from 'next/image';
import VoiceRecorder from '@/components/ui/VoiceRecorder';
import AISuggestButton from '@/components/ui/AISuggestButton';
import { translateAbbreviation } from '@/lib/utils/syrian-universities';
import { getYearSuggestions } from '@/lib/utils/year-suggestions';

// ═══════════════════════════════════════════════════════════════
// AI SUGGEST FIELD MAPPING
// ═══════════════════════════════════════════════════════════════
const AI_SUGGEST_FIELDS: Record<string, string> = {
    'education_institution': 'university',
    'education_degree': 'degree',
    'education_major': 'major',
    'experience_company': 'company',
    'experience_position': 'position',
    'experience_description': 'description',
    'targetJobTitle': 'jobTitle',
    'skills_text': 'skills',
    'languages_name': 'language',
};

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

// Sequence item — represents one step in the questionnaire
interface SequenceItem {
    field: string;
    entryIndex?: number;
}

export default function QuestionnaireStep({ data, onNext, onUpdate, onBack }: StepProps) {
    const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
    const [response, setResponse] = useState<string>('');
    const [loading, setLoading] = useState(true);

    // Email-specific state
    const [emailUsername, setEmailUsername] = useState<string>('');
    const [emailDomain, setEmailDomain] = useState<string>('gmail.com');

    // ═══════════════════════════════════════════════════════════════
    // CURSOR-BASED NAVIGATION — the new core
    // ═══════════════════════════════════════════════════════════════
    const [sequence, setSequence] = useState<SequenceItem[]>([]);
    const [cursorIndex, setCursorIndex] = useState<number>(0);
    const [initialized, setInitialized] = useState(false);

    // Active entry index for array fields (derived from sequence)
    const activeEntryIndex = sequence[cursorIndex]?.entryIndex ?? null;

    // Ref to latest data to avoid stale closures
    const dataRef = useRef(data);
    dataRef.current = data;

    // ═══════════════════════════════════════════════════════════════
    // BUILD SEQUENCE — deterministic question order from data
    // ═══════════════════════════════════════════════════════════════
    const buildSequence = useCallback((d: CVData): SequenceItem[] => {
        const seq: SequenceItem[] = [];

        // === PERSONAL INFO (always present) ===
        seq.push({ field: 'birthDate' });
        seq.push({ field: 'targetJobTitle' });
        seq.push({ field: 'email' });
        seq.push({ field: 'photoUrl' });

        // === EDUCATION ===
        seq.push({ field: 'education_has' });
        if (d.education && d.education.length > 0) {
            d.education.forEach((edu, i) => {
                seq.push({ field: 'education_institution', entryIndex: i });
                seq.push({ field: 'education_degree', entryIndex: i });
                seq.push({ field: 'education_major', entryIndex: i });
                seq.push({ field: 'education_startYear', entryIndex: i });
                seq.push({ field: 'education_endYear', entryIndex: i });
            });
            // Add education_more if last entry is complete OR section is completed
            const lastEdu = d.education[d.education.length - 1];
            const lastComplete = !!(lastEdu?.institution && lastEdu?.degree && lastEdu?.major && lastEdu?.startYear && lastEdu?.endYear);
            if (d._completedEducation || lastComplete) {
                seq.push({ field: 'education_more' });
            }
        }

        // === EXPERIENCE ===
        seq.push({ field: 'experience_has' });
        if (d.experience && d.experience.length > 0) {
            d.experience.forEach((exp, i) => {
                seq.push({ field: 'experience_company', entryIndex: i });
                seq.push({ field: 'experience_position', entryIndex: i });
                seq.push({ field: 'experience_startDate', entryIndex: i });
                seq.push({ field: 'experience_endDate', entryIndex: i });
                seq.push({ field: 'experience_description', entryIndex: i });
            });
            const lastExp = d.experience[d.experience.length - 1];
            const lastComplete = !!(lastExp?.company && lastExp?.position && lastExp?.startDate && lastExp?.endDate && lastExp?.description);
            if (d._completedExperience || lastComplete) {
                seq.push({ field: 'experience_more' });
            }
        }

        // === SKILLS (always present) ===
        seq.push({ field: 'skills' });

        // === LANGUAGES ===
        seq.push({ field: 'languages_has' });
        if (d.languages && d.languages.length > 0) {
            d.languages.forEach((lang, i) => {
                seq.push({ field: 'languages_name', entryIndex: i });
                seq.push({ field: 'languages_level', entryIndex: i });
            });
            const lastLang = d.languages[d.languages.length - 1];
            const lastComplete = !!(lastLang?.name && lastLang?.level);
            if (d._completedLanguages || lastComplete) {
                seq.push({ field: 'languages_more' });
            }
        }

        // === HOBBIES ===
        seq.push({ field: 'hobbies_has' });
        if (d.hobbies && d.hobbies.length > 0) {
            seq.push({ field: 'hobbies_text' });
        }

        return seq;
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // CHECK IF FIELD HAS STORED VALUE
    // ═══════════════════════════════════════════════════════════════
    const hasStoredValue = useCallback((item: SequenceItem, d: CVData): boolean => {
        const { field, entryIndex } = item;
        if (field === 'birthDate') return !!(d.personal.birthDate);
        if (field === 'targetJobTitle') return !!(d.personal.targetJobTitle);
        if (field === 'email') return !!(d.personal.email);
        if (field === 'photoUrl') return !!(d.personal.photoUrl);
        if (field === 'education_has') return d.education.length > 0 || !!d._completedEducation;
        if (field === 'education_institution') return !!(d.education?.[entryIndex!]?.institution);
        if (field === 'education_degree') return !!(d.education?.[entryIndex!]?.degree);
        if (field === 'education_major') return !!(d.education?.[entryIndex!]?.major);
        if (field === 'education_startYear') return !!(d.education?.[entryIndex!]?.startYear);
        if (field === 'education_endYear') return !!(d.education?.[entryIndex!]?.endYear);
        if (field === 'education_more') return !!d._completedEducation;
        if (field === 'experience_has') return d.experience.length > 0 || !!d._completedExperience;
        if (field === 'experience_company') return !!(d.experience?.[entryIndex!]?.company);
        if (field === 'experience_position') return !!(d.experience?.[entryIndex!]?.position);
        if (field === 'experience_startDate') return !!(d.experience?.[entryIndex!]?.startDate);
        if (field === 'experience_endDate') return !!(d.experience?.[entryIndex!]?.endDate);
        if (field === 'experience_description') return !!(d.experience?.[entryIndex!]?.description);
        if (field === 'experience_more') return !!d._completedExperience;
        if (field === 'skills') return !!(d.skills && d.skills.length > 0);
        if (field === 'languages_has') return d.languages.length > 0 || !!d._completedLanguages;
        if (field === 'languages_name') return !!(d.languages?.[entryIndex!]?.name);
        if (field === 'languages_level') return !!(d.languages?.[entryIndex!]?.level);
        if (field === 'languages_more') return !!d._completedLanguages;
        if (field === 'hobbies_has') return (d.hobbies && d.hobbies.length > 0) || !!d._completedHobbies;
        if (field === 'hobbies_text') return !!(d.hobbies && d.hobbies.length > 0 && d.hobbies[0] !== '__pending__');
        return false;
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // POPULATE RESPONSE — fill input with stored value
    // ═══════════════════════════════════════════════════════════════
    const populateResponse = useCallback((field: string, entryIndex: number | undefined, d: CVData) => {
        // Personal fields
        if (field === 'birthDate') {
            const v = d.personal.birthDate;
            setResponse(v && v !== '__skipped__' ? v : '');
        } else if (field === 'targetJobTitle') {
            setResponse(d.personal.targetJobTitle || '');
        } else if (field === 'email') {
            const currentEmail = d.personal.email;
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
            const v = d.personal.photoUrl;
            setResponse(v && v !== '__skipped__' ? v : '');
        }
        // Education array fields
        else if (field.startsWith('education_') && entryIndex !== undefined) {
            const edu = d.education?.[entryIndex];
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
            const exp = d.experience?.[entryIndex];
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
            const lang = d.languages?.[entryIndex];
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
            setResponse(d.skills?.join('، ') || '');
        }
        // Hobbies
        else if (field === 'hobbies_text') {
            const h = d.hobbies?.filter(h => h !== '__pending__');
            setResponse(h?.join('، ') || '');
        }
        // yes/no fields — check stored answer
        else if (field === 'education_has') {
            if (d.education.length > 0) setResponse('yes');
            else if (d._completedEducation) setResponse('no');
            else setResponse('');
        } else if (field === 'education_more') {
            if (d._completedEducation) setResponse('no');
            else setResponse('');
        } else if (field === 'experience_has') {
            if (d.experience.length > 0) setResponse('yes');
            else if (d._completedExperience) setResponse('no');
            else setResponse('');
        } else if (field === 'experience_more') {
            if (d._completedExperience) setResponse('no');
            else setResponse('');
        } else if (field === 'languages_has') {
            if (d.languages.length > 0) setResponse('yes');
            else if (d._completedLanguages) setResponse('no');
            else setResponse('');
        } else if (field === 'languages_more') {
            if (d._completedLanguages) setResponse('no');
            else setResponse('');
        } else if (field === 'hobbies_has') {
            if (d.hobbies && d.hobbies.length > 0) setResponse('yes');
            else if (d._completedHobbies) setResponse('no');
            else setResponse('');
        }
        else {
            setResponse('');
        }
    }, []);

    // ═══════════════════════════════════════════════════════════════
    // SHOW QUESTION AT CURSOR — display question + populate response
    // ═══════════════════════════════════════════════════════════════
    const showQuestionAtCursor = useCallback((seq: SequenceItem[], index: number, d: CVData) => {
        if (index >= seq.length) {
            // All done
            setCurrentQuestion(null);
            setLoading(false);
            return;
        }

        const item = seq[index];
        const question = questionnaireAgent.getQuestionForFieldDirect(item.field, d, item.entryIndex);
        if (question) {
            setCurrentQuestion(question);
            populateResponse(item.field, item.entryIndex, d);
        } else {
            setCurrentQuestion(null);
        }
        setLoading(false);
    }, [populateResponse]);

    // ═══════════════════════════════════════════════════════════════
    // INITIALIZATION — build sequence and find starting cursor
    // ═══════════════════════════════════════════════════════════════
    useEffect(() => {
        if (!initialized) {
            const seq = buildSequence(data);
            setSequence(seq);

            // Find first unanswered question
            let startCursor = seq.length; // default: all done
            for (let i = 0; i < seq.length; i++) {
                if (!hasStoredValue(seq[i], data)) {
                    startCursor = i;
                    break;
                }
            }

            setCursorIndex(startCursor);
            showQuestionAtCursor(seq, startCursor, data);
            setInitialized(true);
            console.log('📜 Sequence built:', seq.length, 'items, starting at cursor:', startCursor);
        }
    }, [initialized, data, buildSequence, hasStoredValue, showQuestionAtCursor]);

    // ═══════════════════════════════════════════════════════════════
    // SECTION STATUS — determine which sections are complete/active
    // ═══════════════════════════════════════════════════════════════
    const getSectionStatus = useCallback((sectionId: string): 'completed' | 'active' | 'locked' => {
        const isSkippedField = (val: string | undefined | null): boolean => val === '__skipped__';

        if (sectionId === 'personal') {
            const p = data.personal;
            const allDone = (!!p.birthDate || isSkippedField(p.birthDate)) &&
                !!p.targetJobTitle &&
                (!!p.email || isSkippedField(p.email)) &&
                (!!p.photoUrl || isSkippedField(p.photoUrl));
            if (allDone) return 'completed';
            if (p.birthDate || p.targetJobTitle) return 'active';
            return 'active'; // First section always accessible
        }

        if (sectionId === 'education') {
            if (data._completedEducation) return 'completed';
            if (data.education.length > 0) return 'active';
            // Check personal is done
            const p = data.personal;
            const personalDone = (!!p.birthDate || isSkippedField(p.birthDate)) &&
                !!p.targetJobTitle &&
                (!!p.email || isSkippedField(p.email)) &&
                (!!p.photoUrl || isSkippedField(p.photoUrl));
            return personalDone ? 'active' : 'locked';
        }

        if (sectionId === 'experience') {
            if (data._completedExperience) return 'completed';
            if (data.experience.length > 0) return 'active';
            return data._completedEducation || data.education.length > 0 ? 'active' : 'locked';
        }

        if (sectionId === 'skills') {
            if (data.skills && data.skills.length > 0) return 'completed';
            return data._completedExperience || data.experience.length > 0 ? 'active' : 'locked';
        }

        if (sectionId === 'languages') {
            if (data._completedLanguages) return 'completed';
            if (data.languages.length > 0) return 'active';
            return data.skills && data.skills.length > 0 ? 'active' : 'locked';
        }

        if (sectionId === 'hobbies') {
            if (data._completedHobbies) return 'completed';
            if (data.hobbies && data.hobbies.length > 0) return 'active';
            return data._completedLanguages || data.languages.length > 0 ? 'active' : 'locked';
        }

        return 'locked';
    }, [data]);

    // ═══════════════════════════════════════════════════════════════
    // PROGRESS CALCULATION
    // ═══════════════════════════════════════════════════════════════
    const calculateProgress = (): { percentage: number; currentSection: string } => {
        if (sequence.length === 0) return { percentage: 0, currentSection: 'المعلومات الشخصية' };

        // Percentage based on cursor position
        const percentage = Math.min(100, Math.round((cursorIndex / sequence.length) * 100));

        // Current section label from current field
        const currentItem = sequence[cursorIndex];
        let currentSection = 'المعلومات الشخصية';
        if (currentItem) {
            for (const section of SECTIONS) {
                if (section.fields.some(f => currentItem.field.startsWith(f.replace(/_.*/, '')) || currentItem.field === f)) {
                    // More precise matching
                    const fieldBase = currentItem.field.split('_')[0] || currentItem.field;
                    if (section.fields.some(f => f === currentItem.field || f.startsWith(fieldBase + '_') || f === fieldBase)) {
                        currentSection = section.label;
                        break;
                    }
                }
            }
        }

        return { percentage, currentSection };
    };

    const { percentage, currentSection } = calculateProgress();

    // ═══════════════════════════════════════════════════════════════
    // SECTION NAVIGATION (Checkpoint click)
    // ═══════════════════════════════════════════════════════════════
    const navigateToSection = useCallback((sectionId: string) => {
        const status = getSectionStatus(sectionId);
        if (status === 'locked') return;

        const section = SECTIONS.find(s => s.id === sectionId);
        if (!section) return;

        // Find the first item in the sequence that belongs to this section
        const sectionFieldPrefixes = section.fields.map(f => f);
        const targetIndex = sequence.findIndex(item =>
            sectionFieldPrefixes.includes(item.field) ||
            sectionFieldPrefixes.some(f => item.field.startsWith(f.split('_')[0] + '_') && section.fields.includes(item.field))
        );

        if (targetIndex >= 0) {
            setCursorIndex(targetIndex);
            showQuestionAtCursor(sequence, targetIndex, data);
        }
    }, [sequence, data, getSectionStatus, showQuestionAtCursor]);

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
    // HELPER: Check if a field's value has actually changed
    // ═══════════════════════════════════════════════════════════════
    const getStoredValue = (field: string, entryIdx: number | null): string => {
        const d = data;
        if (field === 'birthDate') return (d.personal.birthDate && d.personal.birthDate !== '__skipped__') ? d.personal.birthDate : '';
        if (field === 'targetJobTitle') return d.personal.targetJobTitle || '';
        if (field === 'email') return (d.personal.email && d.personal.email !== '__skipped__') ? d.personal.email : '';
        if (field === 'photoUrl') return (d.personal.photoUrl && d.personal.photoUrl !== '__skipped__') ? d.personal.photoUrl : '';
        if (field === 'education_has') return d.education.length > 0 ? 'yes' : (d._completedEducation ? 'no' : '');
        if (field === 'education_more') return d._completedEducation ? 'no' : '';
        if (field === 'experience_has') return d.experience.length > 0 ? 'yes' : (d._completedExperience ? 'no' : '');
        if (field === 'experience_more') return d._completedExperience ? 'no' : '';
        if (field === 'languages_has') return d.languages.length > 0 ? 'yes' : (d._completedLanguages ? 'no' : '');
        if (field === 'languages_more') return d._completedLanguages ? 'no' : '';
        if (field === 'hobbies_has') return (d.hobbies && d.hobbies.length > 0) ? 'yes' : (d._completedHobbies ? 'no' : '');
        if (field === 'skills') return d.skills?.join('، ') || '';
        if (field === 'hobbies_text') return d.hobbies?.filter(h => h !== '__pending__').join('، ') || '';
        const i = entryIdx ?? 0;
        if (field === 'education_institution') return d.education?.[i]?.institution || '';
        if (field === 'education_degree') return d.education?.[i]?.degree || '';
        if (field === 'education_major') return d.education?.[i]?.major || '';
        if (field === 'education_startYear') return d.education?.[i]?.startYear || '';
        if (field === 'education_endYear') return d.education?.[i]?.endYear || '';
        if (field === 'experience_company') return d.experience?.[i]?.company || '';
        if (field === 'experience_position') return d.experience?.[i]?.position || '';
        if (field === 'experience_startDate') return d.experience?.[i]?.startDate || '';
        if (field === 'experience_endDate') return d.experience?.[i]?.endDate || '';
        if (field === 'experience_description') return d.experience?.[i]?.description || '';
        if (field === 'languages_name') return d.languages?.[i]?.name || '';
        if (field === 'languages_level') return d.languages?.[i]?.level || '';
        return '';
    };

    // ═══════════════════════════════════════════════════════════════
    // HANDLE ANSWER (forward navigation) — cursor++
    // ═══════════════════════════════════════════════════════════════
    const handleAnswer = async () => {
        if (!currentQuestion) return;

        const field = currentQuestion.field;
        const idx = activeEntryIndex !== null ? activeEntryIndex : 0;

        // ═══ FAST PATH: If value hasn't changed, just advance cursor ═══
        const storedValue = getStoredValue(field, activeEntryIndex);
        if (response === storedValue && storedValue !== '') {
            // Value is the same — just advance cursor without modifying data
            console.log('⏩ Fast path (no change):', field, '→ cursor++');
            const nextCursor = cursorIndex + 1;
            if (nextCursor >= sequence.length) {
                setCursorIndex(nextCursor);
                setCurrentQuestion(null);
                setLoading(false);
            } else {
                setCursorIndex(nextCursor);
                showQuestionAtCursor(sequence, nextCursor, data);
            }
            return;
        }

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
                // Only add new entry if there are none
                if (!data.education || data.education.length === 0) {
                    const list = [...(data.education || [])];
                    list.push({ id: Date.now().toString(), institution: '', degree: '', major: '', startYear: '', endYear: '' });
                    updatedData.education = list;
                    updatedData._completedEducation = undefined;
                }
                // If education already has entries, DON'T touch _completedEducation
            } else {
                updatedData._completedEducation = true;
                updatedData.education = [];
            }
        }
        else if (field === 'education_institution') {
            const list = [...(data.education || [])];
            const eduIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > eduIdx && response) list[eduIdx].institution = translateAbbreviation(response, 'university');
            updatedData.education = list;
        }
        else if (field === 'education_degree') {
            const list = [...(data.education || [])];
            const eduIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > eduIdx && response) list[eduIdx].degree = response;
            updatedData.education = list;
        }
        else if (field === 'education_major') {
            const list = [...(data.education || [])];
            const eduIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > eduIdx && response) list[eduIdx].major = translateAbbreviation(response, 'major');
            updatedData.education = list;
        }
        else if (field === 'education_startYear') {
            const list = [...(data.education || [])];
            const eduIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > eduIdx && response) list[eduIdx].startYear = response;
            updatedData.education = list;
        }
        else if (field === 'education_endYear') {
            const list = [...(data.education || [])];
            const eduIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > eduIdx && response) list[eduIdx].endYear = response;
            updatedData.education = list;
        }
        else if (field === 'education_more') {
            if (response === 'yes') {
                const list = [...(data.education || [])];
                list.push({ id: Date.now().toString(), institution: '', degree: '', major: '', startYear: '', endYear: '' });
                updatedData.education = list;
                updatedData._completedEducation = undefined;
            } else {
                updatedData._completedEducation = true;
            }
        }

        // ═══ EXPERIENCE ═══
        else if (field === 'experience_has') {
            if (response === 'yes') {
                if (!data.experience || data.experience.length === 0) {
                    const list = [...(data.experience || [])];
                    list.push({ id: Date.now().toString(), company: '', position: '', startDate: '', endDate: '', description: '' });
                    updatedData.experience = list;
                    updatedData._completedExperience = undefined;
                }
                // If experience already has entries, DON'T touch _completedExperience
            } else {
                updatedData._completedExperience = true;
                updatedData.experience = [];
            }
        }
        else if (field === 'experience_company') {
            const list = [...(data.experience || [])];
            const expIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > expIdx && response) list[expIdx].company = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_position') {
            const list = [...(data.experience || [])];
            const expIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > expIdx && response) list[expIdx].position = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_startDate') {
            const list = [...(data.experience || [])];
            const expIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > expIdx && response) list[expIdx].startDate = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_endDate') {
            const list = [...(data.experience || [])];
            const expIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > expIdx && response) list[expIdx].endDate = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_description') {
            const list = [...(data.experience || [])];
            const expIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > expIdx && response) list[expIdx].description = response;
            updatedData.experience = list;
        }
        else if (field === 'experience_more') {
            if (response === 'yes') {
                const list = [...(data.experience || [])];
                list.push({ id: Date.now().toString(), company: '', position: '', startDate: '', endDate: '', description: '' });
                updatedData.experience = list;
                updatedData._completedExperience = undefined;
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
                if (!data.languages || data.languages.length === 0) {
                    const list = [...(data.languages || [])];
                    list.push({ name: '', level: '' });
                    updatedData.languages = list;
                    updatedData._completedLanguages = undefined;
                }
                // If languages already has entries, DON'T touch _completedLanguages
            } else {
                updatedData._completedLanguages = true;
                updatedData.languages = [];
            }
        }
        else if (field === 'languages_name') {
            const list = [...(data.languages || [])];
            const langIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > langIdx && response) list[langIdx].name = response;
            updatedData.languages = list;
        }
        else if (field === 'languages_level') {
            const list = [...(data.languages || [])];
            const langIdx = activeEntryIndex !== null ? activeEntryIndex : list.length - 1;
            if (list.length > langIdx && response) list[langIdx].level = response;
            updatedData.languages = list;
        }
        else if (field === 'languages_more') {
            if (response === 'yes') {
                const list = [...(data.languages || [])];
                list.push({ name: '', level: '' });
                updatedData.languages = list;
                updatedData._completedLanguages = undefined;
            } else {
                updatedData._completedLanguages = true;
            }
        }

        // Update global state
        onUpdate(updatedData);

        // Merge updated data with current data to rebuild sequence
        const mergedData = { ...data, ...updatedData } as CVData;
        if (updatedData.personal) {
            mergedData.personal = { ...data.personal, ...updatedData.personal };
        }

        // Rebuild sequence from updated data
        const newSeq = buildSequence(mergedData);
        setSequence(newSeq);

        // Find current field in new sequence and advance cursor
        const currentItem = sequence[cursorIndex];
        let newIndex = newSeq.findIndex(item =>
            item.field === currentItem.field && item.entryIndex === currentItem.entryIndex
        );

        // If field not found (shouldn't happen), try to move forward
        if (newIndex < 0) newIndex = Math.min(cursorIndex, newSeq.length - 1);

        const nextCursor = newIndex + 1;

        // If "no" to a _has field, skip to next section's start
        if ((field === 'education_has' || field === 'experience_has' || field === 'languages_has' || field === 'hobbies_has') && response === 'no') {
            // Find next non-skipped section item in new sequence
            const nextSectionIndex = newSeq.findIndex((item, i) => {
                if (i <= newIndex) return false;
                // Find items that don't belong to the current section
                return !item.field.startsWith(field.replace('_has', '_'));
            });
            if (nextSectionIndex >= 0) {
                setCursorIndex(nextSectionIndex);
                showQuestionAtCursor(newSeq, nextSectionIndex, mergedData);
                setResponse('');
                return;
            }
        }

        // If "no" to a _more field, skip to next section
        if ((field === 'education_more' || field === 'experience_more' || field === 'languages_more') && response === 'no') {
            const sectionPrefix = field.replace('_more', '_');
            const nextSectionIndex = newSeq.findIndex((item, i) => {
                if (i <= newIndex) return false;
                return !item.field.startsWith(sectionPrefix);
            });
            if (nextSectionIndex >= 0) {
                setCursorIndex(nextSectionIndex);
                showQuestionAtCursor(newSeq, nextSectionIndex, mergedData);
                setResponse('');
                return;
            }
        }

        if (nextCursor >= newSeq.length) {
            // All questions answered!
            setCursorIndex(nextCursor);
            setCurrentQuestion(null);
            setLoading(false);
        } else {
            setCursorIndex(nextCursor);
            showQuestionAtCursor(newSeq, nextCursor, mergedData);
        }

        setResponse('');
    };

    // ═══════════════════════════════════════════════════════════════
    // HANDLE BACK — cursor--
    // ═══════════════════════════════════════════════════════════════
    const handleInternalBack = () => {
        if (cursorIndex <= 0) {
            onBack();
            return;
        }

        const newCursor = cursorIndex - 1;
        setCursorIndex(newCursor);
        showQuestionAtCursor(sequence, newCursor, data);
        console.log('🔙 Back to cursor:', newCursor, 'field:', sequence[newCursor]?.field);
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
                    // Entry count badge for array sections
                    let entryBadge = '';
                    if (section.id === 'education' && data.education.length > 0) {
                        entryBadge = `(${data.education.length})`;
                    } else if (section.id === 'experience' && data.experience.length > 0) {
                        entryBadge = `(${data.experience.length})`;
                    } else if (section.id === 'languages' && data.languages.length > 0) {
                        entryBadge = `(${data.languages.length})`;
                    }
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
                            {entryBadge && <span className="text-[9px] opacity-70">{entryBadge}</span>}
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
                key={currentQuestion.id + '-' + (activeEntryIndex ?? 'null') + '-' + cursorIndex}
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
                        <div>
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
                            {/* AI Suggestions */}
                            {AI_SUGGEST_FIELDS[currentQuestion.field] && (
                                <AISuggestButton
                                    fieldType={AI_SUGGEST_FIELDS[currentQuestion.field]}
                                    context={
                                        currentQuestion.field === 'education_major' ? (data.education[data.education.length - 1]?.institution || '') :
                                            currentQuestion.field === 'experience_position' ? (data.experience[data.experience.length - 1]?.company || '') :
                                                currentQuestion.field === 'skills_text' ? (data.personal.targetJobTitle || '') :
                                                    ''
                                    }
                                    currentValue={response}
                                    onSelect={(value) => setResponse(value)}
                                />
                            )}
                        </div>
                    )}

                    {currentQuestion.type === 'textarea' && (
                        <div>
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
                            {/* AI Suggestions */}
                            {AI_SUGGEST_FIELDS[currentQuestion.field] && (
                                <AISuggestButton
                                    fieldType={AI_SUGGEST_FIELDS[currentQuestion.field]}
                                    context={
                                        currentQuestion.field === 'experience_description' ?
                                            `${data.experience[data.experience.length - 1]?.company || ''} - ${data.experience[data.experience.length - 1]?.position || ''}` :
                                            ''
                                    }
                                    currentValue={response}
                                    onSelect={(value) => setResponse(value)}
                                />
                            )}
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
                            <div className="flex items-center gap-2">
                                <input
                                    type="email"
                                    value={emailUsername}
                                    onChange={(e) => {
                                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9._-]/g, '');
                                        setEmailUsername(val);
                                        setResponse(val ? `${val}@${emailDomain}` : '');
                                    }}
                                    className="flex-1 p-4 text-lg border-2 border-gray-200 rounded-xl outline-none focus:border-primary bg-white text-gray-800 placeholder:text-gray-400"
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
                                <span className="text-2xl font-bold text-primary">@</span>
                                <select
                                    value={emailDomain}
                                    onChange={(e) => {
                                        setEmailDomain(e.target.value);
                                        setResponse(emailUsername ? `${emailUsername}@${e.target.value}` : '');
                                    }}
                                    className="p-4 text-lg border-2 border-gray-200 rounded-xl outline-none focus:border-primary bg-white text-gray-700 font-medium min-w-[150px]"
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

                    {currentQuestion.type === 'year' && (() => {
                        const eduIdx = activeEntryIndex !== null ? activeEntryIndex : data.education.length - 1;
                        const edu = data.education[eduIdx] || data.education[data.education.length - 1];
                        const yearSuggestions = getYearSuggestions(
                            currentQuestion.yearType || 'start',
                            data.personal.birthDate,
                            edu?.institution,
                            edu?.major,
                            edu?.startYear
                        );
                        return (
                            <div className="space-y-3">
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={response}
                                        onChange={(e) => setResponse(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                                e.preventDefault();
                                                handleAnswer();
                                            }
                                        }}
                                        className="w-full p-5 text-lg border-2 border-gray-100 rounded-2xl focus:border-primary focus:ring-0 outline-none transition-all bg-gray-50/50 focus:bg-white text-gray-800 placeholder:text-gray-300"
                                        placeholder={currentQuestion.yearType === 'start' ? 'مثال: 2018' : 'مثال: 2023'}
                                        autoFocus
                                        enterKeyHint="next"
                                        min="1950"
                                        max={new Date().getFullYear() + 5}
                                    />
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <span className="text-xs text-gray-500 font-medium">اقتراحات:</span>
                                    {yearSuggestions.map((s, i) => (
                                        <button
                                            key={i}
                                            type="button"
                                            onClick={() => setResponse(s.year.toString())}
                                            className={`px-3 py-1.5 text-sm rounded-full border transition-all ${
                                                response === s.year.toString()
                                                    ? 'bg-primary/10 border-primary text-primary font-bold'
                                                    : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-primary/50'
                                            }`}
                                        >
                                            {s.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })()}

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
