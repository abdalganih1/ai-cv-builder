"use client";

import { useState, useEffect } from 'react';

interface AnalysisProgressProps {
    estimatedDuration?: number; // in seconds, default 70
    onComplete?: () => void;
}

const STATUS_MESSAGES = [
    { min: 0, max: 10, text: "جاري التفكير...", icon: "🤔" },
    { min: 10, max: 30, text: "جاري تحليل السيرة الذاتية...", icon: "📄" },
    { min: 30, max: 50, text: "جاري استخراج الخبرات العملية...", icon: "💼" },
    { min: 50, max: 70, text: "جاري تحليل المهارات...", icon: "⚙️" },
    { min: 70, max: 90, text: "جاري تحسين قسم التعليم...", icon: "🎓" },
    { min: 90, max: 100, text: "جاري إنهاء التحليل...", icon: "✨" },
];

export default function AnalysisProgress({
    estimatedDuration = 70,
    onComplete
}: AnalysisProgressProps) {
    const [progress, setProgress] = useState(0);
    const [currentMessage, setCurrentMessage] = useState(STATUS_MESSAGES[0]);
    const [elapsedTime, setElapsedTime] = useState(0);

    useEffect(() => {
        // Calculate progress increment per 100ms to reach 100% in estimatedDuration
        const totalIntervals = (estimatedDuration * 1000) / 100; // Number of 100ms intervals
        const incrementPerInterval = 100 / totalIntervals;

        const interval = setInterval(() => {
            setProgress(prev => {
                const newProgress = Math.min(prev + incrementPerInterval, 99.5); // Cap at 99.5% until actual completion

                // Update message based on progress
                const message = STATUS_MESSAGES.find(
                    msg => newProgress >= msg.min && newProgress < msg.max
                );
                if (message && message !== currentMessage) {
                    setCurrentMessage(message);
                }

                return newProgress;
            });

            setElapsedTime(prev => prev + 0.1); // Increment by 0.1 seconds
        }, 100);

        return () => clearInterval(interval);
    }, [estimatedDuration, currentMessage]);

    // Calculate time remaining
    const timeRemaining = Math.max(0, estimatedDuration - elapsedTime);
    const minutes = Math.floor(timeRemaining / 60);
    const seconds = Math.floor(timeRemaining % 60);

    return (
        <div className="w-full max-w-2xl mx-auto space-y-6 py-8">
            {/* Status Message */}
            <div className="text-center space-y-3">
                <div className="text-6xl animate-bounce">
                    {currentMessage.icon}
                </div>
                <h2 className="text-2xl font-bold text-gray-800 animate-pulse">
                    {currentMessage.text}
                </h2>
                <p className="text-gray-500 text-sm">
                    الوقت المتبقي: {minutes > 0 && `${minutes} دقيقة و`} {seconds} ثانية
                </p>
            </div>

            {/* Progress Bar */}
            <div className="space-y-2">
                <div className="relative w-full h-4 bg-gray-100 rounded-full overflow-hidden shadow-inner">
                    {/* Animated gradient background */}
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 animate-pulse"
                        style={{
                            width: `${progress}%`,
                            transition: 'width 0.3s ease-out'
                        }}
                    />
                    {/* Shimmer effect */}
                    <div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-shimmer"
                        style={{
                            width: `${progress}%`,
                            animation: 'shimmer 2s infinite'
                        }}
                    />
                </div>

                {/* Progress Percentage */}
                <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600 font-bold">
                        {Math.floor(progress)}%
                    </span>
                    <span className="text-gray-400">
                        جاري العمل بجد...
                    </span>
                </div>
            </div>

            {/* Fun Loading Messages */}
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl text-blue-700 text-sm text-center">
                <p className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⚡</span>
                    <span>الذكاء الاصطناعي يعمل على تحليل بياناتك بدقة عالية</span>
                </p>
            </div>

            {/* Loading Dots Animation */}
            <div className="flex justify-center gap-2">
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <div className="w-3 h-3 bg-primary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>

            <style jsx>{`
                @keyframes shimmer {
                    0% {
                        transform: translateX(-100%);
                    }
                    100% {
                        transform: translateX(100%);
                    }
                }
                .animate-shimmer {
                    animation: shimmer 2s infinite;
                }
            `}</style>
        </div>
    );
}
