@AGENTS.md
# Line OpenChat Access Request

## Tech Stack
- Next.js (App Router) + TypeScript (strict) + Tailwind CSS
- Node 22 LTS (or newer) + pnpm
- PostgreSQL + Drizzle ORM
- Zod (validation) + React Hook Form
- Vitest + Playwright
- Docker Compose (Postgres 16 + Mailpit)

## Commands
- `pnpm dev`: Start dev server
- `pnpm build`: Build production bundle
- `pnpm test`: Run unit tests
- `pnpm e2e`: Run Playwright tests
- `pnpm lint`: Lint code
- `pnpm typecheck`: Run TypeScript compiler check
- `pnpm db:up`: Start local DB and Mailpit
- `pnpm db:down`: Stop local containers
- `pnpm db:generate`: Generate Drizzle migrations
- `pnpm db:migrate`: Run DB migrations
- `pnpm db:seed`: Seed the DB

## Rules
- **Process:** Work in PR-sized phases. After every phase: run lint, typecheck, tests, and compare screenshots against the design (1440px only). Use Conventional Commits. Log architectural decisions in `docs/DECISIONS.md`.
- **Language & Spec:** English-only UI. The `./design/` folder is read-only SPEC; NEVER import code from it directly.
- **Privacy & Security:** 
  - NO phone number mentions anywhere.
  - The OpenChat link is NEVER shown on the public success page (email only).
  - Branch lookup MUST return masked data.
  - Strictly NO PII in logs.
- **Data:** Never commit secrets or real personal data. Use fixture data in `fixtures/` ONLY (e.g. branch codes 1234, 5678, 2468).
- **Architecture:** Interfaces for external things: `EmailSender`, `InviteLinkBuilder`, `StorageProvider`, `AuthProvider`.
- **Other:** Adhere to WCAG 2.1 AA accessibility. Ask before choosing paid/lock-in infrastructure.
