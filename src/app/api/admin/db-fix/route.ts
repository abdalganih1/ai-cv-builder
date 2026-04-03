import { NextRequest, NextResponse } from 'next/server';
import { getRequestContext } from '@cloudflare/next-on-pages';

export const runtime = 'edge';

// Secret endpoint to fix D1 database schema automatically
export async function GET(request: NextRequest) {
    try {
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

        const queries = [
            // Fix sessions table
            "ALTER TABLE sessions ADD COLUMN cv_data JSON;",
            "ALTER TABLE sessions ADD COLUMN profile_photo TEXT;",
            "ALTER TABLE sessions ADD COLUMN payment_proof_data TEXT;",
            "ALTER TABLE sessions ADD COLUMN advanced_data JSON;",
            "ALTER TABLE sessions ADD COLUMN max_step_reached INTEGER DEFAULT 0;",
            "ALTER TABLE sessions ADD COLUMN form_data JSON;",
            
            // Fix payment_settings table
            "ALTER TABLE payment_settings ADD COLUMN price_usd REAL DEFAULT 5;",
            "ALTER TABLE payment_settings ADD COLUMN price_syp INTEGER DEFAULT 50000;",
            "ALTER TABLE payment_settings ADD COLUMN payment_language TEXT DEFAULT 'both';",
            "ALTER TABLE payment_settings ADD COLUMN default_payment_image INTEGER DEFAULT 1;"
        ];

        const results = [];
        for (const query of queries) {
            try {
                await db.prepare(query).run();
                results.push({ query, status: 'success' });
            } catch (error: any) {
                // It will fail if column already exists, which is fine
                results.push({ query, status: 'skipped or error', message: error.message });
            }
        }

        return NextResponse.json({ 
            success: true, 
            message: 'Database schema migration check completed.', 
            results 
        });
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message });
    }
}
