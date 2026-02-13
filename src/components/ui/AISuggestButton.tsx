'use client';

import React, { useState } from 'react';

interface AISuggestButtonProps {
    fieldType: string;
    context?: string;
    currentValue?: string;
    onSelect: (value: string) => void;
}

export default function AISuggestButton({ fieldType, context, currentValue, onSelect }: AISuggestButtonProps) {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [error, setError] = useState(false);

    const fetchSuggestions = async () => {
        if (loading) return;

        // If suggestions are already shown, toggle them off
        if (showSuggestions && suggestions.length > 0) {
            setShowSuggestions(false);
            return;
        }

        setLoading(true);
        setError(false);
        setSuggestions([]);
        setShowSuggestions(true);

        try {
            const res = await fetch('/api/ai/suggest', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fieldType, context, currentValue }),
            });

            if (!res.ok) throw new Error('Request failed');

            const data = await res.json();
            if (data.suggestions && data.suggestions.length > 0) {
                setSuggestions(data.suggestions);
            } else {
                setError(true);
                setTimeout(() => setShowSuggestions(false), 2000);
            }
        } catch {
            setError(true);
            setTimeout(() => setShowSuggestions(false), 2000);
        } finally {
            setLoading(false);
        }
    };

    const handleSelect = (value: string) => {
        onSelect(value);
        setShowSuggestions(false);
        setSuggestions([]);
    };

    return (
        <div className="ai-suggest-container">
            {/* Trigger Button */}
            <button
                type="button"
                onClick={fetchSuggestions}
                disabled={loading}
                className="ai-suggest-btn"
                title="اقتراحات ذكية"
            >
                {loading ? (
                    <span className="ai-suggest-spinner" />
                ) : (
                    <>💡 اقتراحات</>
                )}
            </button>

            {/* Suggestions Dropdown */}
            {showSuggestions && (
                <div className="ai-suggest-dropdown">
                    {loading && (
                        <div className="ai-suggest-loading">
                            <span className="ai-suggest-spinner" />
                            <span>جارِ التحميل...</span>
                        </div>
                    )}

                    {error && (
                        <div className="ai-suggest-error">
                            لم نتمكّن من الحصول على اقتراحات
                        </div>
                    )}

                    {suggestions.length > 0 && (
                        <div className="ai-suggest-list">
                            {suggestions.map((s, i) => (
                                <button
                                    key={i}
                                    type="button"
                                    className="ai-suggest-chip"
                                    onClick={() => handleSelect(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Scoped Styles */}
            <style jsx>{`
                .ai-suggest-container {
                    position: relative;
                    display: inline-block;
                    margin-top: 8px;
                }

                .ai-suggest-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 4px;
                    padding: 6px 14px;
                    border: 1px solid rgba(99, 102, 241, 0.3);
                    border-radius: 20px;
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(168, 85, 247, 0.08));
                    color: #6366f1;
                    font-size: 13px;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    white-space: nowrap;
                }

                .ai-suggest-btn:hover:not(:disabled) {
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(168, 85, 247, 0.15));
                    border-color: rgba(99, 102, 241, 0.5);
                    transform: translateY(-1px);
                    box-shadow: 0 2px 8px rgba(99, 102, 241, 0.2);
                }

                .ai-suggest-btn:disabled {
                    opacity: 0.6;
                    cursor: wait;
                }

                .ai-suggest-spinner {
                    display: inline-block;
                    width: 14px;
                    height: 14px;
                    border: 2px solid rgba(99, 102, 241, 0.3);
                    border-top-color: #6366f1;
                    border-radius: 50%;
                    animation: ai-spin 0.6s linear infinite;
                }

                @keyframes ai-spin {
                    to { transform: rotate(360deg); }
                }

                .ai-suggest-dropdown {
                    position: absolute;
                    top: calc(100% + 6px);
                    right: 0;
                    z-index: 50;
                    min-width: 250px;
                    max-width: 400px;
                    background: white;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    border-radius: 12px;
                    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
                    padding: 8px;
                    animation: ai-fade-in 0.2s ease;
                }

                @keyframes ai-fade-in {
                    from { opacity: 0; transform: translateY(-4px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .ai-suggest-loading {
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    padding: 12px;
                    color: #6366f1;
                    font-size: 13px;
                }

                .ai-suggest-error {
                    padding: 12px;
                    text-align: center;
                    color: #ef4444;
                    font-size: 13px;
                }

                .ai-suggest-list {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 6px;
                }

                .ai-suggest-chip {
                    display: inline-flex;
                    align-items: center;
                    padding: 6px 12px;
                    border: 1px solid rgba(99, 102, 241, 0.2);
                    border-radius: 16px;
                    background: rgba(99, 102, 241, 0.05);
                    color: #374151;
                    font-size: 13px;
                    cursor: pointer;
                    transition: all 0.15s ease;
                    text-align: right;
                    line-height: 1.4;
                }

                .ai-suggest-chip:hover {
                    background: rgba(99, 102, 241, 0.12);
                    border-color: rgba(99, 102, 241, 0.4);
                    color: #4f46e5;
                    transform: scale(1.02);
                }
            `}</style>
        </div>
    );
}
