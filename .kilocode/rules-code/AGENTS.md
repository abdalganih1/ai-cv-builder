# Code Mode Rules

## Non-Obvious Coding Patterns

- **API Routes**: All routes in `src/app/api/` MUST include `export const runtime = 'edge'` for Cloudflare Pages compatibility
- **AI Client**: Use [`src/lib/ai/zai-client.ts`](src/lib/ai/zai-client.ts) for AI calls - includes SSE stream parsing with 120s timeout and retry logic
- **Analytics**: Wrap components with `AnalyticsProvider` from [`src/lib/analytics/provider.tsx`](src/lib/analytics/provider.tsx) - returns no-op if outside provider
- **CV Types**: Import from [`src/lib/types/cv-schema.ts`](src/lib/types/cv-schema.ts) - `CVData` interface is the central type
- **Tests**: Vitest config includes `**/*.test.{ts,tsx}` - place test files alongside source files, not in separate folders
- **State Persistence**: CV data auto-syncs to localStorage (key: `cv_builder_data`) and server via `/api/sessions/save`
