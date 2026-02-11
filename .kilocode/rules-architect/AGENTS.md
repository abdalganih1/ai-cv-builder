# Architect Mode Rules

## Non-Obvious Architectural Constraints

- **Edge Runtime Required**: All API routes MUST use `export const runtime = 'edge'` - Cloudflare Pages deployment depends on it
- **State Management**: No external state library - uses React useState with localStorage persistence and server sync
- **Analytics Provider Pattern**: Must wrap components with `AnalyticsProvider` - returns no-op outside provider context
- **AI API Base URL**: `https://api.z.ai/api/coding/paas/v4` - not OpenAI-compatible endpoint
- **Database Dual Mode**: D1 in production, localStorage in development - storage layer abstracts this in [`src/lib/analytics/storage.ts`](src/lib/analytics/storage.ts)
- **PDF Generation**: Uses `@react-pdf/renderer` - see [`src/components/preview/PDFDocument.tsx`](src/components/preview/PDFDocument.tsx)
- **Payment Flow**: ShamCash payment integration - proof upload to `/api/upload-proof`
