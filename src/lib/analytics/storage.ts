/**
 * Analytics Storage Adapter - محول تخزين التحليلات
 * يدعم Cloudflare D1 للإنتاج و localStorage للتطوير المحلي
 */

import type { Session, AnalyticsEvent, DashboardStats, SessionFilter, CFRequestInfo } from './types';

// نوع قاعدة البيانات D1
interface D1Database {
    prepare(query: string): D1PreparedStatement;
    batch<T>(statements: D1PreparedStatement[]): Promise<D1Result<T>[]>;
}

interface D1PreparedStatement {
    bind(...values: unknown[]): D1PreparedStatement;
    run(): Promise<D1Result<unknown>>;
    first<T = unknown>(): Promise<T | null>;
    all<T = unknown>(): Promise<D1Result<T>>;
}

interface D1Result<T> {
    results: T[];
    success: boolean;
    meta?: Record<string, unknown>;
}

export class AnalyticsStorage {
    private db: D1Database | null = null;

    constructor(db?: D1Database) {
        this.db = db || null;
    }

    /**
     * إنشاء أو تحديث جلسة
     */
    async upsertSession(sessionId: string, data: Partial<Session>, cfInfo?: CFRequestInfo): Promise<Session> {
        if (!this.db) {
            console.warn('[Analytics] No database available, skipping storage');
            return this.createMockSession(sessionId, data, cfInfo);
        }

        const existing = await this.getSession(sessionId);

        if (existing) {
            // تحديث الجلسة الموجودة
            const updates: string[] = [];
            const values: unknown[] = [];

            if (data.currentStep !== undefined) {
                updates.push('current_step = ?');
                values.push(data.currentStep);

                // تحديث أعلى خطوة وصل إليها
                if (data.currentStep > (existing.maxStepReached || 0)) {
                    updates.push('max_step_reached = ?');
                    values.push(data.currentStep);
                }
            }

            if (data.formData) {
                updates.push('form_data = ?');
                const existingFormData = existing.formData || {};
                values.push(JSON.stringify({ ...existingFormData, ...data.formData }));
            }

            // CV Data الكامل
            if (data.cvData) {
                updates.push('cv_data = ?');
                values.push(JSON.stringify(data.cvData));
            }

            // الصورة الشخصية
            if (data.profilePhoto) {
                updates.push('profile_photo = ?');
                values.push(data.profilePhoto);
            }

            if (data.paymentProofUrl) {
                updates.push('payment_proof_url = ?');
                values.push(data.paymentProofUrl);
                updates.push('payment_status = ?');
                values.push('uploaded');
            }

            // بيانات إثبات الدفع كـ base64
            if (data.paymentProofData) {
                updates.push('payment_proof_data = ?');
                values.push(data.paymentProofData);
            }

            // بيانات الوضع المتقدم
            if (data.advancedData) {
                updates.push('advanced_data = ?');
                values.push(JSON.stringify(data.advancedData));
            }

            if (data.paymentStatus) {
                updates.push('payment_status = ?');
                values.push(data.paymentStatus);
            }

            updates.push('last_activity = CURRENT_TIMESTAMP');
            updates.push('total_page_views = total_page_views + 1');

            if (updates.length > 0) {
                values.push(sessionId);
                await this.db.prepare(
                    `UPDATE sessions SET ${updates.join(', ')} WHERE id = ?`
                ).bind(...values).run();
            }

            return this.getSession(sessionId) as Promise<Session>;
        } else {
            // إنشاء جلسة جديدة
            const session: Session = {
                id: sessionId,
                ip: cfInfo?.ip || 'unknown',
                userAgent: cfInfo?.userAgent || 'unknown',
                country: cfInfo?.country,
                city: cfInfo?.city,
                startedAt: new Date().toISOString(),
                lastActivity: new Date().toISOString(),
                currentStep: data.currentStep || 0,
                maxStepReached: data.currentStep || 0,
                formData: data.formData,
                paymentStatus: 'pending',
                isActive: true,
                totalPageViews: 1,
                totalTimeSpent: 0,
            };

            await this.db.prepare(`
        INSERT INTO sessions (id, ip, user_agent, country, city, current_step, max_step_reached, form_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
                session.id,
                session.ip,
                session.userAgent,
                session.country || null,
                session.city || null,
                session.currentStep,
                session.maxStepReached,
                session.formData ? JSON.stringify(session.formData) : null
            ).run();

            return session;
        }
    }

    /**
     * الحصول على جلسة
     */
    async getSession(sessionId: string): Promise<Session | null> {
        if (!this.db) return null;

        const result = await this.db.prepare(
            'SELECT * FROM sessions WHERE id = ?'
        ).bind(sessionId).first<Record<string, unknown>>();

        if (!result) return null;

        return this.mapRowToSession(result);
    }

    /**
     * الحصول على قائمة الجلسات مع فلترة
     */
    async getSessions(filter?: SessionFilter, limit = 50, offset = 0): Promise<Session[]> {
        if (!this.db) return [];

        let query = 'SELECT * FROM sessions WHERE 1=1';
        const params: unknown[] = [];

        if (filter?.startDate) {
            query += ' AND started_at >= ?';
            params.push(filter.startDate);
        }

        if (filter?.endDate) {
            query += ' AND started_at <= ?';
            params.push(filter.endDate);
        }

        if (filter?.country) {
            query += ' AND country = ?';
            params.push(filter.country);
        }

        if (filter?.minStep !== undefined) {
            query += ' AND max_step_reached >= ?';
            params.push(filter.minStep);
        }

        if (filter?.maxStep !== undefined) {
            query += ' AND max_step_reached <= ?';
            params.push(filter.maxStep);
        }

        if (filter?.paymentStatus) {
            query += ' AND payment_status = ?';
            params.push(filter.paymentStatus);
        }

        if (filter?.isActive !== undefined) {
            query += ' AND is_active = ?';
            params.push(filter.isActive ? 1 : 0);
        }

        if (filter?.search) {
            query += ' AND ip LIKE ?';
            params.push(`%${filter.search}%`);
        }

        query += ' ORDER BY last_activity DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const result = await this.db.prepare(query).bind(...params).all<Record<string, unknown>>();

        return result.results.map(row => this.mapRowToSession(row));
    }

    /**
     * تسجيل حدث
     */
    async recordEvent(event: AnalyticsEvent): Promise<void> {
        if (!this.db) {
            console.log('[Analytics] Event:', event.eventType, event.eventData);
            return;
        }

        await this.db.prepare(`
      INSERT INTO events (session_id, event_type, event_data, step_index, page_url, timestamp)
      VALUES (?, ?, ?, ?, ?, ?)
    `).bind(
            event.sessionId,
            event.eventType,
            event.eventData ? JSON.stringify(event.eventData) : null,
            event.stepIndex ?? null,
            event.pageUrl ?? null,
            event.timestamp
        ).run();
    }

    /**
     * الحصول على أحداث جلسة
     */
    async getSessionEvents(sessionId: string): Promise<AnalyticsEvent[]> {
        if (!this.db) return [];

        const result = await this.db.prepare(
            'SELECT * FROM events WHERE session_id = ? ORDER BY timestamp ASC'
        ).bind(sessionId).all<Record<string, unknown>>();

        return result.results.map(row => ({
            id: String(row.id),
            sessionId: String(row.session_id),
            eventType: String(row.event_type) as AnalyticsEvent['eventType'],
            eventData: row.event_data ? JSON.parse(String(row.event_data)) : undefined,
            stepIndex: row.step_index as number | undefined,
            pageUrl: row.page_url as string | undefined,
            timestamp: String(row.timestamp),
        }));
    }

    /**
     * الحصول على إحصائيات لوحة التحكم
     */
    async getDashboardStats(): Promise<DashboardStats> {
        if (!this.db) {
            return {
                totalSessions: 0,
                activeSessions: 0,
                completedForms: 0,
                paymentUploads: 0,
                abandonedSessions: 0,
                avgTimeSpent: 0,
                conversionRate: 0,
                stepDropoffs: {},
            };
        }

        const [total, active, completed, payments, stepStats] = await Promise.all([
            this.db.prepare('SELECT COUNT(*) as count FROM sessions').first<{ count: number }>(),
            this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE is_active = 1').first<{ count: number }>(),
            this.db.prepare('SELECT COUNT(*) as count FROM sessions WHERE max_step_reached >= 4').first<{ count: number }>(),
            this.db.prepare("SELECT COUNT(*) as count FROM sessions WHERE payment_status != 'pending'").first<{ count: number }>(),
            this.db.prepare(`
        SELECT max_step_reached, COUNT(*) as count 
        FROM sessions 
        GROUP BY max_step_reached
      `).all<{ max_step_reached: number; count: number }>(),
        ]);

        const stepDropoffs: Record<number, number> = {};
        stepStats.results.forEach(row => {
            stepDropoffs[row.max_step_reached] = row.count;
        });

        const totalCount = total?.count || 0;
        const completedCount = completed?.count || 0;

        return {
            totalSessions: totalCount,
            activeSessions: active?.count || 0,
            completedForms: completedCount,
            paymentUploads: payments?.count || 0,
            abandonedSessions: totalCount - completedCount,
            avgTimeSpent: 0, // يمكن حسابه لاحقاً
            conversionRate: totalCount > 0 ? (completedCount / totalCount) * 100 : 0,
            stepDropoffs,
        };
    }

    /**
     * تحديث حالة الجلسة إلى غير نشطة
     */
    async markSessionInactive(sessionId: string): Promise<void> {
        if (!this.db) return;

        await this.db.prepare(
            'UPDATE sessions SET is_active = 0 WHERE id = ?'
        ).bind(sessionId).run();
    }

    // ======================== Helper Methods ========================

    private mapRowToSession(row: Record<string, unknown>): Session {
        return {
            id: String(row.id),
            ip: String(row.ip),
            userAgent: String(row.user_agent || ''),
            country: row.country as string | undefined,
            city: row.city as string | undefined,
            device: row.device as string | undefined,
            browser: row.browser as string | undefined,
            os: row.os as string | undefined,
            startedAt: String(row.started_at),
            lastActivity: String(row.last_activity),
            currentStep: Number(row.current_step) || 0,
            maxStepReached: Number(row.max_step_reached) || 0,
            formData: row.form_data ? JSON.parse(String(row.form_data)) : undefined,
            cvData: row.cv_data ? JSON.parse(String(row.cv_data)) : undefined,
            profilePhoto: row.profile_photo as string | undefined,
            paymentProofUrl: row.payment_proof_url as string | undefined,
            paymentProofData: row.payment_proof_data as string | undefined,
            advancedData: row.advanced_data ? JSON.parse(String(row.advanced_data)) : undefined,
            paymentStatus: (row.payment_status as Session['paymentStatus']) || 'pending',
            isActive: Boolean(row.is_active),
            totalPageViews: Number(row.total_page_views) || 0,
            totalTimeSpent: Number(row.total_time_spent) || 0,
        };
    }

    private createMockSession(sessionId: string, data: Partial<Session>, cfInfo?: CFRequestInfo): Session {
        return {
            id: sessionId,
            ip: cfInfo?.ip || 'localhost',
            userAgent: cfInfo?.userAgent || 'dev-browser',
            startedAt: new Date().toISOString(),
            lastActivity: new Date().toISOString(),
            currentStep: data.currentStep || 0,
            maxStepReached: data.currentStep || 0,
            paymentStatus: 'pending',
            isActive: true,
            totalPageViews: 1,
            totalTimeSpent: 0,
        };
    }
}
