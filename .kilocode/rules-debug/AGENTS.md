# Debug Mode Rules

## Non-Obvious Debugging Patterns

- **AI API Issues**: Check `ZAI_API_KEY` environment variable first - returns 503 with Arabic error message if missing
- **Rate Limiting**: API routes have in-memory rate limiting (10 req/min per client) - check `x-forwarded-for` header
- **Stream Timeouts**: AI client has 120s timeout - check console for "⏰ Stream timeout" warnings
- **Analytics Storage**: Falls back to localStorage when D1 database unavailable - check browser console for "[Analytics]" logs
- **State Sync Issues**: CV data syncs to localStorage (`cv_builder_data`) then server - check network tab for `/api/sessions/save` calls
- **Edge Runtime**: API routes must use `export const runtime = 'edge'` - Cloudflare deployment fails without it
