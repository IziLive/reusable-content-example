# Frontend scripts

Place project-owned browser integrations here (for example, Yandex Metrica).

Mount integrations from `src/app/(frontend)/layout.tsx` only, so they do not load in the Payload admin panel. Use Next.js `Script` with an appropriate loading strategy. Keep site-specific identifiers in environment variables when practical.

No analytics integration is enabled yet.
