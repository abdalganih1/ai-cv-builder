import { CVData, Question, ResponseDepth } from '../types/cv-schema';

class QuestionnaireAgent {
    // Analyze how detailed the user's response is
    analyzeResponse(response: string): ResponseDepth {
        const words = response.trim().split(/\s+/).length;
        if (words < 5) return 'brief';
        if (words < 15) return 'medium';
        return 'detailed';
    }

    // Helper: Check if last education entry is complete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private isEducationEntryComplete(edu: any): boolean {
        return !!(edu.institution && edu.degree && edu.major && edu.startYear && edu.endYear);
    }

    // Helper: Check if last experience entry is complete
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private isExperienceEntryComplete(exp: any): boolean {
        return !!(exp.company && exp.position && exp.startDate && exp.endDate && exp.description);
    }

    // Main question dispatcher - STATE MACHINE APPROACH
    async getNextQuestion(data: CVData): Promise<Question | null> {
        const { education, experience, hobbies, personal, skills } = data;

        // Helper to check if field was skipped
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const isSkipped = (val: any) => val === '__skipped__';

        // ═══════════════════════════════════════════════════════════════
        // PHASE 1: PERSONAL INFO
        // ═══════════════════════════════════════════════════════════════

        // Birth Date (SKIPPABLE)
        if (!personal.birthDate && !isSkipped(personal.birthDate)) {
            return {
                id: 'birthDate',
                field: 'birthDate',
                text: 'ما هو تاريخ ميلادك؟ (مثال: 1990/05/15)',
                type: 'text',
                skippable: true
            };
        }

        // Job Title (REQUIRED)
        if (!personal.targetJobTitle) {
            return {
                id: 'targetJobTitle',
                field: 'targetJobTitle',
                text: 'ما هو المسمى الوظيفي الذي ترغب أن يظهر في أعلى السيرة الذاتية؟ (مثال: مبرمج واجهات أمامية، مدير مشاريع)',
                type: 'text',
                skippable: false
            };
        }

        // Email (SKIPPABLE with auto-suggest)
        if (!personal.email && !isSkipped(personal.email)) {
            return {
                id: 'email',
                field: 'email',
                text: 'ما هو بريدك الإلكتروني؟',
                type: 'email',
                skippable: true,
                placeholder: `${personal.firstName?.toLowerCase() || 'your.name'}@gmail.com`
            };
        }

        // Photo (SKIPPABLE)
        if (!personal.photoUrl && !isSkipped(personal.photoUrl)) {
            return {
                id: 'photoUrl',
                field: 'photoUrl',
                text: 'هل تود إضافة صورة شخصية للسيرة الذاتية؟ يفضل صورة احترافية خلفية بيضاء.',
                type: 'file',
                skippable: true
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 2: EDUCATION SECTION
        // ═══════════════════════════════════════════════════════════════
        if (!data._completedEducation) {
            // 2a. Ask if they have education (only if no entries yet)
            if (!education || education.length === 0) {
                return {
                    id: 'hasEducation',
                    field: 'education_has',
                    text: 'هل لديك شهادات تعليمية (جامعة، معهد، دورات تدريبية)؟',
                    type: 'yesno'
                };
            }

            // 2b. If there's an incomplete entry, complete it field by field
            const lastEdu = education[education.length - 1];
            if (lastEdu) {
                if (!lastEdu.institution) {
                    return {
                        id: 'edu_institution',
                        field: 'education_institution',
                        text: 'ما هو اسم الجامعة أو المؤسسة التعليمية؟',
                        type: 'text'
                    };
                }
                if (!lastEdu.degree) {
                    return {
                        id: 'edu_degree',
                        field: 'education_degree',
                        text: `ما هي الدرجة العلمية التي حصلت عليها من ${lastEdu.institution}؟ (مثال: بكالوريوس، ماجستير، دبلوم)`,
                        type: 'text'
                    };
                }
                if (!lastEdu.major) {
                    return {
                        id: 'edu_major',
                        field: 'education_major',
                        text: `ما هو التخصص الذي درسته في ${lastEdu.institution}؟`,
                        type: 'text'
                    };
                }
                if (!lastEdu.startYear) {
                    return {
                        id: 'edu_startYear',
                        field: 'education_startYear',
                        text: `متى بدأت الدراسة في ${lastEdu.institution}؟ (مثال: 2015)`,
                        type: 'text'
                    };
                }
                if (!lastEdu.endYear) {
                    return {
                        id: 'edu_endYear',
                        field: 'education_endYear',
                        text: `متى تخرجت من ${lastEdu.institution} أو متى تتوقع التخرج؟ (مثال: 2019 أو "حالياً")`,
                        type: 'text'
                    };
                }
            }

            // 2c. Entry is complete, ask for more
            if (lastEdu && this.isEducationEntryComplete(lastEdu)) {
                return {
                    id: 'moreEducation',
                    field: 'education_more',
                    text: 'ممتاز! هل لديك شهادات أو دراسات أخرى تريد إضافتها؟',
                    type: 'yesno'
                };
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 3: WORK EXPERIENCE SECTION
        // ═══════════════════════════════════════════════════════════════
        if (!data._completedExperience) {
            // 3a. Ask if they have experience (only if no entries yet)
            if (!experience || experience.length === 0) {
                return {
                    id: 'hasExperience',
                    field: 'experience_has',
                    text: 'هل لديك خبرات عمل سابقة (وظائف، تدريب، عمل حر، تطوع)؟',
                    type: 'yesno'
                };
            }

            // 3b. Complete the last experience entry field by field
            const lastExp = experience[experience.length - 1];
            if (lastExp) {
                if (!lastExp.company) {
                    return {
                        id: 'exp_company',
                        field: 'experience_company',
                        text: 'ما هو اسم الشركة أو جهة العمل؟',
                        type: 'text'
                    };
                }
                if (!lastExp.position) {
                    return {
                        id: 'exp_position',
                        field: 'experience_position',
                        text: `ما هو المسمى الوظيفي أو الدور الذي شغلته في ${lastExp.company}؟`,
                        type: 'text'
                    };
                }
                if (!lastExp.startDate) {
                    return {
                        id: 'exp_startDate',
                        field: 'experience_startDate',
                        text: `متى بدأت العمل في ${lastExp.company}؟ (مثال: 2020/01)`,
                        type: 'text'
                    };
                }
                if (!lastExp.endDate) {
                    return {
                        id: 'exp_endDate',
                        field: 'experience_endDate',
                        text: `متى انتهت عملك في ${lastExp.company}؟ (أو اكتب "حتى الآن" إذا كنت لا تزال تعمل بها)`,
                        type: 'text'
                    };
                }
                if (!lastExp.description) {
                    return {
                        id: 'exp_description',
                        field: 'experience_description',
                        text: `صف مهامك ومسؤولياتك الرئيسية في ${lastExp.company} بجملتين أو أكثر:`,
                        type: 'textarea'
                    };
                }
            }

            // 3c. Entry is complete, ask for more
            if (lastExp && this.isExperienceEntryComplete(lastExp)) {
                return {
                    id: 'moreExperience',
                    field: 'experience_more',
                    text: 'رائع! هل لديك خبرات عمل أخرى تود إضافتها؟',
                    type: 'yesno'
                };
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 4: SKILLS
        // ═══════════════════════════════════════════════════════════════
        if (!skills || skills.length === 0) {
            return {
                id: 'skills',
                field: 'skills',
                text: 'ما هي أهم المهارات التي تتقنها؟ اكتبها مفصولة بفواصل (مثال: Word, Excel, إدارة المشاريع, اللغة الإنجليزية)',
                type: 'textarea'
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 5: LANGUAGES
        // ═══════════════════════════════════════════════════════════════
        const languages = data.languages;

        if (!data._completedLanguages) {
            // 5a. Ask if they have languages (only if no entries yet)
            if (!languages || languages.length === 0) {
                return {
                    id: 'hasLanguages',
                    field: 'languages_has',
                    text: 'هل تتقن لغات أخرى غير لغتك الأم؟',
                    type: 'yesno'
                };
            }

            // 5b. Complete the last language entry
            const lastLang = languages[languages.length - 1];
            if (lastLang) {
                if (!lastLang.name) {
                    return {
                        id: 'lang_name',
                        field: 'languages_name',
                        text: 'ما هي اللغة؟ (مثال: الإنجليزية، الفرنسية، الألمانية)',
                        type: 'text'
                    };
                }
                if (!lastLang.level) {
                    return {
                        id: 'lang_level',
                        field: 'languages_level',
                        text: `ما هو مستواك في اللغة ${lastLang.name}؟`,
                        type: 'select',
                        options: ['مبتدئ', 'متوسط', 'جيد', 'جيد جداً', 'ممتاز', 'لغة أم/طلاقة تامة']
                    };
                }
            }

            // 5c. Ask for more
            if (lastLang && lastLang.name && lastLang.level) {
                return {
                    id: 'moreLanguages',
                    field: 'languages_more',
                    text: 'هل تود إضافة لغة أخرى؟',
                    type: 'yesno'
                };
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 6: HOBBIES
        // ═══════════════════════════════════════════════════════════════
        if (!data._completedHobbies) {
            if (!hobbies || hobbies.length === 0) {
                return {
                    id: 'hasHobbies',
                    field: 'hobbies_has',
                    text: 'هل تود إضافة هوايات أو اهتمامات شخصية للسيرة الذاتية؟',
                    type: 'yesno'
                };
            }
            // If hobbies has pending marker, ask for actual hobbies
            if (hobbies.length === 1 && hobbies[0] === '__pending__') {
                return {
                    id: 'hobbiesText',
                    field: 'hobbies_text',
                    text: 'اكتب هواياتك واهتماماتك مفصولة بفواصل (مثال: القراءة، السباحة، البرمجة، الرياضة)',
                    type: 'textarea'
                };
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // ALL DONE!
        // ═══════════════════════════════════════════════════════════════
        return null;
    }

    // Suggest skills based on target job and country
    suggestSkills(targetJob: string, _country: string): string[] {
        const commonSkills = ['التواصل الفعال', 'العمل الجماعي', 'حل المشكلات', 'إدارة الوقت'];

        if (targetJob.includes('مطور') || targetJob.includes('Developer')) {
            return [...commonSkills, 'JavaScript', 'React', 'Git', 'Agile'];
        }
        if (targetJob.includes('محاسب') || targetJob.includes('Accountant')) {
            return [...commonSkills, 'Excel', 'إعداد التقارير المالية', 'التحليل المالي'];
        }

        return commonSkills;
    }

    async generateFollowUp(_context: CVData, _lastResponse: string): Promise<Question | null> {
        // Disabled AI follow-up for now to ensure deterministic flow
        return null;
    }
}

export const questionnaireAgent = new QuestionnaireAgent();
export default questionnaireAgent;
