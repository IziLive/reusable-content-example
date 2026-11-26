# Custom project extensions

This directory contains project-owned extensions, separate from the Payload and Next.js foundation.

- `styles/custom.css`: additional frontend styles; imported by the frontend layout.
- `scripts/`: browser scripts and integrations (for example, analytics). Add an integration component here when it is implemented, then mount it only in the frontend layout.
- `components/`: reusable project-owned frontend components when they can be separated cleanly.

Keep framework configuration, Payload collection/block definitions, hooks, API routes, and editor feature registration in their expected application locations. They may import code from this directory where appropriate; do not move them solely to centralize files.

Before adding client-side Payload editor components, update and verify `src/app/(payload)/admin/importMap.js`.
