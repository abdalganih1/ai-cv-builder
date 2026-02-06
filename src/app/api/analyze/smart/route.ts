/**
 * Smart Analysis API - تحليل ذكي لمصادر متعددة
 * يدعم: روابط، ملفات PDF، نص إضافي
 * مع اكتشاف تلقائي للنوع (بيانات شخصية vs وظيفة شاغرة)
 */

import { NextRequest, NextResponse } from 'next/server';

// Helper to fetch and analyze URL content
async function analyzeUrl(url: string, type: 'personal' | 'job' | 'unknown') {
    try {
        // Try to fetch the URL content
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; CVBuilder/1.0)',
            },
            signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
            console.warn(`Failed to fetch ${url}: ${response.status}`);
            return null;
        }

        const contentType = response.headers.get('content-type') || '';

        // Handle PDF from URL (like Google Drive)
        if (contentType.includes('application/pdf')) {
            const buffer = await response.arrayBuffer();
            // Process PDF content
            return {
                type: type !== 'unknown' ? type : 'personal',
                content: 'PDF content from URL',
                url,
            };
        }

        // Handle HTML/text content
        const text = await response.text();

        return {
            type: type !== 'unknown' ? type : detectContentType(text),
            content: text.slice(0, 10000), // Limit content size
            url,
        };

    } catch (error) {
        console.error(`Error analyzing URL ${url}:`, error);
        return null;
    }
}

// Detect if content is about a job or personal info
function detectContentType(content: string): 'personal' | 'job' {
    const jobKeywords = [
        'vacancy', 'وظيفة', 'شاغر', 'مطلوب', 'hiring', 'job description',
        'requirements', 'متطلبات', 'qualifications', 'مؤهلات', 'apply now',
        'تقدم الآن', 'salary', 'راتب', 'experience required', 'خبرة مطلوبة'
    ];

    const lowerContent = content.toLowerCase();
    let jobScore = 0;

    for (const keyword of jobKeywords) {
        if (lowerContent.includes(keyword.toLowerCase())) {
            jobScore++;
        }
    }

    return jobScore >= 3 ? 'job' : 'personal';
}

// Merge extracted data from multiple sources
function mergePersonalData(sources: Array<{ data: Record<string, unknown>; type: string }>) {
    const merged: Record<string, unknown> = {};

    for (const source of sources) {
        if (source.type === 'personal' && source.data) {
            // Deep merge personal data
            Object.assign(merged, source.data);
        }
    }

    return merged;
}

// Extract job profile from job sources
function extractJobProfile(sources: Array<{ data: Record<string, unknown>; type: string }>) {
    const jobSources = sources.filter(s => s.type === 'job');

    if (jobSources.length === 0) return null;

    // Combine job information
    return {
        title: 'الوظيفة المستهدفة',
        requirements: [],
        description: '',
        ...jobSources[0].data,
    };
}

export async function POST(request: NextRequest) {
    try {
        const formData = await request.formData();

        // Parse URLs
        const urlsJson = formData.get('urls');
        const urls = urlsJson ? JSON.parse(urlsJson as string) : [];

        // Get additional text
        const additionalText = formData.get('additionalText') as string || '';

        // Collect all sources
        const analyzedSources: Array<{ data: Record<string, unknown>; type: string }> = [];

        // Analyze URLs
        for (const urlItem of urls) {
            const result = await analyzeUrl(urlItem.url, urlItem.type || 'unknown');
            if (result) {
                analyzedSources.push({
                    data: { content: result.content, url: result.url },
                    type: result.type,
                });
            }
        }

        // Analyze PDF files
        const fileKeys = Array.from(formData.keys()).filter(k => k.startsWith('file_') && !k.endsWith('_type'));

        for (const key of fileKeys) {
            const file = formData.get(key) as File;
            const typeKey = `${key}_type`;
            const fileType = formData.get(typeKey) as string || 'unknown';

            if (file) {
                try {
                    // Use existing PDF analyzer
                    const pdfFormData = new FormData();
                    pdfFormData.append('file', file);

                    const pdfResponse = await fetch(`${request.nextUrl.origin}/api/analyze/pdf`, {
                        method: 'POST',
                        body: pdfFormData,
                    });

                    if (pdfResponse.ok) {
                        const pdfResult = await pdfResponse.json();
                        analyzedSources.push({
                            data: pdfResult.cvData || {},
                            type: fileType !== 'unknown' ? fileType : 'personal',
                        });
                    }
                } catch (error) {
                    console.error(`Error analyzing PDF ${file.name}:`, error);
                }
            }
        }

        // Analyze additional text
        if (additionalText.trim()) {
            const textType = detectContentType(additionalText);
            analyzedSources.push({
                data: { rawText: additionalText },
                type: textType,
            });
        }

        // Merge all personal data
        const cvData = mergePersonalData(analyzedSources);

        // Extract job profile if any job sources
        const jobProfile = extractJobProfile(analyzedSources);

        // Create default structure if empty
        const finalCvData = {
            personal: {
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                location: '',
                ...(cvData.personal || {}),
            },
            summary: cvData.summary || '',
            experience: cvData.experience || [],
            education: cvData.education || [],
            skills: cvData.skills || [],
            languages: cvData.languages || [],
            ...cvData,
        };

        return NextResponse.json({
            success: true,
            cvData: finalCvData,
            jobProfile,
            sourcesAnalyzed: analyzedSources.length,
            message: `تم تحليل ${analyzedSources.length} مصدر بنجاح`,
        });

    } catch (error) {
        console.error('Smart analysis error:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'فشل في تحليل المصادر',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        );
    }
}
