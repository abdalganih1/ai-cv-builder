"use client";

interface ProgressBarProps {
    current: number;
    total: number;
}

export default function ProgressBar({ current, total }: ProgressBarProps) {
    const percentage = Math.round((current / (total - 1)) * 100);

    return (
        <div className="w-full h-2 bg-gray-100 relative overflow-hidden">
            <div
                className="h-full bg-accent transition-all duration-500 ease-out shadow-[0_0_10px_rgba(8,145,178,0.5)]"
                style={{ width: `${percentage}%` }}
            />
        </div>
    );
}
