"use client";

import { useState, useEffect } from 'react';
import ProgressBar from '@/components/wizard/ProgressBar';
import WelcomeStep from '@/components/wizard/WelcomeStep';
import ContactStep from '@/components/wizard/ContactStep';
import QuestionnaireStep from '@/components/wizard/QuestionnaireStep';
import ShamCashPayment from '@/components/payment/ShamCashPayment';
import CVPreview from '@/components/preview/CVPreview';
import { CVData } from '@/lib/types/cv-schema';

const STORAGE_KEY = 'cv_builder_data';

const getInitialData = (): CVData => ({
  personal: { firstName: '', lastName: '', phone: '', country: '' },
  education: [],
  experience: [],
  skills: [],
  hobbies: [],
  languages: [],
  metadata: {
    currentStep: 0,
    paymentStatus: 'pending',
    totalCost: 500,
    primaryLanguage: 'ar'
  }
});

const steps = [
  { component: WelcomeStep, title: 'Welcome' },
  { component: ContactStep, title: 'Contact' },
  { component: QuestionnaireStep, title: 'Questionnaire' },
  { component: ShamCashPayment, title: 'Payment' },
  { component: CVPreview, title: 'Preview' },
];

export default function Home() {
  const [data, setData] = useState<CVData>(getInitialData());
  const [isLoaded, setIsLoaded] = useState(false);

  // Load data from localStorage on mount
  useEffect(() => {
    try {
      const savedData = localStorage.getItem(STORAGE_KEY);
      if (savedData) {
        const parsed = JSON.parse(savedData);
        // eslint-disable-next-line
        setData(parsed);
        console.log('✅ Restored CV data from localStorage', parsed);
      }
    } catch (error) {
      console.error('Failed to load saved data:', error);
    }
    setIsLoaded(true);
  }, []);

  // Save data to localStorage whenever it changes
  useEffect(() => {
    if (isLoaded) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        console.log('💾 Saved CV data to localStorage - Step:', data.metadata.currentStep);
      } catch (error) {
        console.error('Failed to save data:', error);
      }
    }
  }, [data, isLoaded]);

  // Clear saved data
  const clearSavedData = () => {
    localStorage.removeItem(STORAGE_KEY);
    setData(getInitialData());
    window.location.reload();
  };

  const nextStep = (newData: Partial<CVData>) => {
    console.log('🔄 nextStep called with:', newData);
    console.log('📍 Current step BEFORE update:', data.metadata.currentStep);

    setData(prev => {
      const newStep = Math.min(prev.metadata.currentStep + 1, steps.length - 1);
      console.log('📍 New step WILL BE:', newStep);

      const updatedData = {
        ...prev,
        ...newData,
        metadata: { ...prev.metadata, currentStep: newStep }
      };

      console.log('📦 Updated data:', updatedData);
      return updatedData;
    });
  };

  const updateData = (newData: Partial<CVData>) => {
    setData(prev => ({
      ...prev,
      ...newData
    }));
  };

  const prevStep = () => {
    setData(prev => ({
      ...prev,
      metadata: { ...prev.metadata, currentStep: Math.max(0, prev.metadata.currentStep - 1) }
    }));
  };

  // Show loading state while checking localStorage
  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-white flex items-center justify-center" dir="rtl">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-4" />
          <p className="text-gray-500 font-medium">جاري تحميل بياناتك المحفوظة...</p>
        </div>
      </main>
    );
  }

  // Ensure step is valid and within bounds
  const currentStepIndex = Math.min(Math.max(0, data.metadata.currentStep || 0), steps.length - 1);
  const CurrentStepComponent = steps[currentStepIndex]?.component || WelcomeStep;
  const isLastStep = currentStepIndex === steps.length - 1;

  console.log('🎨 Rendering - Current Step Index:', currentStepIndex);
  console.log('🎨 Full data state:', data);

  return (
    <main className="min-h-screen bg-gray-50 text-foreground flex flex-col items-center p-4 md:p-8" dir="rtl">
      <div className={`w-full ${isLastStep ? 'max-w-6xl' : 'max-w-2xl'} transition-all duration-500 bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100`}>
        <ProgressBar current={currentStepIndex} total={steps.length} />

        <div className="p-8 h-full">
          <div key={currentStepIndex}>
            <CurrentStepComponent
              data={data}
              onNext={nextStep}
              onUpdate={updateData}
              onBack={prevStep}
            />
          </div>
        </div>
      </div>

      {/* Reset Button - Always visible */}
      <div className="mt-6 text-center">
        <button
          onClick={() => {
            if (confirm('هل أنت متأكد من حذف جميع البيانات والبدء من جديد؟')) {
              clearSavedData();
            }
          }}
          className="px-6 py-3 text-sm font-bold text-red-500 hover:text-white hover:bg-red-500 border-2 border-red-200 hover:border-red-500 rounded-xl transition-all duration-300 flex items-center gap-2 mx-auto"
        >
          <span>🔄</span>
          <span>البدء من جديد</span>
        </button>
        <p className="text-[10px] text-gray-400 mt-2">
          الخطوة {currentStepIndex + 1} من {steps.length}
        </p>
      </div>
    </main>
  );
}
