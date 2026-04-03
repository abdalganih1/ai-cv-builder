import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// رمز المصادقة — يجب تعيينه كـ environment variable في Cloudflare Pages
const ADMIN_TOKEN = process.env.ADMIN_SECRET || 'X9kF2mPq7vR4wL8sT3nB6jY0hA5dC1eG';

/**
 * Database Schema Fix & Migration Endpoint
 * محمي بـ Cloudflare Zero Trust + رمز مصادقة
 * GET /api/admin/db-fix?token=<ADMIN_TOKEN>
 */
export async function GET(request: NextRequest) {
    try {
        // ===== التحقق من المصادقة =====
        const cfAccessJWT = request.headers.get('cf-access-jwt-assertion');
        const cookies = request.headers.get('cookie') || '';
        const isLocalDev = process.env.NODE_ENV === 'development';
        const secretToken = request.nextUrl.searchParams.get('token');

        // يجب توفر إحدى طرق المصادقة: CF Access، أو Token سري، أو بيئة تطوير محلية
        const isAuthorized = isLocalDev
            || cfAccessJWT
            || cookies.includes('CF_Authorization')
            || secretToken === ADMIN_TOKEN;

        if (!isAuthorized) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized — provide ?token= or use CF Access' },
                { status: 401 }
            );
        }

        // ===== الاتصال بقاعدة البيانات =====
        let db: any = undefined;
        try {
            const { env } = getRequestContext();
            db = env.ANALYTICS_DB || undefined;
        } catch {
            console.log('[Admin D1 Fix] No Cloudflare context available');
        }

        if (!db) {
            return NextResponse.json({ success: false, error: 'Analytics DB not connected' });
        }

        // ===== المرحلة 1: إنشاء الجداول إذا لم تكن موجودة =====
        const createTableQueries = [
            `CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                ip TEXT NOT NULL,
                user_agent TEXT,
                country TEXT,
                city TEXT,
                device TEXT,
                browser TEXT,
                os TEXT,
                started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
                current_step INTEGER DEFAULT 0,
                max_step_reached INTEGER DEFAULT 0,
                form_data JSON,
                cv_data JSON,
                profile_photo TEXT,
                payment_proof_url TEXT,
                payment_proof_data TEXT,
                advanced_data JSON,
                payment_status TEXT DEFAULT 'pending',
                is_active BOOLEAN DEFAULT 1,
                total_page_views INTEGER DEFAULT 0,
                total_time_spent INTEGER DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                session_id TEXT NOT NULL,
                event_type TEXT NOT NULL,
                event_data JSON,
                step_index INTEGER,
                page_url TEXT,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (session_id) REFERENCES sessions(id)
            )`,
            `CREATE TABLE IF NOT EXISTS daily_stats (
                date DATE PRIMARY KEY,
                total_sessions INTEGER DEFAULT 0,
                completed_forms INTEGER DEFAULT 0,
                payment_uploads INTEGER DEFAULT 0,
                abandoned_sessions INTEGER DEFAULT 0,
                avg_time_spent INTEGER DEFAULT 0,
                step_0_views INTEGER DEFAULT 0,
                step_1_views INTEGER DEFAULT 0,
                step_2_views INTEGER DEFAULT 0,
                step_3_views INTEGER DEFAULT 0,
                step_4_views INTEGER DEFAULT 0
            )`,
            `CREATE TABLE IF NOT EXISTS payment_settings (
                id INTEGER PRIMARY KEY DEFAULT 1,
                qr_image_url TEXT DEFAULT '/sham-cash-qr.png',
                recipient_name TEXT,
                recipient_code TEXT,
                amount INTEGER DEFAULT 500,
                currency TEXT DEFAULT 'ل.س',
                payment_type TEXT DEFAULT 'mandatory',
                price_usd REAL DEFAULT 5,
                price_syp INTEGER DEFAULT 50000,
                payment_language TEXT DEFAULT 'both',
                default_payment_image INTEGER DEFAULT 1,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )`,
        ];

        // ===== المرحلة 2: إضافة أعمدة ناقصة (ستفشل بصمت إذا موجودة مسبقاً) =====
        const alterQueries = [
            "ALTER TABLE sessions ADD COLUMN cv_data JSON;",
            "ALTER TABLE sessions ADD COLUMN profile_photo TEXT;",
            "ALTER TABLE sessions ADD COLUMN payment_proof_data TEXT;",
            "ALTER TABLE sessions ADD COLUMN advanced_data JSON;",
            "ALTER TABLE sessions ADD COLUMN max_step_reached INTEGER DEFAULT 0;",
            "ALTER TABLE sessions ADD COLUMN form_data JSON;",
            "ALTER TABLE payment_settings ADD COLUMN price_usd REAL DEFAULT 5;",
            "ALTER TABLE payment_settings ADD COLUMN price_syp INTEGER DEFAULT 50000;",
            "ALTER TABLE payment_settings ADD COLUMN payment_language TEXT DEFAULT 'both';",
            "ALTER TABLE payment_settings ADD COLUMN default_payment_image INTEGER DEFAULT 1;",
        ];

        // ===== المرحلة 3: إدخال القيم الافتراضية =====
        const seedQueries = [
            "INSERT OR IGNORE INTO payment_settings (id) VALUES (1)",
        ];

        // ===== المرحلة 4: الفهارس =====
        const indexQueries = [
            "CREATE INDEX IF NOT EXISTS idx_sessions_started_at ON sessions(started_at);",
            "CREATE INDEX IF NOT EXISTS idx_sessions_is_active ON sessions(is_active);",
            "CREATE INDEX IF NOT EXISTS idx_sessions_payment_status ON sessions(payment_status);",
            "CREATE INDEX IF NOT EXISTS idx_sessions_country ON sessions(country);",
            "CREATE INDEX IF NOT EXISTS idx_events_session_id ON events(session_id);",
            "CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);",
            "CREATE INDEX IF NOT EXISTS idx_events_event_type ON events(event_type);",
        ];

        const allQueries = [
            ...createTableQueries.map(q => ({ query: q, phase: 'create_tables' })),
            ...alterQueries.map(q => ({ query: q, phase: 'alter_columns' })),
            ...seedQueries.map(q => ({ query: q, phase: 'seed_data' })),
            ...indexQueries.map(q => ({ query: q, phase: 'indexes' })),
        ];

        const results = [];
        let successCount = 0;
        let skippedCount = 0;

        for (const { query, phase } of allQueries) {
            try {
                await db.prepare(query).run();
                results.push({ phase, status: '✅ success', query: query.substring(0, 60) + '...' });
                successCount++;
            } catch (error: any) {
                // ALTER TABLE يفشل إذا العمود موجود مسبقاً — هذا طبيعي
                results.push({
                    phase,
                    status: '⏭️ skipped (already exists)',
                    query: query.substring(0, 60) + '...',
                    message: error.message?.substring(0, 100),
                });
                skippedCount++;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Migration completed: ${successCount} applied, ${skippedCount} skipped.`,
            results,
        });
    } catch (error: any) {
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
