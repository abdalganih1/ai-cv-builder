'use client';

/**
 * VoiceRecorder - مكون التسجيل الصوتي
 * يستخدم Web Speech API أو Gemini للتحويل من صوت إلى نص
 * يدعم العربية والإنجليزية
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ======================== Types ========================

interface VoiceRecorderProps {
    onTranscript: (text: string) => void;
    language?: 'ar' | 'en' | 'ar-SA' | 'en-US';
    className?: string;
    placeholder?: string;
    disabled?: boolean;
    useGemini?: boolean; // استخدام Gemini API بدل Web Speech
}

type RecordingState = 'idle' | 'recording' | 'processing' | 'error';

// ======================== Web Speech API Types ========================

interface SpeechRecognitionEvent extends Event {
    results: SpeechRecognitionResultList;
    resultIndex: number;
}

interface SpeechRecognitionErrorEvent extends Event {
    error: string;
    message?: string;
}

interface SpeechRecognitionResultList {
    readonly length: number;
    item(index: number): SpeechRecognitionResult;
    [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
    readonly length: number;
    item(index: number): SpeechRecognitionAlternative;
    [index: number]: SpeechRecognitionAlternative;
    isFinal: boolean;
}

interface SpeechRecognitionAlternative {
    transcript: string;
    confidence: number;
}

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    maxAlternatives: number;
    start(): void;
    stop(): void;
    abort(): void;
    onstart: ((this: SpeechRecognition, ev: Event) => void) | null;
    onend: ((this: SpeechRecognition, ev: Event) => void) | null;
    onerror: ((this: SpeechRecognition, ev: SpeechRecognitionErrorEvent) => void) | null;
    onresult: ((this: SpeechRecognition, ev: SpeechRecognitionEvent) => void) | null;
}

declare global {
    interface Window {
        SpeechRecognition: new () => SpeechRecognition;
        webkitSpeechRecognition: new () => SpeechRecognition;
    }
}

// ======================== Main Component ========================

export default function VoiceRecorder({
    onTranscript,
    language = 'ar',
    className = '',
    placeholder = 'اضغط للتسجيل',
    disabled = false,
    useGemini = false,
}: VoiceRecorderProps) {
    const [state, setState] = useState<RecordingState>('idle');
    const [transcript, setTranscript] = useState('');
    const [isSupported, setIsSupported] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');

    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Map language codes
    const getLangCode = useCallback(() => {
        if (language === 'ar' || language === 'ar-SA') return 'ar-SA';
        if (language === 'en' || language === 'en-US') return 'en-US';
        return language;
    }, [language]);

    // ======================== Web Speech API ========================

    useEffect(() => {
        // Check for browser support
        const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognitionAPI && !useGemini) {
            setIsSupported(false);
            return;
        }

        if (!useGemini && SpeechRecognitionAPI) {
            const recognition = new SpeechRecognitionAPI();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = getLangCode();
            recognition.maxAlternatives = 1;

            recognition.onstart = () => {
                setState('recording');
                setTranscript('');
                setErrorMessage('');
            };

            recognition.onend = () => {
                if (state === 'recording') {
                    setState('idle');
                }
            };

            recognition.onerror = (event) => {
                console.error('[VoiceRecorder] Error:', event.error);
                setState('error');

                switch (event.error) {
                    case 'no-speech':
                        setErrorMessage('لم يتم اكتشاف صوت');
                        break;
                    case 'audio-capture':
                        setErrorMessage('لا يوجد ميكروفون');
                        break;
                    case 'not-allowed':
                        setErrorMessage('الميكروفون غير مسموح');
                        break;
                    default:
                        setErrorMessage(`خطأ: ${event.error}`);
                }
            };

            recognition.onresult = (event) => {
                let finalTranscript = '';
                let interimTranscript = '';

                for (let i = event.resultIndex; i < event.results.length; i++) {
                    const result = event.results[i];
                    if (result.isFinal) {
                        finalTranscript += result[0].transcript;
                    } else {
                        interimTranscript += result[0].transcript;
                    }
                }

                if (finalTranscript) {
                    setTranscript(prev => prev + finalTranscript);
                    onTranscript(finalTranscript);
                } else {
                    setTranscript(interimTranscript);
                }
            };

            recognitionRef.current = recognition;
        }

        return () => {
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.abort();
                } catch {
                    // Ignore
                }
            }
        };
    }, [getLangCode, onTranscript, state, useGemini]);

    // ======================== Gemini Recording (for future use) ========================

    const startGeminiRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const mediaRecorder = new MediaRecorder(stream);
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                setState('processing');
                const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });

                try {
                    // Send to Gemini API for transcription
                    const formData = new FormData();
                    formData.append('audio', audioBlob);
                    formData.append('language', getLangCode());

                    const response = await fetch('/api/ai/transcribe', {
                        method: 'POST',
                        body: formData,
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.transcript) {
                            onTranscript(data.transcript);
                            setTranscript(data.transcript);
                        }
                    } else {
                        throw new Error('Transcription failed');
                    }
                } catch (error) {
                    console.error('[VoiceRecorder] Gemini error:', error);
                    setErrorMessage('فشل في تحويل الصوت');
                    setState('error');
                } finally {
                    setState('idle');
                    stream.getTracks().forEach(track => track.stop());
                }
            };

            mediaRecorderRef.current = mediaRecorder;
            mediaRecorder.start();
            setState('recording');
        } catch (error) {
            console.error('[VoiceRecorder] Mic access error:', error);
            setErrorMessage('لا يمكن الوصول للميكروفون');
            setState('error');
        }
    };

    const stopGeminiRecording = () => {
        if (mediaRecorderRef.current && state === 'recording') {
            mediaRecorderRef.current.stop();
        }
    };

    // ======================== Controls ========================

    const startRecording = () => {
        if (disabled) return;

        setErrorMessage('');

        if (useGemini) {
            startGeminiRecording();
        } else if (recognitionRef.current) {
            try {
                recognitionRef.current.start();
            } catch (error) {
                console.error('[VoiceRecorder] Start error:', error);
            }
        }
    };

    const stopRecording = () => {
        if (useGemini) {
            stopGeminiRecording();
        } else if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
                setState('idle');
            } catch (error) {
                console.error('[VoiceRecorder] Stop error:', error);
            }
        }
    };

    const toggleRecording = () => {
        if (state === 'recording') {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // ======================== UI ========================

    if (!isSupported) {
        return (
            <button
                type="button"
                disabled
                className={`p-2 rounded-lg bg-gray-100 text-gray-400 cursor-not-allowed ${className}`}
                title="المتصفح لا يدعم التسجيل الصوتي"
            >
                🎤❌
            </button>
        );
    }

    return (
        <div className={`relative inline-flex items-center ${className}`}>
            {/* Main Button */}
            <motion.button
                type="button"
                onClick={toggleRecording}
                disabled={disabled || state === 'processing'}
                whileTap={{ scale: 0.95 }}
                className={`
                    relative p-3 rounded-full transition-all duration-300 shadow-md
                    ${state === 'recording'
                        ? 'bg-red-500 text-white animate-pulse shadow-red-500/50'
                        : state === 'processing'
                            ? 'bg-yellow-500 text-white'
                            : state === 'error'
                                ? 'bg-red-100 text-red-500'
                                : 'bg-gradient-to-br from-blue-500 to-indigo-500 text-white hover:shadow-lg hover:shadow-blue-500/30'
                    }
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                title={
                    state === 'recording' ? 'إيقاف التسجيل'
                        : state === 'processing' ? 'جاري المعالجة...'
                            : placeholder
                }
            >
                {/* Icon */}
                {state === 'recording' ? (
                    <span className="text-xl">⏹️</span>
                ) : state === 'processing' ? (
                    <motion.span
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        className="text-xl inline-block"
                    >
                        ⏳
                    </motion.span>
                ) : (
                    <span className="text-xl">🎤</span>
                )}

                {/* Recording pulse indicator */}
                {state === 'recording' && (
                    <motion.span
                        initial={{ scale: 1, opacity: 0.5 }}
                        animate={{ scale: 1.5, opacity: 0 }}
                        transition={{ duration: 1, repeat: Infinity }}
                        className="absolute inset-0 rounded-full bg-red-500"
                    />
                )}
            </motion.button>

            {/* Live transcript preview */}
            <AnimatePresence>
                {state === 'recording' && transcript && (
                    <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        className="absolute right-full mr-2 bg-white px-3 py-2 rounded-lg shadow-lg border text-sm text-gray-700 max-w-xs truncate"
                        dir="rtl"
                    >
                        {transcript.length > 50 ? `...${transcript.slice(-50)}` : transcript}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Error tooltip */}
            <AnimatePresence>
                {state === 'error' && errorMessage && (
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="absolute top-full mt-2 right-0 bg-red-50 text-red-600 text-xs px-3 py-2 rounded-lg shadow border border-red-200 whitespace-nowrap"
                    >
                        {errorMessage}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
