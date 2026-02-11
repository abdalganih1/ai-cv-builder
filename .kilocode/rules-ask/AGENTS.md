# Ask Mode Rules

## Non-Obvious Documentation Context

- **Arabic-First UI**: All user-facing text is in Arabic with RTL layout - check existing components for Arabic text patterns
- **Wizard Flow**: 5 steps defined in [`src/app/page.tsx`](src/app/page.tsx) - Welcome → Contact → Questionnaire → Payment → Preview
- **CV Data Structure**: Central schema in [`src/lib/types/cv-schema.ts`](src/lib/types/cv-schema.ts) - `CVData` interface with personal, education, experience, skills, hobbies, languages, metadata
- **AI Integration**: Uses z.ai API (not OpenAI) - see [`src/lib/ai/zai-client.ts`](src/lib/ai/zai-client.ts) for client-side streaming
- **Analytics System**: D1 database in production, localStorage fallback - schema in [`src/lib/analytics/schema.sql`](src/lib/analytics/schema.sql)
- **Admin Panel**: Separate routes under `/panel` for session management and analytics
