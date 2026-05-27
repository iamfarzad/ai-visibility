# Changelog

## 2026-05-28 — Slice 0: Monorepo Scaffold + Database Schema [COMPLETE]
- Created repo https://github.com/iamfarzad/ai-visibility
- Scaffoled monorepo: apps/web, apps/api, apps/worker, packages/{db,types,policies}
- Turp + pnpm workspaces configured
- Drizzle ORM with full schema (5 planes, 14 tables)
- Next.js dashboard bootstrap at apps/web (home, dashboard, findings, handoffs)
- Fastify API scaffold at apps/api
- Cloud Tasks worker at apps/worker (idempotent job handlers)
- SAFE_ACTION_POLICY engine at packages/policies
- Smoke test: pnpm install → typecheck → build → push → verified on GitHub

## TODO — Upcoming Slices
- Cloud Tasks queue provisioned (GCP)
- Worker handler for at-least-once idempotent job processing
- Smoke test: job enqueue → execute → ack verified

## TODO — Upcoming
- Slice 2: GSC ingestion + finding normalization (Track A dogfood on farzadbayat.com)
- Slice 3: PageSpeed ingestion + PSI adapter
- Slice 4: Gemini planner + structured handoff generation
- Slice 5: SAFE_ACTION_POLICY engine + approval UI
- Slice 6: GitHub draft PR execution + Vercel preview verification
- Slice 7: Track B prompt pack framework (NorGEO-style ontology)
- Slice 8: Billing integration (Stripe self-serve)
- Slice 9: Landing page, onboarding, trial flow
- Slice 10: Dogfood on own site + hardening

## Architecture Decision Log (ADL)
| ADL-001 | Turbo instead of Nx | Simpler, lower cognitive overhead, fast enough for solo founder |
| ADL-002 | Drizzle ORM over Prisma | Zero runtime, smaller bundle, no separate generate step |
| ADL-003 | Fastify over Express | Better plugin system, built-in validation hooks, faster |
| ADL-004 | Neon over Cloud SQL (dev) | Branching per PR, Vercel integration, lower friction |
| ADL-005 | pnpm workspaces over npm/yarn lerna | Standard for 2026, better disk dedup, faster install |
