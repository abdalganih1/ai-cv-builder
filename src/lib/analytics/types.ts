/**
 * Analytics Types - تعريفات أنواع التحليلات
 */

// أنواع الأحداث المتتبعة
export type EventType =
    | 'page_view'           // دخول الصفحة
    | 'step_view'           // دخول خطوة
    | 'step_complete'       // إكمال خطوة
    | 'form_field_fill'     // ملء حقل
    | 'button_click'        // نقر زر
    | 'file_upload'         // رفع ملف
    | 'pdf_upload'          // رفع PDF
    | 'payment_proof_upload'// رفع إثبات دفع
    | 'tab_visible'         // المتصفح في الواجهة
    | 'tab_hidden'          // المتصفح في الخلفية
    | 'page_exit'           // مغادرة الصفحة
    | 'session_start'       // بدء الجلسة
    | 'session_end'         // انتهاء الجلسة
    | 'error';              // خطأ

// حدث تحليلي فردي
export interface AnalyticsEvent {
    id?: string;
    sessionId: string;
    eventType: EventType;
    eventData?: Record<string, unknown>;
    timestamp: string;
    stepIndex?: number;
    pageUrl?: string;
}

// جلسة مستخدم
export interface Session {
    id: string;
    ip: string;
    userAgent: string;
    country?: string;
    city?: string;
    device?: string;
    browser?: string;
    os?: string;
    startedAt: string;
    lastActivity: string;
    currentStep: number;
    maxStepReached: number;
    formData?: Record<string, unknown>;
    paymentProofUrl?: string;
    paymentStatus: 'pending' | 'uploaded' | 'verified' | 'rejected';
    isActive: boolean;
    totalPageViews: number;
    totalTimeSpent: number; // بالثواني
}

// إحصائيات عامة
export interface DashboardStats {
    totalSessions: number;
    activeSessions: number;
    completedForms: number;
    paymentUploads: number;
    abandonedSessions: number;
    avgTimeSpent: number;
    conversionRate: number;
    stepDropoffs: Record<number, number>;
}

// فلترة الجلسات
export interface SessionFilter {
    startDate?: string;
    endDate?: string;
    country?: string;
    minStep?: number;
    maxStep?: number;
    paymentStatus?: Session['paymentStatus'];
    isActive?: boolean;
    search?: string; // للبحث بالـ IP
}

// طلب تتبع من الـ client
export interface TrackRequest {
    sessionId?: string;
    eventType: EventType;
    eventData?: Record<string, unknown>;
    stepIndex?: number;
    pageUrl?: string;
    formData?: Record<string, unknown>;
}

// استجابة API
export interface TrackResponse {
    success: boolean;
    sessionId: string;
    message?: string;
}

// تفاصيل Cloudflare
export interface CFRequestInfo {
    ip: string;
    country?: string;
    city?: string;
    userAgent: string;
    cfRay?: string;
}
