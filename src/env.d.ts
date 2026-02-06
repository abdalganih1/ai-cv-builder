/**
 * Cloudflare Environment Types
 * أنواع بيئة Cloudflare للـ D1 bindings
 */

// Define the D1 types
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

// Extend the CloudflareEnv interface
declare global {
    interface CloudflareEnv {
        ANALYTICS_DB: D1Database;
    }
}

export { };
