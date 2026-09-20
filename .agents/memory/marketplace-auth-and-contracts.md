---
name: Marketplace auth and contracts
description: Durable implementation choices for full-stack marketplace builds in this workspace.
---

Public discovery intentionally remains usable without an account, while provider creation/editing and admin review require Clerk session authentication enforced in the API. The browser uses Clerk cookies rather than manually managed bearer tokens.

**Why:** Customers need to browse before committing to sign in, but ownership and moderation must never rely on client-only checks.

**How to apply:** Keep public read routes separate from provider/admin mutations, and derive the signed-in identity on the server.

OpenAPI is the contract boundary for the FixFinder API. Generated React Query hooks are the frontend integration surface, and every request body is named after its entity rather than its operation.

**Why:** This avoids drift between the frontend and Express routes and prevents Orval schema export collisions.

**How to apply:** Change `lib/api-spec/openapi.yaml` first, rerun codegen, then build route handlers and UI against generated types.