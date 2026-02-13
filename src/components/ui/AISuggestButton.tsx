'use client';

import { useState, useEffect } from 'react';

interface AISuggestButtonProps {
    fieldType: string;
    context?: string;
    currentValue: string;
    onSelect: (value: string) => void;
}

export default function AISuggestButton({ fieldType, context, currentValue, onSelect }: AISuggestButtonProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    // Auto-fetch suggestions on mount
    useEffect(() => {
        fetchSuggestions();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Only run once on mount

    const fetchSuggestions = async () => {
        setLoading(true);
        setError(false);

        try {
            const res = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fieldType, context, currentValue }),
            });

            if (!res.ok) {
                throw new Error('Failed to fetch');
            }

            const data = await res.json();
            setSuggestions(data.suggestions || []);
        } catch (err) {
            console.error('Suggestions error:', err);
            setError(true);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (value: string) => {
        onSelect(value);
        // Don't clear suggestions - keep them visible
    };

    // Don't render if loading or error
    if (loading) {
        return (
            <div className="ai-suggest-container">
                <div className="ai-suggest-loading">
                    <span className="ai-suggest-spinner" />
                    <span className="text-xs text-gray-500">جاري تحميل الاقتراحات...</span>
                </div>
                {/* Styles */}
                <style jsx>{`
                    .ai-suggest-container {
                        margin-top: 12px;
                        direction: rtl;
                    }
                    .ai-suggest-loading {
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        padding: 8px;
                    }
                    .ai-suggest-spinner {
                        display: inline-block;
                        width: 16px;
                        height: 16px;
                        border: 2px solid #e5e7eb;
                        border-top-color: #6366f1;
                        border-radius: 50%;
                        animation: spin 0.6s linear infinite;
                    }
                    @keyframes spin {
                        to { transform: rotate(360deg); }
                    }
                `}</style>
            </div>
        );
    }

    if (error || suggestions.length === 0) {
        return null; // Don't show anything if error or no suggestions
    }

    return (
        <div className="ai-suggest-container">
            <div className="ai-suggest-label">💡 اقتراحات ذكية:</div>
            <div className="ai-suggest-chips">
                {suggestions.map((suggestion, idx) => (
                    <button
                        key={idx}
                        type="button"
                        onClick={() => handleSelect(suggestion)}
                        className="ai-suggest-chip"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>

            {/* Scoped Styles */}
            <style jsx>{`
                .ai-suggest-container {
                    margin-top: 12px;
                    direction: rtl;
                }
                .ai-suggest-label {
                    font-size: 13px;
                    font-weight: 600;
                    color: #6366f1;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 4px;
                }
                .ai-suggest-chips {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }
                .ai-suggest-chip {
                    display: inline-flex;
                    align-items: center;
                    padding: 8px 14px;
                    font-size: 14px;
                    font-weight: 500;
                    color: #4f46e5;
                    background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
                    border: 1.5px solid #c7d2fe;
                    border-radius: 20px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }
                .ai-suggest-chip:hover {
                    background: linear-gradient(135deg, #c7d2fe 0%, #a5b4fc 100%);
                    border-color: #818cf8;
                    color: #3730a3;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 8px rgba(99, 102, 241, 0.15);
                }
                .ai-suggest-chip:active {
                    transform: translateY(0);
                    box-shadow: 0 1px 2px rgba(99, 102, 241, 0.1);
                }
            `}</style>
        </div>
    );
}
