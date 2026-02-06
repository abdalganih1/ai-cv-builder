export interface PersonalInfo {
  firstName: string;
  lastName: string;
  phone: string;
  country: string;
  email?: string;
  jobTitle?: string;
  summary?: string;
  birthDate?: string;
  photoUrl?: string;
  targetJobTitle?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree: string;
  major?: string;
  startYear: string;
  endYear: string;
  description?: string;
}

export interface WorkExperience {
  id: string;
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description: string;
}

export interface CVData {
  personal: PersonalInfo;
  education: Education[];
  experience: WorkExperience[];
  skills: string[];
  hobbies: string[];
  languages: string[];
  metadata: {
    currentStep: number;
    paymentStatus: 'pending' | 'completed';
    totalCost: number;
    primaryLanguage: string;
    paymentProofUrl?: string;
    importSource?: 'manual' | 'pdf' | 'text' | 'url';
    sourceUrl?: string;
    originalPdfName?: string;
  };
  // Internal flags for questionnaire state
  _completedEducation?: boolean;
  _completedExperience?: boolean;
  _completedHobbies?: boolean;
}

export type ResponseDepth = 'brief' | 'medium' | 'detailed';

export interface Question {
  id: string;
  field: string;
  text: string;
  type: 'text' | 'yesno' | 'select' | 'textarea' | 'file' | 'email';
  options?: string[];
  condition?: (data: CVData) => boolean;
  followUp?: boolean;
  skippable?: boolean; // Whether this question can be skipped
  placeholder?: string; // Placeholder text for input
}

// Missing fields detection for text analysis
export interface MissingFieldInfo {
  field: keyof PersonalInfo;
  label: string;
  labelAr: string;
  type: 'text' | 'email' | 'tel' | 'date' | 'file';
  required: boolean;
  placeholder?: string;
  placeholderAr?: string;
}

// Text analysis API response
export interface TextAnalysisResponse {
  cvData: Partial<CVData>;
  missingFields: MissingFieldInfo[];
  isComplete: boolean;
  message: string;
}
